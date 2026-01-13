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

// --- FUNGSI ADVISOR (OPTIMALISASI HITUNG DULUAN) ---
export const generateFinancialInsights = async (transactions) => {
  // 1. HITUNG MANUAL DI JAVASCRIPT (Super Cepat & Akurat)
  // Jangan suruh AI ngitung, dia lambat & sering salah hitung.
  
  let totalIncome = 0;
  let totalExpense = 0;
  const categoryMap = {}; // Buat nyari kategori paling boros

  transactions.forEach(t => {
    if (t.type === 'income') {
        totalIncome += t.total_amount;
    } else {
        totalExpense += t.total_amount;
        // Rekap per kategori
        categoryMap[t.category] = (categoryMap[t.category] || 0) + t.total_amount;
    }
  });

  // Cari biang kerok (Kategori Paling Boros)
  let topCategory = "Tidak ada";
  let topCategoryAmount = 0;
  
  for (const [cat, amount] of Object.entries(categoryMap)) {
    if (amount > topCategoryAmount) {
        topCategory = cat;
        topCategoryAmount = amount;
    }
  }

  const balance = totalIncome - totalExpense;
  const statusKeuangan = balance >= 0 ? "AMAN (Surplus)" : "BAHAYA (Defisit/Boncos)";

  // 2. SUSUN LAPORAN SINGKAT BUAT AI
  // Kita cuma kirim teks pendek ini, jadi AI bacanya kilat! ⚡
  const summaryContext = `
    - Total Pemasukan: Rp ${totalIncome.toLocaleString('id-ID')}
    - Total Pengeluaran: Rp ${totalExpense.toLocaleString('id-ID')}
    - Sisa Saldo: Rp ${balance.toLocaleString('id-ID')}
    - Status: ${statusKeuangan}
    - Paling Boros di: ${topCategory} (Habis Rp ${topCategoryAmount.toLocaleString('id-ID')})
  `;

  try {
    const model = genAI.getGenerativeModel({ 
        model: MODEL_NAME, // Tetap Gemini 2.5
        generationConfig: { 
            responseMimeType: "application/json", // Output langsung JSON (Cepat)
            temperature: 0.7 // Kreativitas sedang biar sarannya luwes
        }
    });
    
    // 3. PROMPT "JURAGAN" (Persona yang kuat)
    const prompt = `
    Berperanlah sebagai "Juragan", mentor keuangan yang bicaranya santai, gaul (Indonesian slang), to the point, dan agak pedas kalau user boros.
    
    Laporan Keuangan User Bulan Ini:
    ${summaryContext}

    Berikan 3 saran singkat (Max 2 kalimat per saran) dalam format Array JSON:
    1. [Evaluasi] Komentari status saldo (Puji kalau surplus, sindir kalau boncos).
    2. [Sorotan] Bahas kenapa dia boros di "${topCategory}" dan kasih tips kurangi itu.
    3. [Tantangan] Satu aksi nyata (Action Plan) yang harus dilakukan besok.

    Output JSON Murni: ["Saran 1...", "Saran 2...", "Saran 3..."]
    `;
    
    const result = await model.generateContent(prompt);
    
    // Karena Native JSON, gak perlu regex replace aneh-aneh
    return JSON.parse(result.response.text());

  } catch (error) {
    console.error("Advisor Error:", error);
    return [
        "Waduh, Juragan lagi sibuk ngitung duit nih.",
        "Coba cek koneksi internet kamu ya.",
        "Intinya: Jangan besar pasak daripada tiang!"
    ];
  }
};