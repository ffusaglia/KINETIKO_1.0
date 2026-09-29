import { useEffect, useRef, useState } from "react";
import GridStage from "@/components/GridStage";
import { defaultGridConfig, buildScene, deriveTokens } from "@/lib/grid";

// Clean grid output window for capture into Resolume / OBS.
export default function GridOutput() {
  const [state, setState] = useState({
    scene: buildScene(1, 1, defaultGridConfig.count, deriveTokens(defaultGridConfig.text, defaultGridConfig.wrap), []),
    config: defaultGridConfig,
  });
  const chRef = useRef(null);

  useEffect(() => {
    const ch = new BroadcastChannel("vj-grid");
    chRef.current = ch;
    ch.onmessage = (e) => {
      if (e.data?.type === "scene") setState({ scene: e.data.scene, config: e.data.config });
    };
    ch.postMessage({ type: "request" });
    document.title = "VJ · GRID OUTPUT";
    return () => ch.close();
  }, []);

  return (
    <div className="h-screen w-screen bg-black">
      <GridStage scene={state.scene} config={state.config} clean />
    </div>
  );
}
