import { useEffect, useRef, useState } from "react";
import { effectivePalette } from "@/lib/grid";
import { stageSize } from "@/lib/render";

// Pure renderer of a generated grid scene. Used by studio preview, fullscreen and pop-out output.
export default function GridStage({ scene, config, clean = false }) {
  const wrapRef = useRef(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => {
      setDims(stageSize(wrap.clientWidth, wrap.clientHeight, config.aspect));
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [config.aspect]);

  const eff = effectivePalette(config.palette, config.invert);
  const clips = config.media?.clips || [];

  return (
    <div ref={wrapRef} className="relative flex h-full w-full items-center justify-center overflow-hidden bg-black">
      <div
        data-testid="grid-stage"
        className="relative overflow-hidden"
        style={{ width: dims.w, height: dims.h, background: eff.fg }}
      >
        {scene.cells.map((c, i) => {
          const a = scene.assign[i];
          if (!a) return null;
          const rect = {
            left: c.x * dims.w,
            top: c.y * dims.h,
            width: c.w * dims.w,
            height: c.h * dims.h,
          };
          return (
            <div
              key={i}
              className="absolute"
              style={{ ...rect, transition: "left .25s cubic-bezier(.7,0,.3,1), top .25s cubic-bezier(.7,0,.3,1), width .25s cubic-bezier(.7,0,.3,1), height .25s cubic-bezier(.7,0,.3,1)" }}
            >
              <div className="absolute overflow-hidden" style={{ inset: "1.5px" }}>
                <CellContent a={a} rect={rect} eff={eff} config={config} scene={scene} clips={clips} />
              </div>
            </div>
          );
        })}
        {!clean && (
          <div className="pointer-events-none absolute inset-0 border border-zinc-800/60" />
        )}
      </div>
    </div>
  );
}

function CellContent({ a, rect, eff, config, scene, clips }) {
  if (a.type === "meta") {
    const bg = a.inv ? eff.fg : eff.bg;
    const fg = a.inv ? eff.bg : eff.fg;
    return (
      <div className="flex h-full w-full flex-col justify-start p-[3%]" style={{ background: bg, color: fg }}>
        <div className="font-mono font-bold leading-tight" style={{ fontSize: Math.max(9, rect.height * 0.11) }}>
          <div>{config.title}</div>
          <div>{config.subtitle}</div>
          <div>{config.metaBpm} BPM</div>
          <div>{scene.idxCode}</div>
        </div>
      </div>
    );
  }

  if (a.type === "media") {
    const clip = clips.find((c) => c.id === a.mediaId);
    const bg = eff.fg;
    if (!clip) return <div className="h-full w-full" style={{ background: bg }} />;
    const mediaStyle = {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      filter: "grayscale(1) contrast(1.2) brightness(1.05)",
      mixBlendMode: "screen",
    };
    return (
      <div className="h-full w-full" style={{ background: bg }}>
        {clip.kind === "video" ? (
          <video src={clip.url} autoPlay loop muted playsInline style={mediaStyle} />
        ) : (
          <img src={clip.url} alt="" style={mediaStyle} />
        )}
      </div>
    );
  }

  // text
  const vertical = rect.height > rect.width * 1.2;
  const bg = a.inv ? eff.fg : eff.bg;
  const fg = a.inv ? eff.bg : eff.fg;
  const fontSize = (vertical ? rect.width : rect.height) * 0.82;
  return (
    <div className="flex h-full w-full items-center justify-center overflow-hidden" style={{ background: bg }}>
      <span
        style={{
          color: fg,
          fontFamily: `"${config.font}", sans-serif`,
          fontWeight: 900,
          fontSize,
          lineHeight: 0.78,
          letterSpacing: "-0.04em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
          transform: vertical ? "rotate(-90deg)" : "none",
          transformOrigin: "center",
        }}
      >
        {a.token}
      </span>
    </div>
  );
}
