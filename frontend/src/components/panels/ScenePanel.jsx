import { useEffect, useState } from "react";
import { Save, Trash2, Play, Download } from "lucide-react";
import { toast } from "sonner";
import { listScenes, createScene, deleteScene, sanitizeConfig } from "@/lib/api";

export function ScenePanel({ config, applyScene, scenesRef }) {
  const [scenes, setScenes] = useState([]);
  const [name, setName] = useState("");

  const refresh = () =>
    listScenes()
      .then((data) => {
        setScenes(data);
        if (scenesRef) scenesRef.current = data;
      })
      .catch(() => {});
  useEffect(() => { refresh(); }, []);

  const save = async () => {
    const n = name.trim() || `Scene ${scenes.length + 1}`;
    try {
      await createScene(n, config);
      setName("");
      toast.success(`Scena "${n}" salvata`);
      refresh();
    } catch {
      toast.error("Errore nel salvataggio");
    }
  };

  const remove = async (id, e) => {
    e.stopPropagation();
    await deleteScene(id);
    refresh();
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(sanitizeConfig(config), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vj-scene.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          data-testid="scene-name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome scena…"
          className="w-full rounded border border-zinc-700 bg-zinc-900/80 px-3 py-2 font-mono text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-emerald-500/50"
        />
        <button
          data-testid="scene-save-button"
          onClick={save}
          className="flex items-center gap-1.5 rounded border border-emerald-500/50 bg-emerald-500/20 px-3 py-2 font-mono text-[11px] text-emerald-400 transition-all hover:bg-emerald-500/30 active:scale-95"
        >
          <Save className="h-3.5 w-3.5" /> Salva
        </button>
      </div>

      <p className="font-mono text-[11px] text-zinc-500">
        Premi <span className="text-emerald-400">1–6</span> per richiamare le prime scene dal vivo.
      </p>

      <div className="space-y-2">
        {scenes.map((s, i) => (
          <div
            key={s.id}
            onClick={() => applyScene(s.config)}
            data-testid={`scene-item-${i}`}
            className="flex cursor-pointer items-center justify-between rounded border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 transition-all hover:border-zinc-600 hover:bg-zinc-800"
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              {i < 6 && (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-zinc-800 font-mono text-[10px] text-emerald-400">
                  {i + 1}
                </span>
              )}
              <span className="truncate font-mono text-xs text-zinc-200">{s.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Play className="h-3.5 w-3.5 text-zinc-500" />
              <button data-testid={`scene-delete-${i}`} onClick={(e) => remove(s.id, e)} className="text-zinc-500 hover:text-red-400">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
        {scenes.length === 0 && (
          <p className="py-4 text-center font-mono text-[11px] text-zinc-600">Nessuna scena salvata</p>
        )}
      </div>

      <button
        data-testid="scene-export-button"
        onClick={exportJson}
        className="flex w-full items-center justify-center gap-2 rounded border border-zinc-700 bg-zinc-800 py-2 font-mono text-[11px] uppercase tracking-wider text-zinc-300 transition-all hover:bg-zinc-700 active:scale-[0.98]"
      >
        <Download className="h-3.5 w-3.5" /> Esporta JSON
      </button>
    </div>
  );
}
