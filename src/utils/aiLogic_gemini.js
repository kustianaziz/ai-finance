import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY; 
const genAI = new GoogleGenerativeAI(API_KEY);

// ABANG REQUEST TETAP PAKAI INI
const MODEL_NAME = "gemini-2.5-flash"; 

// Helper untuk menyusun list kategori di Prompt
const buildCategoryPrompt = (userCategories = []) => {
    // List Baku
    const defaultCats = ['Makanan', 'Transport', 'Belanja', 'Tagihan', 'Hiburan', 'Kesehatan', 'Lainnya'];
    
    // Gabung dengan kategori user, hilangkan duplikat, dan join jadi string
    const allCats = [...new Set([...defaultCats, ...userCategories])];
    return allCats.join(", ");
};

/// --- FUNGSI VOICE & TEXT (UPDATE: TERIMA KATEGORI USER) ---
export const processVoiceInput = async (text, userCategories = []) => {
  try {
    const model = genAI.getGenerativeModel({ 
        model: MODEL_NAME,
        generationConfig: { responseMimeType: "application/json" }
    });
    
    const today = new Date().toISOString().split('T')[0];
    const categoryListString = buildCategoryPrompt(userCategories);

    const prompt = `
    Role: Expense Tracker Parser.
    Current Date: ${today} (YYYY-MM-DD).
    Input: "${text}"
    
    ALLOWED CATEGORIES: [${categoryListString}]
    
    Tasks:
    1. Extract transactions.
    2. Detect Date (handle "kemarin", "lusa", etc.).
    3. Categorize items using ONLY the "ALLOWED CATEGORIES" list above. Pick the most relevant one.
    
    Output Schema: 
    Array of objects [{ 
        "merchant": string, 
        "total_amount": number, 
        "date": string (YYYY-MM-DD),
        "category": string, 
        "type": "expense"|"income", 
        "items": [{"name": string, "price": number}] 
    }]
    `;

    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text());

  } catch (error) {
    console.error("Voice/Text Error:", error);
    throw new Error("Gagal proses input.");
  }
};

// --- FUNGSI VISION (UPDATE: TERIMA KATEGORI USER) ---
export const processImageInput = async (fileBase64, mimeType, userCategories = []) => {
  try {
    const model = genAI.getGenerativeModel({ 
        model: MODEL_NAME,
        generationConfig: { 
            responseMimeType: "application/json",
            temperature: 0.2 
        }
    });

    const categoryListString = buildCategoryPrompt(userCategories);

    const prompt = `
    Analyze receipt image. Extract data strictly into this JSON structure:
    {
      "merchant": "Store Name",
      "date": "YYYY-MM-DD", 
      "amount": Total Amount (number),
      "category": "CategoryString", 
      "type": "expense" or "income",
      "items": [
        { "name": "Item Name", "price": Item Price (number) }
      ]
    }
    
    ALLOWED CATEGORIES: [${categoryListString}]

    RULES:
    1. Look for the date. Convert to YYYY-MM-DD. If missing, return null.
    2. For "category", choose the BEST MATCH from the "ALLOWED CATEGORIES" list provided above.
    3. Do NOT create new categories outside that list.
    `;
    
    const imagePart = { inlineData: { data: fileBase64, mimeType: mimeType } };
    const result = await model.generateContent([prompt, imagePart]);
    return JSON.parse(result.response.text());

  } catch (error) {
    console.error("Vision Error:", error);
    throw new Error("Gagal analisa gambar.");
  }
};

// --- FUNGSI GENERATE INSIGHT (MAJOR UPGRADE: REAL AI) ---
export const generateFinancialInsights = async (transactions) => {
    // 1. Cek Data Kosong
    if (!transactions || transactions.length === 0) {
        return ["Data transaksi masih kosong. Yuk mulai catat pengeluaranmu hari ini! 📝"];
    }

    try {
        // 2. Siapkan Ringkasan Data untuk dikirim ke AI
        // Kita tidak kirim semua raw object biar hemat token, kita format jadi string ringkas.
        const summaryData = transactions.map(t => 
            `- ${t.date.split('T')[0]}: ${t.type === 'income' ? '+' : '-'} ${formatIDR(t.total_amount)} (${t.category} @ ${t.merchant})`
        ).join("\n");

        // Hitung total manual sekilas buat konteks prompt
        let income = 0, expense = 0;
        transactions.forEach(t => t.type === 'income' ? income += Number(t.total_amount) : expense += Number(t.total_amount));
        const balance = income - expense;

        const model = genAI.getGenerativeModel({ 
            model: MODEL_NAME,
            generationConfig: { 
                responseMimeType: "application/json" 
            }
        });

        // 3. Prompt Engineer yang Cerdas
        // Kita minta AI jadi "Konsultan Keuangan Pribadi yang Santai tapi Tajam"
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
        3. Jika boros di kategori tertentu (misal sering jajan/kopi), tegor secara halus dan berikan saran.
        4. Jika saldo minus, kasih warning keras tapi solutif.
        5. Jika hemat/sehat, kasih pujian serta masukan untuk lebih di tingkatkan.
        6. Sebutkan nama merchant jika itu mencolok (misal: "Sering banget ke Starbucks nih").

        Contoh Output JSON:
        ["Waduh, jajan kopi kamu minggu ini udah setara cicilan motor lho ☕", "Saldo aman, tapi hati-hati pengeluaran transport mulai bengkak 🚗"]
        `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        // Bersihkan formatting markdown json jika ada (kadang Gemini nambahin ```json)
        const cleanJson = responseText.replace(/```json|```/g, '').trim();
        
        return JSON.parse(cleanJson);

    } catch (error) {
        console.error("AI Insight Error:", error);
        // Fallback kalau AI Error/Limit Habis (Balik ke logic manual sederhana sebagai cadangan)
        return getFallbackInsights(transactions);
    }
};

// --- FALLBACK MANUAL (JAGA-JAGA KALAU API ERROR) ---
const getFallbackInsights = (transactions) => {
    let income = 0, expense = 0;
    transactions.forEach(t => t.type === 'income' ? income += Number(t.total_amount) : expense += Number(t.total_amount));
    const balance = income - expense;

    if (balance < 0) return ["Waduh, pengeluaran lebih besar dari pemasukan nih! 🚨 Cek lagi pos pengeluaranmu."];
    if (expense > income * 0.8) return ["Hati-hati, sisa saldomu menipis. Rem dulu jajannya ya! 🛡️"];
    return ["Keuanganmu tercatat rapi. Terus pertahankan ya! 🌟"];
};

// Helper Format Rupiah
const formatIDR = (num) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
};