// Generative broken-grid engine.
// Topology (BSP tree) is stable per topoSeed; split ratios re-randomize per cutSeed,
// so cells fluidly grow/shrink in place (ease-in-out via CSS) instead of teleporting.

export const PALETTES = {
  bw: { bg: "#FFFFFF", fg: "#0A0A0A", label: "Nero/Bianco" },
  blue: { bg: "#FFFFFF", fg: "#1E32FF", label: "Blu/Bianco" },
  red: { bg: "#FFFFFF", fg: "#FF1E1E", label: "Rosso/Bianco" },
};

export const GRID_FONTS = [
  "Archivo Black",
  "Anton",
  "Bebas Neue",
  "Unbounded",
  "Syne",
  "Space Grotesk",
];

export const defaultGridConfig = {
  text: "303 MTL PLUGIN",
  title: "303MTLPLUGIN",
  subtitle: "POLYAMOR",
  idx: "",
  metaBpm: 124,
  font: "Archivo Black",
  palette: "blue",
  invert: false,
  flipOnCut: true,
  bpm: 124,
  cutEvery: 2,
  count: 6,
  aspect: "16/9",
  media: { clips: [] },
};

export function effectivePalette(key, invert) {
  const p = PALETTES[key] || PALETTES.bw;
  return invert ? { bg: p.fg, fg: p.bg } : { bg: p.bg, fg: p.fg };
}

export function deriveTokens(text) {
  return (text || "")
    .split(/[;\s]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => t.toUpperCase());
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

// Stable topology: a BSP tree with `count` leaves (ids 0..count-1). No ratios yet.
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

// Compute leaf rects using fresh random split ratios for this cut.
function computeRects(tree, cutSeed) {
  const rand = rng(Math.imul(cutSeed, 40503) + 7);
  const out = {};
  (function rec(node, x, y, w, h) {
    if (node.leaf) { out[node.id] = { x, y, w, h }; return; }
    const r = 0.3 + rand() * 0.4;
    if (node.dir === "v") { const w1 = w * r; rec(node.a, x, y, w1, h); rec(node.b, x + w1, y, w - w1, h); }
    else { const h1 = h * r; rec(node.a, x, y, w, h1); rec(node.b, x, y + h1, w, h - h1); }
  })(tree, 0, 0, 1, 1);
  return out;
}

function assignContent(cutSeed, cells, tokens, media) {
  const rand = rng(Math.imul(cutSeed, 22695) + 13);
  const n = cells.length;
  const order = [...cells.keys()].sort((a, b) => cells[b].w * cells[b].h - cells[a].w * cells[a].h);
  const assign = new Array(n);
  const metaIdx = order[Math.min(n - 1, 1 + Math.floor(rand() * Math.max(1, n - 2)))];
  let ti = 0;
  for (const idx of order) {
    if (idx === metaIdx) continue;
    const useMedia = media.length > 0 && (ti >= tokens.length || rand() < 0.35);
    if (useMedia) assign[idx] = { type: "media", mediaId: media[Math.floor(rand() * media.length)].id };
    else { assign[idx] = { type: "text", token: tokens[ti % Math.max(1, tokens.length)] || "303" }; ti++; }
  }
  assign[metaIdx] = { type: "meta" };
  for (let i = 0; i < n; i++) if (assign[i]) assign[i].inv = rand() < 0.42;
  return assign;
}

export function buildScene(topoSeed, cutSeed, count, tokens, media) {
  const safeTokens = tokens.length ? tokens : ["303"];
  const tree = buildTopology(topoSeed, count);
  const rectMap = computeRects(tree, cutSeed);
  const cells = [];
  for (let i = 0; i < count; i++) cells[i] = rectMap[i];
  const assign = assignContent(cutSeed, cells, safeTokens, media);
  const idxNum = 200 + (Math.abs(Math.imul(cutSeed, 7)) % 800);
  return { cells, assign, idxCode: `IDX-${idxNum}` };
}
