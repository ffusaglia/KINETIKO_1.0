// Compact pro-style range slider with a value readout and double-click reset.
export function ProSlider({ label, value, min, max, step = 1, onChange, unit = "", reset = 0, testId }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">{label}</span>
        <span
          className="cursor-pointer font-mono text-[11px] tabular-nums text-zinc-200 hover:text-emerald-400"
          title="Double-click per resettare"
          onDoubleClick={() => onChange(reset)}
        >
          {typeof value === "number" ? Number(value.toFixed(2)) : value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        data-testid={testId}
        className="vj-slider w-full"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}
