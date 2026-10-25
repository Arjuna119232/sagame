# SAGame — Preman Gang Sempit

Game 3D jalanan Jakarta yang dibungkus menjadi aplikasi Android (WebView fullscreen,
landscape) dengan package `com.karta.sagame`.

- Engine: **three.js r160** (ES module + importmap; diunduh saat build, tidak masuk repo)
- Android: Java 17, `minSdk 24`, `targetSdk 34`, `compileSdk 34`
- Halaman dimuat lewat `WebViewAssetLoader` di `https://appassets.androidplatform.net`
  agar ES module dan `fetch()` aset `.glb` berjalan (bukan `file://`)
- Jembatan JS → native: `window.Android.quit()`

> **Status v0.7:** seluruh 31 aset `.glb` (6 karakter, 9 kendaraan, 13 gedung,
> 3 properti) **sudah ada di repo** dan dimuat tanpa `MISSING ASSET`. Model dibuat
> secara programatik lewat `tools/glb/` sehingga bisa dibangun ulang kapan saja —
> lihat [Regenerasi aset](#regenerasi-aset). Sejak v0.6 angka kota (penduduk, luas,
> kendaraan) menjadi parameter game yang nyata — lihat [Data kota](#data-kota-v06).

## Struktur

```
app/src/main/
├── AndroidManifest.xml                 # activity fullscreen, sensorLandscape
├── assets/
│   ├── index.html                      # shell UI: splash, menu, HUD
│   ├── main.js                         # game loop, kota, input, misi
│   ├── KotaData.js                     # sumber tunggal angka kota + layar PROFIL KOTA
│   ├── AssetLoader.js                  # muat manifest + GLB (graceful bila hilang)
│   ├── SceneBuilder.js                 # clone/instance GLB, animasi, wheel nodes
│   ├── MaterialSetup.js                # renderer PBR, lighting, HDR env, siang-malam
│   ├── intro.mp4                       # video splash (tools/make_intro.py)
│   ├── assets/
│   │   ├── manifest.json               # daftar 31 aset + url/scale/yaw
│   │   ├── env/sky.hdr                 # HDRI gradasi (tools/make_sky.py)
│   │   └── models/{characters,buildings,vehicles,props}/*.glb
│   └── vendor/three/                   # three.js r160 (diunduh CI, gitignore)
└── java/com/karta/sagame/
    └── MainActivity.java               # WebView + WebViewAssetLoader

tools/make_intro.py                     # generator video splash (Pillow + ffmpeg)
tools/make_sky.py                       # generator HDRI langit (Radiance .hdr)
tools/glb/factory.js                    # resep 31 model: gedung, kendaraan, karakter, props
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

# tulis ulang ke-31 GLB + validasi kontrak (ukuran, origin, klip, roda, emissive)
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

`characters`: player, ped_m1, ped_m2, ped_h1, ped_p1, ped_a1 (anak/remaja) ·
`vehicles`: mobil_player, mobil_umum_1, mobil_umum_2, taksi_bluebird, bus_transjakarta, bajaj, mobil_polisi, motor_1, truk_1 ·
`buildings`: gedung_pencakar_1/2, ruko_1/2, rumah_menteng_1, gedung_kolonial_1, gedung_umum_1/2, apartemen_1, monas, bundaran_hi, stadion_gbk, dufan_bianglala ·
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

## Data kota (v0.6)

Semua angka kota ada di satu berkas: `app/src/main/assets/KotaData.js`. Tidak ada angka
kota yang ditulis ulang di `main.js` atau `index.html`; turunan (rasio, kepadatan,
komposisi lalu lintas) dihitung dari berkas itu.

| Data | Nilai di `KOTA` | Dipakai jadi apa di game |
|---|---|---|
| Penduduk 10.680.000 (L 5.361.000 / P 5.317.000) | `penduduk`, `pendudukLaki`, `pendudukPerempuan` | baris layar PROFIL KOTA |
| Kelompok umur 0-9 / 10-19 / 20-64 / 65+ | `umur[]` | baris layar PROFIL KOTA |
| Luas darat 661,53 km², laut 6.977,5 km², total 7.639,83 km² | `luasDarat`, `luasLaut`, `luasTotal` | baris luas + dasar kepadatan |
| Kepadatan ±16.144 jiwa/km² | **turunan**: `penduduk / luasDarat` | baris luas |
| Kendaraan 12.279.058: motor 9.376.276, mobil 2.336.960, truk 527.841, bus 37.981 | `kendaraan` | **komposisi + jumlah lalu lintas** (motor 76,4% · mobil 19,0% · truk 4,3% · bus 0,3%) |
| Rumah milik sendiri 54,54% | `rumahMilik` | peluang jendela menyala malam (dipakai `tools/glb/factory.js`) |
| Apartemen ±46.000 | `apartemen` | **jumlah tower apartemen** di peta (24 tower) |
| Gedung audit ±3.500 | `gedungDiperiksa` | pembagi porsi tower + baris panel |
| Kepadatan 16.144 jiwa/km² | turunan | **jumlah pejalan kaki (NPC)** |
| Kepadatan 18.562 kendaraan/km² | turunan | **jumlah kendaraan** yang di-spawn |
| Rasio umur 0-19 / 20-64 / 65+ | `umur[]` | **komposisi model NPC** (anak · dewasa · lansia) |

### Dari data ke gameplay (v0.7)

```
luas peta      = 600 x 600 m                      = 0,36 km²
penduduk peta  = 16.144 jiwa/km² x 0,36 km²       = 5.812 jiwa
kendaraan peta = 18.562 kendaraan/km² x 0,36 km²  = 6.682 kendaraan
skala main     = 1 : 150   (batas yang masih bisa dirender di ponsel)
   -> NPC        = 5.812 / 150 = 39 orang
   -> kendaraan  = 6.682 / 150 = 45 unit
tower          = (46.000 unit / 120 unit per tower) / 3.500 gedung audit
   -> 10,9% x 221 bangunan     = 24 tower
```

`SKALA = 150` dan `UNIT_PER_MENARA = 120` **bukan angka statistik** — itu asumsi
permainan, ditulis di `KotaData.js` dan di layar PROFIL KOTA. Ganti angkanya di
satu tempat itu untuk membuat kota lebih padat atau lebih ringan.

Komposisi pejalan kaki memakai porsi tabel umur: 0-19 th → `ped_a1`, 20-64 th →
`ped_m1/m2/p1`, 65+ → `ped_h1`. Hasil v0.7: 39 NPC = 11 anak, 25 dewasa, 3 lansia.

Cara kerja lalu lintas: 45 kendaraan di-spawn sekali saat dunia dibangun
(`MAX_LALULINTAS` = 45), jumlah yang **tampil** diatur pengaturan LALU LINTAS
(16 / 30 / 45) lewat `visible`. Komposisinya dihitung `bagiKendaraan()` dengan metode
sisa terbesar dari rasio nyata, lalu `rencanaLaluLintas()` memecahnya jadi id GLB:
motor → `motor_1`, mobil → campuran `mobil_umum_1/2`, `taksi_bluebird`, `bajaj`
(bobot 45/30/15/10), truk → `truk_1`, bus → `bus_transjakarta`.

Penyimpangan yang disengaja (dan ditulis di panel):

- **Skala 1:150.** Jakarta asli berisi 16.144 orang/km²; menerjemahkannya 1:1 ke
  peta 600x600 m berarti ~5.800 NPC dan ~6.700 kendaraan, mustahil di ponsel.
- **Bus & truk dapat kuota minimum 1** saat n ≥ 12. Porsi aslinya 0,3% dan 4,3%,
  sehingga tanpa kuota bus tidak pernah muncul (ikon TransJakarta hilang).
- **Jendela menyala 54,54%** adalah analogi dari angka rumah milik sendiri, bukan
  data pemakaian listrik.
- **Peta tetap kecil dibanding Jakarta.** 600x600 m ≈ 0,36 km² ≈ 0,05% daratan;
  itulah alasan skala 1:150 dipakai.

### Performa

221 bangunan dipasang sebagai `InstancedMesh` per tipe (`SceneBuilder.loadInstanced`),
bukan clone per gedung: 24 tower apartemen = 8 draw call, bukan ~190. Tanpa ini
600x600 m akan jadi ~1.100 draw call dan ponsel menengah akan tersendat.
Pejalan kaki tetap mesh per karakter (39 x ±19 mesh) karena tiap karakter
dianimasikan sendiri.

Ketidakcocokan di data sumber ditampilkan apa adanya, tidak "diperbaiki" di kode:

- Jumlah kelompok umur 11.149.500 vs total penduduk 10.680.000 → selisih 469.500.
- Darat + laut = 7.639,03 km² vs total resmi 7.639,83 km² → selisih 0,8 km².
- "3.500 gedung" adalah **sampel audit**, bukan total gedung Jakarta.

Layar **PROFIL KOTA** (menu utama) merender tabel di atas, termasuk catatan
ketidakcocokan itu. Untuk mengubah data: sunting `KOTA`/`DUNIA` di `KotaData.js`,
lalu `bun tools/glb/build-assets.js` bila perubahan menyentuh `rumahMilik`
(peluang jendela menyala ikut berubah).

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
(`v0.1`–`v0.7`). Untuk distribusi serius, buat keystore rilis sendiri dan
konfigurasikan `signingConfigs` di `app/build.gradle`.

## Riwayat versi

- **v0.7** — **data kota jadi dunia**: peta diperbesar ke 600x600 m (15x15 blok,
  221 bangunan), jumlah kendaraan (45) dan pejalan kaki (39) dihitung dari
  kepadatan Jakarta dengan skala 1:150, komposisi NPC mengikuti kelompok umur
  (anak/dewasa/lansia), dan 24 tower apartemen berasal dari 46.000 unit
  apartemen ÷ 120 unit/menara dibanding sampel 3.500 gedung audit. Tambah 2 GLB
  (`apartemen_1`, `ped_a1`) → 31 aset. Bangunan di-*instance* agar tetap ringan.
  Perbaikan: pemain dulu spawn di dalam radius Monas sehingga tidak bisa berjalan.
- **v0.6** — **data kota jadi parameter**: `KotaData.js` memuat penduduk, kelompok
  umur, luas wilayah, dan jumlah kendaraan; komposisi lalu lintas mengikuti rasio
  nyata (motor 76,4%), jendela malam mengikuti 54,54% rumah milik, dan menu baru
  **PROFIL KOTA** menampilkan tabel + catatan ketidakcocokan data. Tambah 2 GLB
  (`motor_1`, `truk_1`) → 29 aset. Jam HUD memakai **WIB asli format 24 jam**,
  bukan lagi jam UTC yang diberi label WIB.
- **v0.5** — **dunia terisi**: 27 aset `.glb` lengkap (low-poly PBR) + generator
  `tools/glb/`. Karakter punya 4 klip animasi, kendaraan punya node roda, bianglala
  berputar, jendela gedung menyala saat malam. `sky.hdr` diperbaiki (placeholder
  v0.4 punya radiance ~4,5x10^30 sehingga layar putih total).
- **v0.4** — refactor ke pipeline **GLB/PBR**: three.js r160 ES module, `AssetLoader` /
  `SceneBuilder` / `MaterialSetup`, HDR environment, `WebViewAssetLoader`, manifest 29 aset.
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
