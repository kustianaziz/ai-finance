import { supabase } from '../supabaseClient';
import { getOrCreateAccount } from './accountingService';

// --- 1. FETCH SEMUA TRANSAKSI PENDING ---
export const fetchUnpostedTransactions = async (userId, startDate, endDate) => {
  let allTransactions = [];
  const adjustedEndDate = `${endDate}T23:59:59`;

  try {
    // A. KASIR, EXPENSE, & TRANSFER
    const { data: trans, error: transErr } = await supabase
      .from('transaction_headers')
      .select(`
        *, 
        source_wallet:wallets!transaction_headers_wallet_id_fkey(name),
        dest_wallet:wallets!transaction_headers_destination_wallet_id_fkey(name)
      `) 
      .eq('user_id', userId)
      .eq('allocation_type', 'BUSINESS')
      .or('is_journalized.is.null,is_journalized.eq.false')
      .gte('date', startDate)
      .lte('date', adjustedEndDate);

    if (transErr) console.error("Error Fetch Header:", transErr);

    if (trans) {
        allTransactions.push(...trans.map(t => {
            let desc = t.description;
            if (!desc) {
                if (t.type === 'income') {
                    if (t.category === 'Saldo Awal') desc = 'Setoran Modal Awal';
                    else if (t.category === 'Hibah') desc = 'Penerimaan Hibah';
                    else if (t.category === 'Pelunasan Invoice') desc = 'Pelunasan Invoice';
                    else desc = 'Penjualan Kasir';
                } else if (t.type === 'expense') {
                    desc = `Beban ${t.category}`;
                } else if (t.type === 'transfer') {
                    desc = 'Mutasi Saldo';
                }
            }
        let finalType = t.type;
            if (t.category === 'Bayar Hutang') {
                    finalType = 'pay_debt'; // Paksa jadi pay_debt biar masuk switch case yang benar
                } else if (t.category === 'Terima Piutang') {
                    finalType = 'receive_receivable'; // Paksa jadi receive_receivable
            }

            return {
                id: t.id,
                source: 'transaction_headers',
                date: t.date,
                description: desc,
                amount: t.total_amount,
                
                type: finalType,
                
                category: t.category,
                wallet_name: t.source_wallet?.name || 'Kas Besar', 
                dest_wallet_name: t.dest_wallet?.name || 'Kas Kecil', 
                ref: `TRX-${t.id.substr(0,6)}`,
                raw: t
            };
        }));
    }

    // B. [REVISI] INVOICE / PIUTANG (Hanya yang BELUM DIBAYAR)
    // Tujuannya agar tidak double dengan 'income' Pelunasan Invoice di Header
    const { data: inv } = await supabase
      .from('invoices')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'unpaid') // <--- KUNCI: Hanya ambil yang benar-benar piutang murni
      .or('is_journalized.is.null,is_journalized.eq.false')
      .gte('issue_date', startDate)
      .lte('issue_date', adjustedEndDate);

    if (inv) {
        allTransactions.push(...inv.map(i => ({
            id: i.id,
            source: 'invoices',
            date: i.issue_date,
            description: `Invoice #${i.invoice_number} - ${i.customer_name} (Piutang)`,
            amount: i.total_amount,
            type: 'invoice_issued',
            category: 'Penjualan Kredit',
            ref: `INV-${i.invoice_number}`,
            raw: i 
        })));
    }

    // C. INVENTORY
    const { data: stok, error: stokErr } = await supabase
      .from('inventory_transactions')
      .select('*, inventory_items(name), wallets(name)') 
      .in('type', ['in', 'restock', 'purchase', 'stock_in', 'opening_stock'])
      .gt('price_per_unit', 0)
      .or('is_journalized.is.null,is_journalized.eq.false')
      .gte('created_at', startDate)
      .lte('created_at', adjustedEndDate);

    if (stokErr) console.error("Error Fetch Stok:", stokErr);

    if (stok) {
        allTransactions.push(...stok.map(s => {
            const isMasuk = s.change_amount > 0;
            return {
                id: s.id,
                source: 'inventory_transactions',
                date: s.created_at,
                description: `${isMasuk ? 'Masuk' : 'Pakai'} Stok: ${s.inventory_items?.name}`,
                amount: Math.abs(s.change_amount * s.price_per_unit),
                type: isMasuk ? 'stock_in' : 'stock_out',
                category: 'Persediaan',
                wallet_name: s.wallets?.name, 
                ref: `STK-${s.id.substr(0,6)}`,
                raw: s
            };
        }).filter(item => item.amount > 0)); 
    }

    // D. [REVISI TOTAL] HUTANG/PIUTANG MANUAL
const { data: manualDebts } = await supabase
  .from('debts')
  .select('*')
  .eq('user_id', userId)
  // KUNCINYA: Ambil semua yang BELUM DIJURNAL, tidak peduli statusnya sudah dicicil atau belum
  .or('is_journalized.is.null,is_journalized.eq.false') 
  .not('description', 'ilike', 'Invoice %') 
  .gte('created_at', startDate)
  .lte('created_at', adjustedEndDate);

if (manualDebts) {
    allTransactions.push(...manualDebts.map(d => ({
        id: d.id,
        source: 'debts',
        date: d.created_at,
        description: `${d.type === 'payable' ? 'Hutang' : 'Piutang'} Baru: ${d.contact_name}`,
        amount: d.amount, // Tetap ambil Nilai TOTAL Awal
        type: d.type === 'payable' ? 'new_debt' : 'new_receivable',
        category: 'Hutang Piutang',
        ref: `DBT-${d.id.substr(0,6)}`,
        raw: d
    })));
}

    return allTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));

  } catch (err) {
    console.error("Fetch Error GLOBAL:", err);
    return [];
  }
};

// --- 2. PROSES SINGLE TRANSAKSI ---
// --- 2. PROSES SINGLE TRANSAKSI (VERSI FIX BERSIH) ---
export const processSingleTransaction = async (userId, item) => {
  try {
    const details = []; 
    let journalDesc = item.description;

    // 1. Buat Header Jurnal
    const { data: journalHead, error: headErr } = await supabase
        .from('journal_headers')
        .insert({
            user_id: userId,
            transaction_date: item.date,
            description: journalDesc,
            reference_no: item.ref,
            is_posted: true
        })
        .select().single();

    if (headErr) throw headErr;
    const jId = journalHead.id;

    // 2. Logic Mapping Detail
    let debitAccName = '', debitCategory = 'ASSET';
    let creditAccName = '', creditCategory = 'ASSET';

    // === CASE 1: INVOICE ===
    if (item.type === 'invoice_issued') {
        const raw = item.raw;
        const totalAmount = raw.total_amount;
        const tax = raw.tax_amount || 0;
        const discount = raw.discount_amount || 0;
        const revenueAmount = totalAmount - tax + discount; 

        // Dr. Piutang
        details.push({ journal_id: jId, account_id: await getOrCreateAccount(userId, 'Piutang Usaha', 'ASSET'), debit: totalAmount, credit: 0 });
        // Dr. Diskon
        if (discount > 0) details.push({ journal_id: jId, account_id: await getOrCreateAccount(userId, 'Potongan Penjualan', 'EXPENSE'), debit: discount, credit: 0 });
        // Cr. PPN
        if (tax > 0) details.push({ journal_id: jId, account_id: await getOrCreateAccount(userId, 'Hutang Pajak PPN', 'LIABILITY'), debit: 0, credit: tax });
        // Cr. Pendapatan
        details.push({ journal_id: jId, account_id: await getOrCreateAccount(userId, 'Pendapatan Penjualan', 'REVENUE'), debit: 0, credit: revenueAmount });

    } else {
        // === CASE 2: TRANSAKSI LAIN (POS, EXPENSE, TRANSFER) ===
        switch (item.type) {
            case 'income': 
                // --- LOGIC POS (SPLIT JOURNAL) ---
                const incTotal = item.amount;
                const incTax = item.raw.tax_amount || 0;
                const incDisc = item.raw.discount_amount || 0;

                // A. Cek Kategori Khusus
                if (item.category === 'Saldo Awal' || item.category === 'Modal') {
                    details.push({ journal_id: jId, account_id: await getOrCreateAccount(userId, item.wallet_name, 'ASSET'), debit: incTotal, credit: 0 });
                    details.push({ journal_id: jId, account_id: await getOrCreateAccount(userId, 'Modal Disetor', 'EQUITY'), debit: 0, credit: incTotal });
                } 
                else if (item.category === 'Pelunasan Invoice') {
                    details.push({ journal_id: jId, account_id: await getOrCreateAccount(userId, item.wallet_name, 'ASSET'), debit: incTotal, credit: 0 });
                    details.push({ journal_id: jId, account_id: await getOrCreateAccount(userId, 'Piutang Usaha', 'ASSET'), debit: 0, credit: incTotal });
                } 
                else {
                    // B. Penjualan POS Biasa
                    const incRevenue = incTotal - incTax + incDisc;

                    // Dr. Kas/Bank
                    details.push({ journal_id: jId, account_id: await getOrCreateAccount(userId, item.wallet_name, 'ASSET'), debit: incTotal, credit: 0 });
                    // Dr. Diskon
                    if (incDisc > 0) details.push({ journal_id: jId, account_id: await getOrCreateAccount(userId, 'Potongan Penjualan', 'EXPENSE'), debit: incDisc, credit: 0 });
                    // Cr. PPN
                    if (incTax > 0) details.push({ journal_id: jId, account_id: await getOrCreateAccount(userId, 'Hutang Pajak PPN', 'LIABILITY'), debit: 0, credit: incTax });
                    // Cr. Pendapatan
                    details.push({ journal_id: jId, account_id: await getOrCreateAccount(userId, 'Pendapatan Penjualan', 'REVENUE'), debit: 0, credit: incRevenue });
                }
                break;

            case 'expense':
                debitAccName = `Beban ${item.category}`; debitCategory = 'EXPENSE';
                creditAccName = item.wallet_name; creditCategory = 'ASSET';
                break;
            case 'transfer':
                debitAccName = item.dest_wallet_name; debitCategory = 'ASSET';
                creditAccName = item.wallet_name; creditCategory = 'ASSET';
                break;
            case 'stock_in':
                debitAccName = 'Persediaan Bahan Baku'; debitCategory = 'ASSET';
                if (item.raw.type === 'opening_stock') { creditAccName = 'Modal Disetor'; creditCategory = 'EQUITY'; }
                else { creditAccName = item.wallet_name || 'Kas Besar'; creditCategory = 'ASSET'; }
                break;
            case 'stock_out':
                debitAccName = 'Beban Pokok Pendapatan (HPP)'; debitCategory = 'EXPENSE';
                creditAccName = 'Persediaan Bahan Baku'; creditCategory = 'ASSET';
                break;
            case 'pay_debt':
                // Debit: Hutang Dagang (Hutang Lunas)
                debitAccName = 'Hutang Dagang'; // <--- SESUAIKAN
                debitCategory = 'LIABILITY'; 
                creditAccName = item.wallet_name; 
                creditCategory = 'ASSET'; 
                break;
            case 'receive_receivable':
                // Kredit: Piutang Dagang (Piutang Lunas)
                debitAccName = item.wallet_name; 
                debitCategory = 'ASSET'; 
                creditAccName = 'Piutang Dagang'; // <--- SESUAIKAN
                creditCategory = 'ASSET'; 
                break;
            case 'new_debt':
                debitAccName = 'Beban Lain-lain'; // Atau 'Persediaan'
                debitCategory = 'EXPENSE';
                creditAccName = 'Hutang Dagang'; // <--- GANTI JADI INI (Biar jadi anak 2100)
                creditCategory = 'LIABILITY';
                break;

            case 'new_receivable':
                debitAccName = 'Piutang Dagang'; // <--- GANTI JADI INI (Biar jadi anak 1120)
                debitCategory = 'ASSET';
                creditAccName = 'Pendapatan Penjualan'; 
                creditCategory = 'REVENUE';
                break;

            default:
                throw new Error(`Tipe transaksi tidak dikenal: ${item.type}`);
        }

        // --- SIMPLE JOURNAL FALLBACK ---
        // Jalankan hanya jika details masih kosong (artinya bukan 'income' yang sudah di-handle di atas)
        if (details.length === 0) {
             const debitAccId = await getOrCreateAccount(userId, debitAccName, debitCategory);
             const creditAccId = await getOrCreateAccount(userId, creditAccName, creditCategory);
             details.push({ journal_id: jId, account_id: debitAccId, debit: item.amount, credit: 0 });
             details.push({ journal_id: jId, account_id: creditAccId, debit: 0, credit: item.amount });
        }
    }

    // 3. Simpan Detail ke DB
    const { error: detErr } = await supabase.from('journal_details').insert(details);
    if (detErr) throw detErr;

    // 4. Update Status Sumber Data
    await supabase.from(item.source).update({ is_journalized: true }).eq('id', item.id);

    return { success: true };

  } catch (error) {
    console.error("Proses Jurnal Error:", error);
    return { success: false, error: error.message };
  }
};