import { supabase } from '../supabaseClient';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getOrCreateAccount } from './accountingService'; 

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);
const MODEL_NAME = "gemini-2.5-flash";

// --- FUNGSI 1: CARI KANDIDAT ---
// (Bagian ini tidak berubah, tapi disertakan biar file lengkap)
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

// --- FUNGSI 2: PROSES SATU BIJI ---
export const processSingleTransaction = async (userId, trx) => {
  try {
    // 1. Cek Gembok & Data
    const { data: freshTrx, error: fetchError } = await supabase
        .from('transaction_headers')
        .select('is_journalized, allocation_type') 
        .eq('id', trx.id)
        .single();

    if (fetchError || !freshTrx) throw new Error("Transaksi hilang.");
    
    // Kalau sudah diproses sebelumnya
    if (freshTrx.is_journalized) {
        return { success: true, status: 'skipped', note: 'Data sudah diproses sebelumnya.' };
    }

    // 2. CEK TIPE ALOKASI
    const allocationType = trx.allocation_type || 'BUSINESS';

    // --- LOGIC SKIP PRIBADI ---
    if (allocationType === 'PERSONAL') {
        // Update DB jadi is_journalized = true (biar gak muncul di antrian lagi)
        await supabase
            .from('transaction_headers')
            .update({ is_journalized: true }) 
            .eq('id', trx.id);

        // RETURN STATUS 'SKIPPED' (Ini kuncinya buat UI)
        return { success: true, status: 'skipped', note: 'Transaksi Pribadi (Tidak Dijurnal)' };
    }

    // 2. AMBIL DAFTAR AKUN (Untuk Konteks AI)
    const { data: existingCOA } = await supabase
        .from('chart_of_accounts')
        .select('code, name, type')
        .eq('user_id', userId);

    const coaListString = existingCOA.map(a => `- ${a.code} ${a.name} (${a.type})`).join('\n');

    // 3. TANYA AI (Generate Jurnal & Deskripsi Rapih)
    const aiJournal = await askAIForJournal(trx, coaListString);

    // 4. SIMPAN HEADER (Pakai Deskripsi dari AI)
    const { data: jHeader, error: jhError } = await supabase
        .from('journal_headers')
        .insert([{
            user_id: userId,
            transaction_date: trx.date,
            // --- DISINI PERUBAHANNYA: ---
            // Kita pakai deskripsi yang sudah dirapikan AI
            description: aiJournal.description, 
            reference_no: `TRX-${trx.id.substring(0,8).toUpperCase()}`,
            is_posted: true
        }])
        .select()
        .single();

    if (jhError) throw jhError;

    // 5. SIMPAN DETAILS
    for (const entry of aiJournal.entries) {
        const accountId = await getOrCreateAccount(
            userId, 
            entry.account, 
            entry.type, 
            entry.position,
            entry.code 
        );

        await supabase.from('journal_details').insert([{
            journal_id: jHeader.id,
            account_id: accountId,
            debit: entry.position === 'debit' ? entry.amount : 0,
            credit: entry.position === 'credit' ? entry.amount : 0
        }]);
    }

    // 6. UPDATE STATUS TRANSAKSI
    await supabase
        .from('transaction_headers')
        .update({ is_journalized: true })
        .eq('id', trx.id);

    return { success: true };

  } catch (err) {
    console.error(`Gagal ID ${trx.id}:`, err);
    return { success: false, error: err.message };
  }
};

// --- FUNGSI 3: PROMPT AI (FULL FIX) ---
const askAIForJournal = async (trx, coaListString) => {
    const model = genAI.getGenerativeModel({ 
        model: MODEL_NAME,
        generationConfig: { responseMimeType: "application/json" }
    });

    // 1. SIAPKAN DATA (Ini yang tadi ketinggalan Bang!)
    const itemsDesc = trx.transaction_items.map(i => `${i.name} (${i.price})`).join(', ');
    
    const dateObj = new Date(trx.date);
    const dateFormatted = `${String(dateObj.getDate()).padStart(2,'0')}-${String(dateObj.getMonth()+1).padStart(2,'0')}-${dateObj.getFullYear()}`;
    
    const allocationType = trx.allocation_type || 'BUSINESS'; // Default Business

    // 2. SUSUN PROMPT
    const prompt = `
    Act as Senior Accountant for Indonesian UMKM.

    TASK: Classify transaction into Journal Entries based on the provided Chart of Accounts.

    CONTEXT:
    - Merchant: ${trx.merchant}
    - Date: ${dateFormatted}
    - Items: ${itemsDesc}
    - **ALLOCATION TYPE**: ${allocationType}

    AVAILABLE ACCOUNTS:
    ${coaListString}

    STRICT RULES BASED ON ALLOCATION TYPE:

    1. **IF ALLOCATION TYPE = 'BUSINESS'** (Default):
       - Map to the most relevant Expense/Asset Account (Header 1, 5, or 6).
       - Example: Bensin -> '6-401 Beban Bensin'. Stok -> '1-105 Persediaan'.

    2. **IF ALLOCATION TYPE = 'PRIVE'** (Owner's Personal Draw):
       - You MUST Debit '3-200 Prive / Penarikan Pemilik'.
       - Do NOT use any 'Beban' accounts.
       - Credit is '1-101 Kas Tunai' (Shop pays for owner's personal needs).

    3. **IF ALLOCATION TYPE = 'SALARY'** (Owner's Salary):
       - You MUST Debit '6-101 Beban Gaji Staff Kantor' (Or equivalent Salary Expense).
       - This treats the owner's withdrawal/spending as a Salary Expense for the business.
       - Credit is '1-101 Kas Tunai'.

    4. **DESCRIPTION FORMAT**:
       "${allocationType === 'BUSINESS' ? '' : '[' + allocationType + '] '}${trx.merchant} | ${dateFormatted} | Category (Indonesian)"

    Output JSON Structure: 
    { 
      "description": "String",
      "entries": [ { "position": "debit/credit", "code": "X-XXX", "account": "Name", "type": "Type", "amount": number } ] 
    }
    `;

    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text());
};