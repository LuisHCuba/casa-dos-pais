// Funções puras de geometria sobre data/house.json (sem Three.js).
// Unidades: mm. Plano: x → direita, y → "norte" (para cima na planta). z = altura.

export const deg = (d) => (d * Math.PI) / 180;

/** Projeta um ponto no segmento a→b. Retorna distância perpendicular e posição ao longo (mm). */
export function projectOnSegment(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len;
  const s = (p[0] - a[0]) * ux + (p[1] - a[1]) * uy;
  const dist = Math.abs((p[0] - a[0]) * uy - (p[1] - a[1]) * ux);
  return { s, dist, len };
}

/** Altura útil de um vão (porta/janela). */
export function openingSize(o) {
  const p = o.params || {};
  const bw = o.bbox[3] - o.bbox[0];
  const bh = o.bbox[5] - o.bbox[2];
  const width = p.width ?? bw;
  const height = bh > 10 ? Math.min(bh, p.height ?? bh) : p.height ?? 2100;
  return { width, height, sill: o.pos[2] };
}

export const isWindow = (o) => /fen/.test(o.dbId) || o.pos[2] > 300;

/** Associa cada vão à parede mais próxima (em que ele está encaixado). */
export function attachOpenings(house) {
  const byWall = new Map(house.walls.map((w) => [w.id, []]));
  for (const o of house.openings) {
    let best = null;
    for (const w of house.walls) {
      const { s, dist, len } = projectOnSegment(o.pos, w.a, w.b);
      if (s < -1 || s > len + 1) continue;
      if (!best || dist < best.dist) best = { w, s, dist };
    }
    if (best && best.dist < best.w.t / 2 + 20) {
      const size = openingSize(o);
      byWall.get(best.w.id).push({ ...o, s: best.s, ...size, window: isWindow(o) });
    }
  }
  for (const list of byWall.values()) list.sort((a, b) => a.s - b.s);
  return byWall;
}

/**
 * Quebra uma parede em blocos sólidos (caixas) contornando os vãos.
 * Cada bloco: { s0, s1, z0, z1 } em coordenadas locais da parede.
 */
export function wallPieces(wall, openings) {
  const len = Math.hypot(wall.b[0] - wall.a[0], wall.b[1] - wall.a[1]);
  const H = wall.h;
  const pieces = [];
  let cursor = 0;
  for (const o of openings) {
    const s0 = Math.max(0, o.s - o.width / 2);
    const s1 = Math.min(len, o.s + o.width / 2);
    if (s0 > cursor) pieces.push({ s0: cursor, s1: s0, z0: 0, z1: H });
    if (o.sill > 0) pieces.push({ s0, s1, z0: 0, z1: o.sill });
    const top = o.sill + o.height;
    if (top < H) pieces.push({ s0, s1, z0: top, z1: H });
    cursor = Math.max(cursor, s1);
  }
  if (cursor < len) pieces.push({ s0: cursor, s1: len, z0: 0, z1: H });
  return pieces.filter((p) => p.s1 - p.s0 > 1 && p.z1 - p.z0 > 1);
}

/** Retângulo (footprint) de um móvel no plano, já rotacionado. 4 cantos [x,y]. */
export function footprint(item) {
  const [x0, y0, , x1, y1] = item.bbox;
  const r = deg(item.rot);
  const c = Math.cos(r), s = Math.sin(r);
  return [
    [x0, y0], [x1, y0], [x1, y1], [x0, y1],
  ].map(([x, y]) => [item.pos[0] + x * c - y * s, item.pos[1] + x * s + y * c]);
}

export function polygonCentroid(pts) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
    const f = x0 * y1 - x1 * y0;
    a += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f;
  }
  a /= 2;
  return [cx / (6 * a), cy / (6 * a)];
}

export function bounds(house) {
  const pts = house.walls.flatMap((w) => [w.a, w.b]);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}
