import { useRef } from "react";
import { Upload, Trash2, Film } from "lucide-react";
import { ProSlider } from "@/components/ProSlider";
import { BLEND_MODES } from "@/lib/render";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const MODES = [
  { key: "off", label: "Off" },
  { key: "background", label: "Sfondo" },
  { key: "alternate", label: "Alterna" },
];

export function MediaPanel({ config, updateMedia }) {
  const inputRef = useRef(null);
  const m = config.media;

  const onFiles = (files) => {
    const added = Array.from(files)
      .filter((f) => f.type.startsWith("video") || f.type === "image/gif")
      .map((f) => ({ id: crypto.randomUUID(), name: f.name, url: URL.createObjectURL(f) }));
    if (!added.length) return;
    const clips = [...m.clips, ...added];
    updateMedia({ clips, activeClipId: m.activeClipId || added[0].id, mode: m.mode === "off" ? "background" : m.mode });
  };

  const removeClip = (id) => {
    const clips = m.clips.filter((c) => c.id !== id);
    updateMedia({ clips, activeClipId: m.activeClipId === id ? clips[0]?.id || null : m.activeClipId });
  };

  return (
    <div className="space-y-5">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); onFiles(e.dataTransfer.files); }}
        data-testid="clip-dropzone"
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-700 bg-zinc-900/50 py-6 text-center transition-all hover:border-emerald-500/50 hover:bg-emerald-500/5"
      >
        <Upload className="h-5 w-5 text-zinc-500" />
        <span className="font-mono text-[11px] text-zinc-400">Carica clip video / GIF</span>
        <span className="font-mono text-[10px] text-zinc-600">.mp4 · .webm · .gif</span>
        <input ref={inputRef} type="file" accept="video/*,image/gif" multiple hidden data-testid="clip-file-input" onChange={(e) => onFiles(e.target.files)} />
      </div>

      {m.clips.length > 0 && (
        <div className="space-y-2">
          {m.clips.map((c) => (
            <div
              key={c.id}
              onClick={() => updateMedia({ activeClipId: c.id })}
              data-testid={`clip-item-${c.id}`}
              className={`flex cursor-pointer items-center justify-between rounded border px-3 py-2 transition-all ${
                m.activeClipId === c.id ? "border-emerald-500/50 bg-emerald-500/10" : "border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800"
              }`}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <Film className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                <span className="truncate font-mono text-[11px] text-zinc-300">{c.name}</span>
              </div>
              <button data-testid={`clip-remove-${c.id}`} onClick={(e) => { e.stopPropagation(); removeClip(c.id); }} className="text-zinc-500 hover:text-red-400">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">Modalità</span>
        <div className="grid grid-cols-3 gap-2">
          {MODES.map((mo) => (
            <button
              key={mo.key}
              data-testid={`media-mode-${mo.key}-button`}
              onClick={() => updateMedia({ mode: mo.key })}
              className={`rounded px-2 py-1.5 font-mono text-[11px] transition-all ${
                m.mode === mo.key ? "border border-emerald-500/50 bg-emerald-500/20 text-emerald-400" : "border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              {mo.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">Blend mode</span>
        <Select value={m.blend} onValueChange={(v) => updateMedia({ blend: v })}>
          <SelectTrigger data-testid="blend-mode-select" className="border-zinc-700 bg-zinc-900/80 font-mono text-xs text-zinc-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-zinc-700 bg-zinc-900 text-zinc-200">
            {BLEND_MODES.map((b) => (
              <SelectItem key={b} value={b} className="font-mono text-xs">{b}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ProSlider label="Opacità clip" testId="clip-opacity-slider" value={m.opacity} min={0} max={1} step={0.01} reset={1} onChange={(v) => updateMedia({ opacity: v })} />
      <ProSlider label="Velocità clip" testId="clip-speed-slider" value={m.speed} min={0.1} max={3} step={0.1} reset={1} onChange={(v) => updateMedia({ speed: v })} unit="x" />
      {m.mode === "alternate" && (
        <ProSlider label="Intervallo alternanza" testId="clip-interval-slider" value={m.interval} min={0.5} max={10} step={0.5} reset={4} onChange={(v) => updateMedia({ interval: v })} unit="s" />
      )}
    </div>
  );
}
