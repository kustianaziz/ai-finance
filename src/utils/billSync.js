import { supabase } from '../supabaseClient';

export const checkAndSyncBill = async (userId, transaction) => {
  try {
    // 1. Cek apakah kategori transaksi berbau tagihan?
    // (Opsional: Kalau mau strict, uncomment baris bawah. Kalau mau fleksibel, biarkan saja)
    // if (!['Tagihan', 'Listrik', 'Air', 'Internet', 'Cicilan'].includes(transaction.category)) return;

    // 2. Ambil daftar tagihan user yang BELUM lunas bulan ini
    const { data: bills } = await supabase.from('bills').select('*').eq('user_id', userId);
    
    if (!bills || bills.length === 0) return null;

    const today = new Date(transaction.date);
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // 3. Logic Pencocokan Pintar
    const matchedBill = bills.find(b => {
        // A. Cek Status Lunas Dulu
        if (b.last_paid_at) {
            const lastPaid = new Date(b.last_paid_at);
            // Kalau sudah bayar bulan/tahun ini, skip
            if (lastPaid.getMonth() === currentMonth && lastPaid.getFullYear() === currentYear) {
                return false; 
            }
        }

        // B. Cek Kesamaan Nama (Case Insensitive)
        // Contoh: Bill="Listrik Rumah" vs Transaksi="Bayar Listrik Rumah Tokopedia" -> MATCH
        // Contoh: Bill="Wifi" vs Transaksi="Indihome" -> NO MATCH (Kecuali user namain bill-nya Indihome)
        const billName = b.name.toLowerCase();
        const transName = (transaction.merchant || '').toLowerCase();
        
        // Cek apakah nama tagihan ada di dalam nama merchant transaksi
        return transName.includes(billName); 
    });

    // 4. Jika Match -> Update Tagihan jadi LUNAS
    if (matchedBill) {
        await supabase.from('bills')
            .update({ last_paid_at: transaction.date })
            .eq('id', matchedBill.id);
            
        return matchedBill.name; // Return nama tagihan yang dilunasi
    }

  } catch (error) {
    console.error("Auto-sync bill error:", error);
  }
  
  return null;
};