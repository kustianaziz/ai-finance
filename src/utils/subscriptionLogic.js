import { supabase } from '../supabaseClient';

export const checkUsageLimit = async (userId, featureType) => {
  // 1. CEK SAFETY: Pastikan UserId ada
  if (!userId) {
    console.warn("CheckUsageLimit: User ID kosong");
    return { allowed: false, message: "Data user tidak valid." };
  }

  try {
    // 2. CEK STATUS MEMBER
    // Gunakan nama kolom: 'subscription_status'
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('subscription_status') // <--- SUDAH DIGANTI
      .eq('id', userId)
      .maybeSingle(); 

    if (error) {
      console.error("Error Database Profile:", error);
    }

    // Ambil statusnya, kalau kosong default 'free'
    const userTier = profile?.subscription_status?.toLowerCase() || 'free'; 

    console.log(`Cek Limit User: ${userId} | Status: ${userTier} | Fitur: ${featureType}`);

    // 3. KALAU DIA 'PRO' ATAU 'SULTAN', LANGSUNG LOLOS (UNLIMITED) 🚀
    if (userTier === 'pro' || userTier === 'sultan') {
      return { allowed: true, tier: 'pro' };
    }

    // --- LOGIKA UNTUK USER GRATISAN (FREE) ---
    
    // Batas Harian
    const LIMITS = {
      VOICE: 3, 
      SCAN: 3,
      ADVISOR: 1
    };

    const limit = LIMITS[featureType] || 0;
    const today = new Date().toISOString().split('T')[0]; 
    
    // Hitung pemakaian hari ini
    const { count, error: countError } = await supabase
      .from('transaction_headers')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', `${today}T00:00:00`)
      .lt('created_at', `${today}T23:59:59`)
      .eq('is_ai_generated', true);

    if (countError) {
        console.error("Gagal hitung transaksi:", countError);
        return { allowed: false, message: "Gagal menghitung kuota." };
    }

    console.log(`Pemakaian Hari Ini: ${count} / ${limit}`);

    if (count >= limit) {
      return { 
        allowed: false, 
        message: `Yah, kuota ${featureType} harian habis (${count}/${limit}).\nUpgrade ke PRO biar Unlimited!` 
      };
    }

    return { allowed: true, tier: 'free' };

  } catch (err) {
    console.error("System Error:", err);
    return { allowed: false, message: "Terjadi kesalahan sistem." };
  }
};