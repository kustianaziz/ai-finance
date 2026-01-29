import { supabase } from '../supabaseClient';
import Groq from "groq-sdk";

// API Key Groq dari .env
const API_KEY = import.meta.env.VITE_GROQ_API_KEY; 
// Inisialisasi Groq Client
const groq = new Groq({ apiKey: API_KEY, dangerouslyAllowBrowser: true });

// Gunakan model Llama 3 70B yang sangat cerdas untuk instruksi kompleks
const MODEL_NAME = "meta-llama/llama-4-scout-17b-16e-instruct"; 

// --- UPDATED LOGGER: TERIMA DATA TOKEN ---
const logAIActivity = async (featureName, usageData, explicitUserId = null) => {
    try {
        let uid = explicitUserId;
        if (!uid) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) uid = user.id;
        }

        if (uid) {
            // usageData format dari Groq: { prompt_tokens, completion_tokens, total_tokens }
            await supabase.from('ai_logs').insert({
                user_id: uid,
                feature: featureName,
                model: MODEL_NAME,
                input_tokens: usageData?.prompt_tokens || 0,
                output_tokens: usageData?.completion_tokens || 0,
                total_tokens: usageData?.total_tokens || 0
            });
        }
    } catch (err) {
        console.error("Gagal log AI:", err);
    }
};

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
    
    Task: Ekstrak daftar transaksi ke JSON. WAJIB pisahkan Pajak dan Biaya Admin jika disebutkan.

    RULES FOR FEES & TAX:
    1. Jika ada kata "pajak", "tax", "ppn" -> Masukkan ke field 'tax'.
    2. Jika ada kata "admin", "biaya layanan", "Biaya Administrasi", "Pembulatan", "fee" -> Masukkan ke field 'admin_fee'.
    3. 'total_amount' adalah TOTAL KESELURUHAN (Harga Barang + Pajak + Admin).

    RULES FOR WALLET DETECTION (CRITICAL):
    1. Cari kata kunci Bank/E-Wallet: "BCA", "Mandiri", "BRI", "BNI", "BSI", "Jago", "Jenius", "Seabank", "Gopay", "Ovo", "Dana", "ShopeePay", "LinkAja", "Tunai", "Cash", "Dompet".
    2. 'source_wallet': 
       - Jika ada kata "dari [Bank]", "pakai [Bank]", "via [Bank]", "menggunakan [Bank]", isi dengan nama Bank tersebut.
       - Contoh: "beli token dari mandiri" -> source_wallet: "Mandiri".
    3. 'destination_wallet' (Hanya untuk type='transfer' atau Tarik Tunai):
       - Jika ada kata "ke [Bank]", "masuk [Bank]", "topup [Bank]", "Tarik Tunai" isi dengan nama Bank tersebut dan jika Tarik Tunai Maka isi nama nya Cash atau dompet atau saku prioritas cari text yang di ketik.

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
        "total_amount": number (GRAND TOTAL),
        "admin_fee": number (0 if none),
        "tax": number (0 if none),
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
      temperature: 0,
      response_format: { type: "json_object" }
    });

    // --- CAPTURE TOKEN & LOG ---
    const usage = chatCompletion.usage; 
    logAIActivity('VOICE_MANUAL', usage);
    // --------------------------

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

// --- FUNGSI 2: SCAN GAMBAR (OPTIMIZED FOR BJB, LOCAL BANKS, & FEES) ---
export const processImageInput = async (fileBase64, mimeType, userCategories = []) => {
  try {
    const categoryListString = buildCategoryPrompt(userCategories);

    const prompt = `
    Role: Expert Indonesian Bank Receipt Analyzer.
    
    Task: Extract transaction data strictly into valid JSON. You MUST detect and separate Admin Fees and Taxes.
    
    Output Schema:
    {
      "merchant": "Store Name OR Receiver Name (if transfer)",
      "date": "YYYY-MM-DD", 
      "amount": Number (GRAND TOTAL PAID including Fees & Tax),
      "admin_fee": Number (Biaya Admin/Jasa/Handling. 0 if none),
      "tax": Number (PPN/Tax. 0 if none),
      "category": "CategoryString", 
      "type": "expense" or "transfer",
      "source_wallet": "Sender Bank/Wallet (e.g. BJB, BCA)",
      "destination_wallet": "Receiver Bank/Wallet (e.g. Mandiri, BNI)",
      "items": [{ "name": "item", "price": 0 }]
    }
    
    ALLOWED CATEGORIES: [${categoryListString}, Mutasi Saldo]

    CRITICAL RULES:

    1. **TRANSFER DETECTION**:
       - Look for keywords: "Top Up", "Transfer Antar Bank", "Bank Yang Dituju", "Rekening Tujuan", "Berita Transfer", "M-Transfer".
       - IF FOUND, SET type = "transfer" AND category = "Mutasi Saldo".
       - SET merchant = Receiver Name (e.g., "SIFA USWATUN...").

    2. **FEES & TAX EXTRACTION (NEW)**:
       - **Admin Fee**: Look for "Biaya Admin", "Adm Bank", "Biaya Jasa", "Biaya Transaksi", "Admin". Extract this value to "admin_fee".
       - **Tax**: Look for "PPN", "Pajak", "Tax", "PB1". Extract this value to "tax".
       - **IMPORTANT**: The "amount" field in JSON must be the TOTAL PAYMENT (Main Amount + Admin Fee + Tax).

    3. **EXTRACT SOURCE WALLET (PENTING)**:
       - Look for: "Dari Bank", "Dari Rekening", "Rekening Asal", "Sumber Rekening", "Sumber Bank".
       - Determine the bank logo/header (e.g., "bank bjb", "BCA", "Livin").
       - Example: Header "bank bjb" -> source_wallet = "BJB".

    4. **EXTRACT DESTINATION WALLET (PENTING)**:
       - Look strictly for: "Bank Yang Dituju", "Bank Tujuan", "Ke Bank","Ke Rek" "Bank Penerima", "Ke Rekening", "Tujuan Transfer", "KEPADA", "Dana", "Go-Pay", "Shopee Pay".
       - Example: "Bank Yang Dituju : BANK MANDIRI" -> destination_wallet = "Mandiri".
    
    5. **EXTRACT DESTINATION WALLET TARIK TUNAI**:
       - Look strictly for: "Penarikan", "Tarik Tunai", "Ambil Cash".
       - Example: "Bank Yang Dituju : BANK MANDIRI" -> destination_wallet = "Mandiri".

    6. **GENERAL RULES**:
       - Ignore rounding (Pembulatan) unless it affects the total significantly.
       - If date missing, use today.
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
      temperature: 0,
      response_format: { type: "json_object" }
    });

    // --- CAPTURE TOKEN & LOG ---
    const usage = chatCompletion.usage;
    logAIActivity('SCAN_RECEIPT', usage);
    // --------------------------

    const resultText = chatCompletion.choices[0]?.message?.content || "{}";
    const cleanJson = resultText.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanJson);

  } catch (error) {
    console.error("Groq Vision Error:", error);
    throw new Error("Gagal analisa gambar.");
  }
};

// --- FUNGSI 3: GENERATE INSIGHT (ULTIMATE VIZO - PREDICTIVE, ANALYTIC & PSYCHOLOGY) ---
export const generateFinancialInsights = async (transactions, userId) => {
    if (!transactions || transactions.length === 0) {
        return ["Halo! Aku Vizo. Data transaksimu masih kosong nih. Yuk mulai catat pengeluaranmu hari ini! 📝"];
    }

    try {
        // 1. DATA PREPARATION (REALIZATION - KENYATAAN)
        let income = 0, expense = 0;
        let expenseByCategory = {};
        
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const daysPassed = now.getDate();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const daysLeft = daysInMonth - daysPassed;

        const monthlyTransactions = transactions.filter(t => new Date(t.date) >= startOfMonth);

        monthlyTransactions.forEach(t => {
            const amt = Number(t.total_amount);
            if (t.category === 'Mutasi Saldo') return;
            
            if (t.type === 'income') {
                income += amt;
            } else {
                expense += amt;
                // Grouping Pengeluaran untuk Analisa Kebocoran
                const cat = t.category || 'Lainnya';
                expenseByCategory[cat] = (expenseByCategory[cat] || 0) + amt;
            }
        });

        const balance = income - expense;
        
        // Hitung Burn Rate & Prediksi
        const dailyBurnRate = daysPassed > 0 ? expense / daysPassed : 0;
        const projectedExpense = expense + (dailyBurnRate * daysLeft);
        const projectedBalance = income - projectedExpense;
        
        // Cari Top Pengeluaran
        const topExpense = Object.entries(expenseByCategory)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3)
            .map(([k,v]) => `${k} (${formatIDR(v)})`)
            .join(", ");

        // 2. FETCH PLANNING DATA (Budget, Bills, Goals)
        const currentMonthStr = startOfMonth.toISOString().split('T')[0];
        const [budgetRes, billRes, goalRes] = await Promise.all([
            supabase.from('budgets').select('*').eq('user_id', userId).eq('month_period', currentMonthStr),
            supabase.from('bills').select('*').eq('user_id', userId),
            supabase.from('goals').select('*').eq('user_id', userId)
        ]);

        const budgets = budgetRes.data || [];
        const bills = billRes.data || [];
        const goals = goalRes.data || [];

        // 3. ANALISA DATA PERENCANAAN (PLANNING)
        // Hitung Total Rencana (Tagihan Wajib + Budget Lifestyle)
        const totalBills = bills.reduce((acc, curr) => acc + Number(curr.amount), 0);
        const totalBudgetLimit = budgets.reduce((acc, curr) => acc + Number(curr.amount_limit), 0);
        const totalPlannedOutflow = totalBills + totalBudgetLimit;
        
        // Rasio Perencanaan vs Income
        let planningRatio = 0;
        if (income > 0) planningRatio = Math.round((totalPlannedOutflow / income) * 100);

        // Data Pendukung Lain
        const hasGoals = goals.length > 0;
        const goalsContext = goals.map(g => `${g.name} (Kurang: ${formatIDR(g.target_amount - g.current_amount)})`).join(", ");
        
        const unpaidBills = bills.filter(b => {
            const lastPaid = b.last_paid_at ? new Date(b.last_paid_at) : null;
            return !lastPaid || (lastPaid.getMonth() !== now.getMonth());
        }).map(b => `${b.name} (${formatIDR(b.amount)})`).join(", ");

        const budgetContext = budgets.map(b => {
            const pct = Math.round((b.current_usage / b.amount_limit) * 100);
            return `${b.category}: ${pct}%`;
        }).join(", ");

        // 4. SUSUN PROMPT SAKTI (COMBINED)
        const prompt = `
        Role: Kamu adalah "Vizo", Konsultan Keuangan Pribadi yang cerdas, tajam, analitis, dan visioner.
        Tone: Profesional santai, "menampar" jika perlu (wake-up call), motivasional, dan solutif. Gunakan Bahasa Indonesia.

        DATA REAL-TIME (Kenyataan Sekarang):
        - Pemasukan: ${formatIDR(income)}
        - Pengeluaran Berjalan: ${formatIDR(expense)}
        - Sisa Saldo: ${formatIDR(balance)}
        - Rata-rata Bakar Uang (Burn Rate): ${formatIDR(dailyBurnRate)} / hari
        - Top Pengeluaran (Boros di): ${topExpense}
        
        FORECASTING (Prediksi Masa Depan Bulan Ini):
        - Proyeksi Sisa Saldo Akhir Bulan: ${formatIDR(projectedBalance)}
        - Status: ${projectedBalance < 0 ? "BAHAYA (DEFISIT)" : "AMAN (SURPLUS)"}

        DATA PERENCANAAN (Mentalitas User):
        - Total Tagihan Wajib: ${formatIDR(totalBills)}
        - Total Budget Lifestyle: ${formatIDR(totalBudgetLimit)}
        - TOTAL RENCANA KELUAR: ${formatIDR(totalPlannedOutflow)}
        - Planning Ratio (Rencana/Income): ${planningRatio}%
        
        KONTEKS PENDUKUNG:
        - Status Budget: ${budgetContext || "-"}
        - Tagihan Belum Lunas: ${unpaidBills || "Lunas semua."}
        - Punya Goals? ${hasGoals ? "YA" : "TIDAK"}
        - Daftar Goals: ${goalsContext || "-"}

        TUGAS VIZO (Berikan 8 Insight Tajam dalam format JSON Array):
        
        1. [Kesehatan Cashflow]: Evaluasi cashflow saat ini. Apakah positif/sehat? Berikan pujian atau peringatan keras jika burn rate terlalu tinggi dibanding pemasukan.
        2. [Prediksi Bahaya]: Berdasarkan 'Proyeksi Sisa Saldo Akhir Bulan', berikan peringatan. Apakah user akan defisit (minus) atau surplus? Jika defisit, sarankan rem mendadak.
        3. [Analisa Kebocoran]: Liat 'Top Pengeluaran'. Apakah ada kategori yang tidak wajar? Beri saran taktis untuk menguranginya (misal: kurangi jajan kopi).
        4. [Strategi Goals]: Hubungkan 'Proyeksi Surplus' dengan 'Goals'. Contoh: "Kalau kamu hemat Rp 50rb/hari, impian [Goal Name] bisa tercapai lebih cepat!".
        5. [Manajemen Utang]: Cek 'Tagihan Belum Lunas'. Bandingkan total tagihan dengan sisa saldo saat ini. Ingatkan prioritas bayar.
        6. [Peluang Bisnis/Income]: Lihat pola pengeluaran. Jika banyak pengeluaran modal, sarankan optimasi. Jika cashflow surplus, sarankan investasi/bisnis sampingan.
        7. [Saran Pamungkas]: Satu kalimat motivasi kuat yang merangkum tindakan apa yang harus dilakukan user HARI INI juga.
        8. [ANALISA PSIKOLOGI BUDGET] (PENTING!):
           - Bandingkan 'Total Rencana Keluar' (${formatIDR(totalPlannedOutflow)}) dengan 'Pemasukan' (${formatIDR(income)}).
           - KASUS A: Jika Rencana mendekati/melebihi Income (>90%) DAN User PUNYA Goals:
             "Gawat! Rencana pengeluaranmu (Tagihan+Budget) memakan ${planningRatio}% gaji! Kamu gak bakal bisa nabung buat [Sebutkan 1 Goal]. Saran: Kurangi budget lifestyle sekarang juga!"
           - KASUS B: Jika Rencana mendekati/melebihi Income (>90%) DAN User TIDAK PUNYA Goals:
             "Kamu aman tapi 'jalan di tempat'. Gajimu habis cuma buat bayar tagihan & gaya hidup (${planningRatio}%). Segera bikin 'Goals' dan pangkas budget biar punya masa depan!"
           - KASUS C: Jika Rencana < 80% Income:
             "Perencanaanmu mantap! Ada sisa ruang nafas ${100 - planningRatio}% dari gaji. Pastikan sisa ini masuk ke investasi ya, jangan dijajanin!"

        ATURAN OUTPUT:
        - Output MURNI JSON Array of Strings.
        - Kalimat Point 8 harus spesifik, tajam, dan sesuai kondisi (A/B/C).
        - Gunakan emoji yang relevan.
        `;

        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.6,
            response_format: { type: "json_object" }
        });

        // --- CAPTURE TOKEN & LOG ---
        const usage = chatCompletion.usage;
        if (userId) logAIActivity('INSIGHT_VIZO', usage, userId);
        // --------------------------

        const resultText = chatCompletion.choices[0]?.message?.content;
        const cleanJson = resultText.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        
        if (Array.isArray(parsed)) return parsed;
        if (parsed.insights) return parsed.insights;
        if (parsed.data) return parsed.data;
        
        return Object.values(parsed).find(v => Array.isArray(v)) || ["Keuanganmu aman, terus pantau ya! 👍"];

    } catch (error) {
        console.error("Vizo Insight Error:", error);
        return [
            "Vizo sedang menghitung ulang strategi (Koneksi Error). 😵",
            "Pastikan rencana pengeluaran (Budget+Tagihan) tidak lebih besar dari Pemasukan ya!"
        ];
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