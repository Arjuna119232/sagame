# SAGame — Preman Gang Sempit

Game 3D jalanan Jakarta berbasis **three.js** yang dibungkus menjadi aplikasi Android
(WebView fullscreen, landscape) dengan package `com.karta.sagame`.

- Engine: three.js r128 (dimuat saat build dari CDN, tidak disimpan di repo)
- Android: Java 17, `minSdk 24`, `targetSdk 34`, `compileSdk 34`
- Jembatan JS → native: `window.Android.quit()` untuk keluar dari game

## Struktur

```
app/src/main/
├── AndroidManifest.xml            # activity fullscreen, sensorLandscape
├── assets/index.html              # seluruh game (render, HUD, menu, splash)
├── assets/intro.mp4               # video splash (dibuat oleh tools/make_intro.py)
├── assets/three.min.js            # diunduh saat build (gitignore)
└── java/com/karta/sagame/
    └── MainActivity.java          # WebView + JavascriptInterface

tools/make_intro.py                # generator video splash (Pillow + ffmpeg)
```

## Video splash

`assets/intro.mp4` — 1280x720, 30 fps, 6,4 detik, H.264 High / yuv420p, tanpa audio
(autoplay WebView aman karena `muted`). Alurnya: kartu studio `0xmahen PRESENTS`,
lalu judul `PREMAN / GANG SEMPIT` di atas siluet Jakarta saat senja (Monas, jendela
menyala), ditutup fade ke hitam agar menyambung ke layar loading.

Video dibuat ulang secara deterministik:

```sh
sudo apt install ffmpeg python3-pil        # sekali saja
python3 tools/make_intro.py app/src/main/assets/intro.mp4
```

Kalau `intro.mp4` tidak ada atau gagal diputar, `index.html` otomatis jatuh ke
splash teks (`setTimeout` 5,8 detik) sehingga aplikasi tetap jalan.

## Build

### GitHub Actions (cara utama)

Workflow `.github/workflows/build.yml` berjalan pada setiap push:

1. checkout + JDK 17 (temurin)
2. unduh `three.min.js` dari cdnjs
3. `gradle assembleDebug`
4. unggah artifact `SAGame-debug-apk`

Jalankan manual lewat tab **Actions → Build APK → Run workflow**.

### Lokal (x86_64 Linux / macOS)

```sh
curl -fL https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js \
  -o app/src/main/assets/three.min.js
ANDROID_HOME=/path/to/android-sdk ./gradlew assembleDebug
# hasil: app/build/outputs/apk/debug/app-debug.apk
```

### Lokal di Android / Termux (arm64)

SDK Android resmi hanya menyediakan `aapt2` x86_64, sehingga build gagal dengan
`AAPT2 Daemon startup failed`. Dua penyesuaian diperlukan:

1. Pakai `aapt2` native arm64 (mis. paket `aapt`/`android-sdk-build-tools` distro),
   lalu tambahkan ke `gradle.properties`:
   ```
   android.aapt2FromMavenOverride=/usr/bin/aapt2
   ```
2. Cegah AGP mengunduh paket SDK yang tidak tersedia untuk arm64:
   ```
   android.builder.sdkDownload=false
   ```

Setelah itu:

```sh
ANDROID_HOME=/opt/android-sdk ./gradlew assembleDebug
```

## Rilis

APK debug ditandatangani dengan debug keystore dan diunggah sebagai asset
GitHub Release (`v0.1`). Untuk distribusi serius, buat keystore rilis sendiri
dan konfigurasikan `signingConfigs` di `app/build.gradle`.

## Catatan

- `buildToolsVersion '35.0.0'` dipatok agar build konsisten antara CI dan perangkat;
  AGP 8.5.2 tetap memakai `compileSdk 34`.
- Back button memanggil `window.bk()` (didefinisikan game) untuk jeda/kembali/keluar.
- APK debug ditandatangani debug keystore — bukan untuk distribusi publik.
