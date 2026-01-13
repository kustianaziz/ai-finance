import { supabase } from '../supabaseClient';

// ==========================================
// 1. HELPER UMUM (FETCHING DATA RAW)
// ==========================================
// Helper ini cuma tugasnya ambil data mentah, biar logic hitung ada di masing-masing fungsi
const fetchJournals = async (userId, startDate, endDate, isSnapshot = false) => {
  let query = supabase
    .from('journal_details')
    .select(`
      debit, credit,
      chart_of_accounts!inner ( name, type, code ),
      journal_headers!inner ( transaction_date )
    `)
    .eq('journal_headers.user_id', userId);

  // Filter Tanggal
  if (isSnapshot) {
    // Mode Snapshot (Neraca/Saldo Awal): Ambil dari awal jaman s/d End Date
    if (endDate) query = query.lte('journal_headers.transaction_date', endDate);
  } else {
    // Mode Periode (Laba Rugi/Arus Kas): Ambil dalam range
    if (startDate) query = query.gte('journal_headers.transaction_date', startDate);
    if (endDate) query = query.lte('journal_headers.transaction_date', endDate);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

// ==========================================
// 2. LAPORAN LABA RUGI (PROFIT LOSS)
// ==========================================
export const getComparativeProfitLoss = async (userId, rangeA, rangeB) => {
  const processPL = async (start, end) => {
    if (!start || !end) return { revenue: [], expense: [], totals: { rev:0, exp:0 } };
    
    const data = await fetchJournals(userId, start, end);
    const result = {};

    data.forEach(row => {
      const acc = row.chart_of_accounts;
      const key = acc.code;
      
      // Inisialisasi
      if (!result[key]) result[key] = { code: acc.code, name: acc.name, type: acc.type, amount: 0 };
      
      // Hitung Flow (Revenue/Expense)
      if (acc.type === 'Revenue') result[key].amount += (row.credit - row.debit);
      else if (acc.type === 'Expense') result[key].amount += (row.debit - row.credit);
    });

    const revenue = Object.values(result).filter(i => i.type === 'Revenue').sort((a,b)=>a.code.localeCompare(b.code));
    const expense = Object.values(result).filter(i => i.type === 'Expense').sort((a,b)=>a.code.localeCompare(b.code));
    
    return {
      revenue, expense,
      totals: {
        rev: revenue.reduce((s, i) => s + i.amount, 0),
        exp: expense.reduce((s, i) => s + i.amount, 0)
      }
    };
  };

  const curr = await processPL(rangeA.start, rangeA.end);
  const prev = await processPL(rangeB?.start, rangeB?.end);

  // Helper Merge Data A & B
  const merge = (arrA, arrB) => {
      const map = {};
      arrA.forEach(i => map[i.code] = { ...i, current: i.amount, prev: 0 });
      (arrB || []).forEach(i => {
          if(!map[i.code]) map[i.code] = { ...i, current: 0, prev: 0 };
          map[i.code].prev = i.amount;
      });
      return Object.values(map).sort((a,b)=>a.code.localeCompare(b.code));
  };

  return {
    revenue: merge(curr.revenue, prev.revenue),
    expense: merge(curr.expense, prev.expense),
    totalRevenue: { current: curr.totals.rev, prev: prev.totals.rev },
    totalExpense: { current: curr.totals.exp, prev: prev.totals.exp },
    netIncome: { current: curr.totals.rev - curr.totals.exp, prev: prev.totals.rev - prev.totals.exp }
  };
};

// Trend Laba Rugi 12 Bulan (Tetap Aman)
export const getMonthlyTrendReport = async (userId, year) => {
    const data = await fetchJournals(userId, `${year}-01-01`, `${year}-12-31`);
    
    const report = { revenue: [], expense: [], totals: { revenue: Array(12).fill(0), expense: Array(12).fill(0), netIncome: Array(12).fill(0) } };
    const tempMap = {};

    data.forEach(row => {
        const acc = row.chart_of_accounts;
        if(!tempMap[acc.code]) tempMap[acc.code] = { ...acc, months: Array(12).fill(0), total: 0 };
        
        const m = new Date(row.journal_headers.transaction_date).getMonth();
        let val = 0;
        if(acc.type === 'Revenue') val = row.credit - row.debit;
        else if(acc.type === 'Expense') val = row.debit - row.credit;

        tempMap[acc.code].months[m] += val;
        tempMap[acc.code].total += val;
    });

    Object.values(tempMap).forEach(item => {
        if(item.type === 'Revenue') {
            report.revenue.push(item);
            item.months.forEach((v,i) => report.totals.revenue[i] += v);
        } else if(item.type === 'Expense') {
            report.expense.push(item);
            item.months.forEach((v,i) => report.totals.expense[i] += v);
        }
    });

    for(let i=0; i<12; i++) report.totals.netIncome[i] = report.totals.revenue[i] - report.totals.expense[i];
    
    report.revenue.sort((a,b)=>a.code.localeCompare(b.code));
    report.expense.sort((a,b)=>a.code.localeCompare(b.code));
    
    return report;
};


// ==========================================
// 3. NERACA (BALANCE SHEET)
// ==========================================
export const getBalanceSheetReport = async (userId, rangeA, rangeB) => {
  const getSnapshot = async (endDate) => {
    if (!endDate) return null;
    // Ambil Snapshot (isSnapshot = true)
    const data = await fetchJournals(userId, null, endDate, true); 
    
    const res = { assets: {}, liabilities: {}, equity: {}, earnings: 0 };
    
    data.forEach(row => {
        const acc = row.chart_of_accounts;
        const net = row.debit - row.credit;

        // Hitung Laba Berjalan (Revenue - Expense)
        if (acc.type === 'Revenue') res.earnings += (row.credit - row.debit);
        else if (acc.type === 'Expense') res.earnings -= (row.debit - row.credit);
        
        // Hitung Saldo Akun Neraca
        else {
            let val = 0;
            let target = null;
            if (acc.type === 'Asset') { target = res.assets; val = net; }
            else if (acc.type === 'Liability') { target = res.liabilities; val = -net; }
            else if (acc.type === 'Equity') { target = res.equity; val = -net; }

            if(target) {
                if(!target[acc.code]) target[acc.code] = { ...acc, amount: 0 };
                target[acc.code].amount += val;
            }
        }
    });
    return res;
  };

  const snapA = await getSnapshot(rangeA.end);
  const snapB = await getSnapshot(rangeB?.end);

  // Helper Merge Neraca
  const mergeBS = (objA, objB) => {
    const map = {};
    Object.values(objA || {}).forEach(i => map[i.code] = { ...i, current: i.amount, prev: 0 });
    Object.values(objB || {}).forEach(i => {
        if(!map[i.code]) map[i.code] = { ...i, current: 0, prev: 0 };
        map[i.code].prev = i.amount;
    });
    return Object.values(map).sort((a,b)=>a.code.localeCompare(b.code));
  };

  // Helper Total Section
  const sumSection = (section, snap) => snap ? Object.values(snap[section]).reduce((a,b)=>a+b.amount,0) : 0;

  return {
    assets: mergeBS(snapA?.assets, snapB?.assets),
    liabilities: mergeBS(snapA?.liabilities, snapB?.liabilities),
    equity: mergeBS(snapA?.equity, snapB?.equity),
    currentEarnings: { current: snapA?.earnings||0, prev: snapB?.earnings||0 },
    totalAssets: { current: sumSection('assets', snapA), prev: sumSection('assets', snapB) },
    totalLiabilities: { current: sumSection('liabilities', snapA), prev: sumSection('liabilities', snapB) },
    totalEquity: { current: sumSection('equity', snapA), prev: sumSection('equity', snapB) }
  };
};

export const getMonthlyBalanceSheetTrend = async (userId, year) => {
    // Ambil data sampai akhir tahun (Snapshot)
    const data = await fetchJournals(userId, null, `${year}-12-31`, true);
    
    // Helper Flatten
    const transactions = data.map(row => ({
        code: row.chart_of_accounts.code,
        name: row.chart_of_accounts.name,
        type: row.chart_of_accounts.type,
        netDebit: row.debit - row.credit,
        netCredit: row.credit - row.debit,
        date: row.journal_headers.transaction_date
    }));

    const report = {
        assets: [], liabilities: [], equity: [], currentEarnings: Array(12).fill(0),
        totals: { assets: Array(12).fill(0), liabilities: Array(12).fill(0), equity: Array(12).fill(0) }
    };

    const accountMap = {};

    // Loop 12 Bulan (Snapshot per Akhir Bulan)
    for (let m = 0; m < 12; m++) {
        const lastDay = new Date(year, m + 1, 0); 
        const dateStr = `${year}-${String(m+1).padStart(2,'0')}-${String(lastDay.getDate()).padStart(2,'0')}`;

        // Hitung Saldo per tanggal ini
        let monthEarnings = 0;
        transactions.forEach(t => {
            if(t.date > dateStr) return; // Skip masa depan

            if(t.type === 'Revenue') monthEarnings += t.netCredit;
            else if(t.type === 'Expense') monthEarnings -= t.netDebit;
            else {
                if(!accountMap[t.code]) accountMap[t.code] = { code: t.code, name: t.name, type: t.type, months: Array(12).fill(0) };
                
                let val = 0;
                if(t.type === 'Asset') val = t.netDebit;
                else val = t.netCredit; // Liability & Equity

                accountMap[t.code].months[m] += val;
            }
        });
        report.currentEarnings[m] = monthEarnings;
    }

    // Susun Report
    Object.values(accountMap).forEach(item => {
        if(item.type === 'Asset') { report.assets.push(item); item.months.forEach((v,i)=>report.totals.assets[i]+=v); }
        else if(item.type === 'Liability') { report.liabilities.push(item); item.months.forEach((v,i)=>report.totals.liabilities[i]+=v); }
        else if(item.type === 'Equity') { report.equity.push(item); item.months.forEach((v,i)=>report.totals.equity[i]+=v); }
    });

    report.currentEarnings.forEach((v,i)=>report.totals.equity[i]+=v); // Add Earnings to Equity Total

    const sortFunc = (a,b)=>a.code.localeCompare(b.code);
    report.assets.sort(sortFunc); report.liabilities.sort(sortFunc); report.equity.sort(sortFunc);
    
    return report;
};


// ==========================================
// 4. ARUS KAS (CASH FLOW) - FIX ERROR 400 🚀
// ==========================================

// Helper: Hitung Saldo Kas Murni (Filter di JS)
const getCashBalance = async (userId, dateStr) => {
    if (!dateStr) return 0;
    const data = await fetchJournals(userId, null, dateStr, true); // Snapshot
    
    let total = 0;
    data.forEach(row => {
        // FILTER MANUAL AKUN KAS (Kepala 1-1)
        if (row.chart_of_accounts.code.startsWith('1-1')) {
            total += (row.debit - row.credit);
        }
    });
    return total;
};

// Mode Standar
export const getCashFlowReport = async (userId, rangeA, rangeB) => {
    const process = async (start, end) => {
        if (!start || !end) return null;
        
        // 1. Flow Periode Ini
        const data = await fetchJournals(userId, start, end, false);
        const cf = { operating:{in:0,out:0,items:{}}, investing:{in:0,out:0,items:{}}, financing:{in:0,out:0,items:{}}, netChange:0, beginningCash:0, endingCash:0 };

        data.forEach(row => {
            const acc = row.chart_of_accounts;
            if(acc.code.startsWith('1-1')) return; // Skip Kas sendiri

            const netDebit = row.debit - row.credit;
            const addItem = (sec, name, val) => {
                if(!sec.items[name]) sec.items[name] = 0;
                sec.items[name] += val;
                if(val>0) sec.in += val; else sec.out += val;
            };

            if(acc.type === 'Revenue') addItem(cf.operating, acc.name, -netDebit);
            else if(acc.type === 'Expense') addItem(cf.operating, acc.name, -netDebit);
            else if(acc.type === 'Asset') addItem(cf.investing, (netDebit>0?`Pembelian ${acc.name}`:`Penjualan ${acc.name}`), -netDebit);
            else if(acc.type === 'Liability'||acc.type === 'Equity') addItem(cf.financing, (netDebit<0?`Penerimaan ${acc.name}`:`Pembayaran ${acc.name}`), -netDebit);
        });

        cf.netChange = cf.operating.in + cf.operating.out + cf.investing.in + cf.investing.out + cf.financing.in + cf.financing.out;

        // 2. Saldo Awal (H-1 dari Start)
        const d = new Date(start);
        d.setDate(d.getDate() - 1);
        const hMin1 = d.toISOString().split('T')[0];
        
        cf.beginningCash = await getCashBalance(userId, hMin1);
        cf.endingCash = cf.beginningCash + cf.netChange;

        return cf;
    };

    const curr = await process(rangeA.start, rangeA.end);
    const prev = await process(rangeB?.start, rangeB?.end);
    return { current: curr, prev: prev };
};

// Mode Trend 12 Bulan (Estafet)
// Mode Trend 12 Bulan (Estafet dengan Rincian)
export const getMonthlyCashFlowTrend = async (userId, year) => {
    // Struktur Data yang lebih detail
    const report = {
        operating: [], // Array of objects { name: 'Gaji', months: [100, 200...] }
        investing: [],
        financing: [],
        totals: {
            operating: Array(12).fill(0),
            investing: Array(12).fill(0),
            financing: Array(12).fill(0),
            netChange: Array(12).fill(0),
            beginning: Array(12).fill(0),
            ending: Array(12).fill(0)
        }
    };

    // Helper untuk grouping detail per akun
    // Key: Nama Akun -> Value: Array 12 bulan
    const detailsMap = {
        operating: {},
        investing: {},
        financing: {}
    };

    // 1. Ambil Saldo Awal Tahun
    let runningBalance = await getCashBalance(userId, `${year-1}-12-31`);

    // 2. Loop 12 Bulan
    for (let m = 0; m < 12; m++) {
        const start = `${year}-${String(m+1).padStart(2,'0')}-01`;
        const lastDay = new Date(year, m + 1, 0).getDate();
        const end = `${year}-${String(m+1).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;

        // Pakai helper internal yang ringan
        const data = await fetchJournals(userId, start, end, false);
        
        let netChangeMonth = 0;

        data.forEach(row => {
            const acc = row.chart_of_accounts;
            if(acc.code.startsWith('1-1')) return;

            const netDebit = row.debit - row.credit;
            let val = 0;
            let type = '';
            let name = acc.name;

            if (acc.type === 'Revenue') { type='operating'; val = -netDebit; }
            else if (acc.type === 'Expense') { type='operating'; val = -netDebit; }
            else if (acc.type === 'Asset') { 
                type='investing'; 
                val = -netDebit;
                name = val < 0 ? `Pembelian ${acc.name}` : `Penjualan ${acc.name}`;
            }
            else if (acc.type === 'Liability'||acc.type === 'Equity') {
                type='financing';
                val = -netDebit;
                name = val > 0 ? `Penerimaan ${acc.name}` : `Pembayaran ${acc.name}`;
            }

            if (type) {
                // Akumulasi ke Total Kategori
                report.totals[type][m] += val;
                netChangeMonth += val;

                // Akumulasi ke Detail Akun
                if (!detailsMap[type][name]) detailsMap[type][name] = Array(12).fill(0);
                detailsMap[type][name][m] += val;
            }
        });

        // Set Saldo
        report.totals.netChange[m] = netChangeMonth;
        report.totals.beginning[m] = runningBalance;
        
        runningBalance += netChangeMonth;
        report.totals.ending[m] = runningBalance;
    }

    // 3. Convert Map ke Array untuk Report
    const toArray = (map) => Object.entries(map).map(([name, months]) => ({ name, months }));
    
    report.operating = toArray(detailsMap.operating);
    report.investing = toArray(detailsMap.investing);
    report.financing = toArray(detailsMap.financing);

    return report;
};

// --- FUNGSI 6: LAPORAN JURNAL HARIAN (DAILY JOURNAL) ---
export const getDailyJournalReport = async (userId, startDate, endDate, keyword = '', accountId = '') => {
  
  // 1. Query Header & Details (Filter Tanggal & Keyword di DB)
  let query = supabase
    .from('journal_headers')
    .select(`
        id,
        transaction_date,
        reference_no,
        description,
        journal_details (
            id,
            debit,
            credit,
            chart_of_accounts ( id, code, name, type )
        )
    `)
    .eq('user_id', userId)
    .gte('transaction_date', startDate)
    .lte('transaction_date', endDate)
    .order('transaction_date', { ascending: false }); // Terbaru paling atas

  // Filter Keyword (Cari di Deskripsi atau No Referensi)
  if (keyword) {
    query = query.or(`description.ilike.%${keyword}%,reference_no.ilike.%${keyword}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  // 2. Filter Akun (Client Side Filtering)
  // Kalau user pilih filter akun, kita cuma ambil Header yang PUNYA detail akun tsb
  let filteredData = data;
  
  if (accountId) {
      filteredData = data.filter(header => 
          header.journal_details.some(det => det.chart_of_accounts.id === accountId)
      );
  }

  return filteredData;
};

// --- FUNGSI 7: BUKU BESAR (GENERAL LEDGER) ---
export const getAccountLedger = async (userId, accountId, startDate, endDate, keyword = '') => {
  
  // 1. HITUNG SALDO AWAL (Dari awal jaman s/d H-1 Start Date)
  const getBeginningBalance = async () => {
    if (!startDate) return 0;
    const d = new Date(startDate);
    d.setDate(d.getDate() - 1);
    const prevDate = d.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('journal_details')
      .select('debit, credit, journal_headers!inner(transaction_date, user_id)')
      .eq('journal_headers.user_id', userId)
      .eq('account_id', accountId) // Filter spesifik akun
      .lte('journal_headers.transaction_date', prevDate);
    
    if (error || !data) return 0;

    // Hitung akumulasi mentah (Debit - Kredit)
    return data.reduce((sum, row) => sum + (row.debit - row.credit), 0);
  };

  // 2. AMBIL MUTASI TRANSAKSI (Dalam Range)
  let query = supabase
    .from('journal_details')
    .select(`
        id, debit, credit,
        journal_headers!inner (
            id, transaction_date, reference_no, description
        )
    `)
    .eq('journal_headers.user_id', userId)
    .eq('account_id', accountId)
    .gte('journal_headers.transaction_date', startDate)
    .lte('journal_headers.transaction_date', endDate)
    .order('journal_headers(transaction_date)', { ascending: true }); // Urut tanggal lama ke baru

  // Filter Keyword (Optional)
  if (keyword) {
     // Note: Filter keyword di relasi agak tricky di Supabase, 
     // kita filter manual di JS saja biar aman kalau datanya gak jutaan.
  }

  const { data: transactions, error } = await query;
  if (error) throw error;

  // Filter Keyword di JS (Lebih aman)
  let filteredTrx = transactions;
  if (keyword) {
      const lowerKey = keyword.toLowerCase();
      filteredTrx = transactions.filter(t => 
          t.journal_headers.description.toLowerCase().includes(lowerKey) || 
          t.journal_headers.reference_no.toLowerCase().includes(lowerKey)
      );
  }

  // 3. EXECUTE
  const beginningBalanceRaw = await getBeginningBalance();

  return {
      beginningBalance: beginningBalanceRaw,
      transactions: filteredTrx
  };
};