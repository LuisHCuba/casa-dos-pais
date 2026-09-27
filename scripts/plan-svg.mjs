// Gera plan.svg (planta baixa 2D) a partir de data/house.json.
// Uso: npm run plan   → escreve out/plan.svg
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { attachOpenings, wallPieces, footprint, polygonCentroid, bounds } from '../src/geometry.js';
import { describe } from '../src/catalog.js';

const house = JSON.parse(readFileSync(new URL('../data/house.json', import.meta.url)));
const b = bounds(house);
const pad = 800;
const W = b.maxX - b.minX + pad * 2, H = b.maxY - b.minY + pad * 2;
// SVG tem y para baixo: invertemos y para manter o norte para cima.
const X = (x) => (x - b.minX + pad).toFixed(0);
const Y = (y) => (b.maxY - y + pad).toFixed(0);
const pts = (arr) => arr.map(([x, y]) => `${X(x)},${Y(y)}`).join(' ');

const out = [];
out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W / 10}" height="${H / 10}" font-family="sans-serif">`);
out.push(`<rect width="100%" height="100%" fill="#fff"/>`);

for (const r of house.rooms) {
  out.push(`<polygon points="${pts(r.polygon)}" fill="#f4ecdf" stroke="none"/>`);
}
for (const f of house.furniture) {
  const { label } = describe(f);
  out.push(`<polygon points="${pts(footprint(f))}" fill="#d8cbb8" fill-opacity=".6" stroke="#8a7a66" stroke-width="10"><title>${label} (${f.dbId})</title></polygon>`);
}
const byWall = attachOpenings(house);
for (const w of house.walls) {
  const dx = w.b[0] - w.a[0], dy = w.b[1] - w.a[1];
  const len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
  const ops = byWall.get(w.id);
  // só desenha trechos cheios na altura de corte (1,0 m)
  for (const p of wallPieces(w, ops).filter((p) => p.z0 <= 1000 && p.z1 >= 1000)) {
    const a = [w.a[0] + ux * p.s0, w.a[1] + uy * p.s0], c = [w.a[0] + ux * p.s1, w.a[1] + uy * p.s1];
    out.push(`<line x1="${X(a[0])}" y1="${Y(a[1])}" x2="${X(c[0])}" y2="${Y(c[1])}" stroke="#222" stroke-width="${w.t}" stroke-linecap="square"/>`);
  }
  for (const o of ops) {
    const a = [w.a[0] + ux * (o.s - o.width / 2), w.a[1] + uy * (o.s - o.width / 2)];
    const c = [w.a[0] + ux * (o.s + o.width / 2), w.a[1] + uy * (o.s + o.width / 2)];
    out.push(`<line x1="${X(a[0])}" y1="${Y(a[1])}" x2="${X(c[0])}" y2="${Y(c[1])}" stroke="${o.window ? '#3a8fc4' : '#a0703c'}" stroke-width="${o.window ? 40 : 60}"/>`);
  }
}
for (const s of house.separators) {
  out.push(`<line x1="${X(s.a[0])}" y1="${Y(s.a[1])}" x2="${X(s.b[0])}" y2="${Y(s.b[1])}" stroke="#999" stroke-width="15" stroke-dasharray="80 60"/>`);
}
for (const r of house.rooms) {
  const [cx, cy] = polygonCentroid(r.polygon);
  out.push(`<text x="${X(cx)}" y="${Y(cy)}" font-size="260" text-anchor="middle" fill="#333">${r.name || r.label}</text>`);
  out.push(`<text x="${X(cx)}" y="${+Y(cy) + 300}" font-size="200" text-anchor="middle" fill="#666">${r.areaFloor} m²</text>`);
}
out.push('</svg>');
mkdirSync(new URL('../out/', import.meta.url), { recursive: true });
writeFileSync(new URL('../out/plan.svg', import.meta.url), out.join('\n'));
console.log('out/plan.svg gerado');
