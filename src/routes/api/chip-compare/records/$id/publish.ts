import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { respData, respErr } from '@/lib/resp';
import { getAuth } from '@/core/auth';
import { getRecord } from '@/modules/chip-compare/service';
import { create as createPost, findBySlug } from '@/modules/posts/service';

const bodySchema = z.object({
  title: z.string().min(1).max(255),
  slug: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, digits, and dashes'),
  description: z.string().max(500).default(''),
  status: z.enum(['draft', 'published']).default('published'),
});

/** Publish an edited comparison report to the blog as an article. */
async function POST({ request, params }: { request: Request; params: { id: string } }) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');

    const record = await getRecord(params.id, session.user.id);
    if (!record) return respErr('Record not found');
    if (!record.result) return respErr('Record has no report to publish');

    const input = bodySchema.parse(await request.json());
    if (await findBySlug(input.slug)) return respErr('Slug already exists');

    const post = await createPost({
      userId: session.user.id,
      slug: input.slug,
      title: input.title,
      description: input.description,
      content: record.result,
      authorName: session.user.name || '',
      status: input.status,
    });
    return respData({ id: post.id, slug: post.slug, status: post.status });
  } catch (error: any) {
    return respErr(error.issues?.[0]?.message || error.message || 'Internal error');
  }
}

export const Route = createFileRoute('/api/chip-compare/records/$id/publish')({
  server: { handlers: { POST } },
});
