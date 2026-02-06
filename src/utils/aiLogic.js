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

// --- FUNGSI 3: GENERATE INSIGHT (DEEP CONTEXTUAL REASONING) ---
export const generateFinancialInsights = async (transactions, userId) => {
    if (!transactions || transactions.length === 0) return ["Halo! Aku Vizo. Data transaksimu masih kosong nih. Yuk mulai catat pengeluaranmu hari ini! 📝"];

    try {
        // --- A. DATA PREPARATION ---
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
            if (t.type === 'income') { income += amt; } 
            else { 
                expense += amt; 
                const cat = t.category || 'Lainnya';
                expenseByCategory[cat] = (expenseByCategory[cat] || 0) + amt;
            }
        });

        const balance = income - expense;
        const dailyBurnRate = daysPassed > 0 ? expense / daysPassed : 0;
        const projectedExpense = expense + (dailyBurnRate * daysLeft);
        const projectedBalance = income - projectedExpense;
        
        // Top Pengeluaran (Biar AI tau konteks borosnya dimana)
        const topExpenseEntry = Object.entries(expenseByCategory).sort(([,a], [,b]) => b - a)[0];
        const topExpenseName = topExpenseEntry ? topExpenseEntry[0] : "Lainnya";
        const topExpenseAmount = topExpenseEntry ? topExpenseEntry[1] : 0;

        // --- B. FETCH PLANNING DATA ---
        const currentMonthStr = startOfMonth.toISOString().split('T')[0];
        const [budgetRes, billRes, goalRes] = await Promise.all([
            supabase.from('budgets').select('*').eq('user_id', userId).eq('month_period', currentMonthStr),
            supabase.from('bills').select('*').eq('user_id', userId),
            supabase.from('goals').select('*').eq('user_id', userId)
        ]);

        const budgets = budgetRes.data || [];
        const bills = billRes.data || [];
        const goals = goalRes.data || [];

        // --- C. DEEP LOGIC ANALYSIS ---
        
        // 1. Analisa Tagihan Tertunggak
        const unpaidBills = bills.filter(b => {
            const lastPaid = b.last_paid_at ? new Date(b.last_paid_at) : null;
            return !lastPaid || (lastPaid.getMonth() !== now.getMonth());
        });
        const totalUnpaidBills = unpaidBills.reduce((acc, curr) => acc + Number(curr.amount), 0);
        const unpaidBillNames = unpaidBills.map(b => `${b.name} (${formatIDR(b.amount)})`).join(", ");

        // 2. Analisa "Fake Surplus" (Penting buat Point 1)
        // Saldo akhir sebenarnya = Proyeksi Sisa - Tagihan yg belum dibayar
        const netEndingBalance = projectedBalance - totalUnpaidBills;
        const isFakeSurplus = projectedBalance > 0 && netEndingBalance < 0; 

        // 3. Analisa Budget Merah
        const dangerBudgets = budgets
            .filter(b => b.amount_limit > 0 && (b.current_usage / b.amount_limit) >= 0.9) // 90% ke atas
            .map(b => `${b.category} (Sisa ${formatIDR(b.amount_limit - b.current_usage)})`);
        const budgetAlert = dangerBudgets.length > 0 ? dangerBudgets.join(", ") : null;

        // 4. Goal Utama
        const mainGoal = goals.length > 0 ? goals[0].name : "Dana Darurat";
        const mainGoalGap = goals.length > 0 ? (goals[0].target_amount - goals[0].current_amount) : 0;

        // --- D. PROMPT (LOGIC LEPAS) ---
        const prompt = `
        Role: "Vizo", Financial Advisor pribadi yang cerdas, analitis, dan bicaranya santai (Gen Z/Millennial Pro).
        
        DATA VISUALISASI KEUANGAN USER:
        ------------------------------------------------
        1. KONDISI CASHFLOW REAL-TIME:
           - Pemasukan: ${formatIDR(income)}
           - Pengeluaran Total: ${formatIDR(expense)}
           - Saldo Saat Ini: ${formatIDR(balance)}
           - Speed Jajan (Burn Rate): ${formatIDR(dailyBurnRate)} / hari.
        
        2. FORECASTING (PREDIKSI AKHIR BULAN):
           - Proyeksi Sisa Saldo (Berdasarkan kebiasaan): ${formatIDR(projectedBalance)}
           - Kewajiban Belum Dibayar (Tagihan): ${formatIDR(totalUnpaidBills)} (${unpaidBillNames || 'Lunas'})
           - NETTO (Proyeksi - Tagihan): ${formatIDR(netEndingBalance)}
           - STATUS BAHAYA: ${netEndingBalance < 0 ? "BAHAYA (DEFISIT)" : "AMAN"}
           - FENOMENA 'FAKE SURPLUS': ${isFakeSurplus ? "YA (Kelihatannya sisa, tapi sebenernya kurang buat bayar tagihan)" : "TIDAK"}

        3. SUMBER KEBOCORAN UTAMA:
           - Kategori: ${topExpenseName}
           - Jumlah: ${formatIDR(topExpenseAmount)}

        4. KONTEKS LAIN:
           - Budget Kritis (Sisa dikit): ${budgetAlert || "Aman"}
           - Goal Utama: ${mainGoal} (Kurang ${formatIDR(mainGoalGap)})
        ------------------------------------------------

        TUGAS: Berikan 5 Insight Tajam (JSON Array String) dengan logika berikut (JANGAN ROBOTIK):

        1. [STATUS KESEHATAN MENYELURUH]:
           - Evaluasi 'NETTO' (Bukan cuma proyeksi).
           - JIKA Fake Surplus (YA): Peringatkan keras! "Kelihatannya dompet tebal, tapi awas itu uang 'panas' buat bayar tagihan ${unpaidBillNames}. Aslinya kamu minus!"
           - JIKA Defisit: Jelaskan matematikanya. "Speed jajanmu ${formatIDR(dailyBurnRate)}/hari terlalu ngebut dibanding sisa hari. Bakal minus ${formatIDR(Math.abs(netEndingBalance))}!"
           - JIKA Aman: Bandingkan Total Pemasukan vs Total Rencana Keluar. "Aman banget! Pemasukanmu ${formatIDR(income)} cukup nutup gaya hidup & tagihan."

        2. [BEDAH KEBOCORAN ${topExpenseName}]:
           - Sebutkan angka ${formatIDR(topExpenseAmount)} di kategori ini.
           - Berikan solusi KREATIF & SPESIFIK sesuai kategori '${topExpenseName}'.
           - Contoh (JANGAN COPY PASTE, MIKIR!): Kalau 'Makanan', saran bawa bekal/masak. Kalau 'Transport', saran berangkat lebih pagi/nebeng. Kalau 'Hobi', saran cari alternatif gratis.

        3. [CEK RENCANA & BUDGET]:
           - Fokus pada Budget Kritis (${budgetAlert}) ATAU Tagihan Tertunggak.
           - Kalau ada budget kritis: "Lampu merah di pos ${budgetAlert}! Sisa segitu gak bakal cukup kalau gak ngerem drastis."
           - Kalau tagihan numpuk: "Prioritas nomor 1: Lunasi ${unpaidBillNames}. Jangan dipakai jajan dulu!"

        4. [STRATEGI GOALS (REALISTIS)]:
           - JIKA NETTO MINUS: "Jujur nih, lupakan dulu '${mainGoal}'. Fokus utamamu sekarang adalah 'Survival Mode' biar akhir bulan gak ngutang."
           - JIKA NETTO PLUS: "Kabar baik! Prediksi sisa bersih ${formatIDR(netEndingBalance)} bisa kamu amankan buat '${mainGoal}' sekarang juga."

        5. [ACTION PLAN HARI INI]:
           - Berikan 2 perintah spesifik berdasarkan masalah terbesar kemudian untuk kata -kata saran dan perintah nya jangan copy paste dari contoh tapi buat lebih kreatif dan kontekstual.
           - JIKA Top Expense Makanan -> "Tantangan hari ini: Makan siang maksimal Rp 15.000!"
           - JIKA Tagihan Ada -> "jangan sampai terlewat, bayar tagihan ${unpaidBills[0]?.name || 'sekarang'}!"
           - JIKA Budget Tipis -> "perlu di perhatikan dan aga di rem untuk kategori [Budget Kritis]!"
           - JIKA Aman -> "Cek instrumen investasimu, ada peluang top-up?"

        ATURAN OUTPUT:
        - Output MURNI JSON Array of Strings.
        - Gunakan Bahasa Indonesia yang luwes, cerdas, dan tidak kaku.
        - Gunakan Emoji.
        `;

        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.7, // Naikkan temperature biar lebih kreatif (tidak template)
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
        return Object.values(parsed).find(v => Array.isArray(v)) || ["Keuanganmu aman, terus pantau ya! 👍"];

    } catch (error) {
        console.error("Vizo Insight Error:", error);
        return ["Vizo sedang menghitung ulang strategi (Koneksi Error). 😵"];
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