// Core real-time render logic for the VJ kinetic type engine.

export const ASPECTS = [
  { label: "16:9", value: "16/9" },
  { label: "4:3", value: "4/3" },
  { label: "3:4", value: "3/4" },
  { label: "1:1", value: "1/1" },
  { label: "9:16", value: "9/16" },
  { label: "21:9", value: "21/9" },
];

export const GOOGLE_FONTS = [
  "Anton",
  "Bebas Neue",
  "Syne",
  "Unbounded",
  "Space Grotesk",
  "Cinzel",
  "Playfair Display",
  "JetBrains Mono",
  "Chivo Mono",
  "Caveat",
  "Inter",
];

export const BLEND_MODES = [
  "normal",
  "screen",
  "multiply",
  "overlay",
  "difference",
  "exclusion",
  "lighten",
  "darken",
];

export const PRESETS = [
  { key: "wave", label: "Wave" },
  { key: "pulse", label: "Pulse BPM" },
  { key: "bounce", label: "Bounce" },
  { key: "glitch", label: "Glitch" },
  { key: "zoom", label: "Infinite Zoom" },
  { key: "drift", label: "Drift" },
  { key: "jitter", label: "Jitter" },
  { key: "blink", label: "Blink" },
];

const anim = () => ({ on: false, speed: 1, amp: 1 });

export const defaultConfig = {
  text: "FEDERICO;BLU",
  font: "Anton",
  uppercase: true,
  letterSpacing: 0,
  lineHeight: 0.92,
  align: "center",
  fontScale: 1,
  textColor: "#FFFFFF",
  bgColor: "#000000",
  aspect: "16/9",
  posX: 0,
  posY: 0,
  scale: 1,
  stretchX: 1,
  stretchY: 1,
  rotation: 0,
  skewX: 0,
  skewY: 0,
  opacity: 1,
  glow: 0,
  animations: {
    wave: anim(),
    pulse: anim(),
    bounce: anim(),
    glitch: anim(),
    zoom: anim(),
    drift: anim(),
    jitter: anim(),
    blink: anim(),
  },
  media: {
    clips: [],
    activeClipId: null,
    mode: "off", // off | background | alternate
    blend: "normal",
    speed: 1,
    interval: 4,
    opacity: 1,
    fit: "cover",
  },
};

function pseudo(n) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function parseLines(text, uppercase) {
  const raw = uppercase ? (text || "").toUpperCase() : text || "";
  const lines = raw.split(";");
  let g = 0;
  return lines.map((line, li) => ({
    li,
    chars: Array.from(line).map((ch) => ({ g: g++, ch: ch === " " ? "\u00A0" : ch })),
  }));
}

export function computeBlockStyle(cfg, t, w, h) {
  const T = t / 1000;
  const a = cfg.animations;
  let tx = (cfg.posX / 100) * (w / 2);
  let ty = (cfg.posY / 100) * (h / 2);
  let sc = cfg.scale;
  let sx = cfg.stretchX;
  let sy = cfg.stretchY;
  let rot = cfg.rotation;
  let op = cfg.opacity;

  if (a.pulse.on) sc *= 1 + Math.sin(T * Math.PI * 2 * a.pulse.speed) * 0.15 * a.pulse.amp;
  if (a.zoom.on) sc *= 1 + Math.sin(T * a.zoom.speed * 1.1) * 0.45 * a.zoom.amp;
  if (a.bounce.on) ty -= Math.abs(Math.sin(T * Math.PI * a.bounce.speed)) * h * 0.14 * a.bounce.amp;
  if (a.drift.on) {
    tx += Math.sin(T * 0.7 * a.drift.speed) * w * 0.09 * a.drift.amp;
    ty += Math.cos(T * 0.5 * a.drift.speed) * h * 0.09 * a.drift.amp;
    rot += Math.sin(T * 0.6 * a.drift.speed) * 12 * a.drift.amp;
  }
  if (a.glitch.on) {
    const s = pseudo(Math.floor(T * 14 * a.glitch.speed));
    if (s > 0.6) tx += (pseudo(s * 99) - 0.5) * w * 0.05 * a.glitch.amp;
  }
  if (a.blink.on) {
    const ph = Math.sin(T * Math.PI * 2 * a.blink.speed);
    op *= ph > 0 ? 1 : 1 - 0.9 * a.blink.amp;
  }

  const scaleX = sc * sx;
  const scaleY = sc * sy;
  return {
    transform: `translate(-50%,-50%) translate(${tx}px,${ty}px) rotate(${rot}deg) skew(${cfg.skewX}deg,${cfg.skewY}deg) scale(${scaleX},${scaleY})`,
    opacity: op,
    textShadow:
      cfg.glow > 0
        ? `0 0 ${cfg.glow}px ${cfg.textColor}, 0 0 ${cfg.glow * 2}px ${cfg.textColor}`
        : "none",
  };
}

export function computeCharStyle(cfg, t, i) {
  const T = t / 1000;
  const a = cfg.animations;
  let cx = 0;
  let cy = 0;
  if (a.wave.on) cy += Math.sin(T * 3 * a.wave.speed + i * 0.6) * 0.28 * a.wave.amp;
  if (a.jitter.on) {
    cx += (Math.random() - 0.5) * 0.12 * a.jitter.amp;
    cy += (Math.random() - 0.5) * 0.12 * a.jitter.amp;
  }
  if (a.glitch.on) {
    const seed = Math.floor(T * 12 * a.glitch.speed) + i * 7;
    if (pseudo(seed) > 0.7) cx += (pseudo(seed * 3) - 0.5) * 0.5 * a.glitch.amp;
  }
  return `translate(${cx}em, ${cy}em)`;
}

export function stageSize(cw, ch, aspect) {
  const [rw, rh] = aspect.split("/").map(Number);
  const ratio = rw / rh;
  let w, h;
  if (cw / ch > ratio) {
    h = ch;
    w = ch * ratio;
  } else {
    w = cw;
    h = cw / ratio;
  }
  return { w: Math.floor(w), h: Math.floor(h) };
}
