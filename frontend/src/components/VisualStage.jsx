import { useEffect, useMemo, useRef, useState } from "react";
import { computeBlockStyle, computeCharStyle, parseLines, stageSize } from "@/lib/render";

// The shared real-time renderer used by both the studio preview and the pop-out output.
export default function VisualStage({ config, clean = false }) {
  const wrapRef = useRef(null);
  const stageRef = useRef(null);
  const blockRef = useRef(null);
  const videoRef = useRef(null);
  const charRefs = useRef([]);
  const cfgRef = useRef(config);
  const dimsRef = useRef({ w: 0, h: 0 });
  const startRef = useRef(performance.now());
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [showClip, setShowClip] = useState(false);

  cfgRef.current = config;

  const parsed = useMemo(
    () => parseLines(config.text, config.uppercase),
    [config.text, config.uppercase]
  );

  // Fit the stage to the wrapper while keeping the chosen aspect ratio.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => {
      const { clientWidth, clientHeight } = wrap;
      const s = stageSize(clientWidth, clientHeight, config.aspect);
      dimsRef.current = s;
      setDims(s);
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [config.aspect]);

  // Real-time animation loop (transforms applied via refs to keep 60fps).
  useEffect(() => {
    let raf;
    const loop = (now) => {
      const t = now - startRef.current;
      const cfg = cfgRef.current;
      const { w, h } = dimsRef.current;
      if (blockRef.current) {
        const s = computeBlockStyle(cfg, t, w, h);
        blockRef.current.style.transform = s.transform;
        blockRef.current.style.opacity = s.opacity;
        blockRef.current.style.textShadow = s.textShadow;
      }
      const a = cfg.animations;
      const anyChar = a.wave.on || a.jitter.on || a.glitch.on;
      const chars = charRefs.current;
      for (let i = 0; i < chars.length; i++) {
        const el = chars[i];
        if (!el) continue;
        if (anyChar) el.style.transform = computeCharStyle(cfg, t, i);
        else if (el.style.transform) el.style.transform = "";
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const m = config.media;
  const activeClip = m.clips.find((c) => c.id === m.activeClipId) || m.clips[0];
  const clipUrl = activeClip?.url;

  // Alternate mode: swap between text and clip on an interval.
  useEffect(() => {
    if (m.mode !== "alternate" || !clipUrl) {
      setShowClip(false);
      return;
    }
    const id = setInterval(() => setShowClip((s) => !s), Math.max(0.2, m.interval) * 1000);
    return () => clearInterval(id);
  }, [m.mode, clipUrl, m.interval]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = m.speed;
  }, [m.speed, clipUrl, showClip]);

  const textVisible = !(m.mode === "alternate" && showClip);
  const videoVisible = clipUrl && (m.mode === "background" || (m.mode === "alternate" && showClip));
  const fontSize = dims.h * 0.22 * config.fontScale;

  return (
    <div
      ref={wrapRef}
      data-testid="visual-stage-wrap"
      className="relative flex h-full w-full items-center justify-center overflow-hidden bg-black"
    >
      <div
        ref={stageRef}
        data-testid="visual-stage"
        className="relative overflow-hidden"
        style={{ width: dims.w, height: dims.h, backgroundColor: config.bgColor }}
      >
        {videoVisible && (
          <video
            key={clipUrl}
            ref={videoRef}
            src={clipUrl}
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 h-full w-full"
            style={{
              objectFit: m.fit,
              opacity: m.opacity,
              mixBlendMode: m.blend,
              zIndex: m.mode === "background" ? 0 : 2,
            }}
          />
        )}

        <div
          ref={blockRef}
          className="absolute left-1/2 top-1/2 select-none"
          style={{
            zIndex: 1,
            color: config.textColor,
            fontFamily: `"${config.font}", sans-serif`,
            fontSize: fontSize,
            lineHeight: config.lineHeight,
            letterSpacing: `${config.letterSpacing / 100}em`,
            textAlign: config.align,
            fontWeight: 700,
            whiteSpace: "nowrap",
            transformOrigin: "center center",
            willChange: "transform",
            visibility: textVisible ? "visible" : "hidden",
          }}
        >
          {parsed.map((line) => (
            <div key={line.li} style={{ display: "block" }}>
              {line.chars.map((c) => (
                <span
                  key={c.g}
                  ref={(el) => (charRefs.current[c.g] = el)}
                  style={{ display: "inline-block", willChange: "transform" }}
                >
                  {c.ch}
                </span>
              ))}
            </div>
          ))}
        </div>

        {!clean && (
          <div className="pointer-events-none absolute inset-0 z-10 rounded-sm border border-zinc-800/70 shadow-[inset_0_0_80px_rgba(0,0,0,0.7)]" />
        )}
      </div>
    </div>
  );
}
