import { SiteHeader } from "@/components/site-header";
import { m } from "@/paraglide/messages.js";

export function Header() {
  
  const navLinks = [
    { href: "/products/chip-p2p", label: m["landing.products.chip_p2p.name"]() },
    { href: "/products/ai-fae", label: m["landing.products.ai_fae.name"]() },
    { href: "/pricing", label: m["landing.nav.pricing"]() },
    { href: "/blog", label: m["landing.nav.blog"]() },
  ];

  return <SiteHeader navLinks={navLinks} />;
}
