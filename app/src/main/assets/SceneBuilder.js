import * as THREE from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { register } from './MaterialSetup.js';

export class SceneBuilder {
  constructor(scene, assets) { this.S = scene; this.A = assets; this.mx = []; this.bb = new Map(); }

  // ukuran model (meter, sudah x scale manifest). Vector3 nol bila aset hilang.
  bounds(id) {
    let b = this.bb.get(id);
    if (!b) {
      const a = this.A.get(id); b = new THREE.Vector3();
      if (!a.missing) { a.scene.updateMatrixWorld(true); new THREE.Box3().setFromObject(a.scene).getSize(b); b.multiplyScalar(a.def.scale ?? 1); }
      this.bb.set(id, b);
    }
    return b;
  }

  loadAsset(id, pos = [0, 0, 0], rot = 0, scale = 1) {
    const a = this.A.get(id), g = new THREE.Group();
    g.userData.wh = [];
    if (!a.missing) {
      const o = clone(a.scene);                       // SkeletonUtils: aman untuk animasi
      o.scale.setScalar((a.def.scale ?? 1) * scale);
      o.rotation.y = a.def.yaw || 0;                  // koreksi arah model (opsional di manifest)
      g.add(o);
      o.traverse(n => { if (/wheel|roda|tire/i.test(n.name)) g.userData.wh.push(n); });
      if (a.anims.length) {
        const m = new THREE.AnimationMixer(o);
        g.userData.acts = a.anims.map(c => ({ k: c.name.toLowerCase(), a: m.clipAction(c) }));
        this.mx.push(m);
      }
      register(g);
    }
    g.userData.missing = !!a.missing;
    g.userData.size = this.bounds(id).clone();
    g.position.set(pos[0], pos[1], pos[2]); g.rotation.y = rot;
    this.S.add(g);
    return g;
  }

  // Untuk ratusan objek statis (pohon, tiang): InstancedMesh dari mesh di dalam GLB.
  loadInstanced(id, list) {
    const a = this.A.get(id);
    if (a.missing || !list.length) return null;
    a.scene.updateMatrixWorld(true);
    const grp = new THREE.Group(), sc = a.def.scale ?? 1;
    const mi = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
    a.scene.traverse(m => {
      if (!m.isMesh) return;
      const im = new THREE.InstancedMesh(m.geometry, m.material, list.length);
      list.forEach((it, i) => {
        e.set(0, it.rot || 0, 0); q.setFromEuler(e); p.set(it.x, it.y || 0, it.z); s.setScalar(sc * (it.s || 1));
        mi.compose(p, q, s).multiply(m.matrixWorld); im.setMatrixAt(i, mi);
      });
      grp.add(im);
    });
    register(grp); this.S.add(grp);
    return grp;
  }

  // putar klip animasi berdasarkan kata kunci nama klip: idle / walk / run / punch
  play(g, key) {
    const u = g.userData;
    if (!u.acts || u.cur === key) return;
    const f = k => u.acts.find(x => x.k.includes(k));
    const x = f(key) || (key === 'run' ? f('walk') : null);
    if (!x) return;
    u.cur = key;
    if (u.curA) u.curA.fadeOut(0.2);
    x.a.reset().setLoop(key === 'punch' ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    x.a.clampWhenFinished = true; x.a.fadeIn(0.2).play(); u.curA = x.a;
  }

  update(dt) { for (const m of this.mx) m.update(dt); }
}
