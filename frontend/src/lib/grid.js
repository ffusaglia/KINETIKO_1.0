// Generative broken-grid engine.
// Topology (BSP tree) + content assignment are STABLE per topoSeed. On a beat/cut only the
// split ratios morph (cells grow/shrink in place). Ratios are managed by the studio so we can
// morph ALL of them or only a few at a time (progressive mode). Cells never swap content or
// position on a cut — a reshuffle happens only when topoSeed changes (palette / Restructure /
// complexity / media change).

export const PALETTES = {
  bw: { bg: "#FFFFFF", fg: "#0A0A0A", label: "Nero/Bianco" },
  blue: { bg: "#FFFFFF", fg: "#1E32FF", label: "Blu/Bianco" },
  red: { bg: "#FFFFFF", fg: "#FF1E1E", label: "Rosso/Bianco" },
};

export const GRID_FONTS = ["Archivo Black", "Anton", "Bebas Neue", "Unbounded", "Syne", "Space Grotesk"];

export const defaultGridConfig = {
  text: "303 MTL PLUGIN",
  metaText: "303MTLPLUGIN;POLYAMOR;124 BPM;IDX-949",
  font: "Archivo Black",
  palette: "blue",
  invert: false,
  flipOnCut: true,
  wrap: false,
  bpm: 124,
  cutEvery: 2,
  count: 6,
  sizeVar: 5,
  resizeMode: "all", // all | progressive
  micSens: 1.35,
  aspect: "16/9",
  media: { clips: [] },
};

export function effectivePalette(key, invert) {
  const p = PALETTES[key] || PALETTES.bw;
  return invert ? { bg: p.fg, fg: p.bg } : { bg: p.bg, fg: p.fg };
}

export function deriveTokens(text, wrap) {
  const parts = wrap ? (text || "").split(";") : (text || "").split(/[;\s]+/);
  return parts.map((t) => t.trim()).filter(Boolean).map((t) => t.toUpperCase());
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

// Base rects with a fixed spread (used only for stable content ordering).
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

// Live rects from an explicit ratios array (positional, pre-order over internal nodes).
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

// sizeVar 1..10 → ratio spread around 0.5 (mild → strong size differences).
export function ratioSpread(sizeVar) {
  return 0.12 + ((Math.max(1, Math.min(10, sizeVar)) - 1) / 9) * 0.62;
}
export function randomRatios(count, sizeVar) {
  const s = ratioSpread(sizeVar);
  const out = [];
  for (let i = 0; i < count - 1; i++) out.push(0.5 - s / 2 + Math.random() * s);
  return out;
}
// Change only `k` ratios (progressive mode) keeping the rest in place.
export function mutateRatios(ratios, k, sizeVar) {
  const s = ratioSpread(sizeVar);
  const out = ratios.slice();
  const idxs = [...out.keys()];
  for (let i = idxs.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idxs[i], idxs[j]] = [idxs[j], idxs[i]]; }
  for (let i = 0; i < Math.min(k, idxs.length); i++) out[idxs[i]] = 0.5 - s / 2 + Math.random() * s;
  return out;
}

function assignContent(topoSeed, baseCells, tokens, media) {
  const rand = rng(Math.imul(topoSeed, 22695) + 13);
  const n = baseCells.length;
  const order = [...baseCells.keys()].sort((a, b) => baseCells[b].w * baseCells[b].h - baseCells[a].w * baseCells[a].h);
  const assign = new Array(n);
  const metaIdx = order[Math.min(n - 1, 1 + Math.floor(rand() * Math.max(1, n - 2)))];
  let ti = 0;
  for (const idx of order) {
    if (idx === metaIdx) continue;
    const useMedia = media.length > 0 && (ti >= tokens.length || rand() < 0.4);
    if (useMedia) assign[idx] = { type: "media", mediaId: media[Math.floor(rand() * media.length)].id };
    else { assign[idx] = { type: "text", token: tokens[ti % Math.max(1, tokens.length)] || "303" }; ti++; }
  }
  assign[metaIdx] = { type: "meta" };
  // Alternate colors: guarantee a balanced ~50% mix (not all cells the same color).
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
