import { useEffect, useRef, useState } from "react";
import { effectivePalette } from "@/lib/grid";
import { stageSize } from "@/lib/render";

const EASE = "cubic-bezier(0.45,0.05,0.15,1)";
const DUR = "0.5s";
const COLOR_TR = "background-color 0.4s ease-in-out, color 0.4s ease-in-out";

let _ctx;
function ctx() {
  if (!_ctx) _ctx = document.createElement("canvas").getContext("2d");
  return _ctx;
}
function textWidthAt1px(text, font) {
  const c = ctx();
  c.font = `900 100px ${font}`;
  return c.measureText(text || " ").width / 100;
}
// Greedy line-break at a given font size; returns lines + widest line.
function layoutLines(words, fontSize, maxW, font) {
  const c = ctx();
  c.font = `900 ${fontSize}px ${font}`;
  const spaceW = c.measureText(" ").width;
  const lines = [];
  let cur = "", curW = 0;
  for (const w of words) {
    const ww = c.measureText(w).width;
    if (cur === "") { cur = w; curW = ww; }
    else if (curW + spaceW + ww <= maxW) { cur += " " + w; curW += spaceW + ww; }
    else { lines.push(cur); cur = w; curW = ww; }
  }
  if (cur) lines.push(cur);
  let widest = 0;
  for (const l of lines) widest = Math.max(widest, c.measureText(l).width);
  return { lines, widest };
}
// Largest font size that fits the wrapped words inside w×h.
function fitWrapped(words, w, h, font) {
  let lo = 6, hi = Math.max(8, Math.floor(h)), best = { fontSize: 6, lines: words };
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const { lines, widest } = layoutLines(words, mid, w * 0.96, font);
    const totalH = lines.length * mid * 0.98;
    if (widest <= w * 0.96 && totalH <= h * 0.92) { best = { fontSize: mid, lines }; lo = mid + 1; }
    else hi = mid - 1;
  }
  return best;
}

export default function GridStage({ scene, config, clean = false }) {
  const wrapRef = useRef(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [, setFontTick] = useState(0);

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
      <div data-testid="grid-stage" className="relative overflow-hidden" style={{ width: dims.w, height: dims.h, background: eff.fg, transition: COLOR_TR }}>
        {scene.cells.map((c, i) => {
          const a = scene.assign[i];
          if (!a || !c) return null;
          const rect = { left: c.x * dims.w, top: c.y * dims.h, width: c.w * dims.w, height: c.h * dims.h };
          return (
            <div key={i} className="absolute" style={{ ...rect, transition: `left ${DUR} ${EASE}, top ${DUR} ${EASE}, width ${DUR} ${EASE}, height ${DUR} ${EASE}` }}>
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
      <div className="flex h-full w-full flex-col justify-start p-[3%]" style={{ background: bg, color: fg, transition: COLOR_TR }}>
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
    if (!clip) return <div className="h-full w-full" style={{ background: eff.fg, transition: COLOR_TR }} />;
    const ms = { width: "100%", height: "100%", objectFit: "cover", filter: "grayscale(1) contrast(1.2) brightness(1.05)", mixBlendMode: "screen" };
    return (
      <div className="h-full w-full" style={{ background: eff.fg, transition: COLOR_TR }}>
        {clip.kind === "video" ? (
          <video src={clip.url} autoPlay loop muted playsInline style={ms} />
        ) : (
          <img src={clip.url} alt="" style={ms} />
        )}
      </div>
    );
  }

  // text
  const bg = a.inv ? eff.fg : eff.bg;
  const fg = a.inv ? eff.bg : eff.fg;
  const fam = `"${config.font}", sans-serif`;
  const words = a.token.split(" ").filter(Boolean);
  const multi = words.length > 1;

  if (multi) {
    const fit = fitWrapped(words, w, h, fam);
    return (
      <div className="flex h-full w-full flex-col items-center justify-center overflow-hidden text-center" style={{ background: bg, transition: COLOR_TR }}>
        {fit.lines.map((line, li) => (
          <span key={li} style={{ color: fg, fontFamily: fam, fontWeight: 900, fontSize: fit.fontSize, lineHeight: 0.98, letterSpacing: "-0.03em", textTransform: "uppercase", whiteSpace: "nowrap", transition: `font-size ${DUR} ${EASE}, color 0.4s ease-in-out` }}>
            {line}
          </span>
        ))}
      </div>
    );
  }

  const vertical = h > w * 1.2;
  const availLong = vertical ? h : w;
  const availThick = vertical ? w : h;
  const perPx = textWidthAt1px(a.token, fam) || 1;
  const fontSize = Math.max(6, Math.min((availLong * 0.94) / perPx, availThick * 0.82));
  return (
    <div className="flex h-full w-full items-center justify-center overflow-hidden" style={{ background: bg, transition: COLOR_TR }}>
      <span
        style={{
          color: fg, fontFamily: fam, fontWeight: 900, fontSize, lineHeight: 0.82,
          letterSpacing: "-0.03em", textTransform: "uppercase", whiteSpace: "nowrap",
          transform: vertical ? "rotate(-90deg)" : "none", transformOrigin: "center",
          transition: `font-size ${DUR} ${EASE}, color 0.4s ease-in-out`,
        }}
      >
        {a.token}
      </span>
    </div>
  );
}
