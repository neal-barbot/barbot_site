import { tool } from '@openai/agents';
import { z } from 'zod';
import { eq, like, or } from 'drizzle-orm';
import { db } from '@/core/db';
import { chip, pin2pin } from '@/config/db/schema';

/**
 * Read-only chip-catalog tools shared by agent surfaces (chip-compare QA
 * agent, AI FAE answer agent). Safe cross-module import: catalog queries
 * only, no writes, no billing.
 */

function normalizePartNumber(partNumber: string): string {
  return partNumber.trim().toUpperCase().replace(/[\s-]+/g, '');
}

export const searchChipsTool = tool({
  name: 'search_chips',
  description: 'Search the chip catalog by part number, manufacturer, or description keyword.',
  parameters: z.object({ keyword: z.string() }),
  execute: async ({ keyword }) => {
    const norm = normalizePartNumber(keyword);
    const rows = await db()
      .select({
        id: chip.id,
        partNumber: chip.partNumber,
        manufacturer: chip.manufacturer,
        description: chip.description,
      })
      .from(chip)
      .where(
        or(
          like(chip.partNumberNorm, `%${norm}%`),
          like(chip.manufacturer, `%${keyword.trim()}%`),
          like(chip.description, `%${keyword.trim()}%`)
        )
      )
      .limit(10);
    return JSON.stringify(rows);
  },
});

export const chipDetailTool = tool({
  name: 'get_chip_detail',
  description:
    'Get full catalog data for one chip by part number: parameters JSON and pin-to-pin substitutes.',
  parameters: z.object({ partNumber: z.string() }),
  execute: async ({ partNumber }) => {
    const [found] = await db()
      .select()
      .from(chip)
      .where(eq(chip.partNumberNorm, normalizePartNumber(partNumber)))
      .limit(1);
    if (!found) return `Chip not found in catalog: ${partNumber}`;
    const substitutes = await db()
      .select({
        supplier: pin2pin.supplierP2p,
        partNumber: pin2pin.partNumberP2p,
      })
      .from(pin2pin)
      .where(eq(pin2pin.chipId, found.id));
    return JSON.stringify({
      partNumber: found.partNumber,
      manufacturer: found.manufacturer,
      description: found.description,
      parameter: found.parameter,
      substitutes,
    });
  },
});

/**
 * Cheap relevance probe: does the question contain a token that matches a
 * catalog part number? Used by the FAE reply gate so substitution questions
 * reach the tool-calling agent even with zero knowledge-base hits.
 */
export async function questionMentionsCatalogPart(question: string): Promise<boolean> {
  const tokens = [
    ...new Set(
      (question.toUpperCase().match(/[A-Z0-9][A-Z0-9-]{3,29}/g) ?? [])
        .map((token) => token.replace(/[\s-]+/g, ''))
        .filter((token) => /\d/.test(token) && token.length >= 4)
    ),
  ].slice(0, 5);
  if (tokens.length === 0) return false;

  const [row] = await db()
    .select({ id: chip.id })
    .from(chip)
    .where(or(...tokens.map((token) => like(chip.partNumberNorm, `%${token}%`))))
    .limit(1);
  return !!row;
}
