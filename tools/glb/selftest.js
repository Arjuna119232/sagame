#!/usr/bin/env bun
/**
 * Uji integrasi aset memakai modul game asli (AssetLoader/SceneBuilder/MaterialSetup)
 * di Chromium headless. Tidak memerlukan GPU: yang diperiksa scene graph, animasi,
 * node roda, node bianglala, dan emissive jendela malam.
 *
 *   bun tools/glb/selftest.js
 */
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const path = require('path');
const REPO = path.resolve(__dirname, '../..');
const PORT = Number(process.env.PORT || 8795);
// CHROME_PATH opsional; tanpa itu playwright mencari chromium yang terpasang.
const EXE = process.env.CHROME_PATH || undefined;
const LAUNCH = { args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] };
if (EXE) LAUNCH.executablePath = EXE;

(async () => {
  const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: REPO, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const browser = await chromium.launch(LAUNCH);
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !t.includes('404')) errs.push(t);
  });

  await page.goto(`http://127.0.0.1:${PORT}/tools/glb/selftest.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });

  let res;
  try {
    res = await page.evaluate(() => window.runSelfTest());
  } catch (e) {
    console.error('GAGAL menjalankan self-test:', e.message);
    await browser.close();
    srv.kill();
    process.exit(1);
  }

  let fail = 0;
  for (const c of res.checks) {
    if (!c.ok) fail++;
    console.log(`  ${c.ok ? 'ok' : 'XX'} ${c.name.padEnd(36)} ${c.detail || ''}`);
  }
  if (errs.length) {
    console.log('\nError konsol:');
    for (const e of errs.slice(0, 8)) console.log('  ' + e);
    fail += errs.length;
  }
  console.log(fail ? `\nGAGAL: ${fail} masalah` : '\nSELF-TEST LULUS');

  await browser.close();
  srv.kill();
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
