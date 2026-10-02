// Generative broken-grid engine.
// Topology (BSP tree) + content assignment are STABLE per topoSeed. On a beat/cut only the
// split ratios morph (cells grow/shrink in place). Colours are defined by two free RGB colours
// (color1 = background, color2 = ink/accent); images are auto-converted to those two tones.

export const GRID_FONTS = ["Archivo Black", "Anton", "Bebas Neue", "Unbounded", "Syne", "Space Grotesk"];

export const defaultGridConfig = {
  text: "KINETIKO VISUAL",
  metaText: "TYPE;IMAGE;VIDEO;VISUAL TOOL",
  font: "Archivo Black",
  metaFont: "Archivo Black",
  fontWeight: 900,
  metaWeight: 900,
  metaAlign: "center",
  color1: "#FFFFFF",
  color2: "#1E32FF",
  invert: false,
  flipOnCut: true,
  wrap: false,
  bpm: 124,
  cutEvery: 2,
  count: 6,
  sizeVar: 5,
  resizeMode: "all", // all | progressive
  dynamic: false,
  micSens: 1.35,
  audioBand: "bass",
  intBass: 1,
  intMid: 1,
  intHigh: 1,
  aspect: "16/9",
  media: { clips: [] },
};

// color1 = background, color2 = foreground/ink. invert swaps them.
export function effectivePalette(color1, color2, invert) {
  return invert ? { bg: color2, fg: color1 } : { bg: color1, fg: color2 };
}

export function deriveTokens(text, wrap) {
  const parts = wrap ? (text || "").split(";") : (text || "").split(/[;\s]+/);
  return parts.map((t) => t.trim()).filter(Boolean);
}

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildTopology(seed, count) {
  const rand = rng(Math.imul(seed, 2654435761) + 1);
  let idc = 0;
  const root = { leaf: true, id: idc++, w: 1, h: 1 };
  let leaves = [root];
  while (leaves.length < count) {
    leaves.sort((a, b) => b.w * b.h - a.w * a.h);
    const leaf = leaves.splice(Math.floor(rand() * Math.min(leaves.length, 3)), 1)[0];
    const dir = leaf.w > leaf.h * 1.05 ? "v" : leaf.h > leaf.w * 1.05 ? "h" : rand() > 0.5 ? "v" : "h";
    const a = { leaf: true, id: leaf.id };
    const b = { leaf: true, id: idc++ };
    if (dir === "v") { a.w = leaf.w / 2; a.h = leaf.h; b.w = leaf.w / 2; b.h = leaf.h; }
    else { a.w = leaf.w; a.h = leaf.h / 2; b.w = leaf.w; b.h = leaf.h / 2; }
    leaf.leaf = false; leaf.dir = dir; leaf.a = a; leaf.b = b;
    delete leaf.id; delete leaf.w; delete leaf.h;
    leaves.push(a, b);
  }
  return root;
}

function computeBaseRects(tree, seed) {
  const rand = rng(Math.imul(seed, 40503) + 7);
  const out = {};
  (function rec(node, x, y, w, h) {
    if (node.leaf) { out[node.id] = { x, y, w, h }; return; }
    const r = 0.32 + rand() * 0.36;
    if (node.dir === "v") { const w1 = w * r; rec(node.a, x, y, w1, h); rec(node.b, x + w1, y, w - w1, h); }
    else { const h1 = h * r; rec(node.a, x, y, w, h1); rec(node.b, x, y + h1, w, h - h1); }
  })(tree, 0, 0, 1, 1);
  return out;
}

function computeRectsFromRatios(tree, ratios) {
  const out = {};
  let k = 0;
  (function rec(node, x, y, w, h) {
    if (node.leaf) { out[node.id] = { x, y, w, h }; return; }
    const r = ratios[k++];
    const rr = r == null ? 0.5 : r;
    if (node.dir === "v") { const w1 = w * rr; rec(node.a, x, y, w1, h); rec(node.b, x + w1, y, w - w1, h); }
    else { const h1 = h * rr; rec(node.a, x, y, w, h1); rec(node.b, x, y + h1, w, h - h1); }
  })(tree, 0, 0, 1, 1);
  return out;
}

export function ratioSpread(sizeVar) {
  return 0.12 + ((Math.max(1, Math.min(10, sizeVar)) - 1) / 9) * 0.62;
}
export function randomRatios(count, sizeVar) {
  const s = ratioSpread(sizeVar);
  const out = [];
  for (let i = 0; i < count - 1; i++) out.push(0.5 - s / 2 + Math.random() * s);
  return out;
}
export function mutateRatios(ratios, k, sizeVar, weights) {
  const s = ratioSpread(sizeVar);
  const out = ratios.slice();
  let idxs = [...out.keys()];
  if (weights && weights.length === out.length) {
    idxs.sort((a, b) => weights[a] - weights[b] || Math.random() - 0.5);
  } else {
    for (let i = idxs.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idxs[i], idxs[j]] = [idxs[j], idxs[i]]; }
  }
  for (let i = 0; i < Math.min(k, idxs.length); i++) out[idxs[i]] = 0.5 - s / 2 + Math.random() * s;
  return out;
}
export function topologyWeights(topoSeed, count) {
  const tree = buildTopology(topoSeed, count);
  const weights = [];
  (function rec(node) {
    if (node.leaf) return 1;
    const idx = weights.length;
    weights.push(0);
    const total = rec(node.a) + rec(node.b);
    weights[idx] = total;
    return total;
  })(tree);
  return weights;
}

// One media clip = one rectangle (media occupy the SMALLEST cells; text keeps the larger ones).
function assignContent(topoSeed, baseCells, tokens, media) {
  const rand = rng(Math.imul(topoSeed, 22695) + 13);
  const n = baseCells.length;
  const order = [...baseCells.keys()].sort((a, b) => baseCells[b].w * baseCells[b].h - baseCells[a].w * baseCells[a].h);
  const assign = new Array(n);
  const metaIdx = order[Math.min(n - 1, 1 + Math.floor(rand() * Math.max(1, n - 2)))];
  const nonMeta = order.filter((i) => i !== metaIdx);
  const mediaCount = Math.min(media.length, nonMeta.length);
  const mediaSet = new Set(nonMeta.slice(nonMeta.length - mediaCount));
  let mi = 0, ti = 0;
  for (const idx of nonMeta) {
    if (mediaSet.has(idx)) { assign[idx] = { type: "media", mediaId: media[mi % media.length].id }; mi++; }
    else { assign[idx] = { type: "text", token: tokens[ti % Math.max(1, tokens.length)] || "303" }; ti++; }
  }
  assign[metaIdx] = { type: "meta" };
  // Alternate colours: balanced ~50% mix.
  const inds = [...assign.keys()];
  for (let i = inds.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [inds[i], inds[j]] = [inds[j], inds[i]]; }
  const half = Math.floor(n / 2);
  inds.forEach((idx, pos) => { if (assign[idx]) assign[idx].inv = pos < half; });
  return assign;
}

export function buildScene(topoSeed, count, tokens, media, ratios) {
  const safeTokens = tokens.length ? tokens : ["303"];
  const tree = buildTopology(topoSeed, count);
  const baseMap = computeBaseRects(tree, topoSeed);
  const baseCells = [];
  for (let i = 0; i < count; i++) baseCells[i] = baseMap[i];
  const assign = assignContent(topoSeed, baseCells, safeTokens, media);
  const useRatios = ratios && ratios.length === count - 1 ? ratios : null;
  const liveMap = useRatios ? computeRectsFromRatios(tree, useRatios) : baseMap;
  const cells = [];
  for (let i = 0; i < count; i++) cells[i] = liveMap[i];
  return { cells, assign };
}
