import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
const mats = new Set();

export function setupRenderer(R) {
  R.shadowMap.enabled = true;
  R.shadowMap.type = THREE.PCFSoftShadowMap;
  R.toneMapping = THREE.ACESFilmicToneMapping;
  R.toneMappingExposure = 1.1;
  R.outputColorSpace = THREE.SRGBColorSpace;
}

export function setupLights(S, shadows) {
  const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x556070, 1.0);
  const sun = new THREE.DirectionalLight(0xfff0d0, 3.0);
  sun.castShadow = shadows;
  sun.shadow.mapSize.set(1024, 1024);
  const c = sun.shadow.camera;
  c.left = c.bottom = -50; c.right = c.top = 50; c.near = 1; c.far = 300;
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.05;
  S.add(hemi, sun, sun.target);
  S.fog = new THREE.Fog(0x9fd0f0, 70, 240);
  return { hemi, sun };
}

export async function loadEnv(R, S, url) {
  try {
    const pm = new THREE.PMREMGenerator(R);
    const tex = await new RGBELoader().loadAsync(url);
    S.environment = pm.fromEquirectangular(tex).texture;
    tex.dispose(); pm.dispose();
    return true;
  } catch (e) { console.warn('MISSING ENV HDR: ' + url); return false; }
}

// Pastikan semua material PBR (unlit/lain dikonversi), aktifkan bayangan, catat untuk siang-malam.
export function register(root) {
  root.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = o.receiveShadow = true;
    const arr = [].concat(o.material).map(m => m.isMeshStandardMaterial ? m :
      new THREE.MeshStandardMaterial({ color: m.color, map: m.map, transparent: m.transparent, opacity: m.opacity, side: m.side }));
    o.material = Array.isArray(o.material) ? arr : arr[0];
    arr.forEach(m => mats.add(m));
  });
}

// nf: 0 siang .. 1 malam. Jendela (emissiveMap) menyala saat malam, env redup.
export function setDay(nf) {
  mats.forEach(m => { m.envMapIntensity = 0.3 + 0.7 * (1 - nf); if (m.emissiveMap) m.emissiveIntensity = nf * 1.5; });
}
