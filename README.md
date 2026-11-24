# Battery Swapping Station Simulation

Simulasi per menit selama 24 jam untuk armada truk listrik (EV) yang mengganti baterai di swapping station. Hasilnya menunjukkan antrean, waktu tunggu, pemakaian charger, dan berapa station yang dibutuhkan.

Halaman ini memakai HTML, CSS, dan JavaScript biasa, jadi tidak perlu server, build, atau instalasi library.

> Hasil simulasi adalah **perkiraan untuk perencanaan**, bukan data operasional. Lihat bagian [Asumsi dan batasan](#8-asumsi-dan-batasan-model).

---

## Daftar isi
1. [Struktur file](#1-struktur-file)
2. [Menjalankan dan deploy](#2-menjalankan-dan-deploy)
3. [Input dan nilai default](#3-input-dan-nilai-default)
4. [Perhitungan sebelum simulasi](#4-perhitungan-sebelum-simulasi-appjs)
5. [Perhitungan dasar di simulasi](#5-perhitungan-dasar-di-simulasi-simjs)
6. [Jalannya simulasi per menit](#6-jalannya-simulasi-per-menit)
7. [Hasil: KPI, status, dan tampilan](#7-hasil-kpi-status-dan-tampilan)
8. [Asumsi dan batasan model](#8-asumsi-dan-batasan-model)
9. [Bagian kode yang sering diubah](#9-bagian-kode-yang-sering-diubah)

---

## 1. Struktur file

| File | Isi |
|---|---|
| `index.html` | Kerangka halaman: panel input, kartu, dan grafik |
| `style.css` | Tampilan dan warna |
| `app.js` | Membaca input, menghitung rute, PA, dan UA, lalu menggambar KPI, grafik, snapshot, dan tabel |
| `sim.js` | **Logika simulasi** (fungsi `simulate`) |
| `test.js` | Uji logika di terminal tanpa browser |

---

## 2. Menjalankan dan deploy

### Di laptop (VS Code)
1. Buka folder ini lewat **File > Open Folder**.
2. Pasang ekstensi **Live Server** (Ritwick Dey) dari tab Extensions.
3. Klik kanan `index.html`, lalu pilih **Open with Live Server**. Halaman akan refresh sendiri setiap kali file disimpan.

Tanpa ekstensi, cukup klik dua kali `index.html` di Finder.

### Uji logika di terminal (butuh Node.js)
```
node test.js
```

### Update ke GitHub dan Vercel
Repository: `github.com/nathaniazzr/swap-simulation`. Vercel otomatis memperbarui web setiap kali ada push.
```
git add -A
git commit -m "pesan perubahan"
git push
```

---

## 3. Input dan nilai default

Nilai default ada di objek `D` di bagian atas `app.js`.

| Input | Default | Bisa diubah di layar |
|---|---|---|
| Number of trucks | 37 | Ya |
| Physical availability / PA | 90% | Ya |
| Number of stations | 4 | Ya |
| Slots per station | 3 | Ya |
| Slot rule | All slots filled (semua slot dipakai) | Tidak, tetap di kode |
| Distance warehouse → hauling site | 9.5 km (sekali jalan, kode mengalikan 2) | Ya |
| Truck battery capacity | 320 kWh | Ya |
| Swap time | 5 menit | Ya |
| Charging time | 80 menit | Ya |
| Loaded speed | 19 km/h | Ya |
| Empty speed | 29 km/h | Ya |
| Energy consumption | 3.0142 kWh/km (dari data: 57.27 kWh per PP 19 km) | Ya |
| Usage of availability (breaks) | Kosong | Ya |
| SOC minimum | 10% | Tidak, tetap di kode |
| Variasi waktu tempuh (jitter) | ±15% | Tidak |
| Kondisi awal SOC | Bertahap | Tidak |
| Strategi masuk station | Standar | Tidak |
| Lama simulasi | 24 jam (1.440 menit) | Tidak |
| Seed acak | 7 | Tidak |

---

## 4. Perhitungan sebelum simulasi (`app.js`)

### 4.1 Physical availability (PA), per truk
PA berlaku **per truk**, bukan mengurangi jumlah truk. Semua 37 truk tetap jalan, tapi setiap truk hanya tersedia PA% dari waktunya. Ini asumsi jaga-jaga, karena truk tidak mungkin jalan 100% terus.
```
Downtime per truk = (1 − PA) × 1.440 menit
                  = 10% × 1.440 = 144 menit per truk per hari
```
- Jadwal downtime **digilir**: truk ke-i mulai di menit i × (1.440 − 144) ÷ 37, supaya truk tidak maintenance bersamaan.
- Saat waktunya tiba, truk menyelesaikan PP atau swap dulu, lalu berhenti penuh selama 144 menit (status **Maintenance**).
- PP ideal ikut dikurangi: truk × (menit kerja − 144) ÷ (waktu PP + waktu swap ÷ PP per swap).
- Kode: `downAt` dan `downLeft` di `sim.js` (status truk `5`).

### 4.2 Waktu satu PP (round trip)
Swapping station berada di gudang. Truk berangkat **kosong** dari gudang ke tempat hauling, lalu pulang **bermuatan** ke gudang.
```
Waktu PP = (jarak ÷ empty speed + jarak ÷ loaded speed) × 60
         = (9.5 ÷ 29 + 9.5 ÷ 19) × 60
         = 19.7 + 30.0 = 49.7 menit (0.83 jam)
```
Yang diketik di kolom Distance adalah jarak **sekali jalan**; kode yang mengalikan 2. Jarak harus **dibagi** kecepatan (km ÷ km/jam = jam), bukan dikali.

### 4.3 Average speed
```
Average speed = (2 × jarak) ÷ waktu PP
              = 19 km ÷ 0.83 jam = 22.9 km/h
```
Nilainya bukan (19 + 29) ÷ 2 = 24 km/h, karena truk menghabiskan lebih banyak waktu di perjalanan yang lambat.

### 4.4 Energi per PP
```
Energi per PP = 2 × jarak × konsumsi
              = 19 × 3.0142 = 57.27 kWh
```
Fungsi untuk 4.2 sampai 4.4: `route`.

---

## 5. Perhitungan dasar di simulasi (`sim.js`)

### 5.1 SOC terpakai per PP
```
SOC per PP = energi per PP ÷ kapasitas baterai × 100
           = 57.27 ÷ 320 × 100 = 17.9%
```

### 5.2 Jumlah PP sebelum swap
```
PP per swap = (100% − SOC minimum) ÷ SOC per PP, dibulatkan ke bawah
            = (100 − 10) ÷ 17.9 = 5.03 → 5 PP
```

### 5.3 Slot yang dipakai
Semua slot dipakai, jadi jumlah baterai per station = slots per station (default 3).

### 5.4 Jam istirahat (Usage of availability / UA)
Setiap break berisi **Input hours** (boleh desimal, misalnya 2.52) dan **jam mulai** (digeser per 1 jam di garis 00–24). Setiap menit dalam sehari ditandai **kerja** atau **istirahat**:
```
Contoh: 2.52 jam mulai 12:00 → 151 menit → 12:00–14:31 ditandai istirahat
```
- Blok yang melewati 24:00 berlanjut ke 00:00.
- Jam yang tumpang tindih hanya dihitung sekali.
- Kode: array `work` di `sim.js`.

### 5.5 SOC awal truk (bertahap)
Supaya truk tidak swap bersamaan di awal hari, SOC awal dibuat berbeda:
```
SOC awal truk ke-i = 100 − (SOC per PP × PP per swap × 0.98 × i ÷ jumlah truk)
Truk pertama ≈ 100%, truk terakhir ≈ 15%
```

### 5.6 Kondisi awal station
Semua baterai di slot station **penuh** di awal hari.

---

## 6. Jalannya simulasi per menit

Simulasi berjalan dari menit 0 sampai 1.439. Setiap menit ada 3 langkah.

### Langkah 1: gerakkan setiap truk

| Status truk | Arti |
|---|---|
| Standby | Belum mulai, hanya di menit pertama |
| Hauling | Sedang menjalankan PP |
| Queued | Antre di station |
| Swap | Sedang ganti baterai |
| Break | Istirahat (UA) |

**Saat truk selesai satu PP:**
1. SOC dikurangi SOC per PP (17.9%).
2. Simulasi mengecek apakah SOC akan turun di bawah SOC minimum (10%) **kalau truk menjalankan satu PP lagi**.
   - **Ya** → truk antre swap. Ini tetap terjadi walaupun sedang jam istirahat.
   - **Tidak, tapi sedang jam istirahat** → truk berhenti (Break).
   - **Tidak** → truk lanjut PP berikutnya.

**Variasi waktu tempuh:** setiap PP diberi variasi acak ±15%, jadi satu PP bisa sekitar 42 sampai 57 menit. Angka acaknya selalu sama setiap kali dijalankan (seed 7), sehingga hasilnya konsisten.

**Memilih station:** truk memilih station dengan **perkiraan tunggu paling kecil**. Perkiraan ini dihitung dari panjang antrean, kapan baterai di slot penuh, dan kapan bay swap kosong.

**Setelah swap selesai:** SOC kembali 100%. Kalau sedang jam kerja, truk jalan lagi. Kalau sedang jam istirahat, truk berhenti.

**Saat istirahat:** truk yang sedang di jalan **menyelesaikan PP dulu** sampai kembali ke gudang, baru berhenti. Setelah istirahat selesai, **semua truk jalan lagi bersamaan**, sehingga bisa muncul lonjakan antrean beberapa waktu kemudian.

### Langkah 2: proses di setiap station
Swap dimulai kalau ketiga syarat ini terpenuhi:
1. Ada truk yang antre.
2. Bay swap kosong. Setiap station hanya punya **1 bay**.
3. Ada minimal 1 baterai penuh di slot.

Kalau terpenuhi:
- Truk paling depan di antrean dilayani duluan (FIFO).
- Diambil baterai yang paling lama sudah penuh.
- Baterai kosong dari truk masuk ke slot itu dan **charging selama waktu charging (80 menit)**.
- Bay sibuk selama waktu swap (5 menit).
- Waktu tunggu truk dicatat: **menit mulai swap − menit mulai antre**.

### Langkah 3: catat kondisi
Status dan SOC setiap truk, panjang antrean, baterai siap, dan baterai yang sedang charging dicatat setiap menit untuk grafik dan snapshot.

---

## 7. Hasil: KPI, status, dan tampilan

### 7.1 KPI

| KPI | Rumus |
|---|---|
| Swaps per day | Jumlah swap dalam 24 jam |
| Theoretical capacity | Station × slot × (1.440 ÷ waktu charging). Default: 4 × 3 × 18 = **216 swap/hari** |
| Average wait | Rata-rata waktu tunggu semua swap |
| Charger utilization | Menit slot charging ÷ (jumlah slot × 1.440) |
| Swap bay utilization | Menit bay sibuk ÷ (jumlah station × 1.440) |
| Fleet efficiency | PP tercapai ÷ PP ideal (maksimal 100%) |
| PP ideal | Truk × menit kerja ÷ (waktu PP + waktu swap ÷ PP per swap). Ini jumlah PP kalau truk tidak pernah menunggu |
| Peak queue | Jumlah truk antre terbanyak di satu waktu, semua station |
| Peak power | Jumlah slot charging terbanyak bersamaan × daya per charger |
| Daya per charger | Kapasitas ÷ (waktu charging ÷ 60). Default: 320 ÷ 1.33 = **240 kW** |
| Energy per day | Total kWh yang diisi ulang: jumlah dari (100% − SOC saat swap) × kapasitas |
| UA | Menit kerja ÷ 1.440 |
| Effective working time | Menit kerja ÷ 60 (jam per truk per hari) |

### 7.2 Status kelayakan
Fungsi `verdict` di `app.js`.

| Status | Syarat |
|---|---|
| Feasible | Average wait ≤ 5 menit |
| Marginal | Average wait ≤ 15 menit |
| Insufficient | Average wait > 15 menit |

**Station count comparison** menjalankan ulang simulasi untuk 1 sampai 8 station dengan input lain yang sama, lalu menilai masing-masing.

### 7.3 Tampilan lain
- **Est. wait (tabel station di snapshot):** perkiraan kasar. Kalau baterai siap lebih banyak dari antrean, perkiraannya antrean × waktu swap. Kalau tidak, (antrean − baterai siap + 1) × waktu charging ÷ slot + waktu swap.
- **Average wait by arrival hour:** rata-rata tunggu per jam kedatangan. Batang merah berarti nilainya ≥ 75% dari jam terburuk dan lebih dari 3 menit.
- **SOC merah di kotak truk:** SOC hampir di batas minimum, artinya truk akan swap setelah PP ini.
- **Arsiran abu-abu di grafik antrean:** jam istirahat (UA).

---

## 8. Asumsi dan batasan model

1. Swapping station berada di **gudang**, jadi truk swap di awal atau akhir PP.
2. Semua station di lokasi yang sama, tanpa jarak antar station.
3. Setiap station hanya punya **1 bay swap**.
4. Jumlah baterai di station **sama dengan jumlah slot**, tanpa baterai cadangan.
5. Waktu charging **tetap**, berapa pun sisa SOC baterainya.
6. **Waktu muat dan bongkar belum dihitung terpisah.** Waktu PP hanya berasal dari perjalanan.
7. Konsumsi energi **sama** saat kosong dan bermuatan (satu angka rata-rata kWh/km).
8. PA mengurangi **waktu tersedia tiap truk** (downtime digilir antar truk). UA mengurangi **jam kerja** dan berlaku untuk semua truk serentak.
9. Saat istirahat, truk menyelesaikan PP dulu, tidak berhenti di tengah jalan.
10. Tidak ada gangguan acak seperti kerusakan mendadak, cuaca, atau antrean di tempat hauling.
11. Simulasi hanya 24 jam dan dimulai dengan semua baterai station penuh.

---

## 9. Bagian kode yang sering diubah

| Yang ingin diubah | Lokasi |
|---|---|
| Nilai default input | Objek `D` di atas `app.js` |
| Rumus waktu PP, average speed, energi per PP | Fungsi `route` di `app.js` |
| Rumus PA (downtime per truk) | `downMin`, `downAt` di `sim.js` |
| Batas Feasible / Marginal / Insufficient | Fungsi `verdict` di `app.js` |
| Panel jam istirahat (UA) | Bagian "Usage of availability" di bawah `app.js` |
| Aturan simulasi per menit | Fungsi `simulate` di `sim.js` |
| Jam istirahat di simulasi | Array `work` di `sim.js` (status truk `4` = Break) |
| Warna | Variabel `:root` di `style.css` |
