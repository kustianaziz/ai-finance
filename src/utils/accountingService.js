import { supabase } from '../supabaseClient';

// --- 1. HEADER UTAMA (LEVEL 0 & 1) ---
const BASE_HEADERS = [
  // --- KEPALA 1: ASET ---
  { code: '1000', name: 'ASET (ASSETS)', type: 'ASSET', normal_balance: 'debit', is_header: true, level: 0 },
  
  // 1.1 Aset Lancar
  { code: '1100', name: 'Aset Lancar', type: 'ASSET', normal_balance: 'debit', is_header: true, level: 1, parent_code: '1000' },
  { code: '1110', name: 'Kas & Setara Kas', type: 'ASSET', normal_balance: 'debit', is_header: true, level: 2, parent_code: '1100' },
  
  // Header Level 3 untuk Kas
  { code: '1111', name: 'Kas (Tunai)', type: 'ASSET', normal_balance: 'debit', is_header: true, level: 3, parent_code: '1110' }, 
  { code: '1112', name: 'Bank', type: 'ASSET', normal_balance: 'debit', is_header: true, level: 3, parent_code: '1110' }, 
  { code: '1113', name: 'E-Wallet', type: 'ASSET', normal_balance: 'debit', is_header: true, level: 3, parent_code: '1110' }, // New Header

  { code: '1120', name: 'Piutang Usaha', type: 'ASSET', normal_balance: 'debit', is_header: true, level: 2, parent_code: '1100' },
  { code: '1130', name: 'Piutang Lain-lain', type: 'ASSET', normal_balance: 'debit', is_header: true, level: 2, parent_code: '1100' },
  { code: '1140', name: 'Persediaan', type: 'ASSET', normal_balance: 'debit', is_header: true, level: 2, parent_code: '1100' },
  { code: '1150', name: 'Biaya Dibayar Dimuka', type: 'ASSET', normal_balance: 'debit', is_header: true, level: 2, parent_code: '1100' },

  // 1.2 Aset Tetap
  { code: '1200', name: 'Aset Tetap', type: 'ASSET', normal_balance: 'debit', is_header: true, level: 1, parent_code: '1000' },
  { code: '1210', name: 'Tanah', type: 'ASSET', normal_balance: 'debit', is_header: true, level: 2, parent_code: '1200' },
  { code: '1220', name: 'Bangunan', type: 'ASSET', normal_balance: 'debit', is_header: true, level: 2, parent_code: '1200' },
  { code: '1230', name: 'Kendaraan', type: 'ASSET', normal_balance: 'debit', is_header: true, level: 2, parent_code: '1200' },
  { code: '1240', name: 'Peralatan & Mesin', type: 'ASSET', normal_balance: 'debit', is_header: true, level: 2, parent_code: '1200' },
  { code: '1250', name: 'Inventaris Kantor', type: 'ASSET', normal_balance: 'debit', is_header: true, level: 2, parent_code: '1200' },

  // --- KEPALA 2: KEWAJIBAN ---
  { code: '2000', name: 'KEWAJIBAN (LIABILITIES)', type: 'LIABILITY', normal_balance: 'credit', is_header: true, level: 0 },
  { code: '2100', name: 'Kewajiban Jangka Pendek', type: 'LIABILITY', normal_balance: 'credit', is_header: true, level: 1, parent_code: '2000' },
  { code: '2200', name: 'Kewajiban Jangka Panjang', type: 'LIABILITY', normal_balance: 'credit', is_header: true, level: 1, parent_code: '2000' },

  // --- KEPALA 3: MODAL ---
  { code: '3000', name: 'MODAL (EQUITY)', type: 'EQUITY', normal_balance: 'credit', is_header: true, level: 0 },

  // --- KEPALA 4: PENDAPATAN ---
  { code: '4000', name: 'PENDAPATAN (REVENUE)', type: 'REVENUE', normal_balance: 'credit', is_header: true, level: 0 },
  { code: '4100', name: 'Pendapatan Operasional', type: 'REVENUE', normal_balance: 'credit', is_header: true, level: 1, parent_code: '4000' },
  { code: '4200', name: 'Pendapatan Non-Operasional', type: 'REVENUE', normal_balance: 'credit', is_header: true, level: 1, parent_code: '4000' },

  // --- KEPALA 5: HPP ---
  { code: '5000', name: 'BEBAN POKOK (HPP)', type: 'EXPENSE', normal_balance: 'debit', is_header: true, level: 0 },

  // --- KEPALA 6: BEBAN OPERASIONAL ---
  { code: '6000', name: 'BEBAN OPERASIONAL', type: 'EXPENSE', normal_balance: 'debit', is_header: true, level: 0 },
  { code: '6100', name: 'Beban Gaji & Tunjangan', type: 'EXPENSE', normal_balance: 'debit', is_header: true, level: 1, parent_code: '6000' },
  { code: '6200', name: 'Beban Umum & Administrasi', type: 'EXPENSE', normal_balance: 'debit', is_header: true, level: 1, parent_code: '6000' },
  { code: '6300', name: 'Beban Pemasaran', type: 'EXPENSE', normal_balance: 'debit', is_header: true, level: 1, parent_code: '6000' },
  { code: '6400', name: 'Beban Pemeliharaan', type: 'EXPENSE', normal_balance: 'debit', is_header: true, level: 1, parent_code: '6000' },
  { code: '6500', name: 'Beban Penyusutan Aset', type: 'EXPENSE', normal_balance: 'debit', is_header: true, level: 1, parent_code: '6000' },

  // --- KEPALA 7: BEBAN LAIN-LAIN ---
  { code: '7000', name: 'BEBAN NON-OPERASIONAL', type: 'EXPENSE', normal_balance: 'debit', is_header: true, level: 0 }
];

// --- 2. AKUN DETAIL STANDAR (FALLBACK) ---
const STANDARD_DETAILS = [
  // --- KAS & BANK (Default, kalau di wallet kosong) ---
  { code: '1111-01', name: 'Kas Besar', type: 'ASSET', parent_code: '1111' },
  { code: '1111-02', name: 'Kas Kecil (Petty Cash)', type: 'ASSET', parent_code: '1111' },
  // Bank & E-Wallet diambil dari database wallets, tapi kita kasih contoh 1
  { code: '1112-99', name: 'Bank Umum (Default)', type: 'ASSET', parent_code: '1112' }, 

  // --- PIUTANG ---
  { code: '1120-01', name: 'Piutang Usaha', type: 'ASSET', parent_code: '1120' },
  { code: '1130-01', name: 'Piutang Karyawan', type: 'ASSET', parent_code: '1130' },
  { code: '1130-02', name: 'Piutang Lain-lain', type: 'ASSET', parent_code: '1130' },

  // --- PERSEDIAAN ---
  { code: '1140-01', name: 'Persediaan Barang Dagang', type: 'ASSET', parent_code: '1140' },
  { code: '1140-02', name: 'Persediaan Bahan Baku', type: 'ASSET', parent_code: '1140' },

  // --- ASET TETAP & PENYUSUTAN ---
  { code: '1210-01', name: 'Tanah', type: 'ASSET', parent_code: '1210' },
  { code: '1220-01', name: 'Bangunan Toko/Kantor', type: 'ASSET', parent_code: '1220' },
  { code: '1220-99', name: 'Akum. Penyusutan Bangunan', type: 'ASSET', parent_code: '1220', normal_balance: 'credit' },
  { code: '1230-01', name: 'Kendaraan Operasional', type: 'ASSET', parent_code: '1230' },
  { code: '1230-99', name: 'Akum. Penyusutan Kendaraan', type: 'ASSET', parent_code: '1230', normal_balance: 'credit' },
  { code: '1240-01', name: 'Mesin Produksi', type: 'ASSET', parent_code: '1240' },
  { code: '1240-02', name: 'Peralatan Toko', type: 'ASSET', parent_code: '1240' },
  { code: '1240-99', name: 'Akum. Penyusutan Peralatan', type: 'ASSET', parent_code: '1240', normal_balance: 'credit' },
  { code: '1250-01', name: 'Inventaris Kantor', type: 'ASSET', parent_code: '1250' },
  { code: '1250-99', name: 'Akum. Penyusutan Inventaris', type: 'ASSET', parent_code: '1250', normal_balance: 'credit' },

  // --- KEWAJIBAN ---
  { code: '2100-01', name: 'Hutang Usaha', type: 'LIABILITY', parent_code: '2100' },
  { code: '2100-02', name: 'Hutang Gaji', type: 'LIABILITY', parent_code: '2100' },
  { code: '2100-03', name: 'Hutang Pajak', type: 'LIABILITY', parent_code: '2100' },
  { code: '2200-01', name: 'Hutang Bank (Jangka Panjang)', type: 'LIABILITY', parent_code: '2200' },

  // --- MODAL ---
  { code: '3000-01', name: 'Modal Disetor', type: 'EQUITY', parent_code: '3000' },
  { code: '3000-02', name: 'Laba Ditahan', type: 'EQUITY', parent_code: '3000' },
  { code: '3000-03', name: 'Laba Tahun Berjalan', type: 'EQUITY', parent_code: '3000' },
  { code: '3000-04', name: 'Prive (Penarikan)', type: 'EQUITY', parent_code: '3000', normal_balance: 'debit' },

  // --- PENDAPATAN ---
  { code: '4100-01', name: 'Pendapatan Penjualan', type: 'REVENUE', parent_code: '4100' },
  { code: '4100-02', name: 'Diskon Penjualan', type: 'REVENUE', parent_code: '4100', normal_balance: 'debit' },
  { code: '4100-03', name: 'Retur Penjualan', type: 'REVENUE', parent_code: '4100', normal_balance: 'debit' },
  { code: '4200-01', name: 'Pendapatan Bunga Bank', type: 'REVENUE', parent_code: '4200' },
  { code: '4200-02', name: 'Pendapatan Lain-lain', type: 'REVENUE', parent_code: '4200' },

  // --- HPP ---
  { code: '5000-01', name: 'HPP Barang Dagang', type: 'EXPENSE', parent_code: '5000' },
  { code: '5000-02', name: 'Biaya Bahan Baku', type: 'EXPENSE', parent_code: '5000' },
  { code: '5000-03', name: 'Biaya Tenaga Kerja Langsung', type: 'EXPENSE', parent_code: '5000' },

  // --- BEBAN OPERASIONAL ---
  { code: '6100-01', name: 'Gaji Karyawan', type: 'EXPENSE', parent_code: '6100' },
  { code: '6100-02', name: 'Tunjangan & Bonus', type: 'EXPENSE', parent_code: '6100' },
  { code: '6200-01', name: 'Listrik, Air & Internet', type: 'EXPENSE', parent_code: '6200' },
  { code: '6200-02', name: 'Sewa Gedung', type: 'EXPENSE', parent_code: '6200' },
  { code: '6200-03', name: 'Perlengkapan Kantor (ATK)', type: 'EXPENSE', parent_code: '6200' },
  { code: '6200-04', name: 'Biaya Perizinan', type: 'EXPENSE', parent_code: '6200' },
  { code: '6300-01', name: 'Iklan & Promosi', type: 'EXPENSE', parent_code: '6300' },
  { code: '6400-01', name: 'Perbaikan & Pemeliharaan Aset', type: 'EXPENSE', parent_code: '6400' },
  { code: '6500-01', name: 'Beban Penyusutan Bangunan', type: 'EXPENSE', parent_code: '6500' },
  { code: '6500-02', name: 'Beban Penyusutan Kendaraan', type: 'EXPENSE', parent_code: '6500' },
  { code: '6500-03', name: 'Beban Penyusutan Peralatan', type: 'EXPENSE', parent_code: '6500' },
  { code: '6500-04', name: 'Beban Penyusutan Inventaris', type: 'EXPENSE', parent_code: '6500' },

  // --- BEBAN LAIN ---
  { code: '7000-01', name: 'Biaya Administrasi Bank', type: 'EXPENSE', parent_code: '7000' },
  { code: '7000-02', name: 'Pajak Final', type: 'EXPENSE', parent_code: '7000' },
];

// --- HELPER UNTUK INSERT ---
const insertAccount = async (userId, accData, parentMap) => {
  const parentId = accData.parent_code ? parentMap[accData.parent_code] : null;

  const { data: existing } = await supabase.from('chart_of_accounts')
    .select('id').eq('user_id', userId).eq('name', accData.name).maybeSingle();
  
  if (existing) return existing.id;

  const payload = {
    user_id: userId,
    code: accData.code,
    name: accData.name,
    type: accData.type,
    normal_balance: accData.normal_balance || (['ASSET', 'EXPENSE'].includes(accData.type) ? 'debit' : 'credit'),
    is_header: accData.is_header || false,
    parent_id: parentId
  };

  const { data, error } = await supabase.from('chart_of_accounts').insert(payload).select().single();
  if (error) {
    console.warn(`Gagal insert akun ${accData.name}:`, error.message);
    return null;
  }
  return data.id;
};

// --- FUNGSI UTAMA 1: GENERATE DEFAULT COA ---
export const ensureUserHasCOA = async (userId) => {
  try {
    // 1. AMBIL WALLET HANYA YANG BISNIS
    const { data: wallets } = await supabase
        .from('wallets')
        .select('name, type')
        .eq('user_id', userId)
        .eq('allocation_type', 'BUSINESS'); // Filter Penting!

    const { data: expenses } = await supabase.from('transaction_headers').select('category').eq('user_id', userId).eq('type', 'expense');
    const { data: incomes } = await supabase.from('transaction_headers').select('category').eq('user_id', userId).eq('type', 'income');

    const uniqueExpenses = [...new Set(expenses?.map(e => e.category).filter(Boolean))];
    const uniqueIncomes = [...new Set(incomes?.map(e => e.category).filter(Boolean))];

    const parentMap = {};

    // 2. Insert Header Base
    for (const header of BASE_HEADERS) {
      const id = await insertAccount(userId, header, parentMap);
      if (id) parentMap[header.code] = id;
    }

    // 3. Insert Detail Standar
    for (const std of STANDARD_DETAILS) {
      await insertAccount(userId, std, parentMap);
    }

    // 4. Insert DINAMIS: Wallets -> Kas (1111), Bank (1112), E-Wallet (1113)
    let cashCounter = 10;
    let bankCounter = 10;
    let ewalletCounter = 10;
    
    if (wallets) {
      for (const w of wallets) {
        if (STANDARD_DETAILS.some(s => s.name.toLowerCase() === w.name.toLowerCase())) continue;

        let parentCode = '1111'; // Default Kas Tunai
        let counter = cashCounter++;
        
        const nameLower = w.name.toLowerCase();
        const typeLower = (w.type || '').toLowerCase();

        // Logic Penentuan Induk Wallet
        if (typeLower === 'ewallet' || nameLower.includes('gopay') || nameLower.includes('ovo') || nameLower.includes('dana') || nameLower.includes('shopee') || nameLower.includes('linkaja') || nameLower.includes('qris')) {
            parentCode = '1113'; // E-Wallet
            counter = ewalletCounter++;
        } else if (typeLower === 'bank' || nameLower.includes('bank') || nameLower.includes('bca') || nameLower.includes('mandiri') || nameLower.includes('bri') || nameLower.includes('bni')) {
            parentCode = '1112'; // Bank
            counter = bankCounter++;
        }

        await insertAccount(userId, {
          code: `${parentCode}-${counter}`,
          name: w.name,
          type: 'ASSET',
          parent_code: parentCode
        }, parentMap);
      }
    }

    // 5. Insert DINAMIS: Expenses -> Beban Ops Lainnya (6200)
    let expenseCounter = 10;
    if (uniqueExpenses.length > 0) {
      for (const cat of uniqueExpenses) {
        if (STANDARD_DETAILS.some(s => s.name.toLowerCase().includes(cat.toLowerCase()))) continue;
        await insertAccount(userId, {
          code: `6200-${expenseCounter++}`,
          name: `Beban ${cat}`,
          type: 'EXPENSE',
          parent_code: '6200' 
        }, parentMap);
      }
    }

    // 6. Insert DINAMIS: Incomes -> Pendapatan Lain (4200)
    let incomeCounter = 10;
    if (uniqueIncomes.length > 0) {
      for (const cat of uniqueIncomes) {
        if (STANDARD_DETAILS.some(s => s.name.toLowerCase().includes(cat.toLowerCase()))) continue;
        await insertAccount(userId, {
          code: `4200-${incomeCounter++}`,
          name: `Pendapatan ${cat}`,
          type: 'REVENUE',
          parent_code: '4200'
        }, parentMap);
      }
    }

    return true;

  } catch (err) {
    console.error("Error generating COA:", err);
    throw err;
  }
};

// --- FUNGSI UTAMA 2: SEARCH / GET OR CREATE (Dipakai AI) ---
export const getOrCreateAccount = async (userId, name, type, parentCode = null) => {
  const { data: existing } = await supabase.from('chart_of_accounts')
    .select('id').eq('user_id', userId).ilike('name', name).maybeSingle();
  
  if (existing) return existing.id;

  let parentId = null;
  if (parentCode) {
     const { data: p } = await supabase.from('chart_of_accounts').select('id').eq('user_id', userId).eq('code', parentCode).maybeSingle();
     parentId = p?.id;
  }

  const randomSuffix = Math.floor(1000 + Math.random() * 9000); 
  const prefix = type === 'ASSET' ? '1' : type === 'LIABILITY' ? '2' : type === 'EQUITY' ? '3' : type === 'REVENUE' ? '4' : '6';
  
  const { data: newAcc, error } = await supabase.from('chart_of_accounts').insert({
    user_id: userId,
    name: name,
    type: type,
    code: `${prefix}-${randomSuffix}`,
    parent_id: parentId,
    normal_balance: ['ASSET','EXPENSE'].includes(type) ? 'debit' : 'credit'
  }).select().single();

  if (error) throw error;
  return newAcc.id;
};

// --- FUNGSI UTAMA 3: GET ALL ACCOUNTS (Wajib Ada) ---
export const getAllAccounts = async (userId) => {
  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, type, parent_id, is_header')
    .eq('user_id', userId)
    .order('code', { ascending: true });

  if (error) throw error;
  return data || [];
};