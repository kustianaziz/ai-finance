import { supabase } from '../supabaseClient';

// --- 1. DATA MASTER: STARTER PACK AKUN UMKM ---
export const STANDARD_COA = [
  // ASET (Kepala 1)
  { code: '1-101', name: 'Kas Tunai', type: 'Asset', normal_balance: 'debit' },
  { code: '1-102', name: 'Bank BCA', type: 'Asset', normal_balance: 'debit' },
  { code: '1-103', name: 'Bank BRI', type: 'Asset', normal_balance: 'debit' },
  { code: '1-104', name: 'Bank Mandiri', type: 'Asset', normal_balance: 'debit' },
  { code: '1-105', name: 'E-Wallet (Gopay/OVO)', type: 'Asset', normal_balance: 'debit' },
  { code: '1-201', name: 'Perlengkapan Usaha', type: 'Asset', normal_balance: 'debit' },
  { code: '1-301', name: 'Peralatan & Mesin', type: 'Asset', normal_balance: 'debit' },
  
  // KEWAJIBAN (Kepala 2)
  { code: '2-101', name: 'Hutang Usaha', type: 'Liability', normal_balance: 'credit' },
  
  // MODAL (Kepala 3)
  { code: '3-101', name: 'Modal Pemilik', type: 'Equity', normal_balance: 'credit' },
  { code: '3-102', name: 'Prive (Tarik Modal)', type: 'Equity', normal_balance: 'debit' },
  
  // PENDAPATAN (Kepala 4)
  { code: '4-101', name: 'Pendapatan Penjualan', type: 'Revenue', normal_balance: 'credit' },
  { code: '4-102', name: 'Pendapatan Lain-lain', type: 'Revenue', normal_balance: 'credit' },
  
  // BEBAN (Kepala 5 & 6)
  { code: '5-101', name: 'Beban HPP (Beli Stok)', type: 'Expense', normal_balance: 'debit' },
  { code: '6-101', name: 'Beban Gaji', type: 'Expense', normal_balance: 'debit' },
  { code: '6-102', name: 'Beban Listrik & Air', type: 'Expense', normal_balance: 'debit' },
  { code: '6-103', name: 'Beban Sewa', type: 'Expense', normal_balance: 'debit' },
  { code: '6-104', name: 'Beban Pemasaran/Iklan', type: 'Expense', normal_balance: 'debit' },
  { code: '6-105', name: 'Beban Transportasi', type: 'Expense', normal_balance: 'debit' },
  { code: '6-106', name: 'Beban Konsumsi', type: 'Expense', normal_balance: 'debit' },
  { code: '6-999', name: 'Beban Lain-lain', type: 'Expense', normal_balance: 'debit' },
];

// --- 2. FUNGSI CEK & SEEDING COA ---
export const ensureUserHasCOA = async (userId) => {
  const { count } = await supabase
    .from('chart_of_accounts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (count === 0) {
    console.log("User baru! Menyiapkan Chart of Accounts...");
    const payload = STANDARD_COA.map(acc => ({ ...acc, user_id: userId }));
    
    const { error } = await supabase.from('chart_of_accounts').insert(payload);
    if (error) console.error("Gagal seeding COA:", error);
    else console.log("Sukses seeding COA!");
  }
};

// --- 3. SMART MATCHER (ALGORITMA PENJODOHAN) ---
// PERBAIKAN: DITAMBAHKAN 'export' DI DEPANNYA
export const getOrCreateAccount = async (userId, name, type, position, codeSuggestion = null) => {
  // 1. Cek by NAME dulu (Case Insensitive)
  let { data: existing, error } = await supabase
    .from('chart_of_accounts')
    .select('id, code')
    .eq('user_id', userId)
    .ilike('name', name) // ilike = insensitive case
    .maybeSingle();

  // 2. Kalau nama gak ketemu, Cek by CODE (kalau AI ngasih kode)
  if (!existing && codeSuggestion) {
      const { data: existingByCode } = await supabase
        .from('chart_of_accounts')
        .select('id, code')
        .eq('user_id', userId)
        .eq('code', codeSuggestion)
        .maybeSingle();
      existing = existingByCode;
  }

  // 3. Kalau ada, return ID
  if (existing) return existing.id;

  // 4. Kalau gak ada, baru CREATE BARU (Terpaksa)
  // Generate kode baru kalau AI gak ngasih atau kodenya duplikat
  let newCode = codeSuggestion;
  if (!newCode) {
      // Logic generate kode sederhana (misal cari max code + 1)
      // Disini kita simplify pakai timestamp buntut aja biar unik sementara
      const prefix = type === 'Asset' ? '1' : type === 'Liability' ? '2' : type === 'Equity' ? '3' : type === 'Revenue' ? '4' : '6';
      newCode = `${prefix}-${Date.now().toString().slice(-4)}`;
  }

  const { data: newAcc, error: insertError } = await supabase
    .from('chart_of_accounts')
    .insert([{ user_id: userId, name: name, type: type, code: newCode }])
    .select()
    .single();

  if (insertError) throw insertError;
  return newAcc.id;
};

// --- 4. FUNGSI UTAMA: SIMPAN JURNAL (TRANSAKSI) ---
export const saveSmartJournal = async (userId, aiResult) => {
  // A. Simpan HEADER Jurnal
  const { data: header, error: headerError } = await supabase
    .from('journal_headers')
    .insert([{
      user_id: userId,
      transaction_date: aiResult.date || new Date(),
      description: aiResult.description || 'Transaksi Tanpa Keterangan',
      reference_no: `AUTO-${Date.now()}`, 
      is_posted: true
    }])
    .select()
    .single();

  if (headerError) throw headerError;
  const journalId = header.id;

  // B. Simpan DETAILS
  for (const entry of aiResult.entries) {
    const accountId = await getOrCreateAccount(
        userId, 
        entry.account, 
        entry.type, 
        entry.position
    );

    const debitAmount = entry.position === 'debit' ? entry.amount : 0;
    const creditAmount = entry.position === 'credit' ? entry.amount : 0;

    const { error: detailError } = await supabase
      .from('journal_details')
      .insert([{
        journal_id: journalId,
        account_id: accountId,
        debit: debitAmount,
        credit: creditAmount
      }]);
      
    if (detailError) throw detailError;
  }

  return journalId;
};

// --- FUNGSI BARU: AMBIL DAFTAR SEMUA AKUN (UNTUK FILTER) ---
export const getAllAccounts = async (userId) => {
  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, type')
    .eq('user_id', userId)
    .order('code', { ascending: true });

  if (error) throw error;
  return data || [];
};