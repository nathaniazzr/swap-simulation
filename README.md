# Simulasi Battery Swapping Station

Simulasi per menit (24 jam) untuk armada truk EV: antrean, jadwal slot, dan jumlah station.
Tidak perlu server atau instalasi library.

## Struktur file
| File | Isi |
|---|---|
| `index.html` | Kerangka halaman |
| `style.css` | Tampilan dan warna |
| `app.js` | Panel parameter, kartu KPI, grafik, tabel perbandingan station |
| `sim.js` | **Logika simulasi** (fungsi `simulate`) |
| `test.js` | Uji di terminal tanpa browser |

## Menjalankan di VS Code
1. Buka folder ini: File > Open Folder.
2. Pasang ekstensi **Live Server** (Ritwick Dey) dari tab Extensions.
3. Klik kanan `index.html` > **Open with Live Server**. Setiap kali file disimpan, halaman refresh sendiri.

Alternatif tanpa ekstensi: klik dua kali `index.html` di file explorer sistem.

## Uji logika di terminal (opsional, butuh Node.js)
```
node test.js
```
Hasil yang diharapkan (parameter bawaan): 1 station = 54 swap/hari, 2 = 108, 3 = 162, 4 = sekitar 200.

## Bagian yang sering diubah
- **Nilai awal parameter:** objek `D` di bagian atas `app.js`.
- **Jarak dan baterai:** kartu "Rute dan baterai". Jarak = station ke titik tujuan, sekali jalan. Waktu PP = 2 × jarak ÷ kecepatan, kWh per PP = 2 × jarak × konsumsi kWh/km (fungsi `route` di `app.js`). Kecepatan dan kWh/km ada di "Parameter teknis".
- **Tombol skenario cepat:** daftar `PRESETS` di `app.js`.
- **Batas Layak / Batas / Kurang:** fungsi `verdict` di `app.js`.
- **Aturan simulasi:** `sim.js`. Urutan per menit: gerakkan truk, mulai swap di station, catat kondisi.
- **Warna:** variabel `:root` di `style.css`.

## Batasan model
Semua station dianggap sama jaraknya, satu bay swap per station, antrean FIFO, tanpa gangguan atau shift.
Hasil adalah perkiraan perencanaan, bukan data operasional.
