import { useEffect, useRef, useState } from "react";
import GridStage from "@/components/GridStage";
import { defaultGridConfig, buildScene, deriveTokens } from "@/lib/grid";

// Clean grid output window for capture into Resolume / OBS.
// Receives the live scene/config over BroadcastChannel, plus a dedicated 'media' message
// carrying the clip data URLs (so images/videos also render on the second monitor).
export default function GridOutput() {
  const [state, setState] = useState({
    scene: buildScene(1, defaultGridConfig.count, deriveTokens(defaultGridConfig.text, defaultGridConfig.wrap), [], null),
    config: defaultGridConfig,
    selected: [],
  });
  const mediaRef = useRef({});

  useEffect(() => {
    const ch = new BroadcastChannel("vj-grid");
    const rebuild = (cfg) => ({
      ...cfg,
      media: { clips: (cfg.media?.clips || []).map((c) => (mediaRef.current[c.id] ? { ...c, url: mediaRef.current[c.id].url } : c)) },
    });
    ch.onmessage = (e) => {
      const d = e.data;
      if (d?.type === "media") {
        mediaRef.current = Object.fromEntries((d.clips || []).map((c) => [c.id, c]));
        setState((s) => ({ ...s, config: rebuild(s.config) }));
      } else if (d?.type === "fonts") {
        (d.fonts || []).forEach((f) => {
          if (!document.fonts) return;
          try { const face = new FontFace(f.family, `url(${f.url})`); face.load().then((ff) => document.fonts.add(ff)); } catch {}
        });
      } else if (d?.type === "scene") {
        setState({ scene: d.scene, config: rebuild(d.config), selected: d.selected || [] });
      }
    };
    ch.postMessage({ type: "request" });
    document.title = "VJ · GRID OUTPUT";
    return () => ch.close();
  }, []);

  return (
    <div className="h-screen w-screen bg-black">
      <GridStage scene={state.scene} config={state.config} clean dynamic={state.config?.dynamic} selected={state.selected} />
    </div>
  );
}
