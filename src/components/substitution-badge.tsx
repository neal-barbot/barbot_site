import { m } from '@/paraglide/messages.js';
import { cn } from '@/lib/utils';

/** Substitution verdict tag assigned by the compare pipeline. */
export function SubstitutionBadge({
  level,
  className,
}: {
  level: string | null | undefined;
  className?: string;
}) {
  if (!level) return null;

  const styles: Record<string, string> = {
    pin2pin: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    functional: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
    non_pin2pin: 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400',
  };
  const labels: Record<string, () => string> = {
    pin2pin: m['compare.verdict.pin2pin'],
    functional: m['compare.verdict.functional'],
    non_pin2pin: m['compare.verdict.non_pin2pin'],
  };
  if (!styles[level]) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        styles[level],
        className
      )}
    >
      {labels[level]()}
    </span>
  );
}
