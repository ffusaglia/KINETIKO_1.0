// Canvas mirror of <GridStage/> — used to export a JPG frame and to record a video
// clip. It replays the exact layout math so the capture matches what's on screen,
// including duotone media (done here via per-pixel luminance mapping instead of the
// SVG filters, which don't survive a canvas export).
import { effectivePalette } from "@/lib/grid";

let _mctx;
function mctx() {
  if (!_mctx) _mctx = document.createElement("canvas").getContext("2d");
  return _mctx;
}
function textWidthAt1px(text, font) {
  const c = mctx();
  c.font = `900 100px ${font}`;
  return c.measureText(text || " ").width / 100;
}
function layoutLines(words, fontSize, maxW, font) {
  const c = mctx();
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
function fitLines(lines, w, h, font) {
  const c = mctx();
  c.font = `900 100px ${font}`;
  let maxRatio = 0.0001;
  for (const l of lines) maxRatio = Math.max(maxRatio, c.measureText(l).width / 100);
  const byW = (w * 0.92) / maxRatio;
  const byH = (h * 0.9) / (lines.length * 1.04);
  return Math.max(6, Math.min(byW, byH));
}
function hexToRgb(hex) {
  const h = (hex || "#000000").replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}

function drawDuotone(ctx, el, x, y, w, h, c0, c1) {
  const iw = el.videoWidth || el.naturalWidth || el.width;
  const ih = el.videoHeight || el.naturalHeight || el.height;
  if (!iw || !ih || w <= 0 || h <= 0) return;
  const tw = Math.max(1, Math.round(w)), th = Math.max(1, Math.round(h));
  const tmp = document.createElement("canvas");
  tmp.width = tw; tmp.height = th;
  const t = tmp.getContext("2d");
  const scale = Math.max(tw / iw, th / ih); // cover
  const dw = iw * scale, dh = ih * scale;
  try { t.drawImage(el, (tw - dw) / 2, (th - dh) / 2, dw, dh); } catch { return; }
  let img;
  try { img = t.getImageData(0, 0, tw, th); } catch { return; }
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = (d[i] * 0.33 + d[i + 1] * 0.34 + d[i + 2] * 0.33) / 255;
    d[i] = c0[0] + (c1[0] - c0[0]) * lum;
    d[i + 1] = c0[1] + (c1[1] - c0[1]) * lum;
    d[i + 2] = c0[2] + (c1[2] - c0[2]) * lum;
    d[i + 3] = 255;
  }
  t.putImageData(img, 0, 0);
  ctx.drawImage(tmp, x, y);
}

function setLS(ctx, px) { try { ctx.letterSpacing = `${px}px`; } catch { /* unsupported */ } }

export function paintScene(ctx, scene, config, W, H, mediaEls = {}) {
  if (!scene || !scene.cells) return;
  const eff = effectivePalette(config.color1, config.color2, config.invert);
  const fam = `"${config.font}", sans-serif`;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = eff.fg;
  ctx.fillRect(0, 0, W, H);
  const inset = 1.5;

  scene.cells.forEach((c, i) => {
    const a = scene.assign[i];
    if (!a || !c) return;
    const x = c.x * W + inset, y = c.y * H + inset, w = c.w * W - inset * 2, h = c.h * H - inset * 2;
    if (w <= 0 || h <= 0) return;
    const bg = a.inv ? eff.fg : eff.bg;
    const fg = a.inv ? eff.bg : eff.fg;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    if (a.type === "media") {
      ctx.fillStyle = eff.bg;
      ctx.fillRect(x, y, w, h);
      const el = mediaEls[a.mediaId];
      if (el) {
        const c0 = a.inv ? hexToRgb(eff.bg) : hexToRgb(eff.fg);
        const c1 = a.inv ? hexToRgb(eff.fg) : hexToRgb(eff.bg);
        drawDuotone(ctx, el, x, y, w, h, c0, c1);
      }
    } else if (a.type === "meta") {
      ctx.fillStyle = bg;
      ctx.fillRect(x, y, w, h);
      const ls = (config.metaText || "").split(";").map((s) => s.trim().toUpperCase()).filter(Boolean);
      const lines = ls.length ? ls : [" "];
      const fs = fitLines(lines, w, h, fam);
      ctx.fillStyle = fg;
      ctx.font = `900 ${fs}px ${fam}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      setLS(ctx, -0.02 * fs);
      const lineH = fs * 1.04;
      let cy = y + h / 2 - (lines.length * lineH) / 2 + lineH / 2;
      lines.forEach((line) => { ctx.fillText(line, x + w / 2, cy); cy += lineH; });
      setLS(ctx, 0);
    } else {
      ctx.fillStyle = bg;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = fg;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const words = a.token.split(" ").filter(Boolean);
      if (words.length > 1) {
        const fit = fitWrapped(words, w, h, fam);
        ctx.font = `900 ${fit.fontSize}px ${fam}`;
        setLS(ctx, -0.03 * fit.fontSize);
        const lineH = fit.fontSize * 0.98;
        let cy = y + h / 2 - (fit.lines.length * lineH) / 2 + lineH / 2;
        fit.lines.forEach((line) => { ctx.fillText(line, x + w / 2, cy); cy += lineH; });
        setLS(ctx, 0);
      } else {
        const vertical = h > w * 1.2;
        const availLong = vertical ? h : w;
        const availThick = vertical ? w : h;
        const perPx = textWidthAt1px(a.token, fam) || 1;
        const fontSize = Math.max(6, Math.min((availLong * 0.94) / perPx, availThick * 0.82));
        ctx.font = `900 ${fontSize}px ${fam}`;
        setLS(ctx, -0.03 * fontSize);
        if (vertical) {
          ctx.translate(x + w / 2, y + h / 2);
          ctx.rotate(-Math.PI / 2);
          ctx.fillText(a.token, 0, 0);
        } else {
          ctx.fillText(a.token, x + w / 2, y + h / 2);
        }
        setLS(ctx, 0);
      }
    }
    ctx.restore();
  });
}

// Nice export resolution from an "rw/rh" aspect string (long edge capped at 1920).
export function targetDims(aspect) {
  const [rw, rh] = (aspect || "16/9").split("/").map(Number);
  let h = 1080, w = Math.round((h * rw) / rh);
  if (w > 1920) { w = 1920; h = Math.round((w * rh) / rw); }
  return { w, h };
}

export function pickVideoMime() {
  // WebM (VP9/VP8) is what MediaRecorder reliably produces. In-browser MP4
  // recording is experimental and tends to emit corrupt files, so it's last resort.
  const cands = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",
  ];
  if (typeof MediaRecorder === "undefined") return "";
  for (const m of cands) { if (MediaRecorder.isTypeSupported(m)) return m; }
  return "";
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
