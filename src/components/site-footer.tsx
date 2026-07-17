import { Link } from "@/core/i18n/navigation";
import type { ComponentType, SVGProps } from "react";
import { envConfigs } from "@/config";
import { cn } from "@/lib/utils";
import { LocaleSelector } from "@/components/locale-selector";

export interface FooterColumn {
  title: string;
  /** external: open in a new tab. Off-site (http) hrefs always open in a new tab. */
  links: { label: string; href: string; external?: boolean }[];
}

/** Off-site URLs render as plain <a>; internal paths use the locale-aware Link. */
const isExternalHref = (href: string) => /^https?:\/\//.test(href);

export interface FooterSocial {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  href: string;
  label: string;
}

export function SiteFooter({
  tagline,
  columns,
  socials,
  copyright,
}: {
  tagline?: string;
  columns?: FooterColumn[];
  socials?: FooterSocial[];
  copyright?: string;
}) {
  const year = new Date().getFullYear();

  return (
    <footer className="relative bg-[oklch(0.16_0.018_55)] text-[oklch(0.96_0.01_75)]">
      {/* ember hairline — echoes the sunset hero */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,#fcfc51_25%,#ffa057_55%,#DF3F00_80%,transparent)] opacity-70"
      />
      <div className="mx-auto max-w-7xl px-6 pt-14 pb-6 sm:px-10 sm:pt-16 lg:px-16">
        {tagline && (
          <p className="font-serif italic text-3xl leading-[1.15] tracking-tight text-[oklch(0.96_0.01_75)] sm:text-4xl mb-12 max-w-2xl">
            {tagline}
          </p>
        )}

        {columns && columns.length > 0 && (
          <div
            className={cn(
              "grid gap-x-8 gap-y-10 sm:gap-x-12",
              columns.length <= 3
                ? "grid-cols-2 sm:grid-cols-3"
                : columns.length === 4
                  ? "grid-cols-2 sm:grid-cols-4"
                  : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
            )}
          >
            {columns.map((col) => (
              <div key={col.title} className="space-y-5">
                <p className="text-[13px] font-semibold tracking-wide text-[oklch(0.96_0.01_75)]">
                  {col.title}
                </p>
                <ul className="space-y-2">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      {isExternalHref(link.href) ? (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-[oklch(0.68_0.02_60)] transition-colors hover:text-[oklch(0.96_0.01_75)]"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link
                          href={link.href}
                          target={link.external ? "_blank" : undefined}
                          className="text-sm text-[oklch(0.68_0.02_60)] transition-colors hover:text-[oklch(0.96_0.01_75)]"
                        >
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {/* Socials + language row */}
        <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          {socials && socials.length > 0 ? (
            <div className="flex items-center gap-5">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[oklch(0.78_0.02_60)] transition-colors hover:text-[oklch(0.96_0.01_75)]"
                >
                  <s.icon className="size-[18px]" />
                </a>
              ))}
            </div>
          ) : (
            <div />
          )}
          <LocaleSelector
            variant="pill"
            className="border-[oklch(0.34_0.02_55)] text-[oklch(0.85_0.02_65)] hover:bg-white/5 hover:text-[oklch(0.96_0.01_75)]"
          />
        </div>

        {/* Bottom bar */}
        <div className="mt-6 flex flex-col gap-3 border-t border-[oklch(0.26_0.02_55)] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-[oklch(0.68_0.02_60)]">
            {copyright || `© ${year} ${envConfigs.app_name}. All rights reserved.`}
          </span>
        </div>
      </div>
    </footer>
  );
}
