import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Maximize2, ExternalLink, Shuffle, Play, Pause, Upload, Trash2, Zap, Mic, MicOff } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProSlider } from "@/components/ProSlider";
import GridStage from "@/components/GridStage";
import { ASPECTS } from "@/lib/render";
import { PALETTES, GRID_FONTS, defaultGridConfig, deriveTokens, buildScene, randomRatios, mutateRatios } from "@/lib/grid";

export default function GridStudio() {
  const [config, setConfig] = useState(defaultGridConfig);
  const [topoSeed, setTopoSeed] = useState(1);
  const [ratios, setRatios] = useState(() => randomRatios(defaultGridConfig.count, defaultGridConfig.sizeVar));
  const [playing, setPlaying] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [level, setLevel] = useState(0);
  const [fs, setFs] = useState(false);
  const stageWrapRef = useRef(null);
  const channelRef = useRef(null);
  const inputRef = useRef(null);
  const tapRef = useRef([]);
  const audioRef = useRef({});
  const sensRef = useRef(config.micSens);
  const stepRef = useRef(0);
  sensRef.current = config.micSens;

  const update = useCallback((patch) => setConfig((c) => ({ ...c, ...patch })), []);
  const tokens = useMemo(() => deriveTokens(config.text, config.wrap), [config.text, config.wrap]);
  const scene = useMemo(
    () => buildScene(topoSeed, config.count, tokens, config.media.clips, ratios),
    [topoSeed, config.count, tokens, config.media.clips, ratios]
  );

  // Re-init ratios (fresh layout) whenever topology, cell count or size-variance changes.
  useEffect(() => { setRatios(randomRatios(config.count, config.sizeVar)); stepRef.current = 0; }, [topoSeed, config.count, config.sizeVar]);

  // Cut = beat event: morph cell sizes (all, or a few at a time in progressive mode) + optional gradual flip.
  const cut = useCallback(() => {
    setRatios((prev) => {
      const n = Math.max(1, config.count - 1);
      const base = prev.length === n ? prev : randomRatios(config.count, config.sizeVar);
      if (config.resizeMode === "all") return randomRatios(config.count, config.sizeVar);
      const pattern = [2, 3, n];
      const k = Math.min(n, pattern[stepRef.current % pattern.length]);
      stepRef.current++;
      return mutateRatios(base, k, config.sizeVar);
    });
    setConfig((c) => (c.flipOnCut ? { ...c, invert: !c.invert } : c));
  }, [config.count, config.sizeVar, config.resizeMode, config.flipOnCut]);
  const cutRef = useRef(cut);
  cutRef.current = cut;

  const restructure = useCallback(() => setTopoSeed((s) => s + 1), []);
  const setPalette = (key) => { update({ palette: key }); setTopoSeed((s) => s + 1); };

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

  useEffect(() => {
    if (!playing || micOn) return;
    let beat = 0;
    const id = setInterval(() => { beat++; if (beat % config.cutEvery === 0) cut(); }, 60000 / config.bpm);
    return () => clearInterval(id);
  }, [playing, micOn, config.bpm, config.cutEvery, cut]);

  const goFullscreen = () => stageWrapRef.current?.requestFullscreen?.();
  useEffect(() => {
    const onFs = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.code === "Space") { e.preventDefault(); cut(); }
      if (e.key === "f") goFullscreen();
      if (e.key === "t") tap();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cut]);

  const tap = () => {
    const now = performance.now();
    tapRef.current = [...tapRef.current.filter((t) => now - t < 2500), now];
    if (tapRef.current.length >= 2) {
      const arr = tapRef.current;
      const bpm = Math.round(60000 / ((arr[arr.length - 1] - arr[0]) / (arr.length - 1)));
      if (bpm >= 40 && bpm <= 300) update({ bpm });
    }
  };

  const stopMic = useCallback(() => {
    const a = audioRef.current;
    if (a.raf) cancelAnimationFrame(a.raf);
    if (a.stream) a.stream.getTracks().forEach((t) => t.stop());
    if (a.ac) a.ac.close();
    audioRef.current = {};
    setMicOn(false);
    setLevel(0);
  }, []);

  const startMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const src = ac.createMediaStreamSource(stream);
      const analyser = ac.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      let avg = 0, last = 0;
      const loop = () => {
        analyser.getByteFrequencyData(data);
        let sum = 0; const N = 8;
        for (let i = 0; i < N; i++) sum += data[i];
        const energy = sum / N;
        avg = avg * 0.92 + energy * 0.08;
        setLevel(Math.min(1, energy / 200));
        const now = performance.now();
        if (energy > avg * sensRef.current && energy > 45 && now - last > 150) { last = now; cutRef.current(); }
        audioRef.current.raf = requestAnimationFrame(loop);
      };
      audioRef.current = { stream, ac };
      audioRef.current.raf = requestAnimationFrame(loop);
      setMicOn(true);
      setPlaying(false);
      toast.success("Microfono attivo — la griglia segue la musica");
    } catch {
      toast.error("Microfono non disponibile o permesso negato");
    }
  };
  useEffect(() => () => stopMic(), [stopMic]);

  const onFiles = (files) => {
    const added = Array.from(files)
      .filter((f) => f.type.startsWith("video") || f.type.startsWith("image"))
      .map((f) => ({ id: crypto.randomUUID(), name: f.name, url: URL.createObjectURL(f), kind: f.type.startsWith("video") ? "video" : "image" }));
    if (added.length) { update({ media: { clips: [...config.media.clips, ...added] } }); setTopoSeed((s) => s + 1); }
  };
  const removeClip = (id) => { update({ media: { clips: config.media.clips.filter((c) => c.id !== id) } }); setTopoSeed((s) => s + 1); };

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
            <div className="flex flex-wrap items-center gap-2">
              <button data-testid="grid-play-button" onClick={() => setPlaying((p) => !p)} disabled={micOn}
                className={`flex items-center gap-1.5 rounded px-3 py-2 font-mono text-[11px] transition-all disabled:opacity-40 ${playing ? "border border-emerald-500/50 bg-emerald-500/20 text-emerald-400" : "border border-zinc-700 bg-zinc-800 text-zinc-200"}`}>
                {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />} {playing ? "Stop" : "Play"}
              </button>
              <button data-testid="grid-mic-button" onClick={() => (micOn ? stopMic() : startMic())}
                className={`flex items-center gap-1.5 rounded px-3 py-2 font-mono text-[11px] transition-all ${micOn ? "border border-emerald-500/50 bg-emerald-500/20 text-emerald-400" : "border border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700"}`}>
                {micOn ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />} Audio
              </button>
              <button data-testid="grid-restructure-button" onClick={restructure} className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-[11px] text-zinc-200 transition-all hover:bg-zinc-700 active:scale-95">
                <Shuffle className="h-3.5 w-3.5" /> Restructure
              </button>
              <button data-testid="grid-tap-button" onClick={tap} className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-[11px] text-zinc-200 transition-all hover:bg-zinc-700 active:scale-95">
                <Zap className="h-3.5 w-3.5" /> Tap
              </button>
            </div>

            {micOn && (
              <div className="space-y-2">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-75" style={{ width: `${Math.max(3, level * 100)}%` }} data-testid="grid-audio-level" />
                </div>
                <ProSlider label="Sensibilità audio" testId="grid-sens-slider" value={config.micSens} min={1.05} max={2.5} step={0.05} reset={1.35} onChange={(v) => update({ micSens: v })} unit="x" />
                <p className="font-mono text-[10px] text-zinc-500">Valori più bassi = più reattivo ai beat.</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">Testo (parole = celle · ; o spazio separano)</label>
              <Textarea data-testid="grid-text-input" value={config.text} onChange={(e) => update({ text: e.target.value })} rows={2} spellCheck={false}
                className="resize-none border-zinc-700 bg-zinc-900/80 font-mono text-sm text-zinc-100 focus-visible:ring-emerald-500/40" />
            </div>

            <div className="space-y-2">
              <label className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">Testo info (meta) · ; = a capo</label>
              <Textarea data-testid="grid-meta-input" value={config.metaText} onChange={(e) => update({ metaText: e.target.value })} rows={2} spellCheck={false}
                className="resize-none border-zinc-700 bg-zinc-900/80 font-mono text-sm text-zinc-100 focus-visible:ring-emerald-500/40" placeholder="POLYAMOR;124 BPM;IDX-949" />
            </div>

            <ProSlider label="BPM" testId="grid-bpm-slider" value={config.bpm} min={40} max={220} step={1} reset={124} onChange={(v) => update({ bpm: v })} />
            <ProSlider label="Cut ogni N beat" testId="grid-cut-slider" value={config.cutEvery} min={1} max={8} step={1} reset={2} onChange={(v) => update({ cutEvery: v })} />
            <ProSlider label="Complessità (celle)" testId="grid-count-slider" value={config.count} min={3} max={12} step={1} reset={6} onChange={(v) => update({ count: v })} />
            <ProSlider label="Randomicità dimensioni" testId="grid-sizevar-slider" value={config.sizeVar} min={1} max={10} step={1} reset={5} onChange={(v) => update({ sizeVar: v })} />

            {/* Resize mode */}
            <div className="space-y-1.5">
              <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">Modalità resize</span>
              <div className="grid grid-cols-2 gap-2">
                <button data-testid="grid-resize-all" onClick={() => update({ resizeMode: "all" })}
                  className={`rounded px-2 py-2 font-mono text-[10px] transition-all ${config.resizeMode === "all" ? "border border-emerald-500/50 bg-emerald-500/20 text-emerald-400" : "border border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>Tutte insieme</button>
                <button data-testid="grid-resize-progressive" onClick={() => update({ resizeMode: "progressive" })}
                  className={`rounded px-2 py-2 font-mono text-[10px] transition-all ${config.resizeMode === "progressive" ? "border border-emerald-500/50 bg-emerald-500/20 text-emerald-400" : "border border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>Progressivo</button>
              </div>
            </div>

            {/* Palette */}
            <div className="space-y-1.5">
              <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">Palette</span>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(PALETTES).map(([key, p]) => (
                  <button key={key} data-testid={`grid-palette-${key}`} onClick={() => setPalette(key)}
                    className={`flex items-center justify-center gap-1.5 rounded border px-2 py-2 font-mono text-[10px] transition-all ${config.palette === key ? "border-emerald-500/50 bg-emerald-500/10 text-zinc-100" : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
                    <span className="h-3 w-3 rounded-sm border border-zinc-600" style={{ background: p.fg }} />
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Toggle label="Invert" testId="grid-invert-toggle" on={config.invert} onClick={() => update({ invert: !config.invert })} />
              <Toggle label="Flip cut" testId="grid-flip-toggle" on={config.flipOnCut} onClick={() => update({ flipOnCut: !config.flipOnCut })} />
              <Toggle label="A capo" testId="grid-wrap-toggle" on={config.wrap} onClick={() => update({ wrap: !config.wrap })} />
            </div>

            {/* Font */}
            <div className="space-y-1.5">
              <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">Font</span>
              <Select value={config.font} onValueChange={(v) => update({ font: v })}>
                <SelectTrigger data-testid="grid-font-select" className="border-zinc-700 bg-zinc-900/80 text-sm text-zinc-200"><SelectValue /></SelectTrigger>
                <SelectContent className="border-zinc-700 bg-zinc-900 text-zinc-200">
                  {GRID_FONTS.map((f) => (<SelectItem key={f} value={f} style={{ fontFamily: `"${f}", sans-serif` }}>{f}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            {/* Media */}
            <div className="space-y-2">
              <div onClick={() => inputRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFiles(e.dataTransfer.files); }}
                data-testid="grid-media-dropzone"
                className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-700 bg-zinc-900/50 py-4 transition-all hover:border-emerald-500/50 hover:bg-emerald-500/5">
                <Upload className="h-4 w-4 text-zinc-500" />
                <span className="font-mono text-[11px] text-zinc-400">Carica clip / GIF / immagini (duotone)</span>
                <input ref={inputRef} type="file" accept="image/*,video/*" multiple hidden data-testid="grid-media-input" onChange={(e) => onFiles(e.target.files)} />
              </div>
              {config.media.clips.map((c) => (
                <div key={c.id} data-testid={`grid-clip-${c.id}`} className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-900/60 px-3 py-1.5">
                  <span className="truncate font-mono text-[11px] text-zinc-300">{c.name}</span>
                  <button data-testid={`grid-clip-remove-${c.id}`} onClick={() => removeClip(c.id)} className="text-zinc-500 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>

            <button data-testid="grid-reset-button" onClick={() => { stopMic(); setConfig(defaultGridConfig); setTopoSeed(1); setRatios(randomRatios(defaultGridConfig.count, defaultGridConfig.sizeVar)); setPlaying(false); }}
              className="w-full rounded border border-zinc-700 bg-zinc-800 py-2 font-mono text-[11px] uppercase tracking-wider text-zinc-300 transition-all hover:bg-zinc-700">
              Reset
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Toggle({ label, on, onClick, testId }) {
  return (
    <button data-testid={testId} onClick={onClick}
      className={`flex items-center justify-between rounded border px-2 py-2 font-mono text-[10px] transition-all ${on ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400" : "border-zinc-700 bg-zinc-800 text-zinc-400"}`}>
      {label} <span>{on ? "ON" : "OFF"}</span>
    </button>
  );
}
