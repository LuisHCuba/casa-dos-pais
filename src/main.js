import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import house from '../data/house.json';
import { attachOpenings, wallPieces, deg, polygonCentroid, bounds } from './geometry.js';
import { describe, openingColor } from './catalog.js';

// Conversão planta (mm) → cena (m). Plano x,y → cena X, -Z. Altura z → Y.
const M = 0.001;
const toScene = (x, y, z = 0) => new THREE.Vector3(x * M, z * M, -y * M);

const app = document.getElementById('app');
const info = document.getElementById('info');

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
app.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(innerWidth, innerHeight);
labelRenderer.domElement.className = 'labels';
app.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#eef1f4');

const b = bounds(house);
const center = toScene((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2);
const span = Math.max(b.maxX - b.minX, b.maxY - b.minY) * M;

const persp = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 500);
persp.position.copy(center).add(new THREE.Vector3(0, span * 0.9, span * 0.75));
const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 500);
let camera = persp;

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(center);

scene.add(new THREE.HemisphereLight('#ffffff', '#b8b0a0', 1.6));
const sun = new THREE.DirectionalLight('#ffffff', 1.6);
sun.position.copy(center).add(new THREE.Vector3(-span, span * 1.5, span * 0.6));
sun.target.position.copy(center);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span });
scene.add(sun, sun.target);

const groups = {
  floors: new THREE.Group(),
  walls: new THREE.Group(),
  openings: new THREE.Group(),
  furniture: new THREE.Group(),
  labels: new THREE.Group(),
};
Object.values(groups).forEach((g) => scene.add(g));

// Chão externo
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(span * 3, span * 3),
  new THREE.MeshStandardMaterial({ color: '#cfdcc4' })
);
ground.rotation.x = -Math.PI / 2;
ground.position.set(center.x, -0.01, center.z);
ground.receiveShadow = true;
scene.add(ground);

// Pisos dos cômodos
const floorMat = new THREE.MeshStandardMaterial({ color: '#e3d3b8' });
for (const room of house.rooms) {
  const shape = new THREE.Shape(room.polygon.map(([x, y]) => new THREE.Vector2(x * M, y * M)));
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), floorMat.clone());
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.001;
  mesh.receiveShadow = true;
  mesh.userData = { kind: 'room', data: room };
  groups.floors.add(mesh);

  const [cx, cy] = polygonCentroid(room.polygon);
  const el = document.createElement('div');
  el.className = 'room-label';
  el.innerHTML = `<b>${room.name || room.label}</b><br>${room.areaFloor} m²`;
  const lbl = new CSS2DObject(el);
  lbl.position.copy(toScene(cx, cy, 50));
  groups.labels.add(lbl);
}

// Paredes com vãos recortados
const wallMat = new THREE.MeshStandardMaterial({ color: '#fafafa' });
const byWall = attachOpenings(house);
for (const w of house.walls) {
  const dx = w.b[0] - w.a[0], dy = w.b[1] - w.a[1];
  const len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len;
  const ang = Math.atan2(dy, dx);
  const ops = byWall.get(w.id);
  for (const p of wallPieces(w, ops)) {
    // estende 50 mm nas pontas livres para fechar os cantos
    const ext0 = p.s0 === 0 ? w.t / 2 : 0;
    const ext1 = Math.abs(p.s1 - len) < 1 ? w.t / 2 : 0;
    const L = p.s1 - p.s0 + ext0 + ext1;
    const mid = (p.s0 - ext0 + p.s1 + ext1) / 2;
    const geo = new THREE.BoxGeometry(L * M, (p.z1 - p.z0) * M, w.t * M);
    const mesh = new THREE.Mesh(geo, wallMat);
    mesh.position.copy(toScene(w.a[0] + ux * mid, w.a[1] + uy * mid, (p.z0 + p.z1) / 2));
    mesh.rotation.y = ang;
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData = { kind: 'wall', data: w };
    groups.walls.add(mesh);
  }
  // Portas/janelas: painel fino dentro do vão
  for (const o of ops) {
    const geo = new THREE.BoxGeometry(o.width * M, o.height * M, (o.window ? 20 : 40) * M);
    const mat = new THREE.MeshStandardMaterial({
      color: openingColor(o),
      transparent: o.window,
      opacity: o.window ? 0.45 : 1,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(toScene(w.a[0] + ux * o.s, w.a[1] + uy * o.s, o.sill + o.height / 2));
    mesh.rotation.y = ang;
    mesh.userData = { kind: o.window ? 'window' : 'door', data: o };
    groups.openings.add(mesh);
  }
}

// Móveis como caixas (bounding box real de cada item)
for (const f of house.furniture) {
  const [x0, y0, z0, x1, y1, z1] = f.bbox;
  const sx = Math.max(x1 - x0, 5), sy = Math.max(y1 - y0, 5), sz = Math.max(z1 - z0, 5);
  const r = deg(f.rot), c = Math.cos(r), s = Math.sin(r);
  const lx = (x0 + x1) / 2, ly = (y0 + y1) / 2;
  const wx = f.pos[0] + lx * c - ly * s;
  const wy = f.pos[1] + lx * s + ly * c;
  const { label, color } = describe(f);
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(sx * M, sz * M, sy * M),
    new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.92 })
  );
  mesh.position.copy(toScene(wx, wy, f.pos[2] + z0 + sz / 2));
  mesh.rotation.y = r;
  mesh.castShadow = true;
  mesh.userData = { kind: 'furniture', data: f, label };
  groups.furniture.add(mesh);
}

// ---------- UI ----------
function setCamera(mode) {
  const old = camera;
  if (mode === '2d') {
    const aspect = innerWidth / innerHeight;
    const h = span * 0.65;
    Object.assign(ortho, { left: -h * aspect, right: h * aspect, top: h, bottom: -h });
    ortho.position.set(center.x, 50, center.z);
    ortho.up.set(0, 0, -1);
    ortho.lookAt(center);
    ortho.updateProjectionMatrix();
    camera = ortho;
    controls.enableRotate = false;
    sun.castShadow = false;
  } else {
    camera = persp;
    controls.enableRotate = true;
    sun.castShadow = true;
  }
  if (old !== camera) {
    controls.object = camera;
    controls.target.copy(center);
    controls.update();
  }
}

document.querySelectorAll('[data-toggle]').forEach((cb) => {
  cb.addEventListener('change', () => (groups[cb.dataset.toggle].visible = cb.checked));
});
document.querySelectorAll('[data-view]').forEach((btn) =>
  btn.addEventListener('click', () => setCamera(btn.dataset.view))
);

const ray = new THREE.Raycaster();
const mouse = new THREE.Vector2();
renderer.domElement.addEventListener('click', (e) => {
  mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(mouse, camera);
  const pick = [groups.furniture, groups.openings, groups.walls, groups.floors].filter((g) => g.visible);
  const hit = ray.intersectObjects(pick, true)[0];
  if (!hit) return (info.hidden = true);
  const { kind, data, label } = hit.object.userData;
  info.hidden = false;
  info.innerHTML = `<b>${label || kind}</b><pre>${JSON.stringify(data, null, 1)}</pre>`;
});

addEventListener('resize', () => {
  persp.aspect = innerWidth / innerHeight;
  persp.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  labelRenderer.setSize(innerWidth, innerHeight);
  if (camera === ortho) setCamera('2d');
});

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
});

if (new URLSearchParams(location.search).get('view') === '2d') setCamera('2d');
window.__ready = true;
