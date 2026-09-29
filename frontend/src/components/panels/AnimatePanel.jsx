import { ProSlider } from "@/components/ProSlider";
import { PRESETS } from "@/lib/render";

export function AnimatePanel({ config, updateAnim }) {
  return (
    <div className="space-y-3">
      <p className="font-mono text-[11px] leading-relaxed text-zinc-500">
        Attiva più effetti insieme per animazioni continue. Regola velocità e intensità per ogni effetto.
      </p>
      {PRESETS.map((p) => {
        const a = config.animations[p.key];
        return (
          <div
            key={p.key}
            className={`rounded-lg border p-3 transition-all ${
              a.on ? "border-emerald-500/40 bg-emerald-500/5" : "border-zinc-800 bg-zinc-900/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {a.on && <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500 shadow-[0_0_8px_#10B981]" />}
                <span className="font-mono text-xs uppercase tracking-wider text-zinc-200">{p.label}</span>
              </div>
              <button
                data-testid={`preset-${p.key}-button`}
                onClick={() => updateAnim(p.key, { on: !a.on })}
                className={`rounded px-3 py-1 font-mono text-[11px] transition-all active:scale-95 ${
                  a.on
                    ? "border border-emerald-500/50 bg-emerald-500/20 text-emerald-400"
                    : "border border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                {a.on ? "ON" : "OFF"}
              </button>
            </div>
            {a.on && (
              <div className="mt-3 space-y-3">
                <ProSlider label="Velocità" testId={`${p.key}-speed-slider`} value={a.speed} min={0.1} max={6} step={0.1} reset={1} onChange={(v) => updateAnim(p.key, { speed: v })} unit="x" />
                <ProSlider label="Intensità" testId={`${p.key}-amp-slider`} value={a.amp} min={0.1} max={3} step={0.1} reset={1} onChange={(v) => updateAnim(p.key, { amp: v })} unit="x" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
