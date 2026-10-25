import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class AssetLoader {
  constructor() { this.cache = new Map(); this.missing = []; this.loader = new GLTFLoader(); }

  async load(manifestUrl, onProgress) {
    const man = await (await fetch(manifestUrl)).json();
    const items = [];
    for (const cat of Object.keys(man)) for (const it of man[cat]) items.push({ ...it, cat });
    let done = 0;
    await Promise.all(items.map(async it => {
      try {
        const g = await this.loader.loadAsync(it.url);
        this.cache.set(it.id, { scene: g.scene, anims: g.animations, def: it });
      } catch (e) {
        console.error('MISSING ASSET: ' + it.id + ' (' + it.url + ')');
        this.missing.push(it.id);
        this.cache.set(it.id, { scene: new THREE.Object3D(), anims: [], def: it, missing: true });
      }
      if (onProgress) onProgress(++done / items.length, it.id);
    }));
    return man;
  }

  get(id) {
    const c = this.cache.get(id);
    if (c) return c;
    console.error('MISSING ASSET: ' + id + ' (tidak ada di manifest)');
    return { scene: new THREE.Object3D(), anims: [], def: { id, scale: 1 }, missing: true };
  }
}
