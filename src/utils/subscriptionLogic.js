import { supabase } from '../supabaseClient';

// Simulasi Status User (Nanti ini diambil dari database 'profiles')
// Ubah jadi TRUE untuk test mode Sultan
const IS_PRO_USER = false; 

// Batas Kuota Harian (Free Tier)
const LIMITS = {
  VOICE: 3,
  SCAN: 3,
  ADVISOR: 1
};

export const checkUsageLimit = async (userId, feature) => {
  // 1. Kalau Sultan, bebas lewat!
  if (IS_PRO_USER) return { allowed: true, type: 'PRO' };

  // 2. Tentukan rentang waktu "Hari Ini"
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  // 3. Cek jumlah pemakaian hari ini di database
  // Kita pakai tabel transaction_headers untuk hitung voice/scan
  // (Asumsi: receipt_url mengandung kata kunci 'Voice' atau 'Scan')
  
  let keyword = '';
  let limit = 0;

  if (feature === 'VOICE') {
    keyword = 'Voice';
    limit = LIMITS.VOICE;
  } else if (feature === 'SCAN') {
    keyword = 'Scan';
    limit = LIMITS.SCAN;
  } else if (feature === 'ADVISOR') {
     // Khusus advisor mungkin perlu tabel log terpisah, tapi kita skip dulu logic DB nya
     // Kita anggap user free cuma boleh sekali klik per sesi aja buat demo
     return { allowed: true, type: 'FREE', remaining: 0 }; 
  }

  const { count, error } = await supabase
    .from('transaction_headers')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('date', startOfDay.toISOString())
    .lte('date', endOfDay.toISOString())
    .ilike('receipt_url', `%${keyword}%`); // Cari yg receipt_url isinya "Voice..." atau "Scan..."

  if (error) {
    console.error("Error check limit:", error);
    return { allowed: false, message: "Server Error" };
  }

  // 4. Bandingkan dengan Limit
  if (count >= limit) {
    return { 
      allowed: false, 
      type: 'FREE',
      limit: limit,
      message: `Kuota Harian Habis! Upgrade ke PRO untuk akses tanpa batas.` 
    };
  }

  return { 
    allowed: true, 
    type: 'FREE', 
    remaining: limit - count 
  };
};