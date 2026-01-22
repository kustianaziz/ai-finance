import Groq from "groq-sdk";

// API Key Groq dari .env
const API_KEY = import.meta.env.VITE_GROQ_API_KEY; 
// Inisialisasi Groq Client
const groq = new Groq({ apiKey: API_KEY, dangerouslyAllowBrowser: true });

// Gunakan model Llama 3 70B yang sangat cerdas untuk instruksi kompleks
const MODEL_NAME = "meta-llama/llama-4-scout-17b-16e-instruct"; 

// Helper untuk menyusun list kategori di Prompt
const buildCategoryPrompt = (userCategories = []) => {
    // List Baku (Expense + Income)
    const defaultCats = [
        // Pengeluaran
        'Makanan', 'Transport', 'Belanja', 'Tagihan', 'Hiburan', 'Kesehatan', 'Lainnya',
        // Pemasukan (NEW)
        'Gaji', 'Bonus', 'Hadiah', 'Penjualan', 'Investasi','Saldo Awal'
    ];
    
    const allCats = [...new Set([...defaultCats, ...userCategories])];
    return allCats.join(", ");
};

// Helper Format Rupiah
const formatIDR = (num) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
};

// --- FUNGSI 1: VOICE & TEXT (UPDATED FOR MULTI-TRANSACTION & WALLETS) ---
export const processVoiceInput = async (text, userCategories = []) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const categoryListString = buildCategoryPrompt(userCategories);

    const prompt = `
    Role: Cerdas Expense Tracker Parser (Bahasa Indonesia).
    Current Date: ${today} (YYYY-MM-DD).
    Input Text: "${text}"
    
    ALLOWED CATEGORIES: [${categoryListString}, Mutasi Saldo]
    
    Task: Analisa teks input dan ekstrak menjadi daftar transaksi dalam format JSON.

    SPECIAL RULE FOR NEW ACCOUNTS/OPENING BALANCE:
    - Jika user menyebut "saldo awal", "buka rekening", "punya rekening baru", "dompet baru", "Kas Baru", "Tabungan Baru":
      - Type: 'income'
      - Category: 'Saldo Awal'
      - source_wallet: [Nama Bank/Dompet Baru] (Contoh: "BJB", "BCA", "Dompet Saku", "BNI", "BSI")
      - merchant: "Saldo Awal"

    Rules for Extraction:
    1. **Split Transactions**: Input mungkin berisi beberapa transaksi sekaligus (dipisah kata "dan", "lalu", "kemudian", ","). Pecah menjadi item terpisah.
    2. **Detect Type**:
       - 'expense': Pembelian, bayar, beli, jajan, bayar gaji, ngasih.
       - 'income': Terima, dapat, gajian, masuk, keuntungan, laba, di kasih.
       - 'transfer': Kirim, pindah, transfer, topup, mutasi.
    3. **Detect Wallets**:
       - 'source_wallet': Sumber dana (contoh: "pakai Gopay", "dari BCA", bayar QRIS). Jika tidak disebut, isi null.
       - 'destination_wallet': Tujuan dana (HANYA untuk 'transfer', contoh: "ke Mandiri"). Jika tidak ada, isi null.
    4. **Category**: Pilih dari ALLOWED CATEGORIES. Jika type='transfer', kategori WAJIB 'Mutasi Saldo'.
    5. **Date**: Konversi kata waktu (kemarin, lusa) ke format YYYY-MM-DD. Default hari ini.
    
    Output Schema (JSON Array):
    [
      {
        "merchant": string (Nama barang/toko/keterangan),
        "total_amount": number (Hanya angka),
        "date": string (YYYY-MM-DD),
        "category": string,
        "type": "expense" | "income" | "transfer",
        "source_wallet": string | null,
        "destination_wallet": string | null
      }
    ]
    `;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: MODEL_NAME,
      temperature: 0, // Wajib 0 agar output konsisten & patuh
      response_format: { type: "json_object" }
    });

    const resultText = chatCompletion.choices[0]?.message?.content || "[]";
    // Bersihkan markdown block jika ada
    const cleanJson = resultText.replace(/```json|```/g, '').trim();
    
    const parsed = JSON.parse(cleanJson);
    
    // Normalisasi Output: Pastikan selalu me-return Array
    // Kadang LLM membungkus dalam object { "transactions": [...] } atau { "data": [...] }
    if (Array.isArray(parsed)) return parsed;
    if (parsed.transactions && Array.isArray(parsed.transactions)) return parsed.transactions;
    if (parsed.data && Array.isArray(parsed.data)) return parsed.data;
    
    // Fallback jika me-return single object
    return [parsed];

  } catch (error) {
    console.error("Groq Text Error:", error);
    // Fallback Manual Basic jika AI Error (Safety Net)
    return [{
        merchant: text,
        total_amount: 0,
        type: 'expense',
        category: 'Lainnya',
        source_wallet: null,
        destination_wallet: null,
        date: new Date().toISOString().split('T')[0]
    }];
  }
};

// --- FUNGSI 2: SCAN GAMBAR (UPDATED PROMPT FOR WALLETS) ---
export const processImageInput = async (fileBase64, mimeType, userCategories = []) => {
  try {
    const categoryListString = buildCategoryPrompt(userCategories);

    const prompt = `
    Analyze this receipt or transfer proof image strictly.
    Return a JSON Object with this schema:
    {
      "merchant": "Store Name or Receiver Name",
      "date": "YYYY-MM-DD", 
      "amount": Total Amount (number),
      "category": "CategoryString", 
      "type": "expense" or "transfer",
      "source_wallet": "Bank/Wallet used to pay (e.g. BCA, Gopay)",
      "destination_wallet": "Target bank/wallet for transfer (only if it's a transfer proof)",
      "items": [{ "name": "item", "price": 0 }]
    }
    
    ALLOWED CATEGORIES: [${categoryListString}, Mutasi Saldo]

    Rules:
    1. If it's a transfer proof: set type to "transfer", merchant to receiver name, and fill "destination_wallet".
    2. If it's a shop receipt: set type to "expense", merchant to shop name, and fill "source_wallet".
    3. If date is missing, use today's date.
    4. Pick the closest category. For transfer, use "Mutasi Saldo" as initial guess.
    5. Return ONLY valid JSON.
    `;
    
    const imageUrl = `data:${mimeType};base64,${fileBase64}`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      model: MODEL_NAME,
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    const resultText = chatCompletion.choices[0]?.message?.content || "{}";
    const cleanJson = resultText.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanJson);

  } catch (error) {
    console.error("Groq Vision Error:", error);
    throw new Error("Gagal analisa gambar.");
  }
};

// --- FUNGSI 3: GENERATE INSIGHT (TETAP SAMA - SUDAH OKE) ---
export const generateFinancialInsights = async (transactions) => {
    if (!transactions || transactions.length === 0) {
        return ["Data transaksi masih kosong. Yuk mulai catat pengeluaranmu hari ini! 📝"];
    }

    try {
        const summaryData = transactions.map(t => 
            `- ${t.date.split('T')[0]}: ${t.type === 'income' ? '+' : '-'} ${formatIDR(t.total_amount)} (${t.category} @ ${t.merchant})`
        ).join("\n");

        let income = 0, expense = 0;
        transactions.forEach(t => t.type === 'income' ? income += Number(t.total_amount) : expense += Number(t.total_amount));
        const balance = income - expense;

        const prompt = `
        Role: Kamu adalah asisten keuangan pribadi bernama "Rapikus AI".
        Tone: Santai, suportif, bahasa Indonesia gaul tapi sopan, kadang pakai emoji.
        Context:
        - Total Pemasukan: ${formatIDR(income)}
        - Total Pengeluaran: ${formatIDR(expense)}
        - Sisa Saldo: ${formatIDR(balance)}
        
        Data Transaksi Terakhir:
        ${summaryData}

        Tugas:
        Analisa pola keuangan user dari data di atas. Jangan cuma baca angka, tapi cari Insight/Pola tersembunyi.
        Berikan respon dalam format JSON Array of Strings.
        
        Aturan Insight:
        1. Buat 2 sampai 3 kalimat insight pendek.
        2. Jangan kaku. Jangan cuma bilang "Saldo kamu sekian".
        3. Jika boros di kategori tertentu, tegor halus & kasih saran.
        4. Jika saldo minus, kasih warning.
        5. Sebutkan nama merchant jika mencolok.

        Contoh Output JSON:
        ["Waduh, jajan kopi kamu minggu ini udah setara cicilan motor lho ☕", "Saldo aman, tapi hati-hati pengeluaran transport mulai bengkak 🚗"]
        `;

        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama3-70b-8192", // Gunakan model text yang kuat
            temperature: 0.7,
            response_format: { type: "json_object" }
        });

        const resultText = chatCompletion.choices[0]?.message?.content;
        const cleanJson = resultText.replace(/```json|```/g, '').trim();
        
        const parsed = JSON.parse(cleanJson);
        
        if (Array.isArray(parsed)) return parsed;
        return Object.values(parsed).find(v => Array.isArray(v)) || ["Keuanganmu aman, terus pantau ya! 👍"];

    } catch (error) {
        console.error("Groq Insight Error:", error);
        return getFallbackInsights(transactions);
    }
};

const getFallbackInsights = (transactions) => {
    let income = 0, expense = 0;
    transactions.forEach(t => t.type === 'income' ? income += Number(t.total_amount) : expense += Number(t.total_amount));
    const balance = income - expense;

    if (balance < 0) return ["Waduh, pengeluaran lebih besar dari pemasukan nih! 🚨 Cek lagi pos pengeluaranmu."];
    if (expense > income * 0.8) return ["Hati-hati, sisa saldomu menipis. Rem dulu jajannya ya! 🛡️"];
    return ["Keuanganmu tercatat rapi. Terus pertahankan ya! 🌟"];
};