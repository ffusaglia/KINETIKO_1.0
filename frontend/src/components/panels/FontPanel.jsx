import { useRef, useState } from "react";
import { Upload, Search } from "lucide-react";
import { GOOGLE_FONTS } from "@/lib/render";

export function FontPanel({ config, update, customFonts, onUploadFont }) {
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");

  const all = [...customFonts, ...GOOGLE_FONTS];
  const filtered = all.filter((f) => f.toLowerCase().includes(query.toLowerCase()));

  const handleFiles = async (files) => {
    for (const file of Array.from(files)) {
      const family = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9 ]/g, " ").trim() || "Custom Font";
      const buf = await file.arrayBuffer();
      const face = new FontFace(family, buf);
      await face.load();
      document.fonts.add(face);
      onUploadFont(family);
      update({ font: family });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded border border-zinc-700 bg-zinc-900/80 px-3 py-2">
        <Search className="h-3.5 w-3.5 text-zinc-500" />
        <input
          data-testid="font-search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca font…"
          className="w-full bg-transparent font-mono text-xs text-zinc-200 outline-none placeholder:text-zinc-600"
        />
      </div>

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
        data-testid="font-dropzone"
        className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-700 bg-zinc-900/50 py-4 transition-all hover:border-emerald-500/50 hover:bg-emerald-500/5"
      >
        <Upload className="h-4 w-4 text-zinc-500" />
        <span className="font-mono text-[11px] text-zinc-400">Carica font personalizzato (.ttf/.otf/.woff2)</span>
        <input ref={inputRef} type="file" accept=".ttf,.otf,.woff,.woff2" multiple hidden data-testid="font-file-input" onChange={(e) => handleFiles(e.target.files)} />
      </div>

      <div className="grid max-h-[46vh] grid-cols-1 gap-2 overflow-y-auto pr-1">
        {filtered.map((f) => (
          <button
            key={f}
            data-testid={`font-option-${f.replace(/\s+/g, "-").toLowerCase()}`}
            onClick={() => update({ font: f })}
            className={`flex items-center justify-between rounded border px-3 py-2.5 text-left transition-all ${
              config.font === f ? "border-emerald-500/50 bg-emerald-500/10" : "border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800"
            }`}
          >
            <span className="truncate text-lg text-zinc-100" style={{ fontFamily: `"${f}", sans-serif` }}>{f}</span>
            {customFonts.includes(f) && (
              <span className="ml-2 shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[9px] uppercase text-zinc-400">custom</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
