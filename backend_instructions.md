# Instruksi Penyesuaian Backend (API)

Dokumen ini berisi panduan untuk penyesuaian respons dan logika pada Backend, sesuai dengan kebutuhan terbaru di Frontend (Flutter).

## 1. Pesan Notifikasi: Menampilkan Nama Artwork (Bukan ID)

**Masalah saat ini:** 
Saat user mendapatkan notifikasi (misal: ada bid baru atau lelang selesai), pesan di dalam notifikasi (`message`) mencantumkan **ID Artwork** (contoh: `fc2e1d...`), yang mana ini tidak UX-friendly bagi pengguna.

**Solusi yang dibutuhkan:**
Backend harus melakukan *query* / *join* ke tabel `artworks` terlebih dahulu untuk mendapatkan nama karyanya (`nama_karya`), lalu menyisipkan nama tersebut ke dalam teks notifikasi sebelum disimpan ke tabel `notifications`.

### Contoh Implementasi (Node.js / Express / Prisma)

**Sebelum diubah (Contoh kode salah):**
```javascript
// Saat membuat bid baru dan mengirim notifikasi outbid
const message = `Ada bid baru yang lebih tinggi pada artwork ${artworkId}.`;
await db.notification.create({
  data: {
    userId: previousBidderId,
    message: message, // Akan menghasilkan teks: "Ada bid baru pada artwork 1234abcd..."
    // ...
  }
});
```

**Setelah diubah (Contoh kode benar):**
```javascript
// 1. Ambil data artwork terlebih dahulu
const artwork = await db.artwork.findUnique({
  where: { id: artworkId }
});

const namaArtwork = artwork ? artwork.nama_karya : 'Karya Seni';

// 2. Masukkan nama artwork ke dalam message
const message = `Penawaran Anda untuk ${namaArtwork} telah dilewati (Outbid) oleh penawar lain.`;

await db.notification.create({
  data: {
    userId: previousBidderId,
    message: message, // Akan menghasilkan teks: "Penawaran Anda untuk Lukisan Pemandangan telah dilewati..."
    // ...
  }
});
```
*Catatan: Hal ini juga berlaku untuk tipe notifikasi lain seperti "Lelang Berakhir / Pemenang Lelang". Pastikan selalu menggunakan field `nama_karya` / `title` dari artwork.*

---

## 2. Penyesuaian Status Bid (Tertinggi & Outbid)

**Masalah saat ini:**
Di database, status bid secara *default* menggunakan tipe data ENUM/String dengan nilai `OPEN`, `CLOSED`, atau `FAILED`.

**Kondisi di Frontend:**
Frontend sebenarnya sudah bisa mengatasi logika secara mandiri untuk menampilkan tulisan **"Tertinggi"** (jika bid tersebut paling besar) dan **"Outbid"** (jika sudah ada bid lain yang lebih besar). Namun, alangkah lebih rapi jika data dari backend (API) juga diselaraskan agar lebih terstruktur.

**Solusi yang dibutuhkan (Opsional namun disarankan):**
Setiap ada user yang memasang bid baru, otomatis update status bid sebelumnya (milik orang lain) menjadi `OUTBID`, dan set bid yang paling baru ini menjadi `TERTINGGI` (atau `HIGHEST`).

### Contoh Logika (Pseudocode)

```javascript
// Saat User B melakukan penawaran (Bid)
async function placeBid(artworkId, userId, amount) {
  // 1. Ubah SEMUA status bid sebelumnya di artwork ini menjadi "OUTBID"
  await db.bid.updateMany({
    where: { 
       artworksId: artworkId,
       status: 'TERTINGGI' // atau status 'OPEN' yang lama
    },
    data: { status: 'OUTBID' }
  });

  // 2. Buat bid baru untuk User B dengan status "TERTINGGI"
  const newBid = await db.bid.create({
    data: {
      artworksId: artworkId,
      bidById: userId,
      amount: amount,
      status: 'TERTINGGI' 
    }
  });

  return newBid;
}
```

**Feedback di Endpoint GET `/bids/:artworkId`:**
Dengan cara di atas, saat frontend memanggil riwayat bid, status JSON-nya akan menjadi lebih rapi dan jelas (tidak lagi cuma `OPEN` semua), misal:
```json
[
  {
    "id": "bid_1",
    "amount": 500000,
    "status": "TERTINGGI"
  },
  {
    "id": "bid_2",
    "amount": 400000,
    "status": "OUTBID"
  }
]
```

---
