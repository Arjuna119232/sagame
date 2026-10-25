// Data kota Jakarta yang dipakai game (v0.6+).
// Sumber angka: tabel statistik yang diberikan pemilik proyek (BPS DKI / Dishub / audit gedung).
// Semua turunan (rasio, komposisi lalu lintas) dihitung di sini supaya tidak ada angka ganda.

export const KOTA = {
  nama: 'DKI Jakarta',
  penduduk: 10680000,
  pendudukLaki: 5361000,
  pendudukPerempuan: 5317000,
  umur: [
    { label: '0-9 th', jumlah: 1500000 },
    { label: '10-19 th', jumlah: 1590000 },
    { label: '20-64 th', jumlah: 7280000 },
    { label: '65+ th', jumlah: 779500 },
  ],
  kendaraan: {
    total: 12279058,
    motor: 9376276,
    mobil: 2336960,
    truk: 527841,
    bus: 37981,
  },
  rumahMilik: 0.5454,      // 54,54% rumah tangga memiliki rumah sendiri
  apartemen: 46000,
  gedungDiperiksa: 3500,   // sampel audit, bukan total resmi
  // Luas wilayah (km²). luasTotal adalah angka resmi yang dipakai sumber;
  // darat + laut tidak menjumlah persis ke angka itu (selisih 0,8 km²).
  luasDarat: 661.53,       // BPS 2025
  luasLaut: 6977.5,
  luasTotal: 7639.83,
};

// Dunia game: 11x11 blok, satu blok 40 m (lihat main.js).
export const DUNIA = { sisi: 440, blok: 11, blokM: 40, bangunan: 110 };

export const rasioKendaraan = () => {
  const k = KOTA.kendaraan;
  return {
    motor: k.motor / k.total,
    mobil: k.mobil / k.total,
    truk: k.truk / k.total,
    bus: k.bus / k.total,
  };
};

// Jumlah kendaraan yang dispawn (yang tampil diatur pengaturan LALU LINTAS).
export const MAX_LALULINTAS = 28;

// Variasi visual untuk slot "mobil penumpang" (bajaj & taksi tetap mobil penumpang).
const MOBIL = [
  { id: 'mobil_umum_1', w: 0.45 },
  { id: 'mobil_umum_2', w: 0.30 },
  { id: 'taksi_bluebird', w: 0.15 },
  { id: 'bajaj', w: 0.10 },
];

function pilihMobil(rand) {
  let x = rand();
  for (const m of MOBIL) { if ((x -= m.w) <= 0) return m.id; }
  return MOBIL[0].id;
}

/**
 * Bagi n kendaraan mengikuti rasio nyata (metode sisa terbesar).
 * Bus & truk diberi kuota minimum 1 bila n cukup, karena porsinya <1% tetapi
 * ikon kota (TransJakarta) dan truk tetap harus terlihat. Penyimpangan ini
 * dicatat di README dan panel PROFIL KOTA.
 */
export function bagiKendaraan(n) {
  const r = rasioKendaraan();
  const jenis = ['motor', 'mobil', 'truk', 'bus'];
  const exact = jenis.map((j) => n * r[j]);
  const out = {};
  jenis.forEach((j, i) => { out[j] = Math.floor(exact[i]); });
  let sisa = n - jenis.reduce((a, j) => a + out[j], 0);
  const order = jenis
    .map((j, i) => ({ j, frac: exact[i] - Math.floor(exact[i]) }))
    .sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < sisa; i++) out[order[i % jenis.length].j]++;

  const min = n >= 12 ? { bus: 1, truk: 1 } : { bus: 0, truk: 0 };
  for (const j of ['bus', 'truk']) {
    while (out[j] < min[j]) {
      const donor = out.motor > 0 ? 'motor' : (out.mobil > 0 ? 'mobil' : null);
      if (!donor) break;
      out[donor]--; out[j]++;
    }
  }
  return out;
}

/** Daftar id GLB untuk n kendaraan, sudah diacak. */
export function rencanaLaluLintas(n, rand = Math.random) {
  const b = bagiKendaraan(n);
  const ids = [];
  for (let i = 0; i < b.motor; i++) ids.push('motor_1');
  for (let i = 0; i < b.mobil; i++) ids.push(pilihMobil(rand));
  for (let i = 0; i < b.truk; i++) ids.push('truk_1');
  for (let i = 0; i < b.bus; i++) ids.push('bus_transjakarta');
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

/* ------------------------------------------------------------------ format & teks */

export const angka = (n) => n.toLocaleString('id-ID');
export const persen = (x, d = 1) => (x * 100).toFixed(d).replace('.', ',') + '%';
/** km² dengan pemisah ribuan/desimal Indonesia, mis. 6977.5 -> "6.977,5". */
export const km2 = (x) => x.toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' km&sup2;';

/** Kepadatan penduduk di daratan (jiwa/km²) - turunan, bukan angka tabel. */
export const kepadatan = () => KOTA.penduduk / KOTA.luasDarat;

/** Selisih antara luas total resmi dan (darat + laut). */
export const selisihLuas = () => KOTA.luasTotal - (KOTA.luasDarat + KOTA.luasLaut);

/** Porsi daratan Jakarta yang benar-benar dibangun jadi peta game (0..1). */
export const porsiPeta = () => (DUNIA.sisi * DUNIA.sisi) / 1e6 / KOTA.luasDarat;

/** Isi layar PROFIL KOTA (HTML). Angka mentah ditampilkan apa adanya. */
export function profilKotaHtml() {
  const r = rasioKendaraan();
  const k = KOTA.kendaraan;
  const luas = (DUNIA.sisi * DUNIA.sisi) / 1e6;
  const umurJumlah = KOTA.umur.reduce((a, u) => a + u.jumlah, 0);
  const baris = (kiri, kanan, sub) =>
    `<div class="pk${sub ? ' sub' : ''}"><span>${kiri}</span><b>${kanan}</b></div>`;

  return `
<div class="pkh">PENDUDUK</div>
${baris('Total', angka(KOTA.penduduk))}
${baris('Laki-laki', angka(KOTA.pendudukLaki), 1)}
${baris('Perempuan', angka(KOTA.pendudukPerempuan), 1)}
${KOTA.umur.map((u) => baris(u.label, angka(u.jumlah), 1)).join('')}
${baris('Jumlah kelompok umur', angka(umurJumlah), 1)}

<div class="pkh">LUAS WILAYAH</div>
${baris('Daratan', km2(KOTA.luasDarat))}
${baris('Laut', km2(KOTA.luasLaut), 1)}
${baris('Total (darat + laut)', km2(KOTA.luasTotal), 1)}
${baris('Kepadatan di daratan', '&plusmn;' + angka(Math.round(kepadatan())) + ' jiwa/km&sup2;', 1)}

<div class="pkh">KENDARAAN BERMOTOR</div>
${baris('Total', angka(k.total))}
${baris('Sepeda motor', angka(k.motor) + ' &middot; ' + persen(r.motor), 1)}
${baris('Mobil penumpang', angka(k.mobil) + ' &middot; ' + persen(r.mobil), 1)}
${baris('Truk', angka(k.truk) + ' &middot; ' + persen(r.truk), 1)}
${baris('Bus', angka(k.bus) + ' &middot; ' + persen(r.bus), 1)}

<div class="pkh">HUNIAN</div>
${baris('Rumah milik sendiri', persen(KOTA.rumahMilik) + ' rumah tangga')}
${baris('Apartemen', '&plusmn;' + angka(KOTA.apartemen) + ' unit')}
${baris('Gedung', '&plusmn;' + angka(KOTA.gedungDiperiksa) + ' (sampel audit)')}

<div class="pkh">DUNIA GAME</div>
${baris('Luas peta', DUNIA.sisi + '&times;' + DUNIA.sisi + ' m &asymp; ' + luas.toFixed(2).replace('.', ',') + ' km&sup2;')}
${baris('Porsi daratan Jakarta', '&asymp; ' + persen(porsiPeta(), 2), 1)}
${baris('Blok', DUNIA.blok + '&times;' + DUNIA.blok + ' &middot; ' + DUNIA.bangunan + ' bangunan', 1)}
${baris('Lalu lintas', 'mengikuti rasio di atas', 1)}
${baris('Jendela menyala malam', persen(KOTA.rumahMilik), 1)}

<div class="pkn">Catatan: jumlah kelompok umur (${angka(umurJumlah)}) berbeda ${angka(umurJumlah - KOTA.penduduk)} dari total penduduk karena berasal dari sumber berbeda &mdash; ditampilkan apa adanya. Luas darat + laut (${km2(KOTA.luasDarat + KOTA.luasLaut)}) tidak sama dengan luas total resmi (${km2(KOTA.luasTotal)}), selisih ${km2(selisihLuas())}; angka resmi dipakai untuk total. Angka ${angka(KOTA.gedungDiperiksa)} gedung adalah jumlah yang diperiksa dalam audit, bukan total gedung Jakarta. Peta game hanya ${luas.toFixed(2).replace('.', ',')} km&sup2; (${persen(porsiPeta(), 2)} daratan Jakarta), jadi kepadatan penduduk asli tidak diterapkan ke dunia game. Porsi bus &amp; truk di lalu lintas game dinaikkan ke minimal 1 unit agar ikon kota tetap muncul.</div>`;
}
