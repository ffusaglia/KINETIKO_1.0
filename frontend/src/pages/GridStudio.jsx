import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Maximize2, ExternalLink, Shuffle, Play, Pause, Upload, Trash2, Zap } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProSlider } from "@/components/ProSlider";
import GridStage from "@/components/GridStage";
import { ASPECTS } from "@/lib/render";
import { PALETTES, GRID_FONTS, defaultGridConfig, deriveTokens, buildScene } from "@/lib/grid";

export default function GridStudio() {
  const [config, setConfig] = useState(defaultGridConfig);
  const [seed, setSeed] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [fs, setFs] = useState(false);
  const stageWrapRef = useRef(null);
  const channelRef = useRef(null);
  const inputRef = useRef(null);
  const tapRef = useRef([]);

  const update = useCallback((patch) => setConfig((c) => ({ ...c, ...patch })), []);
  const tokens = useMemo(() => deriveTokens(config.text), [config.text]);
  const scene = useMemo(
    () => buildScene(seed, config.count, tokens, config.media.clips),
    [seed, config.count, tokens, config.media.clips]
  );
  const restructure = useCallback(() => setSeed((s) => s + 1), []);

  // Broadcast to pop-out output.
  useEffect(() => {
    if (!channelRef.current) channelRef.current = new BroadcastChannel("vj-grid");
    channelRef.current.postMessage({ type: "scene", scene, config });
  }, [scene, config]);
  useEffect(() => {
    const ch = channelRef.current || new BroadcastChannel("vj-grid");
    channelRef.current = ch;
    const onMsg = (e) => { if (e.data?.type === "request") ch.postMessage({ type: "scene", scene, config }); };
    ch.addEventListener("message", onMsg);
    return () => ch.removeEventListener("message", onMsg);
  }, [scene, config]);

  // BPM beat loop → restructure + optional color flip on the cut.
  useEffect(() => {
    if (!playing) return;
    let beat = 0;
    const id = setInterval(() => {
      beat++;
      if (beat % config.cutEvery === 0) {
        restructure();
        if (config.flipOnCut) setConfig((c) => ({ ...c, invert: !c.invert }));
      }
    }, 60000 / config.bpm);
    return () => clearInterval(id);
  }, [playing, config.bpm, config.cutEvery, config.flipOnCut, restructure]);

  const goFullscreen = () => stageWrapRef.current?.requestFullscreen?.();
  useEffect(() => {
    const onFs = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // Keyboard: space = cut, f = fullscreen, t = tap tempo.
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.code === "Space") { e.preventDefault(); restructure(); if (config.flipOnCut) setConfig((c) => ({ ...c, invert: !c.invert })); }
      if (e.key === "f") goFullscreen();
      if (e.key === "t") tap();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [restructure, config.flipOnCut]);

  const tap = () => {
    const now = performance.now();
    tapRef.current = [...tapRef.current.filter((t) => now - t < 2500), now];
    if (tapRef.current.length >= 2) {
      const arr = tapRef.current;
      const avg = (arr[arr.length - 1] - arr[0]) / (arr.length - 1);
      const bpm = Math.round(60000 / avg);
      if (bpm >= 40 && bpm <= 300) update({ bpm, metaBpm: bpm });
    }
  };

  const onFiles = (files) => {
    const added = Array.from(files)
      .filter((f) => f.type.startsWith("video") || f.type.startsWith("image"))
      .map((f) => ({ id: crypto.randomUUID(), name: f.name, url: URL.createObjectURL(f), kind: f.type.startsWith("video") ? "video" : "image" }));
    if (added.length) update({ media: { clips: [...config.media.clips, ...added] } });
  };
  const removeClip = (id) => update({ media: { clips: config.media.clips.filter((c) => c.id !== id) } });

  const openPopout = () => window.open("/grid-output", "vj-grid-output", "width=1280,height=720");

  return (
    <div className="min-h-screen bg-[#09090B] p-3 text-zinc-100 lg:p-4">
      <Toaster theme="dark" position="top-center" />
      <div className="grid h-[calc(100vh-1.5rem)] grid-cols-1 gap-4 lg:grid-cols-12">
        {/* LEFT */}
        <section className="flex flex-col gap-3 lg:col-span-7 xl:col-span-8">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500 shadow-[0_0_10px_#10B981]" />
              <div className="flex overflow-hidden rounded border border-zinc-700 font-mono text-[11px]">
                <Link to="/" data-testid="mode-kinetic" className="px-3 py-1 text-zinc-400 hover:bg-zinc-800">KINETIC</Link>
                <span data-testid="mode-grid" className="bg-emerald-500/20 px-3 py-1 text-emerald-400">GRID</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button data-testid="grid-fullscreen-button" onClick={goFullscreen} className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 font-mono text-[11px] text-zinc-200 transition-all hover:bg-zinc-700 active:scale-95">
                <Maximize2 className="h-3.5 w-3.5" /> Fullscreen
              </button>
              <button data-testid="grid-popout-button" onClick={openPopout} className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 font-mono text-[11px] text-zinc-200 transition-all hover:bg-zinc-700 active:scale-95">
                <ExternalLink className="h-3.5 w-3.5" /> Pop-out
              </button>
            </div>
          </header>

          <div className="flex flex-wrap items-center gap-1.5">
            {ASPECTS.map((a) => (
              <button key={a.value} data-testid={`grid-aspect-${a.label.replace(":", "-")}`} onClick={() => update({ aspect: a.value })}
                className={`rounded px-2.5 py-1 font-mono text-[11px] transition-all ${config.aspect === a.value ? "border border-emerald-500/50 bg-emerald-500/20 text-emerald-400" : "border border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800"}`}>
                {a.label}
              </button>
            ))}
          </div>

          <div ref={stageWrapRef} className={`relative flex-1 overflow-hidden rounded-lg border border-zinc-800 bg-black ${fs ? "border-none" : ""}`}>
            <GridStage scene={scene} config={config} clean={fs} />
          </div>
        </section>

        {/* RIGHT */}
        <aside className="flex min-h-0 flex-col overflow-y-auto rounded-lg border border-zinc-800 bg-[#121215] p-4 lg:col-span-5 xl:col-span-4">
          <div className="space-y-5">
            {/* Transport */}
            <div className="flex items-center gap-2">
              <button data-testid="grid-play-button" onClick={() => setPlaying((p) => !p)} className={`flex items-center gap-1.5 rounded px-3 py-2 font-mono text-[11px] transition-all ${playing ? "border border-emerald-500/50 bg-emerald-500/20 text-emerald-400" : "border border-zinc-700 bg-zinc-800 text-zinc-200"}`}>
                {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />} {playing ? "Stop" : "Play"}
              </button>
              <button data-testid="grid-restructure-button" onClick={restructure} className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-[11px] text-zinc-200 transition-all hover:bg-zinc-700 active:scale-95">
                <Shuffle className="h-3.5 w-3.5" /> Restructure
              </button>
              <button data-testid="grid-tap-button" onClick={tap} className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-[11px] text-zinc-200 transition-all hover:bg-zinc-700 active:scale-95">
                <Zap className="h-3.5 w-3.5" /> Tap
              </button>
            </div>

            <div className="space-y-2">
              <label className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">Testo (parole = celle · ; o spazio separano)</label>
              <Textarea data-testid="grid-text-input" value={config.text} onChange={(e) => update({ text: e.target.value })} rows={2} spellCheck={false}
                className="resize-none border-zinc-700 bg-zinc-900/80 font-mono text-sm text-zinc-100 focus-visible:ring-emerald-500/40" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <TextField label="Titolo meta" testId="grid-title-input" value={config.title} onChange={(v) => update({ title: v })} />
              <TextField label="Sottotitolo" testId="grid-subtitle-input" value={config.subtitle} onChange={(v) => update({ subtitle: v })} />
            </div>

            <ProSlider label="BPM" testId="grid-bpm-slider" value={config.bpm} min={40} max={220} step={1} reset={124} onChange={(v) => update({ bpm: v, metaBpm: v })} />
            <ProSlider label="Cut ogni N beat" testId="grid-cut-slider" value={config.cutEvery} min={1} max={8} step={1} reset={2} onChange={(v) => update({ cutEvery: v })} />
            <ProSlider label="Complessità (celle)" testId="grid-count-slider" value={config.count} min={3} max={12} step={1} reset={6} onChange={(v) => update({ count: v })} />

            {/* Palette */}
            <div className="space-y-1.5">
              <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">Palette</span>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(PALETTES).map(([key, p]) => (
                  <button key={key} data-testid={`grid-palette-${key}`} onClick={() => update({ palette: key })}
                    className={`flex items-center justify-center gap-1.5 rounded border px-2 py-2 font-mono text-[10px] transition-all ${config.palette === key ? "border-emerald-500/50 bg-emerald-500/10 text-zinc-100" : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
                    <span className="h-3 w-3 rounded-sm border border-zinc-600" style={{ background: p.fg }} />
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Toggle label="Invert" testId="grid-invert-toggle" on={config.invert} onClick={() => update({ invert: !config.invert })} />
              <Toggle label="Flip on cut" testId="grid-flip-toggle" on={config.flipOnCut} onClick={() => update({ flipOnCut: !config.flipOnCut })} />
            </div>

            {/* Font */}
            <div className="space-y-1.5">
              <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">Font</span>
              <Select value={config.font} onValueChange={(v) => update({ font: v })}>
                <SelectTrigger data-testid="grid-font-select" className="border-zinc-700 bg-zinc-900/80 text-sm text-zinc-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-zinc-700 bg-zinc-900 text-zinc-200">
                  {GRID_FONTS.map((f) => (
                    <SelectItem key={f} value={f} style={{ fontFamily: `"${f}", sans-serif` }}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Media */}
            <div className="space-y-2">
              <div onClick={() => inputRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFiles(e.dataTransfer.files); }}
                data-testid="grid-media-dropzone"
                className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-700 bg-zinc-900/50 py-4 transition-all hover:border-emerald-500/50 hover:bg-emerald-500/5">
                <Upload className="h-4 w-4 text-zinc-500" />
                <span className="font-mono text-[11px] text-zinc-400">Carica immagini / video (duotone)</span>
                <input ref={inputRef} type="file" accept="image/*,video/*" multiple hidden data-testid="grid-media-input" onChange={(e) => onFiles(e.target.files)} />
              </div>
              {config.media.clips.map((c) => (
                <div key={c.id} data-testid={`grid-clip-${c.id}`} className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-900/60 px-3 py-1.5">
                  <span className="truncate font-mono text-[11px] text-zinc-300">{c.name}</span>
                  <button data-testid={`grid-clip-remove-${c.id}`} onClick={() => removeClip(c.id)} className="text-zinc-500 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>

            <button data-testid="grid-reset-button" onClick={() => { setConfig(defaultGridConfig); setSeed(1); setPlaying(false); }}
              className="w-full rounded border border-zinc-700 bg-zinc-800 py-2 font-mono text-[11px] uppercase tracking-wider text-zinc-300 transition-all hover:bg-zinc-700">
              Reset
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, testId }) {
  return (
    <div className="space-y-1.5">
      <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">{label}</span>
      <input data-testid={testId} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-zinc-700 bg-zinc-900/80 px-2 py-1.5 font-mono text-xs text-zinc-200 outline-none focus:border-emerald-500/50" />
    </div>
  );
}

function Toggle({ label, on, onClick, testId }) {
  return (
    <button data-testid={testId} onClick={onClick}
      className={`flex items-center justify-between rounded border px-3 py-2 font-mono text-[11px] transition-all ${on ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400" : "border-zinc-700 bg-zinc-800 text-zinc-400"}`}>
      {label} <span>{on ? "ON" : "OFF"}</span>
    </button>
  );
}
