import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, ExternalLink, Shuffle, Play, Pause, Upload, Trash2, Zap, Mic, MicOff, Activity, Camera, Video, Square } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProSlider } from "@/components/ProSlider";
import GridStage from "@/components/GridStage";
import { ASPECTS } from "@/lib/render";
import { GRID_FONTS, defaultGridConfig, deriveTokens, buildScene, randomRatios, mutateRatios, topologyWeights, ratioSpread } from "@/lib/grid";
import { paintScene, targetDims, pickVideoMime, downloadBlob } from "@/lib/capture";
import { webmToMp4 } from "@/lib/mp4";

export default function GridStudio() {
  const [config, setConfig] = useState(defaultGridConfig);
  const [topoSeed, setTopoSeed] = useState(1);
  const [ratios, setRatios] = useState(() => randomRatios(defaultGridConfig.count, defaultGridConfig.sizeVar));
  const [playing, setPlaying] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [levels, setLevels] = useState({ bass: 0, mid: 0, high: 0 });
  const [fs, setFs] = useState(false);
  const [recording, setRecording] = useState(false);
  const [selectedCells, setSelectedCells] = useState([]);
  const stageWrapRef = useRef(null);
  const channelRef = useRef(null);
  const inputRef = useRef(null);
  const fontInputRef = useRef(null);
  const [customFonts, setCustomFonts] = useState([]);
  const tapRef = useRef([]);
  const audioRef = useRef({});
  const sensRef = useRef(config.micSens);
  const stepRef = useRef(0);
  const lastBcRef = useRef(0);
  const audioParamsRef = useRef({});
  const sceneRef = useRef(null);
  const configRef = useRef(config);
  const recRef = useRef(null);
  sensRef.current = config.micSens;
  audioParamsRef.current = { band: config.audioBand, sens: config.micSens, ib: config.intBass, im: config.intMid, ih: config.intHigh };

  const update = useCallback((patch) => setConfig((c) => ({ ...c, ...patch })), []);
  const tokens = useMemo(() => deriveTokens(config.text, false), [config.text]);
  // Auto-expand cell count so every word + every uploaded clip + meta gets its own rectangle.
  const cellCount = useMemo(
    () => Math.min(24, Math.max(config.count, tokens.length + config.media.clips.length + 1)),
    [config.count, tokens.length, config.media.clips.length]
  );
  const weights = useMemo(() => topologyWeights(topoSeed, cellCount), [topoSeed, cellCount]);
  const weightsRef = useRef(weights);
  weightsRef.current = weights;
  const scene = useMemo(
    () => buildScene(topoSeed, cellCount, tokens, config.media.clips, ratios),
    [topoSeed, cellCount, tokens, config.media.clips, ratios]
  );
  sceneRef.current = scene;
  configRef.current = config;

  // Re-init ratios whenever topology, cell count or size-variance changes.
  useEffect(() => { setRatios(randomRatios(cellCount, config.sizeVar)); stepRef.current = 0; }, [topoSeed, cellCount, config.sizeVar]);

  // Cut = beat event: morph cell sizes (skipped when Dynamic movement drives them) + random flip.
  const cut = useCallback(() => {
    if (!config.dynamic) {
      setRatios((prev) => {
        const n = Math.max(1, cellCount - 1);
        const base = prev.length === n ? prev : randomRatios(cellCount, config.sizeVar);
        if (config.resizeMode === "all") return randomRatios(cellCount, config.sizeVar);
        const pattern = [2, 3, n];
        const k = Math.min(n, pattern[stepRef.current % pattern.length]);
        stepRef.current++;
        return mutateRatios(base, k, config.sizeVar, weightsRef.current);
      });
    }
    setConfig((c) => (c.flipOnCut && Math.random() < 0.35 ? { ...c, invert: !c.invert } : c));
  }, [cellCount, config.sizeVar, config.resizeMode, config.flipOnCut, config.dynamic]);
  const cutRef = useRef(cut);
  cutRef.current = cut;

  // Dynamic movement: continuous "accordion / breathing" resize, decoupled from BPM, at rAF rate.
  useEffect(() => {
    if (!config.dynamic) return;
    const n = Math.max(1, cellCount - 1);
    const amp = ratioSpread(config.sizeVar) / 2;
    const phases = Array.from({ length: n }, () => Math.random() * Math.PI * 2);
    const freqs = Array.from({ length: n }, () => 0.18 + Math.random() * 0.5);
    const t0 = performance.now();
    let raf;
    const loop = (now) => {
      const t = (now - t0) / 1000;
      const r = [];
      for (let i = 0; i < n; i++) r.push(0.5 + Math.sin(t * freqs[i] * Math.PI * 2 + phases[i]) * amp);
      setRatios(r);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [config.dynamic, cellCount, config.sizeVar]);

  const restructure = useCallback(() => setTopoSeed((s) => s + 1), []);

  // Lightweight config for the per-beat broadcast (media data URLs are sent separately, once).
  const lightConfig = useMemo(
    () => ({ ...config, media: { clips: config.media.clips.map(({ id, name, kind }) => ({ id, name, kind })) } }),
    [config]
  );
  const ch = () => (channelRef.current || (channelRef.current = new BroadcastChannel("vj-grid")));

  useEffect(() => {
    const now = performance.now();
    if (config.dynamic && now - lastBcRef.current < 40) return; // throttle to ~25fps during dynamic
    lastBcRef.current = now;
    ch().postMessage({ type: "scene", scene, config: lightConfig, selected: selectedCells });
  }, [scene, lightConfig, config.dynamic, selectedCells]);
  useEffect(() => { ch().postMessage({ type: "media", clips: config.media.clips }); }, [config.media.clips]);
  useEffect(() => {
    const c = ch();
    const onMsg = (e) => {
      if (e.data?.type === "request") {
        c.postMessage({ type: "media", clips: config.media.clips });
        c.postMessage({ type: "fonts", fonts: customFonts });
        c.postMessage({ type: "scene", scene, config: lightConfig, selected: selectedCells });
      }
    };
    c.addEventListener("message", onMsg);
    return () => c.removeEventListener("message", onMsg);
  }, [scene, lightConfig, config.media.clips, customFonts, selectedCells]);

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
    setLevels({ bass: 0, mid: 0, high: 0 });
  }, []);

  const startMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const src = ac.createMediaStreamSource(stream);
      const analyser = ac.createAnalyser();
      analyser.fftSize = 2048;
      src.connect(analyser);
      const bins = analyser.frequencyBinCount;
      const data = new Uint8Array(bins);
      const bandAvg = (arr, from, to) => {
        let s = 0; const a = Math.floor(bins * from), b = Math.floor(bins * to);
        for (let i = a; i < b; i++) s += arr[i];
        return s / Math.max(1, b - a);
      };
      let avg = { bass: 0, mid: 0, high: 0 }, last = 0;
      const loop = () => {
        analyser.getByteFrequencyData(data);
        const p = audioParamsRef.current;
        const raw = { bass: bandAvg(data, 0, 0.06), mid: bandAvg(data, 0.06, 0.25), high: bandAvg(data, 0.25, 0.6) };
        const e = { bass: raw.bass * (p.ib || 1), mid: raw.mid * (p.im || 1), high: raw.high * (p.ih || 1) };
        avg = { bass: avg.bass * 0.9 + e.bass * 0.1, mid: avg.mid * 0.9 + e.mid * 0.1, high: avg.high * 0.9 + e.high * 0.1 };
        setLevels({ bass: Math.min(1, e.bass / 220), mid: Math.min(1, e.mid / 220), high: Math.min(1, e.high / 220) });
        const band = p.band || "bass";
        const now = performance.now();
        if (e[band] > avg[band] * (p.sens || 1.35) && e[band] > 40 && now - last > 130) { last = now; cutRef.current(); }
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

  const onFiles = async (files) => {
    const MB = 1024 * 1024;
    const arr = Array.from(files).filter((f) => f.type.startsWith("video") || f.type.startsWith("image"));
    const valid = [];
    for (const f of arr) {
      if (f.size > 40 * MB) { toast.error(`${f.name}: troppo pesante (${(f.size / MB).toFixed(1)}MB, max 40MB) — saltato`); continue; }
      valid.push(f);
    }
    if (!valid.length) return;
    const heavy = valid.filter((f) => f.size > 8 * MB);
    if (heavy.length) toast(`Clip pesante caricata (${(heavy[0].size / MB).toFixed(1)}MB) — per un live fluido usa clip brevi e leggere`);
    const added = await Promise.all(
      valid.map((f) => new Promise((res) => {
        const r = new FileReader();
        r.onload = () => res({ id: crypto.randomUUID(), name: f.name, kind: f.type.startsWith("video") ? "video" : "image", url: r.result });
        r.onerror = () => res(null);
        r.readAsDataURL(f);
      }))
    );
    const clips = added.filter(Boolean);
    if (!clips.length) { toast.error("Impossibile leggere il file"); return; }
    setConfig((c) => ({ ...c, media: { clips: [...c.media.clips, ...clips] } }));
    setTopoSeed((s) => s + 1);
    toast.success(`${clips.length} media aggiunto — appare in un riquadro`);
  };
  const removeClip = (id) => { setConfig((c) => ({ ...c, media: { clips: c.media.clips.filter((x) => x.id !== id) } })); setTopoSeed((s) => s + 1); };

  const onFonts = async (files) => {
    const list = Array.from(files).filter((f) => /\.(ttf|otf|woff2?)$/i.test(f.name));
    if (!list.length) { toast.error("Formati supportati: TTF, OTF"); return; }
    const added = [];
    for (const f of list) {
      const family = (f.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9 ]/g, " ").trim() || "Custom Font");
      const url = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
      try {
        const face = new FontFace(family, `url(${url})`);
        await face.load();
        document.fonts.add(face);
        added.push({ family, url });
      } catch { toast.error(`Impossibile caricare ${f.name}`); }
    }
    if (added.length) { setCustomFonts((p) => [...p.filter((x) => !added.some((a) => a.family === x.family)), ...added]); update({ font: added[0].family }); toast.success(`${added.length} font aggiunto`); }
  };
  // Register custom fonts in the pop-out too.
  useEffect(() => { ch().postMessage({ type: "fonts", fonts: customFonts }); }, [customFonts]);

  const gatherMedia = () => {
    const map = {};
    const el = stageWrapRef.current?.querySelector('[data-testid="grid-stage"]');
    el?.querySelectorAll("[data-clip-id]").forEach((n) => { map[n.getAttribute("data-clip-id")] = n; });
    return map;
  };

  const saveFrame = () => {
    const { w, h } = targetDims(config.aspect);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    paintScene(ctx, sceneRef.current, configRef.current, w, h, gatherMedia(), selectedCells);
    canvas.toBlob((b) => {
      if (!b) { toast.error("Impossibile salvare il frame"); return; }
      downloadBlob(b, `kinetiko-${Date.now()}.jpg`);
      toast.success("Frame salvato (JPG)");
    }, "image/jpeg", 0.95);
  };

  const startRec = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) { toast.error("Registrazione schermo non supportata dal browser"); return; }
    const stageEl = stageWrapRef.current?.querySelector('[data-testid="grid-stage"]');
    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 60 },
        audio: false,
        preferCurrentTab: true,
        selfBrowserSurface: "include",
        surfaceSwitching: "exclude",
      });
    } catch { toast.error("Registrazione annullata"); return; }
    const [track] = stream.getVideoTracks();
    // Region Capture: crop the tab capture down to ONLY the grid area.
    let cropped = false;
    try {
      if (stageEl && window.CropTarget?.fromElement && typeof track.cropTo === "function") {
        const target = await window.CropTarget.fromElement(stageEl);
        await track.cropTo(target);
        cropped = true;
      }
    } catch { cropped = false; }
    const mime = pickVideoMime();
    let rec;
    try { rec = new MediaRecorder(stream, mime ? { mimeType: mime } : {}); }
    catch { stream.getTracks().forEach((t) => t.stop()); toast.error("Registrazione non supportata dal browser"); return; }
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      recRef.current = null;
      setRecording(false);
      const type = rec.mimeType || mime || "video/webm";
      const ts = Date.now();
      const blob = new Blob(chunks, { type });
      if (type.includes("mp4")) { downloadBlob(blob, `kinetiko-${ts}.mp4`); toast.success("Clip salvata (MP4)"); return; }
      const tid = toast.loading("Conversione in MP4… 0%");
      try {
        const mp4 = await webmToMp4(blob, (p) => toast.loading(`Conversione in MP4… ${Math.round(p * 100)}%`, { id: tid }));
        downloadBlob(mp4, `kinetiko-${ts}.mp4`);
        toast.success("Clip salvata (MP4)", { id: tid });
      } catch (err) {
        downloadBlob(blob, `kinetiko-${ts}.webm`);
        toast.error("Conversione MP4 non riuscita: salvata in WebM", { id: tid });
      }
    };
    // If the user stops sharing from the browser bar, finalize the clip.
    track.addEventListener("ended", () => { if (rec.state !== "inactive") rec.stop(); });
    recRef.current = rec;
    rec.start();
    setRecording(true);
    toast.success(cropped
      ? "Registro solo l'area grafica — ripremi Stop per salvare in MP4"
      : 'Ritaglio non supportato: seleziona "Questa scheda". Output MP4');
  };
  const stopRec = () => { try { recRef.current?.stop(); } catch { /* noop */ } };
  const toggleRec = () => (recording ? stopRec() : startRec());
  useEffect(() => () => { if (recRef.current) { try { recRef.current.stop(); } catch { /* noop */ } } }, []);

  const toggleCell = useCallback((i) => {
    setSelectedCells((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));
  }, []);

  const openPopout = () => window.open("/output", "vj-grid-output", "width=1280,height=720");

  return (
    <div className="min-h-screen bg-[#09090B] p-3 text-zinc-100 lg:p-4">
      <Toaster theme="dark" position="top-center" />
      <div className="grid h-[calc(100vh-1.5rem)] grid-cols-1 gap-4 lg:grid-cols-12">
        {/* LEFT */}
        <section className="flex flex-col gap-3 lg:col-span-7 xl:col-span-8">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500 shadow-[0_0_10px_#10B981]" />
              <h1 className="font-heading text-lg font-bold tracking-tight text-zinc-50">KINETIKO · GRID VISUAL TOOL</h1>
            </div>
            <div className="flex items-center gap-2">
              <button data-testid="grid-snapshot-button" onClick={saveFrame} className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 font-mono text-[11px] text-zinc-200 transition-all hover:bg-zinc-700 active:scale-95">
                <Camera className="h-3.5 w-3.5" /> JPG
              </button>
              <button data-testid="grid-record-button" onClick={toggleRec}
                className={`flex items-center gap-1.5 rounded border px-3 py-1.5 font-mono text-[11px] transition-all active:scale-95 ${recording ? "border-red-500/60 bg-red-500/20 text-red-400" : "border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700"}`}>
                {recording ? <Square className="h-3.5 w-3.5 fill-current" /> : <Video className="h-3.5 w-3.5" />}
                {recording ? "Stop REC" : "Rec"}
              </button>
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
            <GridStage scene={scene} config={config} clean={fs} dynamic={config.dynamic} selected={selectedCells} onCellClick={toggleCell} />
          </div>
          {!fs && (
            <p className="font-mono text-[10px] text-zinc-500">
              Clicca un rettangolo per far <span className="text-emerald-400">deformare il testo</span> fino a riempirlo (clicca di nuovo per annullare).
              {selectedCells.length > 0 && (
                <button data-testid="grid-clear-stretch" onClick={() => setSelectedCells([])} className="ml-2 rounded border border-zinc-700 px-2 py-0.5 text-zinc-300 hover:bg-zinc-800">Azzera stretch ({selectedCells.length})</button>
              )}
            </p>
          )}
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
              <div className="space-y-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                <span className="font-mono text-[11px] uppercase tracking-wider text-emerald-400">Analisi audio</span>
                {[
                  ["bass", "Bassi", "intBass", "grid-level-bass", "grid-int-bass"],
                  ["mid", "Medi", "intMid", "grid-level-mid", "grid-int-mid"],
                  ["high", "Alti", "intHigh", "grid-level-high", "grid-int-high"],
                ].map(([key, label, intKey, lvlId, intId]) => (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <button data-testid={`grid-band-${key}`} onClick={() => update({ audioBand: key })}
                        className={`rounded px-2 py-0.5 font-mono text-[10px] uppercase transition-all ${config.audioBand === key ? "bg-emerald-500/25 text-emerald-300 ring-1 ring-emerald-500/50" : "text-zinc-400 hover:text-zinc-200"}`}>
                        {config.audioBand === key ? "▶ " : ""}{label}
                      </button>
                      <span className="font-mono text-[10px] text-zinc-500">intensità {config[intKey].toFixed(1)}x</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                      <div data-testid={lvlId} className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(2, levels[key] * 100)}%` }} />
                    </div>
                    <input type="range" data-testid={intId} className="vj-slider w-full" min={0.3} max={3} step={0.1}
                      value={config[intKey]} onChange={(e) => update({ [intKey]: parseFloat(e.target.value) })} />
                  </div>
                ))}
                <ProSlider label="Sensibilità (soglia beat)" testId="grid-sens-slider" value={config.micSens} min={1.05} max={2.5} step={0.05} reset={1.35} onChange={(v) => update({ micSens: v })} unit="x" />
                <p className="font-mono text-[10px] text-zinc-500">Scegli la banda (▶) a cui reagiscono i rettangoli. Sensibilità bassa = più reattivo.</p>
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
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { k: "left", lbl: "Bandiera sx" },
                  { k: "center", lbl: "Centro" },
                  { k: "right", lbl: "Bandiera dx" },
                  { k: "justify", lbl: "Giustifica" },
                ].map((o) => (
                  <button key={o.k} data-testid={`grid-meta-align-${o.k}`} onClick={() => update({ metaAlign: o.k })}
                    className={`rounded px-1 py-1.5 font-mono text-[9px] uppercase tracking-wide transition-all ${(config.metaAlign || "center") === o.k ? "border border-emerald-500/50 bg-emerald-500/20 text-emerald-400" : "border border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800"}`}>{o.lbl}</button>
                ))}
              </div>
            </div>

            <ProSlider label="BPM" testId="grid-bpm-slider" value={config.bpm} min={40} max={220} step={1} reset={124} onChange={(v) => update({ bpm: v })} />
            <ProSlider label="Cut ogni N beat" testId="grid-cut-slider" value={config.cutEvery} min={1} max={8} step={1} reset={2} onChange={(v) => update({ cutEvery: v })} />
            <ProSlider label="Complessità (min celle)" testId="grid-count-slider" value={config.count} min={3} max={12} step={1} reset={6} onChange={(v) => update({ count: v })} />
            <ProSlider label="Randomicità dimensioni" testId="grid-sizevar-slider" value={config.sizeVar} min={1} max={10} step={1} reset={5} onChange={(v) => update({ sizeVar: v })} />

            {/* Dynamic movement */}
            <button data-testid="grid-dynamic-toggle" onClick={() => update({ dynamic: !config.dynamic })}
              className={`flex w-full items-center justify-between rounded border px-3 py-2.5 font-mono text-[11px] transition-all ${config.dynamic ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400" : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}>
              <span className="flex items-center gap-2"><Activity className="h-3.5 w-3.5" /> Dynamic movement</span>
              <span>{config.dynamic ? "ON" : "OFF"}</span>
            </button>
            {config.dynamic && <p className="-mt-2 font-mono text-[10px] text-zinc-500">Respiro continuo dei riquadri, svincolato dai BPM.</p>}

            {/* Resize mode */}
            <div className="space-y-1.5">
              <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">Modalità resize (a battito)</span>
              <div className="grid grid-cols-2 gap-2">
                <button data-testid="grid-resize-all" disabled={config.dynamic} onClick={() => update({ resizeMode: "all" })}
                  className={`rounded px-2 py-2 font-mono text-[10px] transition-all disabled:opacity-40 ${config.resizeMode === "all" ? "border border-emerald-500/50 bg-emerald-500/20 text-emerald-400" : "border border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>Tutte insieme</button>
                <button data-testid="grid-resize-progressive" disabled={config.dynamic} onClick={() => update({ resizeMode: "progressive" })}
                  className={`rounded px-2 py-2 font-mono text-[10px] transition-all disabled:opacity-40 ${config.resizeMode === "progressive" ? "border border-emerald-500/50 bg-emerald-500/20 text-emerald-400" : "border border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>Progressivo</button>
              </div>
            </div>

            {/* Colours */}
            <div className="space-y-1.5">
              <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">Colori (2 tinte)</span>
              <div className="grid grid-cols-2 gap-3">
                <ColorPick label="Colore 1 · sfondo" testId="grid-color1-picker" value={config.color1} onChange={(v) => update({ color1: v })} />
                <ColorPick label="Colore 2 · ink" testId="grid-color2-picker" value={config.color2} onChange={(v) => update({ color2: v })} />
              </div>
              <button data-testid="grid-swap-colors" onClick={() => update({ color1: config.color2, color2: config.color1 })}
                className="w-full rounded border border-zinc-700 bg-zinc-800 py-1.5 font-mono text-[10px] uppercase tracking-wider text-zinc-400 transition-all hover:bg-zinc-700">
                Scambia colori
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Toggle label="Invert" testId="grid-invert-toggle" on={config.invert} onClick={() => update({ invert: !config.invert })} />
              <Toggle label="Flip cut" testId="grid-flip-toggle" on={config.flipOnCut} onClick={() => update({ flipOnCut: !config.flipOnCut })} />
            </div>

            {/* Font */}
            <div className="space-y-1.5">
              <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">Font celle testo</span>
              <Select value={config.font} onValueChange={(v) => update({ font: v })}>
                <SelectTrigger data-testid="grid-font-select" className="border-zinc-700 bg-zinc-900/80 text-sm text-zinc-200"><SelectValue /></SelectTrigger>
                <SelectContent className="border-zinc-700 bg-zinc-900 text-zinc-200">
                  {[...GRID_FONTS, ...customFonts.map((f) => f.family)].map((f) => (<SelectItem key={f} value={f} style={{ fontFamily: `"${f}", sans-serif` }}>{f}</SelectItem>))}
                </SelectContent>
              </Select>
              <span className="mt-1 block font-mono text-[11px] uppercase tracking-wider text-zinc-400">Font casella info (meta)</span>
              <Select value={config.metaFont || config.font} onValueChange={(v) => update({ metaFont: v })}>
                <SelectTrigger data-testid="grid-meta-font-select" className="border-zinc-700 bg-zinc-900/80 text-sm text-zinc-200"><SelectValue /></SelectTrigger>
                <SelectContent className="border-zinc-700 bg-zinc-900 text-zinc-200">
                  {[...GRID_FONTS, ...customFonts.map((f) => f.family)].map((f) => (<SelectItem key={f} value={f} style={{ fontFamily: `"${f}", sans-serif` }}>{f}</SelectItem>))}
                </SelectContent>
              </Select>
              <div className="pt-1">
                <ProSlider label="Spessore testo" testId="grid-weight-slider" value={config.fontWeight ?? 900} min={100} max={900} step={100} reset={900} onChange={(v) => update({ fontWeight: v })} />
                <ProSlider label="Spessore info" testId="grid-meta-weight-slider" value={config.metaWeight ?? 900} min={100} max={900} step={100} reset={900} onChange={(v) => update({ metaWeight: v })} />
              </div>
              <div onClick={() => fontInputRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFonts(e.dataTransfer.files); }}
                data-testid="grid-font-dropzone"
                className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-700 bg-zinc-900/50 py-3 transition-all hover:border-emerald-500/50 hover:bg-emerald-500/5">
                <Upload className="h-4 w-4 text-zinc-500" />
                <span className="font-mono text-[11px] text-zinc-400">Trascina font (.ttf / .otf)</span>
                <input ref={fontInputRef} type="file" accept=".ttf,.otf,.woff,.woff2" multiple hidden data-testid="grid-font-input" onChange={(e) => onFonts(e.target.files)} />
              </div>
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

            <button data-testid="grid-reset-button" onClick={() => { stopMic(); setConfig(defaultGridConfig); setTopoSeed(1); setRatios(randomRatios(defaultGridConfig.count, defaultGridConfig.sizeVar)); setPlaying(false); setSelectedCells([]); }}
              className="w-full rounded border border-zinc-700 bg-zinc-800 py-2 font-mono text-[11px] uppercase tracking-wider text-zinc-300 transition-all hover:bg-zinc-700">
              Reset
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ColorPick({ label, value, onChange, testId }) {
  return (
    <div className="space-y-1.5">
      <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">{label}</span>
      <div className="flex items-center gap-2 rounded border border-zinc-700 bg-zinc-900/80 px-2 py-1.5">
        <input type="color" data-testid={testId} value={value} onChange={(e) => onChange(e.target.value)}
          className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0" />
        <span className="font-mono text-[11px] uppercase text-zinc-300">{value}</span>
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
