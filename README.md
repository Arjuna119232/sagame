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
├── assets/three.min.js            # diunduh saat build (gitignore)
└── java/com/karta/sagame/
    └── MainActivity.java          # WebView + JavascriptInterface
```

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

- `assets/index.html` merujuk `intro.mp4` untuk splash screen; file video tidak
  disertakan sehingga splash memakai teks.
- Back button memanggil `window.bk()` bila didefinisikan oleh game.
