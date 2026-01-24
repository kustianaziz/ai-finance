import { supabase } from '../supabaseClient';
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
    
    Task: Ekstrak daftar transaksi ke JSON.

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

// --- FUNGSI 2: SCAN GAMBAR (OPTIMIZED FOR BJB & LOCAL BANKS) ---
export const processImageInput = async (fileBase64, mimeType, userCategories = []) => {
  try {
    const categoryListString = buildCategoryPrompt(userCategories);

    const prompt = `
    Role: Expert Indonesian Bank Receipt Analyzer.
    
    Task: Extract transaction data strictly into valid JSON.
    
    Output Schema:
    {
      "merchant": "Store Name OR Receiver Name (if transfer)",
      "date": "YYYY-MM-DD", 
      "amount": Total Amount (number),
      "category": "CategoryString", 
      "type": "expense" or "transfer",
      "source_wallet": "Sender Bank/Wallet (e.g. BJB, BCA)",
      "destination_wallet": "Receiver Bank/Wallet (e.g. Mandiri, BNI)",
      "items": [{ "name": "item", "price": 0 }]
    }
    
    ALLOWED CATEGORIES: [${categoryListString}, Mutasi Saldo]

    CRITICAL RULES FOR TRANSFER DETECTION:
    1. Look for keywords: "Top Up", "Transfer Antar Bank", "Bank Yang Dituju", "Rekening Tujuan", "Berita Transfer", "M-Transfer".
    2. IF FOUND, SET type = "transfer" AND category = "Mutasi Saldo".
    3. SET merchant = Receiver Name (e.g., "SIFA USWATUN...").
    
    4. EXTRACT SOURCE WALLET (PENTING):
       - Look for: "Dari Bank", "Dari Rekening", "Rekening Asal", "Sumber Rekening", "Sumber Bank".
       - Determine the bank logo/header (e.g., "bank bjb", "BCA", "Livin").
       - Example: Header "bank bjb" -> source_wallet = "BJB".

    5. EXTRACT DESTINATION WALLET (PENTING):
       - Look strictly for: "Bank Yang Dituju", "Bank Tujuan", "Ke Bank","Ke Rek" "Bank Penerima", "Ke Rekening", "Tujuan Transfer", "KEPADA", "Dana", "Go-Pay", "Sohpee Pay".
       - Example: "Bank Yang Dituju : BANK MANDIRI" -> destination_wallet = "Mandiri".
    
    6. EXTRACT DESTINATION WALLET TARIK TUNAI:
       - Look strictly for: "Penarikan", "Tarik Tunai", "Ambil Cash".
       - Example: "Bank Yang Dituju : BANK MANDIRI" -> destination_wallet = "Mandiri".

    7. GENERAL RULES:
       - Ignore administrative fees (Biaya Admin) in the main amount unless it's the only amount. Use "Total Nominal" or "Jumlah Transfer".
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

    const resultText = chatCompletion.choices[0]?.message?.content || "{}";
    const cleanJson = resultText.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanJson);

  } catch (error) {
    console.error("Groq Vision Error:", error);
    throw new Error("Gagal analisa gambar.");
  }
};

// --- FUNGSI 3: GENERATE INSIGHT (SUPERCHARGED VIZO) ---
export const generateFinancialInsights = async (transactions, userId) => {
    // Note: Kita butuh userId untuk fetch data lain.
    if (!transactions || transactions.length === 0) {
        return ["Halo! Aku Vizo. Data transaksimu masih kosong nih. Yuk mulai catat pengeluaranmu hari ini! 📝"];
    }

    try {
        // 1. HITUNG SALDO & ARUS KAS (Basic)
        let income = 0, expense = 0;
        transactions.forEach(t => {
            // Skip mutasi agar perhitungan kesehatan keuangan akurat
            if (t.category === 'Mutasi Saldo') return;
            t.type === 'income' ? income += Number(t.total_amount) : expense += Number(t.total_amount);
        });
        const balance = income - expense;
        const savingsRate = income > 0 ? ((income - expense) / income) * 100 : 0;

        // 2. FETCH DATA TAMBAHAN (Budget, Bills, Goals)
        // Kita fetch parallel biar cepat
        const today = new Date();
        const currentMonthStr = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];

        const [budgetRes, billRes, goalRes] = await Promise.all([
            // A. Budget Bulan Ini
            supabase.from('budgets').select('*').eq('user_id', userId).eq('month_period', currentMonthStr),
            // B. Tagihan (Ambil semua utk difilter status bayarnya)
            supabase.from('bills').select('*').eq('user_id', userId),
            // C. Goals (Semua impian)
            supabase.from('goals').select('*').eq('user_id', userId)
        ]);

        const budgets = budgetRes.data || [];
        const bills = billRes.data || [];
        const goals = goalRes.data || [];

        // 3. OLAH DATA UNTUK PROMPT AI

        // A. Analisa Budget (Cari yg boros/hemat)
        let budgetAlerts = [];
        budgets.forEach(b => {
            const pct = (b.current_usage / b.amount_limit) * 100;
            if (pct >= 90) budgetAlerts.push(`${b.category} (KRITIS: ${Math.round(pct)}% terpakai)`);
            else if (pct >= 75) budgetAlerts.push(`${b.category} (Warning: ${Math.round(pct)}%)`);
            else if (pct < 10) budgetAlerts.push(`${b.category} (Jarang dipakai)`);
        });

        // B. Analisa Tagihan (Cari yg belum lunas & dekat)
        const currentDay = today.getDate();
        const upcomingBills = bills
            .filter(b => {
                // Cek apakah sudah lunas bulan ini
                let isPaid = false;
                if (b.last_paid_at) {
                    const paidDate = new Date(b.last_paid_at);
                    if (paidDate.getMonth() === today.getMonth() && paidDate.getFullYear() === today.getFullYear()) isPaid = true;
                }
                return !isPaid;
            })
            .map(b => ({ ...b, daysLeft: b.due_date - currentDay }))
            .sort((a, b) => a.daysLeft - b.daysLeft) // Urutkan dari yg paling dekat/telat
            .slice(0, 3) // Ambil top 3
            .map(b => {
                const status = b.daysLeft < 0 ? `TELAT ${Math.abs(b.daysLeft)} hari` : b.daysLeft === 0 ? "HARI INI" : `${b.daysLeft} hari lagi`;
                return `${b.name} (${formatIDR(b.amount)} - ${status})`;
            });

        // C. Analisa Goals
        const activeGoals = goals.map(g => {
            const pct = Math.round((g.current_amount / g.target_amount) * 100);
            return `${g.name}: Terkumpul ${pct}% (${formatIDR(g.current_amount)})`;
        }).join(", ");

        // 4. SUSUN PROMPT SAKTI
        const prompt = `
        Role: Kamu adalah "Vizo", asisten keuangan pribadi dari aplikasi Vizofin.
        Tone: Santai, cerdas, suportif, "Gen Z professional", menggunakan Bahasa Indonesia yang luwes dan emoji yang relevan.
        
        DATA KEUANGAN USER (Bulan Ini):
        - Pemasukan: ${formatIDR(income)}
        - Pengeluaran: ${formatIDR(expense)}
        - Cashflow Bersih: ${formatIDR(balance)}
        - Saving Rate: ${savingsRate.toFixed(1)}% (Standar sehat minimal 20%)
        
        DATA PENDUKUNG:
        - Budget Warning: ${budgetAlerts.length > 0 ? budgetAlerts.join(", ") : "Semua budget aman terkendali."}
        - Tagihan Belum Lunas (Prioritas): ${upcomingBills.length > 0 ? upcomingBills.join(", ") : "Tidak ada tagihan mendesak."}
        - Goals/Impian: ${activeGoals || "Belum ada goals."}

        TUGAS VIZO (Berikan 6-7 poin insight dalam format JSON Array string):
        1. [Kesehatan Saldo]: Analisa apakah Cashflow user sehat (positif), standar, atau bahaya (negatif/minus). Puji jika saving rate bagus dan berikan saran positif untuk peningkatan.
        2. [Saran Budget]: Komentari budget yang kritis (hampir habis) atau yang tidak terpakai. Beri saran taktis munculkan nama budget yang hampir habis terpakai atau tidak terpakai samasekali, beri saran juga untuk mulai menyusun budget jika belum ada data bulan ini.
        3. [Reminder Tagihan]: WAJIB ingatkan tagihan yang jatuh tempo dekat/telat (sebutkan nama tagihannya).
        4. [Motivasi Goals]: Hubungkan sisa saldo kemudian lihat budget rencana pengeluaran lalu bandingkan dengan goals user. Contoh: "Sisa saldomu sebutkan [angka sisa saldo] dengan rencana pengelauran [sebutkan rencana pengeluaran bulan ini]  sebutkan saran nya apakah cukup untuk nabung di target [Nama Goal] lho!".
        5. [Reminder transaksi] : cek data transaksi reminder jika ada transaksi yang nominal nya jauh dari rata - rata pengeluaran biasa. informasikan rata - rata pengeluaran user tersebut berdasarkan data transaksi nya.
        6. [Reminder pemasukan] : ingatkan user saat ini pemasukan nya dari apa saja, dan rata - rata berapa. berikan saran positive yang memotivasi.
        7. [Saran Bisnis] : Berikan kesimpulan Akhir, dengan kondisi keuangan yang ada, kemudian melihat kondisi status tagihan, dan transaksi pengeluaran, berikan saran untuk meningkatkan pemasukan termasuk peluang bisnis yang bisa dilakukan.
      

        ATURAN OUTPUT:
        - Output HARUS JSON Array of Strings murni.
        - Kalimat harus langsung "to the point" dan enak dibaca.
        - untuk movitasi goals minimal ingatkan 2 atau 3 goals inti nya lebih dari 1 goals jika memang ada data goals nya.
        - Jangan kaku seperti robot.
        - untuk monivasi bisnis / saran bisnis ini harus benar - benar dilihat dari kebiasaan user, melihat budget, melihat goals, melihat transaksi pengeluaran, melihat item pengeluaran, sehingga saran nya relevan dan kontekstual dengan user tersebut.

        Contoh Output:
        [
            "Halo Juragan! Cashflow kamu bulan ini sehat banget, saving rate tembus 30%. Keren! 🚀",
            "Eh hati-hati ya, budget 'Makanan' kamu udah 95% kepakai padahal baru pertengahan bulan. Masak sendiri dulu yuk? 🍳",
            "Jangan lupa, tagihan Listrik jatuh tempo 2 hari lagi. Siapin dananya ya biar gak kena denda! ⚡",
            "Sisa uangmu lumayan nih, kalau ditabung ke 'Beli MacBook' bisa makin cepat tercapai lho! 💻"
        ]
        `;

        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile", // Gunakan model terbaik untuk reasoning
            temperature: 0.6,
            response_format: { type: "json_object" }
        });

        const resultText = chatCompletion.choices[0]?.message?.content;
        const cleanJson = resultText.replace(/```json|```/g, '').trim();
        
        const parsed = JSON.parse(cleanJson);
        
        if (Array.isArray(parsed)) return parsed;
        // Handle jika AI membungkus dalam object key 'insights' atau 'data'
        return parsed.insights || parsed.data || Object.values(parsed).find(v => Array.isArray(v)) || ["Keuanganmu aman, terus pantau ya! 👍"];

    } catch (error) {
        console.error("Vizo Insight Error:", error);
        return [
            "Waduh, Vizo lagi pusing koneksi nih. 😵",
            "Tapi sekilas kulihat, pastikan pengeluaranmu tidak lebih besar dari pemasukan ya!",
            "Cek halaman Tagihan untuk memastikan tidak ada yang terlewat."
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