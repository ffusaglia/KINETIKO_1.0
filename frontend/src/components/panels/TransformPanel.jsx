import { ProSlider } from "@/components/ProSlider";

export function TransformPanel({ config, update }) {
  return (
    <div className="space-y-5">
      <ProSlider label="Posizione X" testId="pos-x-slider" value={config.posX} min={-100} max={100} step={1} reset={0} onChange={(v) => update({ posX: v })} unit="%" />
      <ProSlider label="Posizione Y" testId="pos-y-slider" value={config.posY} min={-100} max={100} step={1} reset={0} onChange={(v) => update({ posY: v })} unit="%" />
      <div className="my-2 h-px bg-zinc-800" />
      <ProSlider label="Scala" testId="scale-slider" value={config.scale} min={0.1} max={3} step={0.01} reset={1} onChange={(v) => update({ scale: v })} unit="x" />
      <ProSlider label="Stretch X" testId="stretch-x-slider" value={config.stretchX} min={0.2} max={4} step={0.01} reset={1} onChange={(v) => update({ stretchX: v })} unit="x" />
      <ProSlider label="Stretch Y" testId="stretch-y-slider" value={config.stretchY} min={0.2} max={4} step={0.01} reset={1} onChange={(v) => update({ stretchY: v })} unit="x" />
      <div className="my-2 h-px bg-zinc-800" />
      <ProSlider label="Rotazione" testId="rotation-slider" value={config.rotation} min={-180} max={180} step={1} reset={0} onChange={(v) => update({ rotation: v })} unit="°" />
      <ProSlider label="Skew X" testId="skew-x-slider" value={config.skewX} min={-60} max={60} step={1} reset={0} onChange={(v) => update({ skewX: v })} unit="°" />
      <ProSlider label="Skew Y" testId="skew-y-slider" value={config.skewY} min={-60} max={60} step={1} reset={0} onChange={(v) => update({ skewY: v })} unit="°" />

      <button
        data-testid="reset-transform-button"
        onClick={() =>
          update({
            posX: 0, posY: 0, scale: 1, stretchX: 1, stretchY: 1,
            rotation: 0, skewX: 0, skewY: 0,
          })
        }
        className="w-full rounded border border-zinc-700 bg-zinc-800 py-2 font-mono text-[11px] uppercase tracking-wider text-zinc-300 transition-all hover:bg-zinc-700 active:scale-[0.98]"
      >
        Reset trasformazioni
      </button>
    </div>
  );
}
