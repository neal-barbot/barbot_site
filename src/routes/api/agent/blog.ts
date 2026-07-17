import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { respData, respErr } from '@/lib/resp';
import { enforceMinIntervalRateLimit } from '@/lib/rate-limit';
import { envConfigs } from '@/config';
import { resolveUserId } from '@/modules/apikeys/auth';
import { persistBlogImage } from '@/modules/posts/agent-media';
import {
  create as createPost,
  update as updatePost,
  findBySlug,
  listByAuthor,
} from '@/modules/posts/service';

/**
 * Agent-facing blog API. Lets a local Claude Code / Codex agent create or
 * update blog articles (with images) using an API key — no UI maintenance.
 *
 *   POST /api/agent/blog   upsert an article by slug (JSON, inline base64 images)
 *   GET  /api/agent/blog   list this key owner's articles
 *
 * Auth: `Authorization: Bearer <api key>` (create one at /settings/apikeys).
 *
 * Images are inlined as base64 so a single request carries the whole post:
 * - `cover` → the article's cover image
 * - `images[]` each has a `ref`; reference it in markdown as `![alt](ref)`
 *   (or `![alt](ref:the-ref)`) and it's rewritten to the uploaded URL.
 */

const imageSchema = z.object({
  data: z.string().min(1), // base64 or data: URL
  mime: z.string().min(1),
});

const bodySchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9-]+$/, 'slug must be lowercase letters, digits, and dashes'),
  title: z.string().min(1).max(255),
  description: z.string().max(500).optional(),
  content: z.string().min(1), // markdown
  status: z.enum(['draft', 'published']).default('published'),
  categories: z.string().max(255).optional(),
  authorName: z.string().max(120).optional(),
  cover: imageSchema.optional(),
  images: z.array(imageSchema.extend({ ref: z.string().min(1).max(60) })).max(20).optional(),
});

/** Replace `](ref)` and `](ref:REF)` occurrences with the uploaded URL. */
function rewriteRefs(content: string, refMap: Map<string, string>): string {
  let out = content;
  for (const [ref, url] of refMap) {
    const escaped = ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out
      .replace(new RegExp(`\\]\\(ref:${escaped}\\)`, 'g'), `](${url})`)
      .replace(new RegExp(`\\]\\(${escaped}\\)`, 'g'), `](${url})`);
  }
  return out;
}

async function POST({ request }: { request: Request }) {
  const limited = enforceMinIntervalRateLimit(request, {
    intervalMs: 1000,
    keyPrefix: 'agent-blog',
  });
  if (limited) return limited;

  const userId = await resolveUserId(request);
  if (!userId) return respErr('Unauthorized');

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return respErr(parsed.error.issues[0]?.message || 'Invalid body');
  const input = parsed.data;

  try {
    // Ownership guard: if the slug exists, only its author may overwrite it.
    const existing = await findBySlug(input.slug);
    if (existing && existing.userId !== userId) {
      return respErr('Slug already used by another author');
    }

    // Upload images and rewrite content references.
    let content = input.content;
    if (input.images?.length) {
      const refMap = new Map<string, string>();
      for (const img of input.images) {
        const url = await persistBlogImage({ data: img.data, mime: img.mime });
        refMap.set(img.ref, url);
      }
      content = rewriteRefs(content, refMap);
    }

    const image = input.cover
      ? await persistBlogImage({ data: input.cover.data, mime: input.cover.mime })
      : undefined;

    const fields = {
      title: input.title,
      description: input.description,
      content,
      status: input.status,
      categories: input.categories,
      authorName: input.authorName,
      ...(image ? { image } : {}),
    };

    const post = existing
      ? await updatePost(existing.id, fields)
      : await createPost({ userId, slug: input.slug, ...fields });

    const base = envConfigs.app_url || new URL(request.url).origin;
    return respData({
      id: post.id,
      slug: post.slug,
      status: post.status,
      updated: !!existing,
      url: `${base}/blog/${post.slug}`,
    });
  } catch (error) {
    console.error('Agent blog upsert failed:', error);
    return respErr(error instanceof Error ? error.message : 'Blog upsert failed');
  }
}

async function GET({ request }: { request: Request }) {
  const userId = await resolveUserId(request);
  if (!userId) return respErr('Unauthorized');
  const items = await listByAuthor(userId);
  return respData({ items });
}

export const Route = createFileRoute('/api/agent/blog')({
  server: { handlers: { GET, POST } },
});
