import { supabase } from '../supabaseClient';
import Groq from "groq-sdk";
import { getOrCreateAccount } from './accountingService'; 

// --- KONFIGURASI GROQ ---
const API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const groq = new Groq({ apiKey: API_KEY, dangerouslyAllowBrowser: true });

// Gunakan model Llama 3 70B (Versatile & Cerdas untuk Akuntansi)
const MODEL_NAME = "llama-3.3-70b-versatile";

// --- FUNGSI 1: CARI KANDIDAT TRANSAKSI ---
export const fetchUnpostedTransactions = async (userId, startDate, endDate) => {
  const { data, error } = await supabase
    .from('transaction_headers')
    .select(`*, transaction_items (*)`)
    .eq('user_id', userId)
    .eq('is_journalized', false) 
    .gte('date', startDate)      
    .lte('date', endDate)        
    .order('date', { ascending: true }); 

  if (error) throw error;
  return data || [];
};

// --- FUNGSI 2: PROSES SATU TRANSAKSI ---
export const processSingleTransaction = async (userId, trx) => {
  try {
    // 1. Cek Ulang Data di DB (Safety Check)
    const { data: freshTrx, error: fetchError } = await supabase
        .from('transaction_headers')
        .select('is_journalized, allocation_type') 
        .eq('id', trx.id)
        .single();

    if (fetchError || !freshTrx) throw new Error("Transaksi tidak ditemukan.");
    
    // Kalau sudah diproses sebelumnya, skip
    if (freshTrx.is_journalized) {
        return { success: true, status: 'skipped', note: 'Data sudah diproses sebelumnya.' };
    }

    // 2. CEK TIPE ALOKASI
    const allocationType = trx.allocation_type || 'BUSINESS';

    // --- LOGIC SKIP PRIBADI (PERSONAL) ---
    // Transaksi 'PERSONAL' tidak perlu masuk jurnal bisnis.
    // Kita tandai is_journalized = true agar tidak muncul lagi di antrian.
    if (allocationType === 'PERSONAL') {
        await supabase
            .from('transaction_headers')
            .update({ is_journalized: true }) 
            .eq('id', trx.id);

        return { success: true, status: 'skipped', note: 'Transaksi Pribadi (Tidak Dijurnal)' };
    }

    // 3. AMBIL DAFTAR AKUN (COA)
    const { data: existingCOA } = await supabase
        .from('chart_of_accounts')
        .select('code, name, type')
        .eq('user_id', userId);

    const coaListString = existingCOA.map(a => `- ${a.code} ${a.name} (${a.type})`).join('\n');

    // 4. TANYA AI (Generate Jurnal & Deskripsi Rapih)
    const aiJournal = await askAIForJournal(trx, coaListString);

    // 5. SIMPAN HEADER JURNAL
    const { data: jHeader, error: jhError } = await supabase
        .from('journal_headers')
        .insert([{
            user_id: userId,
            transaction_date: trx.date,
            description: aiJournal.description, // Deskripsi hasil olahan AI
            reference_no: `TRX-${trx.id.substring(0,8).toUpperCase()}`,
            is_posted: true
        }])
        .select()
        .single();

    if (jhError) throw jhError;

    // 6. SIMPAN DETAILS (Debit & Credit)
    for (const entry of aiJournal.entries) {
        const accountId = await getOrCreateAccount(
            userId, 
            entry.account, 
            entry.type, 
            entry.position, // 'debit' or 'credit'
            entry.code 
        );

        await supabase.from('journal_details').insert([{
            journal_id: jHeader.id,
            account_id: accountId,
            debit: entry.position === 'debit' ? entry.amount : 0,
            credit: entry.position === 'credit' ? entry.amount : 0
        }]);
    }

    // 7. UPDATE STATUS TRANSAKSI JADI SUDAH DIJURNAL
    await supabase
        .from('transaction_headers')
        .update({ is_journalized: true })
        .eq('id', trx.id);

    return { success: true, status: 'success' };

  } catch (err) {
    console.error(`Gagal ID ${trx.id}:`, err);
    return { success: false, error: err.message };
  }
};

// --- FUNGSI 3: PROMPT AI (GROQ VERSION) ---
const askAIForJournal = async (trx, coaListString) => {
    // 1. SIAPKAN DATA CONTEXT
    const itemsDesc = trx.transaction_items?.map(i => `${i.name} (${i.price})`).join(', ') || "Item";
    
    const dateObj = new Date(trx.date);
    const dateFormatted = `${String(dateObj.getDate()).padStart(2,'0')}-${String(dateObj.getMonth()+1).padStart(2,'0')}-${dateObj.getFullYear()}`;
    
    const allocationType = trx.allocation_type || 'BUSINESS'; // Default Business

    // 2. SUSUN PROMPT SAKTI
    const prompt = `
    Act as Senior Accountant for Indonesian UMKM.

    TASK: Create a Journal Entry JSON based on the transaction data and available Chart of Accounts (COA).

    TRANSACTION CONTEXT:
    - Merchant/Desc: ${trx.merchant}
    - Total Amount: ${trx.total_amount}
    - Date: ${dateFormatted}
    - Items Detail: ${itemsDesc}
    - **ALLOCATION TYPE**: ${allocationType}

    AVAILABLE CHART OF ACCOUNTS:
    ${coaListString}

    ACCOUNTING RULES:
    1. **IF ALLOCATION TYPE = 'BUSINESS'** (Standard Expense/Income):
       - Map to the most specific Expense Account (Header 6) or Asset (Header 1).
       - Credit is usually '1-101 Kas Tunai' or Bank.

    2. **IF ALLOCATION TYPE = 'PRIVE'** (Owner's Personal Draw):
       - DEBIT: '3-200 Prive / Penarikan Pemilik' (Equity reduction).
       - CREDIT: '1-101 Kas Tunai' (Cash outflow).
       - Do NOT use Expense accounts (Beban).

    3. **IF ALLOCATION TYPE = 'SALARY'** (Owner's Salary):
       - DEBIT: '6-101 Beban Gaji' (Operating Expense).
       - CREDIT: '1-101 Kas Tunai'.
       - This treats the withdrawal as a business expense.

    4. **DESCRIPTION FORMAT**:
       - Format: "[Category] Merchant Name - Brief Details"
       - Example: "[Bensin] SPBU Pertamina - Isi Pertalite"

    OUTPUT JSON SCHEMA (Strict):
    {
      "description": "String",
      "entries": [
        { "position": "debit", "code": "X-XXX", "account": "Account Name", "type": "Type", "amount": number },
        { "position": "credit", "code": "X-XXX", "account": "Account Name", "type": "Type", "amount": number }
      ]
    }
    `;

    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: MODEL_NAME,
            temperature: 0, // Wajib 0 agar output konsisten & patuh
            response_format: { type: "json_object" }
        });

        const resultText = chatCompletion.choices[0]?.message?.content || "{}";
        const cleanJson = resultText.replace(/```json|```/g, '').trim();
        
        return JSON.parse(cleanJson);

    } catch (error) {
        console.error("Groq Journal Error:", error);
        // Fallback Manual jika AI Error
        return {
            description: `Manual: ${trx.merchant}`,
            entries: [
                { position: 'debit', code: '9-999', account: 'Uncategorized Expense', type: 'Expense', amount: trx.total_amount },
                { position: 'credit', code: '1-101', account: 'Kas Tunai', type: 'Asset', amount: trx.total_amount }
            ]
        };
    }
};