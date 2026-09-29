// Generative broken-grid engine (Mondrian / guillotine split) driven by a seed.

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

function generateLayout(seed, count) {
  const rand = rng(Math.imul(seed, 2654435761));
  let cells = [{ x: 0, y: 0, w: 1, h: 1 }];
  while (cells.length < count) {
    cells.sort((a, b) => b.w * b.h - a.w * a.h);
    const pick = Math.floor(rand() * Math.min(cells.length, 3));
    const c = cells.splice(pick, 1)[0];
    const splitVertical = c.w > c.h * 1.05 ? true : c.h > c.w * 1.05 ? false : rand() > 0.5;
    const ratio = 0.34 + rand() * 0.32;
    if (splitVertical) {
      const w1 = c.w * ratio;
      cells.push({ x: c.x, y: c.y, w: w1, h: c.h });
      cells.push({ x: c.x + w1, y: c.y, w: c.w - w1, h: c.h });
    } else {
      const h1 = c.h * ratio;
      cells.push({ x: c.x, y: c.y, w: c.w, h: h1 });
      cells.push({ x: c.x, y: c.y + h1, w: c.w, h: c.h - h1 });
    }
  }
  return cells;
}

function assignContent(seed, cells, tokens, media) {
  const rand = rng(Math.imul(seed, 40503) + 17);
  const n = cells.length;
  const order = [...cells.keys()].sort((a, b) => cells[b].w * cells[b].h - cells[a].w * cells[a].h);
  const assign = new Array(n);
  // Metadata block goes to a medium/small cell (not the biggest).
  const metaIdx = order[Math.min(n - 1, 1 + Math.floor(rand() * Math.max(1, n - 2)))];
  let ti = 0;
  for (const idx of order) {
    if (idx === metaIdx) continue;
    const useMedia = media.length > 0 && (ti >= tokens.length || rand() < 0.35);
    if (useMedia) {
      assign[idx] = { type: "media", mediaId: media[Math.floor(rand() * media.length)].id };
    } else {
      assign[idx] = { type: "text", token: tokens[ti % Math.max(1, tokens.length)] || "303" };
      ti++;
    }
  }
  assign[metaIdx] = { type: "meta" };
  for (let i = 0; i < n; i++) if (assign[i]) assign[i].inv = rand() < 0.42;
  return assign;
}

export function buildScene(seed, count, tokens, media) {
  const safeTokens = tokens.length ? tokens : ["303"];
  const cells = generateLayout(seed, count);
  const assign = assignContent(seed, cells, safeTokens, media);
  const idx = 200 + (Math.abs(Math.imul(seed, 7)) % 800);
  return { cells, assign, idxCode: `IDX-${idx}` };
}
