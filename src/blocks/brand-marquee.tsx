import { Marquee } from "@/components/ui/marquee";

const NAMES = [
  "STMicroelectronics",
  "GigaDevice",
  "Texas Instruments",
  "Analog Devices",
  "NXP",
  "Infineon",
  "WCH",
  "Novosense",
  "Espressif",
  "onsemi",
  "Renesas",
  "Microchip",
];

/** Vendor vocabulary strip under the hero — the catalog speaks their parts. */
export function BrandMarquee() {
  return (
    <section className="relative border-y border-border/60 py-5">
      <Marquee
        pauseOnHover
        className="[--duration:56s] [mask-image:linear-gradient(to_right,transparent,white_12%,white_88%,transparent)]"
      >
        {NAMES.map((name) => (
          <span
            key={name}
            className="mx-6 whitespace-nowrap text-sm tracking-wide text-muted-foreground/70"
          >
            {name}
          </span>
        ))}
      </Marquee>
    </section>
  );
}
