// Sunset hero background — fully reused from the fumadocs Harvey hero
// (hero-background-demo.tsx): a GrainGradient "sky" plus a dithered sun
// sphere, WebGL via @paper-design/shaders-react. Client-only: the module
// is dynamically imported after a 400ms delay (same as the original) so
// SSR and first paint stay clean, then fades in.

import { useEffect, useState, type ComponentType } from 'react';
import { useTheme } from 'next-themes';

type ShaderMods = {
  GrainGradient: ComponentType<Record<string, unknown>>;
  Dithering: ComponentType<Record<string, unknown>>;
};

export function SunsetShader() {
  const { resolvedTheme } = useTheme();
  const [mods, setMods] = useState<ShaderMods | null>(null);

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      import('@paper-design/shaders-react').then((mod) => {
        if (alive) setMods({ GrainGradient: mod.GrainGradient, Dithering: mod.Dithering });
      });
    }, 400);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  if (!mods) return null;
  const dark = resolvedTheme === 'dark';

  return (
    <>
      <mods.GrainGradient
        className="absolute inset-0 duration-1000 animate-in fade-in"
        colors={
          dark
            ? ['#DF3F00', '#9c2f05', '#7A2A0000'] // dusk: deep sunset oranges
            : ['#fcfc51', '#ffa057', '#7A2A0020'] // daylight sunset: yellow → orange
        }
        colorBack="#00000000"
        softness={1}
        intensity={0.9}
        noise={0.5}
        speed={1}
        shape="corners"
        minPixelRatio={1}
        maxPixelCount={1920 * 1080}
      />
      <mods.Dithering
        width={720}
        height={720}
        colorBack="#00000000"
        colorFront={dark ? '#DF3F00' : '#fa8023'}
        shape="sphere"
        type="4x4"
        scale={0.5}
        size={3}
        speed={0}
        frame={5000 * 120}
        className="absolute duration-500 animate-in fade-in max-lg:bottom-[-50%] max-lg:left-[-200px] lg:right-0 lg:top-[-5%]"
        minPixelRatio={1}
      />
    </>
  );
}
