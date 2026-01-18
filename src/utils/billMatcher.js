import { supabase } from '../supabaseClient';

export const findMatchingBill = async (userId, transaction) => {
  try {
    // 1. Ambil semua tagihan user
    const { data: bills } = await supabase.from('bills').select('*').eq('user_id', userId);
    
    if (!bills || bills.length === 0) return null;

    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // 2. Filter Tagihan yang BELUM LUNAS bulan ini
    const pendingBills = bills.filter(b => {
        if (b.last_paid_at) {
            const lastPaid = new Date(b.last_paid_at);
            // Kalau sudah bayar bulan ini, skip
            if (lastPaid.getMonth() === currentMonth && lastPaid.getFullYear() === currentYear) {
                return false; 
            }
        }
        return true;
    });

    // 3. SIAPKAN DATA PENCARIAN (GABUNGAN MERCHANT + ITEM)
    // Kita gabung Merchant dan semua Item jadi satu "Kolam Kata"
    let textToSearch = (transaction.merchant || '').toLowerCase();
    
    if (transaction.items && transaction.items.length > 0) {
        transaction.items.forEach(item => {
            textToSearch += ' ' + (item.name || '').toLowerCase();
        });
    }

    // Bersihkan simbol aneh
    textToSearch = textToSearch.replace(/[^\w\s]/gi, ' ').trim(); 
    const searchTokens = textToSearch.split(/\s+/); // Pecah jadi array kata

    console.log("Mencari di:", textToSearch);

    // 4. LOGIC PENCOCOKAN
    let bestMatch = null;
    let highestScore = 0;

    pendingBills.forEach(bill => {
        const billNameClean = bill.name.toLowerCase().replace(/[^\w\s]/gi, '').trim();
        const billTokens = billNameClean.split(/\s+/);

        let matchCount = 0;
        
        // Cek setiap kata di Nama Tagihan, apakah ada di "Kolam Kata" transaksi?
        billTokens.forEach(token => {
            if (searchTokens.includes(token)) {
                matchCount++;
            }
        });

        // Skor = Jumlah kata cocok / Total kata di nama tagihan
        const score = matchCount / billTokens.length;

        // Cek juga containment langsung (untuk jaga-jaga)
        const isContainment = textToSearch.includes(billNameClean);
        const finalScore = isContainment ? 1.0 : score;

        console.log(`Cek Tagihan: "${bill.name}" | Score: ${finalScore}`);

        // Threshold >= 0.4 (Cukup toleran)
        // Contoh: Tagihan "Tagihan Listrik" (2 kata). 
        // Di struk ada kata "Listrik" (1 kata cocok).
        // Skor = 0.5. Lolos!
        if (finalScore >= 0.4 && finalScore > highestScore) {
            highestScore = finalScore;
            bestMatch = bill;
        }
    });

    if (bestMatch) {
        console.log("KETEMU! Cocok dengan:", bestMatch.name);
    }

    return bestMatch; 

  } catch (error) {
    console.error("Error matching bill:", error);
    return null;
  }
};

export const markBillAsPaid = async (billId) => {
    const now = new Date().toISOString();
    const { error } = await supabase.from('bills').update({ last_paid_at: now }).eq('id', billId);
    if (error) throw error;
};