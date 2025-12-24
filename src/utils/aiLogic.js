import { GoogleGenerativeAI } from "@google/generative-ai";

// ⚠️ PASTIKAN API KEY TETAP AMAN (Gunakan Key yang sudah valid)
const API_KEY = "AIzaSyBcpX9sRJh50dO1TykYCZ3y5ACH6xkkzHs"; 

const genAI = new GoogleGenerativeAI(API_KEY);

// --- FUNGSI PROSES SUARA (VOICE V3 - SMART GROUPING) ---
export const processVoiceInput = async (text) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
    
    const prompt = `
      Kamu adalah akuntan cerdas. Tugasmu mengubah ucapan user menjadi data transaksi JSON.
      
      Input User: "${text}"

      ATURAN PENTING (LOGIKA PENGELOMPOKAN):
      1. Jika user menyebutkan SATU Lokasi/Sumber (misal: "Belanja di Indomaret" atau "Pendapatan Toko Kelontong"), lalu diikuti daftar barang/item --> GABUNGKAN jadi 1 Transaksi dengan banyak 'items'. JANGAN DIPISAH!
      2. Jika user menyebutkan DUA kejadian beda tempat/waktu (misal: "Beli bensin, TERUS makan siang") --> PISAHKAN jadi 2 Transaksi berbeda.
      
      Format Output JSON (Array of Objects):
      [
        {
          "merchant": "Nama Toko/Sumber (Contoh: Toko Kelontong, Indomaret, Gaji)",
          "total_amount": 0, // Total dari semua item (hitung sendiri jika user tidak sebut total)
          "category": "Kategori (Makan, Belanja, Usaha, Transport, dll)",
          "type": "expense" atau "income",
          "items": [
             { "name": "Nama Barang 1", "price": 10000 },
             { "name": "Nama Barang 2", "price": 5000 }
          ]
        }
      ]

      Contoh Kasus:
      - Input: "Pendapatan warung jual kopi 5rb sama gorengan 2rb"
      - Output: 1 Transaksi (Merchant: Warung, Total: 7000, Items: [{Kopi, 5000}, {Gorengan, 2000}])

      - Input: "Beli bensin 10rb terus beli rokok 20rb"
      - Output: 2 Transaksi terpisah (karena tidak ada konteks satu toko yang jelas, kecuali dibilang 'di warkop beli bensin dan rokok').

      Hasilkan HANYA JSON Array valid tanpa format markdown.
    `;

    const result = await model.generateContent(prompt);
    const textResult = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
    
    const parsed = JSON.parse(textResult);
    return Array.isArray(parsed) ? parsed : [parsed];

  } catch (error) {
    console.error("Error AI Voice:", error);
    throw new Error("Gagal memproses suara.");
  }
};

// --- FUNGSI VISION (Tetap sama, tidak perlu diubah) ---
export const processImageInput = async (fileBase64, mimeType) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    const prompt = `
      Analisa gambar struk/nota ini.
      Ekstrak data: merchant, amount (total), category, type (expense/income), dan items (name, price).
      Output HANYA JSON valid.
    `;

    const imagePart = {
      inlineData: { data: fileBase64, mimeType: mimeType },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const textResult = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
    
    return JSON.parse(textResult);
  } catch (error) {
    console.error("Error AI Vision:", error);
    throw new Error("Gagal deteksi detail barang.");
  }
};

// --- FUNGSI ADVISOR KEUANGAN (NEW) ---
export const generateFinancialInsights = async (transactions) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    // Ringkas data dulu biar prompt gak kepanjangan
    const summary = transactions.map(t => 
      `${t.date}: ${t.merchant || 'Umum'} (${t.category}) = ${t.type} Rp${t.total_amount}`
    ).join('\n');

    const prompt = `
      Bertindaklah sebagai Konsultan Keuangan Pribadi yang cerdas, santai, dan to the point.
      Analisa data transaksi user berikut ini:
      
      ${summary}

      Tugasmu:
      Berikan 3 (TIGA) Insight atau Saran Pendek yang sangat spesifik berdasarkan data di atas.
      
      Gaya Bahasa:
      - Poin 1: Komentar soal kategori pengeluaran terbesar (Warning/Pujian).
      - Poin 2: Analisa cash flow (Pemasukan vs Pengeluaran).
      - Poin 3: Saran aksi nyata untuk minggu depan.
      - Gunakan Bahasa Indonesia gaul tapi sopan.
      - Panggil user dengan sebutan "Juragan".

      Output HANYA JSON Array of Strings. Contoh:
      [
        "Waduh Juragan, jajan kopinya dikurangin dikit ya, udah abis 500rb tuh!",
        "Cash flow aman, pemasukan bisnis lebih gede dari pengeluaran. Pertahankan!",
        "Minggu depan coba bawa bekal aja biar hemat transport."
      ]
    `;

    const result = await model.generateContent(prompt);
    const textResult = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
    
    return JSON.parse(textResult);

  } catch (error) {
    console.error("Error AI Insight:", error);
    // Fallback kalau AI error/limit
    return [
      "Data keuanganmu sudah tercatat rapi.",
      "Cek grafik analisa untuk detail lebih lengkap.",
      "Tetap semangat mengatur keuangan, Juragan!"
    ];
  }
};