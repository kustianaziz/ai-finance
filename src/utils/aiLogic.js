import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY; 
const genAI = new GoogleGenerativeAI(API_KEY);

// ABANG REQUEST TETAP PAKAI INI
const MODEL_NAME = "gemini-2.5-flash"; 

// --- FUNGSI VOICE ---
export const processVoiceInput = async (text) => {
  try {
    const model = genAI.getGenerativeModel({ 
        model: MODEL_NAME,
        // OPTIMASI: Paksa output JSON langsung (Lebih Cepat & Stabil)
        generationConfig: { responseMimeType: "application/json" }
    });
    
    const prompt = `
    You are an expense tracker parser.
    Input: "${text}"
    Rule: Group items by location/merchant.
    Output Schema: Array of objects [{ "merchant": string, "total_amount": number, "category": string, "type": "expense"|"income", "items": [{"name": string, "price": number}] }]
    `;

    const result = await model.generateContent(prompt);
    // Karena sudah mode JSON, kita tidak perlu replace regex yang ribet
    return JSON.parse(result.response.text());

  } catch (error) {
    console.error("Voice Error:", error);
    throw new Error("Gagal proses suara.");
  }
};

// --- FUNGSI VISION (SCAN) ---
export const processImageInput = async (fileBase64, mimeType) => {
  try {
    const model = genAI.getGenerativeModel({ 
        model: MODEL_NAME,
        generationConfig: { 
            responseMimeType: "application/json",
            temperature: 0.2 
        }
    });

    // PROMPT LEBIH RINGAN & CEPAT
    // Kita HAPUS instruksi nebak allocation_type
    const prompt = `
    Analyze receipt image. Extract data strictly into this JSON structure:
    {
      "merchant": "Store Name",
      "amount": Total Amount (number),
      "category": "Food/Transport/Shopping/etc (Indonesian)",
      "type": "expense" or "income",
      "items": [
        { "name": "Item Name", "price": Item Price (number) }
      ]
    }
    `;
    
    const imagePart = { inlineData: { data: fileBase64, mimeType: mimeType } };
    const result = await model.generateContent([prompt, imagePart]);
    return JSON.parse(result.response.text());

  } catch (error) {
    // ... error handling sama
    console.error("Vision Error:", error);
    throw new Error("Gagal analisa gambar.");
  }
};

// Fungsi utama untuk generate insight
export const generateFinancialInsights = async (transactions) => {
    // Simulasi delay biar berasa mikir
    await new Promise(resolve => setTimeout(resolve, 1500));

    if (!transactions || transactions.length === 0) {
        return ["Data transaksi masih kosong. Yuk mulai catat pengeluaranmu hari ini! 📝"];
    }

    // 1. Hitung Data Dasar
    let income = 0;
    let expense = 0;
    const categoryTotals = {};

    transactions.forEach(t => {
        const amount = Number(t.total_amount);
        if (t.type === 'income') {
            income += amount;
        } else {
            expense += amount;
            // Grouping pengeluaran per kategori
            if (!categoryTotals[t.category]) categoryTotals[t.category] = 0;
            categoryTotals[t.category] += amount;
        }
    });

    const balance = income - expense;
    const insights = [];

    // --- LOGIC CERDAS (AI RULES) ---

    // A. KONDISI SALDO MINUS (Critical)
    if (balance < 0) {
        // Insight 1: Diagnosa Teknis (Lupa Catat)
        insights.push(`Waduh, saldo tercatat minus ${formatIDR(Math.abs(balance))}. 🤔 Coba cek lagi, apakah ada Pemasukan yang lupa dicatat? Kalau ada, yuk input dulu biar datanya akurat.`);
        
        // Insight 2: Solusi Keuangan (Realita)
        insights.push(`Tapi kalau datanya sudah benar, artinya pengeluaran bulan ini lebih besar dari pemasukan. 🚨 Yuk rem dulu pengeluaran yang sifatnya keinginan, fokus ke kebutuhan pokok aja.`);
    } 
    // B. KONDISI SALDO TIPIS (< 10% Pemasukan)
    else if (balance > 0 && balance < (income * 0.1)) {
        insights.push(`Hati-hati, sisa saldomu tinggal sedikit (${formatIDR(balance)}). Usahakan jangan belanja impulsif dulu sampai gajian berikutnya ya! 🛡️`);
    }
    // C. KONDISI SEHAT
    else if (balance > (income * 0.3)) {
        insights.push(`Keren! Cashflow kamu sehat banget (Surplus > 30%). 🌟 Pertimbangkan untuk alokasikan kelebihan dana ini ke Tabungan atau Investasi.`);
    }

    // D. ANALISA KATEGORI TERBOROS (Top Spender)
    if (expense > 0) {
        // Cari kategori dengan pengeluaran terbesar
        const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
        const topCategory = sortedCategories[0]; // [NamaKategori, Jumlah]

        if (topCategory) {
            const catName = topCategory[0];
            const catAmount = topCategory[1];
            const percent = Math.round((catAmount / expense) * 100);

            // Variasi pesan berdasarkan kategori
            if (['makanan', 'jajan', 'kopi'].includes(catName.toLowerCase())) {
                insights.push(`Tercatat ${percent}% pengeluaranmu habis buat ${catName} (${formatIDR(catAmount)}). 🍔 Mungkin bisa dikurangi dikit frekuensi jajan di luar? Masak sendiri lebih hemat lho.`);
            } else if (['transport', 'bensin'].includes(catName.toLowerCase())) {
                insights.push(`Biaya ${catName} lumayan tinggi nih (${formatIDR(catAmount)}). Coba cek rute atau pertimbangkan opsi transportasi yang lebih efisien.`);
            } else {
                insights.push(`Pengeluaran terbesarmu bulan ini ada di kategori '${catName}' sebesar ${formatIDR(catAmount)}. Pastikan ini memang kebutuhan prioritas ya. 🧐`);
            }
        }
    }

    // E. ANALISA FREKUENSI TRANSAKSI
    if (transactions.length > 10) {
        const expenseCount = transactions.filter(t => t.type === 'expense').length;
        if (expenseCount > 8) {
            insights.push(`Wah, aktif banget! Ada ${expenseCount} kali transaksi keluar baru-baru ini. Rajin mencatat itu awal yang baik buat atur keuangan. Pertahankan! 💪`);
        }
    }

    return insights;
};

// Helper Format Rupiah
const formatIDR = (num) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
};