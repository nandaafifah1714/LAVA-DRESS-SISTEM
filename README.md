# LAVÉ Dress Rental & Finance System

Frontend: HTML + CSS + JavaScript. Backend: Supabase PostgreSQL.

## Struktur
```text
frontend/
  index.html
  style.css
  app.js
backend/
  config.js   # Sumber konfigurasi browser yang disematkan saat deploy
database/
  schema.sql  # Skema awal, seed, fungsi, dan seluruh migrasi
README.md
```

## Setup
1. Buat project Supabase.
2. Untuk project Supabase baru, jalankan `database/schema.sql` satu kali dari awal hingga akhir. File tersebut menggabungkan skema awal dan migrasi secara berurutan.
   Jangan jalankan ulang seluruh file pada project yang sudah pernah dimigrasikan. Untuk project yang sudah berisi data, backup database terlebih dahulu. Jika migration 37 belum dijalankan, jalankan blok migration 37 lalu migration 38-42 secara berurutan. Jika migration 37 sudah selesai, jalankan blok migration 38-42 di bagian akhir. Project yang sudah menerapkan migration 38 perlu menjalankan blok migration 39-42; yang sudah menerapkan migration 39 perlu menjalankan 40-42; yang sudah menerapkan migration 40 perlu menjalankan 41-42; dan yang sudah menerapkan migration 41 cukup menjalankan migration 42. Jika eksekusi migration 39 sebelumnya berhenti dengan error signature fungsi, jalankan ulang blok migration 39 yang sudah diperbaiki sebelum melanjutkan. Migration 38 menambahkan snapshot kontak supplier pada transaksi pembelian dan tidak menghapus data supplier lama. Migration 39 menampilkan nomor pembelian, migration 40 menghitung preview dari pembelian tersimpan, migration 41 menambahkan RPC laba rugi dan arus kas, dan migration 42 menerapkan penomoran berbasis nomor tertinggi yang sudah tersimpan pada pelanggan, supplier, dress, rental, pembayaran, pembelian, biaya, pengembalian, denda, movement, dan modal. Nomor transaksi lama serta kode UNIT yang melekat pada barang fisik tidak diubah; membuka atau membatalkan form tidak menghabiskan nomor lagi.
3. Isi URL dan publishable/anon key di `backend/config.js`. Untuk penggunaan lokal, perbarui blok `BROWSER CONFIG` di `frontend/app.js`; workflow GitHub Pages menyematkan konfigurasi dari `backend/config.js` secara otomatis saat deploy.
4. Jalankan frontend dengan Live Server di VS Code dan buka `frontend/index.html`. Semua menu aplikasi dimuat dari satu HTML dan navigasi memakai parameter `?page=`.
5. Jangan pernah memasukkan service_role/secret key ke frontend.

## GitHub Pages
Workflow `.github/workflows/pages.yml` menerbitkan folder `frontend` setiap ada push ke branch `main`. Pada repository GitHub, buka **Settings > Pages** dan pilih **GitHub Actions** sebagai source. Setelah perubahan frontend dan workflow di-commit dan di-push, situs tersedia di URL Pages repository dan root situs langsung menuju dashboard tanpa halaman login. Repository harus public agar pengunjung dapat membuka kode/situs tanpa masuk ke GitHub; pengaturan visibility repository tidak bisa diubah dari file aplikasi.

Untuk koneksi data tanpa login, migration `36_public_access.sql` di dalam `database/schema.sql` harus dijalankan pada project Supabase yang URL-nya sedang dipakai di `backend/config.js`. Migration 37 setelahnya menghapus chart akun dan jurnal serta mengganti laporan dengan rekap langsung dari transaksi operasional. Tanpa migration 36, UI tetap terbuka tetapi request data akan ditolak.

Seluruh JavaScript frontend—konfigurasi, modul halaman, dan skrip halaman—dibundel dalam satu file `frontend/app.js`. HTML hanya memuat library Supabase dari CDN dan bundle tersebut.

**Peringatan keamanan:** Migration 36 menonaktifkan RLS dan memberi role `anon` akses baca/tulis serta eksekusi RPC pada seluruh schema `public`. Siapa pun yang mengetahui URL aplikasi dapat membaca, mengubah, atau menghapus data pelanggan dan transaksi. Gunakan hanya jika database memang sengaja dipublikasikan; jangan gunakan untuk data privat atau produksi.

## Catatan
- **Dress & Persediaan** menggabungkan master model dress dan ketersediaan unit pada satu halaman bertab. Master Dress mengelola model/kategori; tab Persediaan menampilkan stok per ukuran/warna, kondisi unit, dan riwayat movement.
- Dress dapat dinonaktifkan dari Master Dress tanpa menghapus riwayatnya, setelah semua unit tidak lagi disewa. Aksi nonaktifkan diblokir selama masih ada unit berstatus disewa.
- Data customer dikelola langsung saat membuat penyewaan; satu tombol **Hub WA** di daftar/detail rental membuka template pesan yang dapat dipilih dan diedit (pelunasan, pengembalian, konfirmasi DP, pengambilan, atau pesan lainnya) sebelum diteruskan ke WhatsApp. Riwayat rental menyediakan nota per transaksi DP dan pelunasan.
- Data supplier tidak lagi dikelola lewat menu terpisah; nama dan kontak dicatat sebagai snapshot pada setiap transaksi Pembelian dan dipakai pada daftar utang serta laporan. Data supplier lama tetap disimpan untuk menjaga riwayat.
- Pengeluaran usaha dicatat dari menu Pembayaran Usaha. Pembayaran utang pembelian juga tersedia di halaman yang sama, dengan daftar outstanding terdeteksi otomatis. Laporan Keuangan merangkum penyewaan, pembayaran, denda pengembalian, biaya, pembelian, piutang, utang, deposit, persediaan, dan setoran modal.
- Menu Daftar Akun, Buku Besar, dan Neraca Saldo dihapus. Migration 37 menghapus tabel akun/jurnal; laporan dan transaksi berikutnya tidak menggunakan pembukuan jurnal.
- Login Supabase Auth tidak digunakan; akses aplikasi memakai publishable/anon key dan database dibuka oleh migration 36.
- Migration 10 membuat settings, audit log, sequence configuration, movement otomatis, dan RLS.
- Migration 11 membuat profile `app_users` otomatis setelah login pertama, memperbaiki policy kategori, dan mencabut akses langsung ke PostgreSQL sequence.
- Migration 12 mengunci satu return per rental dan memproses return, denda keterlambatan, kerusakan, pembayaran denda, perubahan status dress, dan status rental dalam satu RPC database.
- Migration 13 menambahkan setoran modal pemilik sebagai transaksi ekuitas atomic (`MOD-0001`), jurnal kas/modal, view modal, dan klasifikasi arus kas pendanaan.
- Migration 14 mencatat `PURCHASE_IN` dari purchase detail dan melengkapi movement `RENTAL_CANCEL` saat rental dibatalkan.
- Migration 15 menambahkan reversal modal dan deferred journal-balance validation.
- Migration 16 membuat Purchase atomic melalui RPC sehingga Dress, Purchase, Detail, movement, dan journal rollback bersama jika salah satu langkah gagal.
- Migration 17 memperbaiki view canonical `v_capital_contributions`, memberikan grant read, dan memuat ulang schema cache PostgREST.
- Migration 18 membuat payment rental dan expense atomic dengan validasi outstanding balance dan posting journal dari database.
- Migration 19 menambahkan catatan supplier nullable tanpa mengubah relasi supplier existing.
- Migration 20 memindahkan posting modal ke RPC authenticated dengan `auth.uid()`, role validation, dan policy `created_by`.
- Migration 21 mengizinkan role operasional `staff` memakai RPC modal yang tetap tervalidasi, tanpa membuka insert langsung atau menonaktifkan RLS.
- Sebelum migration 23-25, backup database dan hentikan penulisan transaksi. Migration 23 membuat `dress_model_merge_map`; tinjau query audit di file tersebut dan masukkan hanya pasangan model duplikat yang sudah diverifikasi, dengan `source_dress_id` diarahkan ke `target_dress_id` canonical. Kesamaan nama saja bukan bukti model sama. Jangan hard-delete master sumber; migration 24 mengalihkan referensi transaksi/movement dan menandai master sumber nonaktif.
- Migration 24 mempertahankan stok yang sebelumnya terlihat: setiap baris `dresses` dihitung sebagai satu unit per ukuran/status lama. `purchase_details.quantity` historis tidak dijumlahkan karena alur lama tidak menggunakannya untuk menghitung stok; tinjau query audit migration 23 dan cocokkan stok fisik sebelum migration. Baris tanpa ukuran dimigrasikan ke `UNKNOWN` dan tidak dapat disewakan. Lakukan stocktake, lalu gunakan pembelian untuk memasukkan ukuran/stok yang sudah terverifikasi.
- Jalankan migration 24 dan 25 dalam satu jendela maintenance, kemudian deploy frontend. Migration 25 mengganti RPC pembelian/rental/return dan mengunci write langsung ke detail; jangan gunakan frontend lama setelah migration 25. Jurnal lama tidak dihapus/ditulis ulang, dan pembelian baru tetap memicu jurnal melalui trigger purchase yang sudah ada.
- Migration 26 membuat bucket publik `dress-photos` untuk menampilkan foto, dengan upload/delete terbatas ke folder user terautentikasi ber-role `admin`/`staff`; sesuaikan kebijakan bucket jika project membutuhkan foto privat.
- Migration 27 memperbaiki ambiguitas kolom `dress_id` pada RPC pembelian tanpa mengubah bentuk respons RPC.
- Migration 28 mencatat deposit baru sebagai liabilitas, menyiapkan saldo pembuka untuk deposit rental yang masih aktif, mengalokasikan deposit saat return, dan mengamankan RPC pembayaran. Deposit historis pada rental yang sudah selesai tidak ditebak atau ditulis ulang.
- Migration 29 menambahkan warna pada varian. Stok gabungan dari model beda warna yang sudah dikonsolidasikan migration 24 ditandai `UNVERIFIED`; cocokkan fisik lalu gunakan aksi Stocktake Warna sebelum varian tersebut disewakan.
- Migration 30 memisahkan jumlah tersedia, disewa, laundry, repair, tidak layak, dan belum terklasifikasi per varian, serta mencatat perubahan status dan rekonsiliasi sebagai movement.
- Migration 31 membuat `v_purchase_payables` hanya menampilkan saldo positif dan memindahkan pembayaran utang ke RPC atomik. Deploy frontend setelah migration 28-31 selesai.
- Migration 32 membuat `dress_units`, menjaga counter varian dan status legacy saat backfill, serta mengaitkan unit ke rental aktif yang dapat dipetakan. Kode `UNIT-########` adalah ID fisik internal; cocokkan/tempelkan label pada barang saat stocktake.
- Migration 33 membuat unit baru per qty pembelian, memilih dan mengunci satu unit `Available` saat rental, serta mencatat purchase/rental movement per unit.
- Migration 34 mengubah return, pembatalan, edit status, stocktake warna, dan view inventory agar memakai unit. Jalankan 32-35 dalam maintenance window dan deploy frontend hanya setelah semuanya sukses.
- Migration 35 membuat ulang `v_dress_inventory` tanpa alias CTE `counts`, agar query sample kolom `condition` tidak gagal dengan `missing FROM-clause entry for table "counts"`. Jika 34 sudah dijalankan, cukup jalankan 35.
- Unit legacy dibuat dari counter varian dengan kode internal `UNIT-########`; cocokkan kode dan tempel label pada unit fisik sebelum operasi stocktake. Rental aktif yang tidak bisa dipetakan atau counter yang tidak seimbang akan membatalkan migration 32.
- Daftar Akun, Buku Besar, Neraca Saldo, dan jurnal tidak digunakan. Laporan Keuangan merangkum langsung transaksi operasional seperti penyewaan, pembayaran, denda, biaya, pembelian, piutang, utang, persediaan, dan modal.
- Uji transaksi setelah seluruh migration aktif: Dress -> Purchase -> Rental -> Return -> Laporan Keuangan.
