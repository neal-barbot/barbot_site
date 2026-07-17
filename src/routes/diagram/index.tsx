import { createFileRoute } from '@tanstack/react-router';
import { getLocale } from '@/paraglide/runtime.js';
import { m } from '@/paraglide/messages.js';
import { Header } from '@/blocks/header';
import { Footer } from '@/blocks/footer';
import { EeDiagramPanel } from '@/blocks/ee-diagram-panel';
import { BlockDiagram, type DiagramData } from '@/components/block-diagram';

/** Baked-in sample (the 16-cell BMS master used in the docs/demo). */
const SAMPLE_DIAGRAM: DiagramData = {
  title: 'BMS 主控板功能框图（示例）',
  blocks: [
    { id: 'vin', label: '12V 输入', sub: '车载电源', group: '电源' },
    { id: 'ldo', label: 'LDO (3.3V)', sub: 'AMS1117-3.3', group: '电源' },
    { id: 'battery', label: '16 串电池组', sub: 'B1–B16 采样', group: '模拟前端' },
    { id: 'afe', label: 'ADBMS6816', sub: '电池监测 AFE', group: '模拟前端' },
    { id: 'mcu', label: 'STM32F103C8T6', sub: 'Cortex-M3 主控', group: '主控' },
    { id: 'can', label: 'CAN 收发器', sub: 'TJA1042', group: '通信' },
    { id: 'bus', label: '整车 CAN 总线', sub: '500 kbps', group: '通信' },
  ],
  edges: [
    { from: 'vin', to: 'ldo', label: '12V' },
    { from: 'ldo', to: 'mcu', label: '3.3V' },
    { from: 'ldo', to: 'afe', label: '3.3V' },
    { from: 'battery', to: 'afe', label: '16 串电压' },
    { from: 'afe', to: 'mcu', label: 'isoSPI' },
    { from: 'afe', to: 'mcu', label: 'ALERT', dashed: true },
    { from: 'mcu', to: 'can', label: 'CAN TX/RX' },
    { from: 'can', to: 'bus', label: 'CAN H/L' },
  ],
};

function DiagramPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-4xl px-4 pb-16 pt-10">
          <div className="anim-settle mb-8">
            <h1 className="text-2xl font-bold tracking-tight">
              {m['compare.diagram.page_title']()}
            </h1>
            <p className="mt-1 max-w-2xl text-muted-foreground">
              {m['compare.diagram.page_subtitle']()}
            </p>
          </div>
          <EeDiagramPanel />

          {/* ── Sample outputs ── */}
          <div className="reveal mt-16 space-y-8 border-t border-border pt-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {m['compare.diagram.samples_label']()}
            </p>
            <div>
              <p className="mb-3 text-sm font-medium">{m['compare.diagram.sample_svg_caption']()}</p>
              <BlockDiagram data={SAMPLE_DIAGRAM} />
            </div>
            <div>
              <p className="mb-3 text-sm font-medium">
                {m['compare.diagram.sample_image_caption']()}
              </p>
              <img
                src="/imgs/ee-diagram-sample.jpg"
                alt=""
                loading="lazy"
                className="hover-lift w-full rounded-lg border border-border"
              />
            </div>
            <div>
              <p className="mb-3 text-sm font-medium">
                {m['compare.diagram.sample_coffee_caption']()}
              </p>
              <img
                src="/imgs/ee-diagram-sample-coffee.jpg"
                alt=""
                loading="lazy"
                className="hover-lift w-full rounded-lg border border-border"
              />
            </div>
            <div>
              <p className="mb-3 text-sm font-medium">
                {m['compare.diagram.sample_bio_caption']()}
              </p>
              <img
                src="/imgs/ee-diagram-sample-bio.jpg"
                alt=""
                loading="lazy"
                className="hover-lift w-full rounded-lg border border-border"
              />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export const Route = createFileRoute('/diagram/')({
  loader: () => {
    const locale = getLocale();
    return { title: m['compare.diagram.page_title']({}, { locale }) };
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: loaderData.title }] : [],
  }),
  component: DiagramPage,
});
