import { SiteHeader } from "@/components/site-header";
import { m } from "@/paraglide/messages.js";

export function Header() {
  
  const navLinks = [
    { href: "/chips", label: m["common.nav.chips"]() },
    { href: "/compare", label: m["common.nav.compare"]() },
    { href: "/#features", label: m["landing.nav.features"]() },
    { href: "/pricing", label: m["landing.nav.pricing"]() },
    { href: "/blog", label: m["landing.nav.blog"]() },
  ];

  return <SiteHeader navLinks={navLinks} />;
}
