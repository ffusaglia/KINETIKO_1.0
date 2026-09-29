import { useEffect, useRef, useState } from "react";
import VisualStage from "@/components/VisualStage";
import { defaultConfig } from "@/lib/render";

// Clean output window for capture into Resolume Arena / OBS. Receives live config over BroadcastChannel.
export default function Output() {
  const [config, setConfig] = useState(defaultConfig);
  const chRef = useRef(null);

  useEffect(() => {
    const ch = new BroadcastChannel("vj-visual");
    chRef.current = ch;
    ch.onmessage = (e) => {
      if (e.data?.type === "config") setConfig(e.data.config);
    };
    ch.postMessage({ type: "request" });
    document.title = "VJ · OUTPUT";
    return () => ch.close();
  }, []);

  return (
    <div className="h-screen w-screen bg-black">
      <VisualStage config={config} clean />
    </div>
  );
}
