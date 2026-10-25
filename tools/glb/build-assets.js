#!/usr/bin/env bun
/**
 * SAGame GLB asset builder.
 *
 * Menjalankan tools/glb/factory.js di Chromium headless (butuh canvas untuk tekstur
 * jendela), mengekspor tiap model ke GLB, menulisnya ke app/src/main/assets/...,
 * lalu memuat ulang setiap GLB untuk memvalidasi kontrak README:
 *   - skala meter, origin di dasar (min.y ~ 0), menghadap +Z
 *   - karakter punya klip idle/walk/run/punch
 *   - kendaraan punya node roda (wheel/roda/tire)
 *   - bianglala punya node berputar
 *   - gedung berjendela punya emissiveMap
 *
 * Pemakaian:  bun tools/glb/build-assets.js [--check]
 *   --check : hanya validasi GLB yang sudah ada, tidak menulis ulang.
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const REPO = path.resolve(__dirname, '../..');
const OUT = path.join(REPO, 'app/src/main/assets');
// CHROME_PATH opsional; tanpa itu playwright mencari chromium yang terpasang.
const EXE = process.env.CHROME_PATH || undefined;
const LAUNCH = { args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] };
if (EXE) LAUNCH.executablePath = EXE;
const PORT = 8791;
const CHECK_ONLY = process.argv.includes('--check');

const MANIFEST = JSON.parse(fs.readFileSync(path.join(OUT, 'assets/manifest.json'), 'utf8'));
const EXPECTED = [];
for (const cat of Object.keys(MANIFEST)) for (const it of MANIFEST[cat]) EXPECTED.push({ ...it, cat });
const byUrl = new Map(EXPECTED.map((e) => [e.url, e]));

/* --------------------------------------------------------------- validation rules */

const RULES = {
  characters: { minH: 1.3, maxH: 2.2, maxW: 1.2, clips: ['idle', 'walk', 'run', 'punch'] },
  vehicles: { minH: 0.8, maxH: 4.2, maxW: 3.0, maxL: 13.5, wheels: 4 },
  buildings: { minH: 3, maxH: 80, maxW: 32, maxL: 32 },
  props: { minH: 1, maxH: 9, maxW: 6, maxL: 6 },
};

function checkGlbHeader(buf, url) {
  const errs = [];
  if (buf.length < 20) errs.push('file terlalu kecil');
  if (buf.readUInt32LE(0) !== 0x46546c67) errs.push('magic bukan glTF');
  if (buf.readUInt32LE(4) !== 2) errs.push('versi glTF bukan 2');
  if (buf.readUInt32LE(8) !== buf.length) errs.push(`header length ${buf.readUInt32LE(8)} != file ${buf.length}`);
  const jsonLen = buf.readUInt32LE(12);
  if (buf.readUInt32LE(16) !== 0x4e4f534a) errs.push('chunk pertama bukan JSON');
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  if (!json.asset || json.asset.version !== '2.0') errs.push('asset.version bukan 2.0');
  for (const b of json.buffers || []) if (b.uri) errs.push('buffer tidak embedded (ada uri)');
  for (const i of json.images || []) if (i.uri) errs.push('image tidak embedded (ada uri)');
  if (!json.meshes || !json.meshes.length) errs.push('tidak ada mesh');
  return { errs, json, size: buf.length };
}

/* ------------------------------------------------------------------ http + browser */

async function startServer() {
  const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {
    cwd: REPO,
    stdio: 'ignore',
  });
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/tools/glb/harness.html`);
      if (r.ok) return srv;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  srv.kill();
  throw new Error('server HTTP gagal start');
}

/* ------------------------------------------------------------------------- main */

(async () => {
  const server = await startServer();
  const browser = await chromium.launch(LAUNCH);
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !t.includes('404')) pageErrors.push('console: ' + t);
  });

  await page.goto(`http://127.0.0.1:${PORT}/tools/glb/harness.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });

  const urls = await page.evaluate(() => window.listModels());
  let fail = 0;
  const say = (s) => console.log(s);

  // registry vs manifest harus sama persis
  const missingInFactory = EXPECTED.map((e) => e.url).filter((u) => !urls.includes(u));
  const extraInFactory = urls.filter((u) => !byUrl.has(u));
  if (missingInFactory.length) { say('XX manifest tanpa builder: ' + missingInFactory.join(', ')); fail++; }
  if (extraInFactory.length) { say('XX builder tanpa manifest: ' + extraInFactory.join(', ')); fail++; }

  const written = [];
  if (!CHECK_ONLY) {
    say(`\n=== build ${urls.length} GLB ===`);
    for (const url of urls) {
      const t0 = Date.now();
      const res = await page.evaluate((u) => window.buildOne(u), url);
      const buf = Buffer.from(res.data, 'base64');
      const dest = path.join(OUT, url);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, buf);
      written.push({ url, size: buf.length });
      say(`  ${(buf.length / 1024).toFixed(1).padStart(7)} KiB  ${((Date.now() - t0) / 1000).toFixed(2)}s  ${url.replace('assets/models/', '')}`);
    }
  }

  // --- validasi tiap GLB: header + muat ulang lewat GLTFLoader
  say(`\n=== validasi ${EXPECTED.length} aset ===`);
  const loaded = await page.evaluate(async (list) => {
    const THREE = await import('three');
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const loader = new GLTFLoader();
    const out = [];
    for (const url of list) {
      try {
        const g = await loader.loadAsync('/app/src/main/assets/' + url);
        const root = g.scene;
        root.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(root);
        const size = new THREE.Vector3();
        box.getSize(size);
        const min = box.min;
        const nodes = [], meshes = [];
        let tris = 0, emissive = 0, maps = 0;
        root.traverse((n) => {
          if (n.name) nodes.push(n.name);
          if (!n.isMesh) return;
          meshes.push(n.name || '(mesh)');
          const mats = [].concat(n.material);
          for (const m of mats) {
            if (m.emissiveMap) emissive++;
            if (m.map) maps++;
          }
          const idx = n.geometry.index;
          tris += idx ? idx.count / 3 : n.geometry.attributes.position.count / 3;
        });
        out.push({
          url,
          ok: true,
          size: [size.x, size.y, size.z],
          min: [min.x, min.y, min.z],
          nodes,
          clips: g.animations.map((a) => a.name),
          emissive,
          maps,
          tris: Math.round(tris),
          meshes: meshes.length,
        });
      } catch (e) {
        out.push({ url, ok: false, error: String(e && e.message ? e.message : e) });
      }
    }
    return out;
  }, EXPECTED.map((e) => e.url));

  for (const r of loaded) {
    const def = byUrl.get(r.url);
    const short = r.url.replace('assets/models/', '');
    const errs = [];
    if (!r.ok) {
      say(`  XX ${short}: gagal dimuat (${r.error})`);
      fail++;
      continue;
    }
    // header GLB
    const buf = fs.readFileSync(path.join(OUT, r.url));
    const hdr = checkGlbHeader(buf, r.url);
    errs.push(...hdr.errs);

    const [w, h, d] = r.size;
    const rule = RULES[def.cat];
    // origin di dasar: min.y mendekati 0 (toleransi 10 cm)
    if (Math.abs(r.min[1]) > 0.1) errs.push(`origin bukan di dasar (min.y=${r.min[1].toFixed(3)})`);
    if (h < rule.minH || h > rule.maxH) errs.push(`tinggi ${h.toFixed(2)} m di luar ${rule.minH}..${rule.maxH}`);
    if (Math.max(w, d) > Math.max(rule.maxW, rule.maxL)) errs.push(`lebar ${Math.max(w, d).toFixed(2)} m terlalu besar`);
    if (rule.maxL && d > rule.maxL) errs.push(`panjang ${d.toFixed(2)} m > ${rule.maxL}`);
    if (def.cat === 'characters') {
      for (const k of rule.clips) if (!r.clips.some((c) => c.toLowerCase().includes(k))) errs.push(`klip '${k}' tidak ada`);
    }
    if (def.cat === 'vehicles') {
      const need = /motor/i.test(def.id) ? 2 : rule.wheels;   // sepeda motor: 2 roda
      const wheels = r.nodes.filter((n) => /wheel|roda|tire/i.test(n));
      if (wheels.length < need) errs.push(`node roda hanya ${wheels.length} (butuh ${need})`);
    }
    if (def.id === 'dufan_bianglala' && !r.nodes.some((n) => /wheel|roda|bianglala|rotor/i.test(n))) {
      errs.push('node pemutar bianglala tidak ada');
    }
    if (['gedung_pencakar_1', 'gedung_pencakar_2', 'ruko_1', 'ruko_2', 'gedung_umum_1', 'gedung_umum_2', 'apartemen_1'].includes(def.id)) {
      if (!r.emissive) errs.push('tidak ada emissiveMap (jendela tidak menyala saat malam)');
    }

    const flag = errs.length ? 'XX' : 'ok';
    say(
      `  ${flag} ${short.padEnd(42)} ${(buf.length / 1024).toFixed(1).padStart(7)} KiB  ` +
      `w=${w.toFixed(1)} h=${h.toFixed(1)} d=${d.toFixed(1)}  ` +
      `tri=${String(r.tris).padStart(5)}  clip=${r.clips.length}  emi=${r.emissive}`
    );
    if (errs.length) {
      fail += errs.length;
      for (const e of errs) say(`       -> ${e}`);
    }
  }

  const total = loaded.reduce((a, r) => a + (r.ok ? fs.statSync(path.join(OUT, r.url)).size : 0), 0);
  say(`\nTotal GLB: ${loaded.length} aset, ${(total / 1024).toFixed(0)} KiB`);
  if (pageErrors.length) {
    say('Error halaman:');
    for (const e of pageErrors.slice(0, 10)) say('  ' + e);
    fail += pageErrors.length;
  }
  if (fail) {
    say(`\nGAGAL: ${fail} masalah`);
  } else {
    say('\nSEMUA ASET VALID');
  }

  await browser.close();
  server.kill();
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
