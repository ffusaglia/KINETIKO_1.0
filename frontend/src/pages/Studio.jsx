import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Maximize2, ExternalLink, RotateCcw, Radio } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import VisualStage from "@/components/VisualStage";
import { TextPanel } from "@/components/panels/TextPanel";
import { TransformPanel } from "@/components/panels/TransformPanel";
import { AnimatePanel } from "@/components/panels/AnimatePanel";
import { MediaPanel } from "@/components/panels/MediaPanel";
import { FontPanel } from "@/components/panels/FontPanel";
import { ScenePanel } from "@/components/panels/ScenePanel";
import { ASPECTS, defaultConfig } from "@/lib/render";
import { sanitizeConfig } from "@/lib/api";

const STORAGE_KEY = "vj-config";

function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return { ...defaultConfig, ...JSON.parse(raw), media: { ...defaultConfig.media } };
  } catch {
    return null;
  }
}

export default function Studio() {
  const [config, setConfig] = useState(() => loadLocal() || defaultConfig);
  const [customFonts, setCustomFonts] = useState([]);
  const [fs, setFs] = useState(false);
  const stageWrapRef = useRef(null);
  const channelRef = useRef(null);
  const scenesRef = useRef([]);

  const update = useCallback((patch) => setConfig((c) => ({ ...c, ...patch })), []);
  const updateAnim = useCallback(
    (key, patch) => setConfig((c) => ({ ...c, animations: { ...c.animations, [key]: { ...c.animations[key], ...patch } } })),
    []
  );
  const updateMedia = useCallback(
    (patch) => setConfig((c) => ({ ...c, media: { ...c.media, ...patch } })),
    []
  );
  const applyScene = useCallback(
    (sceneConfig) => setConfig((c) => ({ ...defaultConfig, ...sceneConfig, media: { ...defaultConfig.media, ...c.media } })),
    []
  );

  // Broadcast config to the pop-out output window + persist locally.
  useEffect(() => {
    if (!channelRef.current) channelRef.current = new BroadcastChannel("vj-visual");
    channelRef.current.postMessage({ type: "config", config });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeConfig(config)));
    } catch {}
  }, [config]);

  useEffect(() => {
    const ch = channelRef.current || new BroadcastChannel("vj-visual");
    channelRef.current = ch;
    const onMsg = (e) => {
      if (e.data?.type === "request") ch.postMessage({ type: "config", config });
    };
    ch.addEventListener("message", onMsg);
    return () => ch.removeEventListener("message", onMsg);
  }, [config]);

  // Fullscreen clean output.
  const goFullscreen = () => stageWrapRef.current?.requestFullscreen?.();
  useEffect(() => {
    const onFs = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const openPopout = () => window.open("/output", "vj-output", "width=1280,height=720");

  // Hotkeys 1-6 recall saved scenes.
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 6 && scenesRef.current[n - 1]) applyScene(scenesRef.current[n - 1].config);
      if (e.key === "f") goFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [applyScene]);

  return (
    <div className="min-h-screen bg-[#09090B] p-3 text-zinc-100 lg:p-4">
      <Toaster theme="dark" position="top-center" />
      <div className="grid h-[calc(100vh-1.5rem)] grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-4">
        {/* LEFT — LIVE CANVAS */}
        <section className="flex flex-col gap-3 lg:col-span-7 xl:col-span-8">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500 shadow-[0_0_10px_#10B981]" />
              <div className="flex overflow-hidden rounded border border-zinc-700 font-mono text-[11px]">
                <span data-testid="mode-kinetic" className="bg-emerald-500/20 px-3 py-1 text-emerald-400">KINETIC</span>
                <Link to="/grid" data-testid="mode-grid" className="px-3 py-1 text-zinc-400 hover:bg-zinc-800">GRID</Link>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button data-testid="fullscreen-output-button" onClick={goFullscreen} className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 font-mono text-[11px] text-zinc-200 transition-all hover:bg-zinc-700 active:scale-95">
                <Maximize2 className="h-3.5 w-3.5" /> Fullscreen
              </button>
              <button data-testid="popout-output-button" onClick={openPopout} className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 font-mono text-[11px] text-zinc-200 transition-all hover:bg-zinc-700 active:scale-95">
                <ExternalLink className="h-3.5 w-3.5" /> Pop-out
              </button>
            </div>
          </header>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {ASPECTS.map((a) => (
                <button
                  key={a.value}
                  data-testid={`aspect-${a.label.replace(":", "-")}-button`}
                  onClick={() => update({ aspect: a.value })}
                  className={`rounded px-2.5 py-1 font-mono text-[11px] transition-all ${
                    config.aspect === a.value
                      ? "border border-emerald-500/50 bg-emerald-500/20 text-emerald-400"
                      : "border border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
            <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              <Radio className="h-3 w-3 text-emerald-500" /> Live source · Resolume ready
            </span>
          </div>

          <div ref={stageWrapRef} className={`relative flex-1 overflow-hidden rounded-lg border border-zinc-800 bg-black ${fs ? "border-none" : ""}`}>
            <VisualStage config={config} clean={fs} />
          </div>
        </section>

        {/* RIGHT — CONTROL RACK */}
        <aside className="flex min-h-0 flex-col rounded-lg border border-zinc-800 bg-[#121215] lg:col-span-5 xl:col-span-4">
          <Tabs defaultValue="text" className="flex min-h-0 flex-1 flex-col">
            <TabsList className="grid w-full grid-cols-6 rounded-none rounded-t-lg border-b border-zinc-800 bg-zinc-900/60 p-1">
              {[
                ["text", "Testo"],
                ["move", "Trasf"],
                ["fx", "FX"],
                ["media", "Media"],
                ["font", "Font"],
                ["scenes", "Scene"],
              ].map(([v, l]) => (
                <TabsTrigger key={v} value={v} data-testid={`tab-${v}`} className="rounded font-mono text-[10px] uppercase tracking-wider text-zinc-400 data-[state=active]:bg-zinc-800 data-[state=active]:text-emerald-400">
                  {l}
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <TabsContent value="text" className="mt-0"><TextPanel config={config} update={update} /></TabsContent>
              <TabsContent value="move" className="mt-0"><TransformPanel config={config} update={update} /></TabsContent>
              <TabsContent value="fx" className="mt-0"><AnimatePanel config={config} updateAnim={updateAnim} /></TabsContent>
              <TabsContent value="media" className="mt-0"><MediaPanel config={config} updateMedia={updateMedia} /></TabsContent>
              <TabsContent value="font" className="mt-0"><FontPanel config={config} update={update} customFonts={customFonts} onUploadFont={(f) => setCustomFonts((p) => (p.includes(f) ? p : [...p, f]))} /></TabsContent>
              <TabsContent value="scenes" className="mt-0"><ScenePanel config={config} applyScene={applyScene} scenesRef={scenesRef} /></TabsContent>
            </div>
          </Tabs>
          <button
            data-testid="reset-all-button"
            onClick={() => setConfig(defaultConfig)}
            className="flex items-center justify-center gap-1.5 border-t border-zinc-800 py-2.5 font-mono text-[11px] uppercase tracking-wider text-zinc-500 transition-all hover:text-zinc-300"
          >
            <RotateCcw className="h-3 w-3" /> Reset totale
          </button>
        </aside>
      </div>
    </div>
  );
}
