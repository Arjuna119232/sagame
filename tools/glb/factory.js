// SAGame GLB factory — builds every asset listed in assets/manifest.json.
// Runs in a browser (see harness.html) because GLTFExporter needs canvas for textures.
// Conventions from README: meters, origin at bottom centre, facing +Z, PBR materials.
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { KOTA } from '../../app/src/main/assets/KotaData.js';

/* ------------------------------------------------------------------ materials */

const std = (color, o = {}) => new THREE.MeshStandardMaterial({
  color,
  roughness: o.r ?? 0.85,
  metalness: o.m ?? 0.05,
  emissive: o.e ?? 0x000000,
  emissiveIntensity: o.ei ?? 1,
  map: o.map ?? null,
  emissiveMap: o.em ?? null,
  side: o.side ?? THREE.FrontSide,
  transparent: o.t ?? false,
  opacity: o.op ?? 1,
});

const GLASS = (c = 0x1a2634) => std(c, { r: 0.15, m: 0.6 });
const METAL = (c = 0x8c9298) => std(c, { r: 0.4, m: 0.8 });
const RUBBER = () => std(0x14161a, { r: 0.95 });
const SKIN = (c) => std(c, { r: 0.75 });

const mesh = (geo, mat, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
};

// box whose UVs tile a texture every `tile` metres on every face
function tiledBox(w, h, d, tile = 4) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const faces = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    const [su, sv] = faces[f];
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, uv.getX(i) * (su / tile), uv.getY(i) * (sv / tile));
    }
  }
  uv.needsUpdate = true;
  return g;
}

/* ------------------------------------------------- window texture (map + emissive) */

const texCache = new Map();

function windowTexture(wall = 0xd6d9dd, lit = 0xffd98a, seed = 1) {
  const key = `${wall}-${lit}-${seed}`;
  if (texCache.has(key)) return texCache.get(key);

  const S = 128, cell = 32, pad = 9, ww = 14, wh = 16;
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

  const base = document.createElement('canvas');
  base.width = base.height = S;
  const b = base.getContext('2d');
  b.fillStyle = '#' + wall.toString(16).padStart(6, '0');
  b.fillRect(0, 0, S, S);
  b.fillStyle = 'rgba(0,0,0,0.06)';
  for (let i = 0; i < 4; i++) b.fillRect(0, i * cell + cell - 2, S, 2);

  const emi = document.createElement('canvas');
  emi.width = emi.height = S;
  const e = emi.getContext('2d');
  e.fillStyle = '#000';
  e.fillRect(0, 0, S, S);

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const x = col * cell + pad, y = row * cell + pad + 4;
      b.fillStyle = '#243247';
      b.fillRect(x, y, ww, wh);
      b.fillStyle = 'rgba(150,185,220,0.45)';
      b.fillRect(x, y, ww, 4);
      // porsi jendela menyala mengikuti kepemilikan rumah (54,54%) sebagai analogi
      if (rnd() < KOTA.rumahMilik) {
        e.fillStyle = rnd() < 0.7 ? '#ffd98a' : '#bfe3ff';
        e.fillRect(x, y, ww, wh);
      }
    }
  }

  const map = new THREE.CanvasTexture(base);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 4;

  const em = new THREE.CanvasTexture(emi);
  em.colorSpace = THREE.SRGBColorSpace;
  em.wrapS = em.wrapT = THREE.RepeatWrapping;

  const out = { map, em };
  texCache.set(key, out);
  return out;
}

/* ------------------------------------------------------------------- buildings */

function office({ w = 16, d = 16, h = 40, wall = 0xd6d9dd, seed = 1, crown = true }) {
  const g = new THREE.Group();
  const { map, em } = windowTexture(wall, 0xffd98a, seed);
  const skin = std(0xffffff, { map, em, e: 0xffffff, r: 0.7, m: 0.1 });
  const body = mesh(tiledBox(w, h, d, 4), skin, 0, h / 2, 0);
  g.add(body);

  const slab = std(0x9aa0a6, { r: 0.9 });
  g.add(mesh(new THREE.BoxGeometry(w + 0.7, 0.45, d + 0.7), slab, 0, h + 0.2, 0));

  if (crown) {
    const cw = w * 0.55, cd = d * 0.55, ch = h * 0.12;
    const top = mesh(tiledBox(cw, ch, cd, 4), skin, 0, h + ch / 2 + 0.4, 0);
    g.add(top);
    g.add(mesh(new THREE.BoxGeometry(cw + 0.5, 0.35, cd + 0.5), slab, 0, h + ch + 0.6, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.09, 0.09, 6, 6), METAL(0xb0b4b8), 0, h + ch + 3.4, 0));
  }
  // entrance canopy so the base does not look naked
  g.add(mesh(new THREE.BoxGeometry(w * 0.4, 0.3, 1.6), std(0x3a3f45, { r: 0.8 }), 0, 3.2, d / 2 + 0.7));
  return { root: g };
}

function shophouse({ w = 8, d = 10, floors = 3, wall = 0xe4d9c6, seed = 3, awning = 0xb23a2e }) {
  const g = new THREE.Group();
  const h = floors * 3.2;
  const { map, em } = windowTexture(wall, 0xffd98a, seed);
  const skin = std(0xffffff, { map, em, e: 0xffffff, r: 0.85 });
  g.add(mesh(tiledBox(w, h, d, 3), skin, 0, h / 2, 0));
  g.add(mesh(new THREE.BoxGeometry(w + 0.5, 0.4, d + 0.5), std(0x8d8377, { r: 0.9 }), 0, h + 0.2, 0));

  // ground-floor shop: dark opening + awning
  g.add(mesh(new THREE.BoxGeometry(w * 0.7, 2.4, 0.25), std(0x20262e, { r: 0.5 }), 0, 1.3, d / 2 + 0.05));
  const aw = mesh(new THREE.BoxGeometry(w * 0.8, 0.12, 1.8), std(awning, { r: 0.8 }), 0, 2.7, d / 2 + 0.85);
  aw.rotation.x = -0.28;
  g.add(aw);
  // signage band
  g.add(mesh(new THREE.BoxGeometry(w * 0.75, 0.7, 0.15), std(0xf2f2f2, { r: 0.6 }), 0, 3.5, d / 2 + 0.12));
  return { root: g };
}

function mentengHouse({ w = 11, d = 12, h = 4.4, wall = 0xf0e6d2 }) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(w, h, d), std(wall, { r: 0.9 }), 0, h / 2, 0));
  // hip roof (rotasi 45 derajat dibakar ke geometri, lalu di-scale per sumbu)
  const roof = mesh(new THREE.ConeGeometry(1, 3.4, 4).rotateY(Math.PI / 4), std(0x8a4a33, { r: 0.85 }), 0, h + 1.7, 0);
  roof.scale.set(w * 0.75, 1, d * 0.75);
  g.add(roof);
  // windows, door, porch
  const win = std(0x243247, { r: 0.35, m: 0.3 });
  for (const x of [-w * 0.3, w * 0.3]) {
    g.add(mesh(new THREE.BoxGeometry(1.5, 1.2, 0.16), win, x, 2.6, d / 2 + 0.02));
    g.add(mesh(new THREE.BoxGeometry(1.8, 1.5, 0.1), std(0xffffff, { r: 0.7 }), x, 2.6, d / 2 - 0.02));
  }
  g.add(mesh(new THREE.BoxGeometry(1.2, 2.2, 0.18), std(0x5a3a24, { r: 0.7 }), 0, 1.1, d / 2 + 0.02));
  g.add(mesh(new THREE.BoxGeometry(3.4, 0.25, 1.8), std(0xd8d2c4, { r: 0.8 }), 0, 2.55, d / 2 + 0.9));
  for (const x of [-1.5, 1.5]) g.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.5, 6), std(0xefe9dd, { r: 0.8 }), x, 1.25, d / 2 + 1.6));
  // garden wall
  g.add(mesh(new THREE.BoxGeometry(w + 2, 1.1, 0.25), std(0xdcd6c8, { r: 0.9 }), 0, 0.55, d / 2 + 2.6));
  return { root: g };
}

function colonialBuilding({ w = 20, d = 14, h = 10, wall = 0xf2ede2 }) {
  const g = new THREE.Group();
  const body = std(wall, { r: 0.9 });
  g.add(mesh(new THREE.BoxGeometry(w, h, d), body, 0, h / 2, 0));
  // plinth + cornice
  g.add(mesh(new THREE.BoxGeometry(w + 0.8, 1.0, d + 0.8), std(0xe2dccf, { r: 0.9 }), 0, 0.5, 0));
  g.add(mesh(new THREE.BoxGeometry(w + 1.0, 0.6, d + 1.0), std(0xe2dccf, { r: 0.9 }), 0, h - 0.3, 0));
  // columns across the front
  for (let i = 0; i < 5; i++) {
    const x = -w / 2 + 2 + i * ((w - 4) / 4);
    g.add(mesh(new THREE.CylinderGeometry(0.42, 0.46, h - 1.2, 10), std(0xfaf6ec, { r: 0.75 }), x, (h - 1.2) / 2 + 0.6, d / 2 + 1.2));
  }
  // hip roof, menutup seluruh denah (bbox tetap w x d)
  const roof = mesh(new THREE.ConeGeometry(1, 2.8, 4).rotateY(Math.PI / 4), std(0xe8e0d0, { r: 0.8 }), 0, h + 1.4, 0);
  roof.scale.set((w / 2 + 0.6) / Math.SQRT1_2, 1, (d / 2 + 0.6) / Math.SQRT1_2);
  g.add(roof);
  // tall windows
  const win = std(0x2a3546, { r: 0.3, m: 0.35 });
  for (let i = 0; i < 4; i++) {
    const x = -w / 2 + 3 + i * ((w - 6) / 3);
    g.add(mesh(new THREE.BoxGeometry(1.4, 3.4, 0.16), win, x, 5.2, -d / 2 - 0.02));
  }
  return { root: g };
}

function towerBlock({ w = 14, d = 14, h = 24, setback = true, wall = 0xc9cfd6, seed = 5 }) {
  const g = new THREE.Group();
  const { map, em } = windowTexture(wall, 0xffe3a0, seed);
  const skin = std(0xffffff, { map, em, e: 0xffffff, r: 0.72 });
  const h1 = setback ? h * 0.7 : h;
  g.add(mesh(tiledBox(w, h1, d, 4), skin, 0, h1 / 2, 0));
  g.add(mesh(new THREE.BoxGeometry(w + 0.5, 0.4, d + 0.5), std(0x9aa0a6, { r: 0.9 }), 0, h1 + 0.2, 0));
  if (setback) {
    const w2 = w * 0.7, d2 = d * 0.7, h2 = h - h1;
    g.add(mesh(tiledBox(w2, h2, d2, 4), skin, 0, h1 + h2 / 2 + 0.4, 0));
    g.add(mesh(new THREE.BoxGeometry(w2 + 0.5, 0.4, d2 + 0.5), std(0x9aa0a6, { r: 0.9 }), 0, h + 0.6, 0));
  }
  return { root: g };
}

function apartment({ w = 22, d = 16, h = 54, wall = 0xe3dcd0, seed = 71 } = {}) {
  const g = new THREE.Group();
  const { map, em } = windowTexture(wall, 0xffe0a0, seed);
  const skin = std(0xffffff, { map, em, e: 0xffffff, r: 0.82 });
  // podium: lobi + parkir, lebih lebar dari slab
  g.add(mesh(new THREE.BoxGeometry(w + 6, 5, d + 8), std(0xbfb6a8, { r: 0.9 }), 0, 2.5, 0));
  // slab hunian
  g.add(mesh(tiledBox(w, h, d, 3.2), skin, 0, h / 2 + 5, 0));
  // pita balkon tiap ~3 lantai — digabung jadi satu geometri supaya tetap 1 draw call
  const bal = std(0xdfe3e6, { r: 0.8 }), strips = [];
  for (let y = 8; y < h; y += 3.2) {
    for (const zz of [d / 2 + 0.5, -d / 2 - 0.5]) {
      const bg = new THREE.BoxGeometry(w + 0.6, 0.18, 1.1);
      bg.translate(0, y + 5, zz);
      strips.push(bg);
    }
  }
  if (strips.length) g.add(mesh(mergeGeometries(strips), bal, 0, 0, 0));
  g.add(mesh(new THREE.BoxGeometry(w + 0.8, 0.5, d + 0.8), std(0x9aa0a6, { r: 0.9 }), 0, h + 5.25, 0));
  // tangki air + antena atap
  for (const x of [-w * 0.28, w * 0.28]) {
    g.add(mesh(new THREE.CylinderGeometry(1.5, 1.5, 2.6, 10), std(0x8fa3b0, { r: 0.5, m: 0.4 }), x, h + 6.8, 0));
  }
  g.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 8, 6), METAL(0xb0b4b8), w * 0.4, h + 9.5, -d * 0.2));
  // papan nama tower
  g.add(mesh(new THREE.BoxGeometry(w * 0.5, 1.6, 0.3), std(0x2f3b46, { r: 0.7 }), 0, h + 3.4, d / 2 + 0.2));
  g.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
  return { root: g };
}

function monas() {
  const g = new THREE.Group();
  const white = std(0xf3f3f0, { r: 0.8 });
  g.add(mesh(new THREE.BoxGeometry(16, 2.4, 16), white, 0, 1.2, 0));          // base
  g.add(mesh(new THREE.BoxGeometry(11, 3.2, 11), white, 0, 4.0, 0));          // pedestal
  g.add(mesh(new THREE.CylinderGeometry(0.9, 2.1, 34, 8), white, 0, 22.6, 0)); // obelisk
  g.add(mesh(new THREE.BoxGeometry(4.6, 1.2, 4.6), white, 0, 40.2, 0));       // cupola
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(1.5, 4.2, 8),
    std(0xffc830, { r: 0.3, m: 0.6, e: 0xffb020, ei: 1.6 })
  );
  flame.position.set(0, 42.9, 0);
  g.add(flame);
  // flag pole beside the monument
  g.add(mesh(new THREE.CylinderGeometry(0.09, 0.09, 12, 6), std(0xcfcfcf, { r: 0.5, m: 0.7 }), 8, 6, -8));
  g.add(mesh(new THREE.BoxGeometry(3.2, 0.8, 0.08), std(0xdd1111, { r: 0.8 }), 9.6, 11.2, -8));
  g.add(mesh(new THREE.BoxGeometry(3.2, 0.8, 0.08), std(0xf4f4f4, { r: 0.8 }), 9.6, 10.4, -8));
  return { root: g };
}

function bundaranHI() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(9, 9, 0.8, 28), std(0xa8b0b8, { r: 0.9 }), 0, 0.4, 0));
  g.add(mesh(new THREE.CylinderGeometry(8.4, 8.4, 0.5, 28), std(0x4aa8d8, { r: 0.2, m: 0.4 }), 0, 0.85, 0));
  g.add(mesh(new THREE.CylinderGeometry(1.1, 1.5, 14, 10), std(0xd8d0c0, { r: 0.7 }), 0, 7.6, 0));
  g.add(mesh(new THREE.SphereGeometry(1.5, 12, 10), std(0xd8d0c0, { r: 0.6 }), 0, 15.6, 0));
  // fountain jets
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.2, 6), std(0xbfe3ff, { r: 0.2, m: 0.2, e: 0x2a6f9a, ei: 0.4 }), Math.cos(a) * 4.5, 1.9, Math.sin(a) * 4.5));
  }
  return { root: g };
}

function stadium() {
  const g = new THREE.Group();
  const R0 = 14, H = 9;
  const bowl = new THREE.Mesh(
    new THREE.CylinderGeometry(R0, R0 * 0.82, H, 32, 1, true),
    std(0xc9cdd2, { r: 0.85, side: THREE.DoubleSide })
  );
  bowl.position.y = H / 2;
  g.add(bowl);
  // red seat band inside
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(R0 - 0.6, R0 - 0.6, 2.4, 32, 1, true),
    std(0xc0392b, { r: 0.9, side: THREE.DoubleSide })
  );
  band.position.y = H - 1.6;
  g.add(band);
  // roof ring
  const roof = new THREE.Mesh(new THREE.TorusGeometry(R0, 0.5, 6, 32), std(0xe6e9ec, { r: 0.7 }));
  roof.rotation.x = Math.PI / 2;
  roof.position.y = H + 1.6;
  g.add(roof);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.add(mesh(new THREE.CylinderGeometry(0.14, 0.14, 2.4, 6), METAL(0xb8bcc0), Math.cos(a) * R0, H + 0.6, Math.sin(a) * R0));
  }
  // pitch
  g.add(mesh(new THREE.CylinderGeometry(R0 - 2.2, R0 - 2.2, 0.3, 32), std(0x3fae4a, { r: 0.95 }), 0, 0.15, 0));
  g.add(mesh(new THREE.BoxGeometry(17, 0.06, 10), std(0x35913f, { r: 0.95 }), 0, 0.32, 0));
  return { root: g };
}

function ferrisWheel() {
  const g = new THREE.Group();
  const legM = METAL(0xb9bec4);
  // A-frame legs
  for (const z of [-2.2, 2.2]) {
    for (const x of [-5.6, 5.6]) {
      const leg = mesh(new THREE.CylinderGeometry(0.26, 0.36, 16, 8), legM, x * 0.5, 7.8, z * 0.5);
      leg.rotation.z = x > 0 ? -0.28 : 0.28;
      g.add(leg);
    }
  }
  g.add(mesh(new THREE.CylinderGeometry(0.7, 0.7, 5.4, 12).rotateX(Math.PI / 2), legM, 0, 14, 0));

  const wheel = new THREE.Group();
  wheel.name = 'wheel';
  wheel.position.set(0, 14, 0);
  g.add(wheel);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(11, 0.22, 6, 40), std(0xe03a8a, { r: 0.6, m: 0.3 }));
  wheel.add(ring);
  const inner = new THREE.Mesh(new THREE.TorusGeometry(9.6, 0.14, 6, 36), std(0xf2f2f2, { r: 0.7 }));
  wheel.add(inner);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const spoke = mesh(new THREE.BoxGeometry(0.16, 22, 0.16), std(0xdddddd, { r: 0.7 }), 0, 0, 0);
    spoke.rotation.z = a;
    wheel.add(spoke);
  }
  const seats = [0xffcc00, 0x33aaff, 0xff5544, 0x66dd66];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    wheel.add(mesh(new THREE.BoxGeometry(1.9, 1.6, 1.9), std(seats[i % 4], { r: 0.7 }), Math.cos(a) * 11, Math.sin(a) * 11, 0));
  }
  // hub
  wheel.add(mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.4, 12).rotateX(Math.PI / 2), legM, 0, 0, 0));
  return { root: g };
}

/* ------------------------------------------------------------------- vehicles */

function wheels(list) {
  // list: [x, z, radius, width]
  const out = [];
  list.forEach(([x, z, r, w], i) => {
    const g = new THREE.Group();
    g.name = `wheel_${['fl', 'fr', 'rl', 'rr', 'extra'][i] || i}`;
    g.position.set(x, r, z);
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 14).rotateZ(Math.PI / 2), RUBBER());
    g.add(tyre);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, w + 0.02, 10).rotateZ(Math.PI / 2), METAL(0xcfd3d7));
    g.add(rim);
    out.push(g);
  });
  return out;
}

function car({ body = 0xc01818, roof = null, taxi = false, police = false } = {}) {
  const g = new THREE.Group();
  const L = 4.4, W = 1.86, H = 0.72;
  g.add(mesh(new THREE.BoxGeometry(W, H, L), std(body, { r: 0.45, m: 0.35 }), 0, 0.72, 0));
  g.add(mesh(new THREE.BoxGeometry(W - 0.08, 0.34, L * 0.92), std(0x0f1319, { r: 0.6 }), 0, 1.22, 0));
  // cabin
  g.add(mesh(new THREE.BoxGeometry(W - 0.18, 0.62, L * 0.46), std(roof ?? body, { r: 0.4, m: 0.3 }), 0, 1.35, -0.12));
  // glass
  g.add(mesh(new THREE.BoxGeometry(W - 0.24, 0.5, 0.08), GLASS(), 0, 1.36, 0.88));
  g.add(mesh(new THREE.BoxGeometry(W - 0.24, 0.46, 0.08), GLASS(), 0, 1.36, -1.1));
  for (const x of [-0.93, 0.93]) g.add(mesh(new THREE.BoxGeometry(0.06, 0.44, L * 0.4), GLASS(), x, 1.36, -0.1));
  // bumpers + lights
  g.add(mesh(new THREE.BoxGeometry(W + 0.04, 0.22, 0.2), std(0x2b2f35, { r: 0.7 }), 0, 0.62, L / 2 - 0.04));
  g.add(mesh(new THREE.BoxGeometry(W + 0.04, 0.22, 0.2), std(0x2b2f35, { r: 0.7 }), 0, 0.62, -L / 2 + 0.04));
  for (const x of [-0.62, 0.62]) {
    g.add(mesh(new THREE.BoxGeometry(0.42, 0.18, 0.08), std(0xfff6d8, { r: 0.2, e: 0xfff2cc, ei: 1.4 }), x, 0.92, L / 2 + 0.01));
    g.add(mesh(new THREE.BoxGeometry(0.38, 0.16, 0.08), std(0xaa1111, { r: 0.3, e: 0xaa1111, ei: 0.9 }), x, 0.92, -L / 2 - 0.01));
  }
  if (taxi) {
    g.add(mesh(new THREE.BoxGeometry(0.8, 0.3, 0.34), std(0xf5d020, { r: 0.4, e: 0xf5d020, ei: 0.8 }), 0, 1.78, -0.1));
  }
  if (police) {
    g.add(mesh(new THREE.BoxGeometry(1.1, 0.18, 0.3), std(0x222a33, { r: 0.5 }), 0, 1.73, -0.1));
    g.add(mesh(new THREE.BoxGeometry(0.42, 0.16, 0.26), std(0xff2222, { r: 0.3, e: 0xff2222, ei: 2 }), -0.3, 1.86, -0.1));
    g.add(mesh(new THREE.BoxGeometry(0.42, 0.16, 0.26), std(0x2266ff, { r: 0.3, e: 0x2266ff, ei: 2 }), 0.3, 1.86, -0.1));
  }
  wheels([[-W / 2 + 0.02, 1.36, 0.34, 0.24], [W / 2 - 0.02, 1.36, 0.34, 0.24],
          [-W / 2 + 0.02, -1.36, 0.34, 0.24], [W / 2 - 0.02, -1.36, 0.34, 0.24]]).forEach((w) => g.add(w));
  return { root: g };
}

function bus() {
  const g = new THREE.Group();
  const L = 12, W = 2.5, H = 2.5;
  g.add(mesh(new THREE.BoxGeometry(W, H, L), std(0x1f5fbf, { r: 0.5, m: 0.25 }), 0, 1.75, 0));
  g.add(mesh(new THREE.BoxGeometry(W - 0.06, 0.9, L - 0.5), GLASS(), 0, 2.45, 0));
  g.add(mesh(new THREE.BoxGeometry(W + 0.02, 0.16, L), std(0xf2f2f2, { r: 0.6 }), 0, 2.95, 0));
  // door
  g.add(mesh(new THREE.BoxGeometry(0.08, 1.9, 1.1), GLASS(0x22303f), W / 2 + 0.01, 1.85, 3.4));
  // lights
  for (const x of [-0.8, 0.8]) {
    g.add(mesh(new THREE.BoxGeometry(0.4, 0.2, 0.08), std(0xfff6d8, { r: 0.2, e: 0xfff2cc, ei: 1.2 }), x, 0.9, L / 2 + 0.01));
    g.add(mesh(new THREE.BoxGeometry(0.34, 0.18, 0.08), std(0xaa1111, { r: 0.3, e: 0xaa1111, ei: 0.8 }), x, 0.9, -L / 2 - 0.01));
  }
  wheels([[-W / 2 + 0.05, 4.2, 0.5, 0.3], [W / 2 - 0.05, 4.2, 0.5, 0.3],
          [-W / 2 + 0.05, -3.6, 0.5, 0.3], [W / 2 - 0.05, -3.6, 0.5, 0.3]]).forEach((w) => g.add(w));
  return { root: g };
}

function bajaj() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(1.35, 0.5, 2.2), std(0xe8761e, { r: 0.55, m: 0.2 }), 0, 0.55, -0.1));
  g.add(mesh(new THREE.BoxGeometry(1.3, 1.15, 1.25), std(0xf0a03a, { r: 0.5 }), 0, 1.35, -0.35));
  g.add(mesh(new THREE.BoxGeometry(1.2, 0.75, 0.06), GLASS(), 0, 1.5, 0.3));
  g.add(mesh(new THREE.BoxGeometry(1.25, 0.12, 1.3), std(0x2b2f35, { r: 0.7 }), 0, 1.98, -0.35));
  // front cowl
  g.add(mesh(new THREE.BoxGeometry(0.9, 0.6, 0.7), std(0xe8761e, { r: 0.5 }), 0, 1.0, 1.0));
  g.add(mesh(new THREE.BoxGeometry(0.36, 0.2, 0.08), std(0xfff6d8, { r: 0.2, e: 0xfff2cc, ei: 1.2 }), 0, 1.05, 1.36));
  wheels([[-0.72, 1.05, 0.3, 0.2], [0.72, 1.05, 0.3, 0.2],
          [-0.72, -0.95, 0.32, 0.22], [0.72, -0.95, 0.32, 0.22]]).forEach((w) => g.add(w));
  return { root: g };
}

function motor() {
  const g = new THREE.Group();
  const bodyM = std(0xd8261f, { r: 0.45, m: 0.35 });
  const frameM = std(0x2a2f36, { r: 0.55, m: 0.5 });
  const R = 0.3;

  const wheel = (name, z) => {
    const grp = new THREE.Group();
    grp.name = name;
    grp.position.set(0, R, z);
    grp.add(new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.1, 14).rotateZ(Math.PI / 2), RUBBER()));
    grp.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.11, 10).rotateZ(Math.PI / 2), METAL(0xcfd3d7)));
    return grp;
  };
  g.add(wheel('wheel_depan', 0.62), wheel('wheel_belakang', -0.6));

  g.add(mesh(new THREE.BoxGeometry(0.14, 0.12, 0.95), frameM, 0, 0.52, 0));      // rangka
  g.add(mesh(new THREE.BoxGeometry(0.26, 0.3, 0.3), frameM, 0, 0.44, 0.02));      // mesin
  g.add(mesh(new THREE.BoxGeometry(0.3, 0.22, 0.42), bodyM, 0, 0.7, 0.12));       // tangki
  g.add(mesh(new THREE.BoxGeometry(0.3, 0.12, 0.55), std(0x14161a, { r: 0.85 }), 0, 0.76, -0.26)); // jok
  g.add(mesh(new THREE.BoxGeometry(0.24, 0.08, 0.26), frameM, 0, 0.79, -0.6));    // bagasi

  for (const x of [-0.09, 0.09]) {                                               // garpu depan
    const f = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.6, 6), METAL(0xb8bcc0), x, 0.62, 0.56);
    f.rotation.x = -0.3;
    g.add(f);
  }
  g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.66, 6).rotateZ(Math.PI / 2), frameM, 0, 0.94, 0.5)); // stang
  g.add(mesh(new THREE.SphereGeometry(0.09, 10, 8), std(0xfff6d8, { r: 0.25, e: 0xfff2cc, ei: 1.4 }), 0, 0.86, 0.64));
  g.add(mesh(new THREE.BoxGeometry(0.34, 0.1, 0.42), std(0x14161a, { r: 0.7 }), 0, 0.42, -0.5)); // knalpot

  // pengendara sederhana (duduk)
  const shirt = std(0x2b6cb0, { r: 0.85 });
  g.add(mesh(new THREE.BoxGeometry(0.3, 0.18, 0.28), std(0x1f2430, { r: 0.9 }), 0, 0.86, -0.05));
  const torso = mesh(new THREE.BoxGeometry(0.34, 0.44, 0.24), shirt, 0, 1.12, -0.02);
  torso.rotation.x = 0.14;
  g.add(torso);
  g.add(mesh(new THREE.SphereGeometry(0.115, 12, 10), SKIN(0xb98558), 0, 1.42, 0.04));
  g.add(mesh(new THREE.SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), std(0x1b1b1b, { r: 0.6 }), 0, 1.45, 0.04));
  for (const s of [-1, 1]) {
    const arm = mesh(new THREE.BoxGeometry(0.075, 0.34, 0.08), shirt, s * 0.19, 1.12, 0.2);
    arm.rotation.x = 0.9;
    g.add(arm);
    g.add(mesh(new THREE.BoxGeometry(0.09, 0.3, 0.12), std(0x1f2430, { r: 0.9 }), s * 0.17, 0.86, 0.12));
  }
  g.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
  return { root: g };
}

function truck() {
  const g = new THREE.Group();
  const boxM = std(0xe8e4da, { r: 0.82 });
  const cabM = std(0x2f5fa8, { r: 0.5, m: 0.3 });
  g.add(mesh(new THREE.BoxGeometry(2.0, 0.3, 6.2), std(0x33383f, { r: 0.85 }), 0, 0.62, 0));   // sasis
  g.add(mesh(new THREE.BoxGeometry(2.15, 1.5, 1.7), cabM, 0, 1.5, 2.2));                          // kabin
  g.add(mesh(new THREE.BoxGeometry(2.05, 0.62, 0.08), GLASS(), 0, 1.85, 3.06));                   // kaca depan
  for (const x of [-1.06, 1.06]) g.add(mesh(new THREE.BoxGeometry(0.08, 0.6, 1.2), GLASS(), x, 1.85, 2.2));
  g.add(mesh(new THREE.BoxGeometry(2.24, 2.2, 3.9), boxM, 0, 1.85, -0.9));                        // boks
  g.add(mesh(new THREE.BoxGeometry(2.26, 0.12, 3.92), std(0xb9b4a8, { r: 0.8 }), 0, 2.98, -0.9)); // atap boks
  for (const x of [-0.75, 0.75]) {
    g.add(mesh(new THREE.BoxGeometry(0.4, 0.2, 0.08), std(0xfff6d8, { r: 0.2, e: 0xfff2cc, ei: 1.2 }), x, 0.95, 3.06));
    g.add(mesh(new THREE.BoxGeometry(0.34, 0.18, 0.08), std(0xaa1111, { r: 0.3, e: 0xaa1111, ei: 0.8 }), x, 0.95, -2.86));
  }
  wheels([[-1.02, 2.2, 0.48, 0.28], [1.02, 2.2, 0.48, 0.28],
          [-1.02, -1.5, 0.48, 0.28], [1.02, -1.5, 0.48, 0.28]]).forEach((w) => g.add(w));
  return { root: g };
}

/* ------------------------------------------------------------------ characters */

const q = (e) => new THREE.Quaternion().setFromEuler(new THREE.Euler(e[0], e[1], e[2], 'XYZ'));

function quatTrack(node, times, eulers) {
  const v = [];
  eulers.forEach((e) => {
    const t = q(e);
    v.push(t.x, t.y, t.z, t.w);
  });
  return new THREE.QuaternionKeyframeTrack(`${node}.quaternion`, times, v);
}

function vectorTrack(node, prop, times, vecs) {
  const v = [];
  vecs.forEach((p) => v.push(p[0], p[1], p[2]));
  return new THREE.VectorKeyframeTrack(`${node}.${prop}`, times, v);
}

function character(o = {}) {
  const skin = o.skin ?? 0xa8703f;
  const shirt = o.shirt ?? 0x1a1a1a;
  const pants = o.pants ?? 0x22304a;
  const shoe = o.shoe ?? 0x14161a;
  const hair = o.hair ?? 0x15110e;

  const g = new THREE.Group();
  const HIPS_Y = 0.96;

  const hips = new THREE.Group();
  hips.name = 'hips';
  hips.position.y = HIPS_Y;
  g.add(hips);

  // torso + head
  hips.add(mesh(new THREE.BoxGeometry(0.4, 0.56, 0.24), std(shirt, { r: 0.85 }), 0, 0.3, 0));
  hips.add(mesh(new THREE.BoxGeometry(0.34, 0.2, 0.22), std(pants, { r: 0.9 }), 0, -0.02, 0));
  hips.add(mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.1, 6), SKIN(skin), 0, 0.62, 0));

  const head = new THREE.Group();
  head.name = 'head';
  head.position.set(0, 0.66, 0);
  hips.add(head);
  head.add(mesh(new THREE.SphereGeometry(0.115, 12, 10), SKIN(skin), 0, 0.11, 0));

  if (o.hijab) {
    const hb = mesh(new THREE.SphereGeometry(0.145, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.78), std(o.hijabColor ?? 0xf0e6d2, { r: 0.9 }), 0, 0.12, -0.01);
    head.add(hb);
    head.add(mesh(new THREE.BoxGeometry(0.26, 0.5, 0.2), std(o.hijabColor ?? 0xf0e6d2, { r: 0.9 }), 0, -0.15, -0.02));
  } else if (o.mohawk) {
    head.add(mesh(new THREE.BoxGeometry(0.06, 0.22, 0.26), std(o.mohawkColor ?? 0xd0527a, { r: 0.7 }), 0, 0.2, -0.01));
  } else if (o.cap) {
    head.add(mesh(new THREE.SphereGeometry(0.125, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), std(o.capColor ?? 0x2e86c1, { r: 0.8 }), 0, 0.15, 0));
    head.add(mesh(new THREE.BoxGeometry(0.2, 0.03, 0.12), std(o.capColor ?? 0x2e86c1, { r: 0.8 }), 0, 0.13, 0.14));
  } else {
    head.add(mesh(new THREE.SphereGeometry(0.122, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), std(hair, { r: 0.85 }), 0, 0.13, -0.005));
  }
  // eyes (tiny, readable at HUD scale)
  for (const x of [-0.042, 0.042]) {
    head.add(mesh(new THREE.BoxGeometry(0.026, 0.026, 0.02), std(0x14161a, { r: 0.6 }), x, 0.115, 0.104));
  }

  // arms: shoulder pivot -> upper arm -> forearm -> hand
  const arm = (side) => {
    const s = side === 'l' ? -1 : 1;
    const sh = new THREE.Group();
    sh.name = `shoulder_${side}`;
    sh.position.set(0.23 * s, 0.5, 0);
    hips.add(sh);
    sh.add(mesh(new THREE.BoxGeometry(0.12, 0.34, 0.14), std(shirt, { r: 0.85 }), 0, -0.16, 0));
    const fore = new THREE.Group();
    fore.name = `elbow_${side}`;
    fore.position.set(0, -0.33, 0);
    sh.add(fore);
    fore.add(mesh(new THREE.BoxGeometry(0.105, 0.3, 0.12), SKIN(skin), 0, -0.15, 0));
    fore.add(mesh(new THREE.BoxGeometry(0.11, 0.1, 0.12), SKIN(skin), 0, -0.33, 0));
    return sh;
  };
  const shoulder_l = arm('l');
  const shoulder_r = arm('r');

  // legs: hip pivot -> thigh -> shin -> shoe
  const leg = (side) => {
    const s = side === 'l' ? -1 : 1;
    const hip = new THREE.Group();
    hip.name = `leg_${side}`;
    hip.position.set(0.1 * s, 0, 0);
    hips.add(hip);
    hip.add(mesh(new THREE.BoxGeometry(0.15, 0.44, 0.17), std(pants, { r: 0.9 }), 0, -0.22, 0));
    const knee = new THREE.Group();
    knee.name = `knee_${side}`;
    knee.position.set(0, -0.44, 0);
    hip.add(knee);
    knee.add(mesh(new THREE.BoxGeometry(0.135, 0.42, 0.155), std(pants, { r: 0.9 }), 0, -0.21, 0));
    knee.add(mesh(new THREE.BoxGeometry(0.16, 0.11, 0.28), std(shoe, { r: 0.8 }), 0, -0.46, 0.04));
    return hip;
  };
  const leg_l = leg('l');
  const leg_r = leg('r');

  if (o.dress) {
    const skirt = mesh(new THREE.ConeGeometry(0.3, 0.55, 10), std(o.dress, { r: 0.9 }), 0, -0.2, 0);
    hips.add(skirt);
  }

  // ------------------------------------------------------------- animation clips
  const clips = [];
  const T = (name, tracks) => clips.push(new THREE.AnimationClip(name, -1, tracks));

  // idle: breathe + tiny sway
  T('idle', [
    vectorTrack('hips', 'position', [0, 0.8, 1.6], [[0, HIPS_Y, 0], [0, HIPS_Y - 0.012, 0], [0, HIPS_Y, 0]]),
    quatTrack('shoulder_l', [0, 0.8, 1.6], [[0, 0, 0.06], [0, 0, 0.1], [0, 0, 0.06]]),
    quatTrack('shoulder_r', [0, 0.8, 1.6], [[0, 0, -0.06], [0, 0, -0.1], [0, 0, -0.06]]),
    quatTrack('head', [0, 0.8, 1.6], [[0, 0.05, 0], [0, -0.05, 0], [0, 0.05, 0]]),
  ]);

  // walk: 1s cycle
  const wt = [0, 0.25, 0.5, 0.75, 1];
  T('walk', [
    quatTrack('leg_l', wt, [[0.45, 0, 0], [0, 0, 0], [-0.45, 0, 0], [0, 0, 0], [0.45, 0, 0]]),
    quatTrack('leg_r', wt, [[-0.45, 0, 0], [0, 0, 0], [0.45, 0, 0], [0, 0, 0], [-0.45, 0, 0]]),
    quatTrack('knee_l', wt, [[0, 0, 0], [0.35, 0, 0], [0.05, 0, 0], [0.5, 0, 0], [0, 0, 0]]),
    quatTrack('knee_r', wt, [[0.05, 0, 0], [0.5, 0, 0], [0, 0, 0], [0.35, 0, 0], [0.05, 0, 0]]),
    quatTrack('shoulder_l', wt, [[-0.3, 0, 0.06], [0, 0, 0.06], [0.3, 0, 0.06], [0, 0, 0.06], [-0.3, 0, 0.06]]),
    quatTrack('shoulder_r', wt, [[0.3, 0, -0.06], [0, 0, -0.06], [-0.3, 0, -0.06], [0, 0, -0.06], [0.3, 0, -0.06]]),
    quatTrack('elbow_l', wt, [[-0.2, 0, 0], [-0.35, 0, 0], [-0.2, 0, 0], [-0.1, 0, 0], [-0.2, 0, 0]]),
    quatTrack('elbow_r', wt, [[-0.2, 0, 0], [-0.1, 0, 0], [-0.2, 0, 0], [-0.35, 0, 0], [-0.2, 0, 0]]),
    vectorTrack('hips', 'position', wt, [[0, HIPS_Y, 0], [0, HIPS_Y + 0.03, 0], [0, HIPS_Y, 0], [0, HIPS_Y + 0.03, 0], [0, HIPS_Y, 0]]),
  ]);

  // run: faster, bigger stride, forward lean
  const rt = [0, 0.175, 0.35, 0.525, 0.7];
  T('run', [
    quatTrack('leg_l', rt, [[0.85, 0, 0], [0, 0, 0], [-0.85, 0, 0], [0, 0, 0], [0.85, 0, 0]]),
    quatTrack('leg_r', rt, [[-0.85, 0, 0], [0, 0, 0], [0.85, 0, 0], [0, 0, 0], [-0.85, 0, 0]]),
    quatTrack('knee_l', rt, [[0.15, 0, 0], [0.9, 0, 0], [0.1, 0, 0], [1.1, 0, 0], [0.15, 0, 0]]),
    quatTrack('knee_r', rt, [[0.1, 0, 0], [1.1, 0, 0], [0.15, 0, 0], [0.9, 0, 0], [0.1, 0, 0]]),
    quatTrack('shoulder_l', rt, [[-0.8, 0, 0.1], [0, 0, 0.1], [0.8, 0, 0.1], [0, 0, 0.1], [-0.8, 0, 0.1]]),
    quatTrack('shoulder_r', rt, [[0.8, 0, -0.1], [0, 0, -0.1], [-0.8, 0, -0.1], [0, 0, -0.1], [0.8, 0, -0.1]]),
    quatTrack('elbow_l', rt, [[-1.2, 0, 0], [-1.4, 0, 0], [-1.2, 0, 0], [-1.0, 0, 0], [-1.2, 0, 0]]),
    quatTrack('elbow_r', rt, [[-1.2, 0, 0], [-1.0, 0, 0], [-1.2, 0, 0], [-1.4, 0, 0], [-1.2, 0, 0]]),
    quatTrack('hips', rt, [[0.12, 0, 0], [0.18, 0, 0], [0.12, 0, 0], [0.18, 0, 0], [0.12, 0, 0]]),
    vectorTrack('hips', 'position', rt, [[0, HIPS_Y, 0], [0, HIPS_Y + 0.05, 0], [0, HIPS_Y, 0], [0, HIPS_Y + 0.05, 0], [0, HIPS_Y, 0]]),
  ]);

  // punch: right arm swings forward, torso twists
  const pt = [0, 0.1, 0.22, 0.34];
  T('punch', [
    quatTrack('shoulder_r', pt, [[0, 0, -0.06], [-1.75, 0.25, -0.1], [-0.5, 0.1, -0.06], [0, 0, -0.06]]),
    quatTrack('elbow_r', pt, [[-0.2, 0, 0], [-0.05, 0, 0], [-0.9, 0, 0], [-0.2, 0, 0]]),
    quatTrack('shoulder_l', pt, [[0, 0, 0.06], [0.5, 0, 0.2], [0.2, 0, 0.1], [0, 0, 0.06]]),
    quatTrack('hips', pt, [[0, 0, 0], [0, -0.35, 0], [0, -0.15, 0], [0, 0, 0]]),
  ]);

  g.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
  return { root: g, anims: clips };
}

/* ---------------------------------------------------------------------- props */

function tree() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.22, 0.3, 3.4, 7), std(0x6b4a2a, { r: 0.95 }), 0, 1.7, 0));
  g.add(mesh(new THREE.IcosahedronGeometry(2.1, 0), std(0x2f8f3a, { r: 0.9 }), 0, 4.4, 0));
  g.add(mesh(new THREE.IcosahedronGeometry(1.5, 0), std(0x379e42, { r: 0.9 }), 0.9, 5.5, 0.4));
  g.add(mesh(new THREE.IcosahedronGeometry(1.2, 0), std(0x2a7f34, { r: 0.9 }), -0.8, 5.2, -0.5));
  g.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
  return { root: g };
}

function streetLamp() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.11, 0.16, 7, 8), std(0x30343a, { r: 0.6, m: 0.5 }), 0, 3.5, 0));
  const arm = mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.6, 6), std(0x30343a, { r: 0.6, m: 0.5 }), 0.7, 6.9, 0);
  arm.rotation.z = Math.PI / 2.3;
  g.add(arm);
  g.add(mesh(new THREE.SphereGeometry(0.34, 10, 8), std(0xffe3a0, { r: 0.3, e: 0xffe3a0, ei: 1.2 }), 1.45, 7.1, 0));
  g.traverse((n) => { if (n.isMesh) n.castShadow = true; });
  return { root: g };
}

function flag() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.06, 0.08, 8, 6), std(0xcfcfcf, { r: 0.5, m: 0.7 }), 0, 4, 0));
  const red = std(0xdd1111, { r: 0.8, side: THREE.DoubleSide });
  const white = std(0xf4f4f4, { r: 0.8, side: THREE.DoubleSide });
  g.add(mesh(new THREE.PlaneGeometry(2.4, 0.75), red, 1.25, 6.9, 0));
  g.add(mesh(new THREE.PlaneGeometry(2.4, 0.75), white, 1.25, 6.15, 0));
  g.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
  return { root: g };
}

/* -------------------------------------------------------------------- registry */

export const REGISTRY = {
  'assets/models/characters/player.glb': () => character({ skin: 0xa8703f, shirt: 0x1a1a1a, pants: 0x22304a, hair: 0x15110e }),
  'assets/models/characters/ped_m1.glb': () => character({ skin: 0xb98558, shirt: 0xc0392b, pants: 0x2b3550 }),
  'assets/models/characters/ped_m2.glb': () => character({ skin: 0x8f5a34, shirt: 0x2e86c1, pants: 0x1a1a1a, cap: true }),
  'assets/models/characters/ped_h1.glb': () => character({ skin: 0xc79a6c, shirt: 0x7d3c98, pants: 0x7d3c98, hijab: true, hijabColor: 0xece2d0, dress: 0x7d3c98 }),
  'assets/models/characters/ped_p1.glb': () => character({ skin: 0xa8703f, shirt: 0x1c1c1c, pants: 0x2b2b33, mohawk: true, mohawkColor: 0xd0527a }),
  // anak/remaja (0-19 th): tinggi 0,79 x dewasa ~1,45 m
  'assets/models/characters/ped_a1.glb': () => {
    const c = character({ skin: 0xc09060, shirt: 0x27ae60, pants: 0x34495e, cap: true, capColor: 0xe67e22 });
    c.root.scale.setScalar(0.79);
    return c;
  },

  'assets/models/vehicles/mobil_player.glb': () => car({ body: 0xc01818, roof: 0x8e1010 }),
  'assets/models/vehicles/mobil_umum_1.glb': () => car({ body: 0x4a78b8 }),
  'assets/models/vehicles/mobil_umum_2.glb': () => car({ body: 0xddbb22 }),
  'assets/models/vehicles/taksi_bluebird.glb': () => car({ body: 0xe8e8e8, taxi: true }),
  'assets/models/vehicles/bus_transjakarta.glb': () => bus(),
  'assets/models/vehicles/bajaj.glb': () => bajaj(),
  'assets/models/vehicles/mobil_polisi.glb': () => car({ body: 0xf2f2f2, police: true }),
  'assets/models/vehicles/motor_1.glb': () => motor(),
  'assets/models/vehicles/truk_1.glb': () => truck(),

  'assets/models/buildings/gedung_pencakar_1.glb': () => office({ w: 16, d: 16, h: 42, wall: 0xd6d9dd, seed: 11 }),
  'assets/models/buildings/gedung_pencakar_2.glb': () => office({ w: 13, d: 15, h: 58, wall: 0xc7d3dd, seed: 23 }),
  'assets/models/buildings/ruko_1.glb': () => shophouse({ w: 8, d: 10, floors: 3, wall: 0xe4d9c6, seed: 31, awning: 0xb23a2e }),
  'assets/models/buildings/ruko_2.glb': () => shophouse({ w: 7.5, d: 9, floors: 2, wall: 0xd8dfd0, seed: 37, awning: 0x2e6f4f }),
  'assets/models/buildings/rumah_menteng_1.glb': () => mentengHouse({}),
  'assets/models/buildings/gedung_kolonial_1.glb': () => colonialBuilding({}),
  'assets/models/buildings/gedung_umum_1.glb': () => towerBlock({ w: 15, d: 14, h: 22, setback: false, wall: 0xd2d7dc, seed: 41 }),
  'assets/models/buildings/gedung_umum_2.glb': () => towerBlock({ w: 13, d: 13, h: 30, setback: true, wall: 0xcbd3d9, seed: 43 }),
  'assets/models/buildings/apartemen_1.glb': () => apartment(),
  'assets/models/buildings/monas.glb': () => monas(),
  'assets/models/buildings/bundaran_hi.glb': () => bundaranHI(),
  'assets/models/buildings/stadion_gbk.glb': () => stadium(),
  'assets/models/buildings/dufan_bianglala.glb': () => ferrisWheel(),

  'assets/models/props/pohon_1.glb': () => tree(),
  'assets/models/props/tiang_lampu.glb': () => streetLamp(),
  'assets/models/props/bendera.glb': () => flag(),
};

const exporter = new GLTFExporter();

function toBase64(u8) {
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
  return btoa(s);
}

export function listModels() {
  return Object.keys(REGISTRY);
}

export async function buildOne(url) {
  const fn = REGISTRY[url];
  if (!fn) throw new Error('unknown model: ' + url);
  const { root, anims } = fn();
  root.updateMatrixWorld(true);
  const glb = await new Promise((res, rej) =>
    exporter.parse(root, res, rej, { binary: true, animations: anims || [], onlyVisible: false })
  );
  const u8 = new Uint8Array(glb);
  return { url, size: u8.length, data: toBase64(u8) };
}

export async function buildAll() {
  const out = [];
  for (const url of listModels()) out.push(await buildOne(url));
  return out;
}
