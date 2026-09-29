import { Textarea } from "@/components/ui/textarea";
import { ProSlider } from "@/components/ProSlider";

const ALIGNS = ["left", "center", "right"];

export function TextPanel({ config, update }) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">
          Testo · usa <span className="text-emerald-400">;</span> per andare a capo
        </label>
        <Textarea
          data-testid="text-input-field"
          value={config.text}
          onChange={(e) => update({ text: e.target.value })}
          rows={3}
          spellCheck={false}
          className="resize-none border-zinc-700 bg-zinc-900/80 font-mono text-sm text-zinc-100 focus-visible:ring-emerald-500/40"
          placeholder="FEDERICO;BLU"
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">Maiuscolo</span>
        <button
          data-testid="uppercase-toggle"
          onClick={() => update({ uppercase: !config.uppercase })}
          className={`rounded px-3 py-1 font-mono text-[11px] transition-all ${
            config.uppercase
              ? "border border-emerald-500/50 bg-emerald-500/20 text-emerald-400"
              : "border border-zinc-700 bg-zinc-800 text-zinc-300"
          }`}
        >
          {config.uppercase ? "ON" : "OFF"}
        </button>
      </div>

      <div className="space-y-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">Allineamento</span>
        <div className="grid grid-cols-3 gap-2">
          {ALIGNS.map((a) => (
            <button
              key={a}
              data-testid={`align-${a}-button`}
              onClick={() => update({ align: a })}
              className={`rounded px-2 py-1.5 font-mono text-[11px] uppercase transition-all ${
                config.align === a
                  ? "border border-emerald-500/50 bg-emerald-500/20 text-emerald-400"
                  : "border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      <ProSlider label="Dimensione" testId="font-scale-slider" value={config.fontScale} min={0.2} max={3} step={0.01} reset={1} onChange={(v) => update({ fontScale: v })} unit="x" />
      <ProSlider label="Spaziatura lettere" testId="letter-spacing-slider" value={config.letterSpacing} min={-20} max={100} step={1} reset={0} onChange={(v) => update({ letterSpacing: v })} />
      <ProSlider label="Altezza riga" testId="line-height-slider" value={config.lineHeight} min={0.6} max={2} step={0.01} reset={0.92} onChange={(v) => update({ lineHeight: v })} />

      <div className="grid grid-cols-2 gap-3 pt-1">
        <ColorField label="Testo" testId="text-color-picker" value={config.textColor} onChange={(v) => update({ textColor: v })} />
        <ColorField label="Sfondo" testId="bg-color-picker" value={config.bgColor} onChange={(v) => update({ bgColor: v })} />
      </div>

      <ProSlider label="Bagliore / Glow" testId="glow-slider" value={config.glow} min={0} max={60} step={1} reset={0} onChange={(v) => update({ glow: v })} unit="px" />
      <ProSlider label="Opacità" testId="opacity-slider" value={config.opacity} min={0} max={1} step={0.01} reset={1} onChange={(v) => update({ opacity: v })} />
    </div>
  );
}

function ColorField({ label, value, onChange, testId }) {
  return (
    <div className="space-y-1.5">
      <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">{label}</span>
      <div className="flex items-center gap-2 rounded border border-zinc-700 bg-zinc-900/80 px-2 py-1.5">
        <input
          type="color"
          data-testid={testId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
        />
        <span className="font-mono text-[11px] uppercase text-zinc-300">{value}</span>
      </div>
    </div>
  );
}
