# SAGame — Preman Gang Sempit

Game 3D jalanan Jakarta yang dibungkus menjadi aplikasi Android (WebView fullscreen,
landscape) dengan package `com.karta.sagame`.

- Engine: **three.js r160** (ES module + importmap; diunduh saat build, tidak masuk repo)
- Android: Java 17, `minSdk 24`, `targetSdk 34`, `compileSdk 34`
- Halaman dimuat lewat `WebViewAssetLoader` di `https://appassets.androidplatform.net`
  agar ES module dan `fetch()` aset `.glb` berjalan (bukan `file://`)
- Jembatan JS → native: `window.Android.quit()`

> **Status v0.5:** seluruh 27 aset `.glb` (5 karakter, 7 kendaraan, 12 gedung,
> 3 properti) **sudah ada di repo** dan dimuat tanpa `MISSING ASSET`. Model dibuat
> secara programatik lewat `tools/glb/` sehingga bisa dibangun ulang kapan saja —
> lihat [Regenerasi aset](#regenerasi-aset).

## Struktur

```
app/src/main/
├── AndroidManifest.xml                 # activity fullscreen, sensorLandscape
├── assets/
│   ├── index.html                      # shell UI: splash, menu, HUD
│   ├── main.js                         # game loop, kota, input, misi
│   ├── AssetLoader.js                  # muat manifest + GLB (graceful bila hilang)
│   ├── SceneBuilder.js                 # clone/instance GLB, animasi, wheel nodes
│   ├── MaterialSetup.js                # renderer PBR, lighting, HDR env, siang-malam
│   ├── intro.mp4                       # video splash (tools/make_intro.py)
│   ├── assets/
│   │   ├── manifest.json               # daftar 27 aset + url/scale/yaw
│   │   ├── env/sky.hdr                 # HDRI gradasi (tools/make_sky.py)
│   │   └── models/{characters,buildings,vehicles,props}/*.glb
│   └── vendor/three/                   # three.js r160 (diunduh CI, gitignore)
└── java/com/karta/sagame/
    └── MainActivity.java               # WebView + WebViewAssetLoader

tools/make_intro.py                     # generator video splash (Pillow + ffmpeg)
tools/make_sky.py                       # generator HDRI langit (Radiance .hdr)
tools/glb/factory.js                    # resep 27 model: gedung, kendaraan, karakter, props
tools/glb/build-assets.js               # ekspor + validasi GLB (Chromium headless)
tools/glb/selftest.js                   # uji integrasi pakai modul game asli
tools/glb/preview.html                  # grid pratinjau semua model di browser
```

## Pipeline aset GLB/PBR

Semua objek dunia dimuat dari `.glb` lewat `AssetLoader.js` → `SceneBuilder.js`. Tidak ada
mesh primitif (hanya ground/laut/trotoar/bintang). Aset yang hilang menjadi `Object3D`
kosong + log `MISSING ASSET: <id>` (dunia tampak kosong sampai GLB diisi).

### Menambah / mengganti GLB

1. Taruh file di `app/src/main/assets/assets/models/<kategori>/<id>.glb`
   (kategori: `characters`, `vehicles`, `buildings`, `props`).
2. Daftarkan di `app/src/main/assets/assets/manifest.json`:
   `{ "id": "ruko_3", "url": "assets/models/buildings/ruko_3.glb", "scale": 1, "yaw": 0 }`
   (`yaw` opsional, radian, untuk memutar model yang tidak menghadap +Z).
3. Pakai id itu di `main.js` (`PICK` untuk gedung, atau `SB.loadAsset('id', [x,y,z], rot, scale)`).

### Syarat model

- Satuan meter, origin di dasar tengah, **menghadap +Z**. Material PBR (metal-roughness).
- Karakter: klip animasi bernama mengandung `idle`, `walk`, `run`, `punch`.
- Kendaraan: node roda bernama mengandung `wheel`/`roda`/`tire` (untuk diputar).
- Bianglala: node yang berputar bernama mengandung `wheel`/`roda`/`bianglala`/`rotor`.
- Gedung: tambahkan emissiveMap pada jendela agar menyala saat malam. Ukuran kolisi
  diambil otomatis dari bounding box.

### Regenerasi aset

Semua model dibuat dari kode (three.js + `GLTFExporter`) di dalam Chromium headless,
karena tekstur jendela butuh canvas. Hasilnya deterministik.

```sh
# sekali saja: dependensi tool
npm i playwright-core && npx playwright install chromium
# bila Chromium tidak terdeteksi otomatis:
# export CHROME_PATH=/path/ke/chrome

# tulis ulang ke-27 GLB + validasi kontrak (ukuran, origin, klip, roda, emissive)
bun tools/glb/build-assets.js

# hanya memeriksa GLB yang sudah ada (tanpa menulis)
bun tools/glb/build-assets.js --check

# uji integrasi: AssetLoader + SceneBuilder + animasi + roda + jendela malam
bun tools/glb/selftest.js
```

`build-assets.js` menolak aset yang menyalahi kontrak: origin bukan di dasar,
dimensi di luar rentang wajar per kategori, klip animasi tidak lengkap, roda kurang
dari 4 node, atau gedung berjendela tanpa `emissiveMap`.

Melihat bentuk model tanpa menjalankan game: buka `tools/glb/preview.html` lewat
HTTP server (mis. `python3 -m http.server`), tambahkan `?only=buildings` untuk
menyaring kategori.

### ID yang dipakai game

`characters`: player, ped_m1, ped_m2, ped_h1, ped_p1 ·
`vehicles`: mobil_player, mobil_umum_1, mobil_umum_2, taksi_bluebird, bus_transjakarta, bajaj, mobil_polisi ·
`buildings`: gedung_pencakar_1/2, ruko_1/2, rumah_menteng_1, gedung_kolonial_1, gedung_umum_1/2, monas, bundaran_hi, stadion_gbk, dufan_bianglala ·
`props`: pohon_1, tiang_lampu, bendera

### Lingkungan & sumber aset

`assets/env/sky.hdr` adalah HDRI gradasi yang dihasilkan `tools/make_sky.py`
(equirectangular 512x256, Radiance RGBE, radiance rata-rata ~0,25 dengan disk
matahari ~49). Bisa diganti HDRI asli (mis. Poly Haven, CC0) dengan nama file sama;
jaga agar nilainya tetap fotometrik — HDRI dengan nilai ekstrem akan membuat seluruh
scene terbakar putih.

Model dibuat sendiri (bukan aset pihak ketiga), jadi tidak ada urusan lisensi.
Untuk mengganti dengan model CC0: Kenney.nl, Quaternius, Poly Pizza, Sketchfab
(cek lisensi).

## Kontrol

| Aksi | Cara |
|---|---|
| Jalan | joystick kiri (analog, arah bebas) |
| Lari | tahan `LARI/REM` sambil jalan |
| Lihat sekitar | geser layar di area bebas (free-look, pitch dibatasi) |
| Masuk/mengemudi mobil | dekatkan diri ke mobil, tekan `MASUK` |
| Gas / rem | joystick saat mengemudi; `LARI/REM` = rem |
| Pukul | tombol `PUKUL` (hanya saat jalan kaki) |
| Jeda | tombol `II` atau tombol back |

## Video splash

`assets/intro.mp4` — 1280x720, 30 fps, 6,4 detik, H.264 High / yuv420p, tanpa audio
(autoplay WebView aman karena `muted`). Dibuat ulang secara deterministik:

```sh
sudo apt install ffmpeg python3-pil        # sekali saja
python3 tools/make_intro.py app/src/main/assets/intro.mp4
```

Bila video tidak ada atau gagal diputar, `index.html` jatuh ke splash teks
(`setTimeout` 5,8 detik) sehingga aplikasi tetap jalan.

## Build

### GitHub Actions (cara utama)

`.github/workflows/build.yml` berjalan pada setiap push:

1. checkout + JDK 17 (temurin)
2. unduh three.js r160 (`three.module.js`, `GLTFLoader`, `RGBELoader`,
   `SkeletonUtils`, `BufferGeometryUtils`) ke `assets/vendor/three/`
3. `gradle assembleDebug`
4. unggah artifact `SAGame-debug-apk`

Manual: tab **Actions → Build APK → Run workflow**.

### Lokal (x86_64 Linux / macOS)

```sh
V=https://cdn.jsdelivr.net/npm/three@0.160.0
D=app/src/main/assets/vendor/three
mkdir -p $D/build $D/examples/jsm/{loaders,utils}
curl -fL $V/build/three.module.js -o $D/build/three.module.js
for f in loaders/GLTFLoader.js loaders/RGBELoader.js utils/SkeletonUtils.js utils/BufferGeometryUtils.js; do
  curl -fL $V/examples/jsm/$f -o $D/examples/jsm/$f
done
ANDROID_HOME=/path/to/android-sdk ./gradlew assembleDebug
```

### Lokal di Android / Termux (arm64)

SDK Android resmi hanya menyediakan `aapt2` x86_64, sehingga build gagal dengan
`AAPT2 Daemon startup failed`. Tambahkan ke `gradle.properties`:

```
android.aapt2FromMavenOverride=/usr/bin/aapt2
android.builder.sdkDownload=false
```

`/usr/bin/aapt2` harus berasal dari paket `aapt` native arm64. Lalu:

```sh
ANDROID_HOME=/opt/android-sdk ./gradlew assembleDebug
```

## Rilis

APK debug ditandatangani debug keystore dan diunggah sebagai asset GitHub Release
(`v0.1`–`v0.5`). Untuk distribusi serius, buat keystore rilis sendiri dan
konfigurasikan `signingConfigs` di `app/build.gradle`.

## Riwayat versi

- **v0.5** — **dunia terisi**: 27 aset `.glb` lengkap (low-poly PBR) + generator
  `tools/glb/`. Karakter punya 4 klip animasi, kendaraan punya node roda, bianglala
  berputar, jendela gedung menyala saat malam. `sky.hdr` diperbaiki (placeholder
  v0.4 punya radiance ~4,5x10^30 sehingga layar putih total).
- **v0.4** — refactor ke pipeline **GLB/PBR**: three.js r160 ES module, `AssetLoader` /
  `SceneBuilder` / `MaterialSetup`, HDR environment, `WebViewAssetLoader`, manifest 27 aset.
  **Berkas `.glb` belum disertakan** → dunia kosong sampai aset diisi.
- **v0.3** — mekanik pukul, kamera free-look, tabrakan kendaraan, NPC bervariasi.
- **v0.2** — video splash `intro.mp4` + generator `tools/make_intro.py`.
- **v0.1** — rilis pertama: WebView fullscreen, dunia Jakarta prosedural, HUD, minimap.

## Catatan

- `buildToolsVersion '35.0.0'` dipatok agar konsisten dengan runner CI dan SDK perangkat.
- Tombol back memanggil `window.bk()` (jeda/kembali/keluar).
- Peringatan "aset GLB belum lengkap" di layar loading cepat tertimpa teks tips
  bergilir; cek `console`/logcat untuk daftar `MISSING ASSET`.
- Verifikasi otomatis tidak butuh GPU: `build-assets.js` memeriksa header GLB, bounding
  box, nama node/klip, dan tekstur; `selftest.js` menjalankan modul game asli. Render
  visual tetap harus dicek di perangkat — Chromium headless di lingkungan build ini
  mengembalikan piksel kosong (SwiftShader tanpa GPU), jadi screenshot tidak bisa
  dipakai sebagai bukti.
- APK debug — bukan untuk distribusi publik.
