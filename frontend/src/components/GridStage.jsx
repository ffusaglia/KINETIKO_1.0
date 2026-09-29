import { useEffect, useRef, useState } from "react";
import { effectivePalette } from "@/lib/grid";
import { stageSize } from "@/lib/render";

const EASE = "cubic-bezier(0.45,0.05,0.15,1)";
const DUR = "0.5s";

// Shared canvas for measuring text so we can auto-fit each cell.
let _ctx;
function textWidthAt1px(text, font) {
  if (!_ctx) _ctx = document.createElement("canvas").getContext("2d");
  _ctx.font = `900 100px ${font}`;
  return _ctx.measureText(text || " ").width / 100;
}

export default function GridStage({ scene, config, clean = false }) {
  const wrapRef = useRef(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [, setFontTick] = useState(0);

  // Re-measure once web fonts finish loading so auto-fit is accurate.
  useEffect(() => {
    let done = false;
    document.fonts?.ready?.then(() => { if (!done) setFontTick((t) => t + 1); });
    return () => { done = true; };
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => setDims(stageSize(wrap.clientWidth, wrap.clientHeight, config.aspect)));
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [config.aspect]);

  const eff = effectivePalette(config.palette, config.invert);
  const clips = config.media?.clips || [];
  const idxOverride = (config.idx || "").trim().replace(/^idx-?/i, "");

  return (
    <div ref={wrapRef} className="relative flex h-full w-full items-center justify-center overflow-hidden bg-black">
      <div data-testid="grid-stage" className="relative overflow-hidden" style={{ width: dims.w, height: dims.h, background: eff.fg }}>
        {scene.cells.map((c, i) => {
          const a = scene.assign[i];
          if (!a || !c) return null;
          const rect = { left: c.x * dims.w, top: c.y * dims.h, width: c.w * dims.w, height: c.h * dims.h };
          return (
            <div
              key={i}
              className="absolute"
              style={{ ...rect, transition: `left ${DUR} ${EASE}, top ${DUR} ${EASE}, width ${DUR} ${EASE}, height ${DUR} ${EASE}` }}
            >
              <div className="absolute overflow-hidden" style={{ inset: "1.5px" }}>
                <CellContent a={a} w={rect.width} h={rect.height} eff={eff} config={config} scene={scene} clips={clips} idxOverride={idxOverride} />
              </div>
            </div>
          );
        })}
        {!clean && <div className="pointer-events-none absolute inset-0 border border-zinc-800/60" />}
      </div>
    </div>
  );
}

function CellContent({ a, w, h, eff, config, scene, clips, idxOverride }) {
  if (a.type === "meta") {
    const bg = a.inv ? eff.fg : eff.bg;
    const fg = a.inv ? eff.bg : eff.fg;
    const fs = Math.max(9, Math.min(h * 0.12, w * 0.075));
    return (
      <div className="flex h-full w-full flex-col justify-start p-[3%]" style={{ background: bg, color: fg }}>
        <div className="font-mono font-bold leading-tight" style={{ fontSize: fs }}>
          <div>{config.title}</div>
          <div>{config.subtitle}</div>
          <div>{config.metaBpm} BPM</div>
          <div>{idxOverride ? `IDX-${idxOverride}` : scene.idxCode}</div>
        </div>
      </div>
    );
  }

  if (a.type === "media") {
    const clip = clips.find((c) => c.id === a.mediaId);
    if (!clip) return <div className="h-full w-full" style={{ background: eff.fg }} />;
    const ms = { width: "100%", height: "100%", objectFit: "cover", filter: "grayscale(1) contrast(1.2) brightness(1.05)", mixBlendMode: "screen" };
    return (
      <div className="h-full w-full" style={{ background: eff.fg }}>
        {clip.kind === "video" ? (
          <video src={clip.url} autoPlay loop muted playsInline style={ms} />
        ) : (
          <img src={clip.url} alt="" style={ms} />
        )}
      </div>
    );
  }

  // text — auto-fit to cell (width + height constrained)
  const vertical = h > w * 1.2;
  const bg = a.inv ? eff.fg : eff.bg;
  const fg = a.inv ? eff.bg : eff.fg;
  const fam = `"${config.font}", sans-serif`;
  const availLong = vertical ? h : w; // text runs along this
  const availThick = vertical ? w : h;
  const perPx = textWidthAt1px(a.token, fam) || 1;
  const byWidth = (availLong * 0.94) / perPx;
  const byHeight = availThick * 0.82;
  const fontSize = Math.max(6, Math.min(byWidth, byHeight));

  return (
    <div className="flex h-full w-full items-center justify-center overflow-hidden" style={{ background: bg }}>
      <span
        style={{
          color: fg,
          fontFamily: fam,
          fontWeight: 900,
          fontSize,
          lineHeight: 0.82,
          letterSpacing: "-0.03em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
          transform: vertical ? "rotate(-90deg)" : "none",
          transformOrigin: "center",
          transition: `font-size ${DUR} ${EASE}`,
        }}
      >
        {a.token}
      </span>
    </div>
  );
}
