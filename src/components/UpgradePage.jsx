import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthProvider';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, X, Crown, Building2, Users, User, 
  ArrowRight, ShieldCheck, Star, PartyPopper 
} from 'lucide-react';

export default function UpgradePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // STATE
  const [currentPlan, setCurrentPlan] = useState('personal'); 
  const [loading, setLoading] = useState(false);
  
  // MODAL STATE
  const [selectedTier, setSelectedTier] = useState(null); 
  const [entityName, setEntityName] = useState(''); 
  
  const [showInputModal, setShowInputModal] = useState(false); // Modal Konfirmasi Bayar
  const [showSuccessModal, setShowSuccessModal] = useState(false); // Modal Sukses Cantik

  // FETCH CURRENT PLAN
  useEffect(() => {
    fetchCurrentPlan();
  }, [user]);

  const fetchCurrentPlan = async () => {
    if (!user) return;
    const { data } = await supabase.from('profiles').select('account_type').eq('id', user.id).single();
    if (data) setCurrentPlan(data.account_type);
  };

  // --- LOGIC PEMBELIAN ---
  const handleSelectPlan = (tier) => {
    if (tier.id === currentPlan) return;

    setSelectedTier(tier);
    setEntityName(''); // Reset input
    setShowInputModal(true); // SELALU BUKA MODAL (Baik Personal Pro maupun Bisnis)
  };

  const processUpgrade = async () => {
    if (!selectedTier) return;
    
    // Validasi Nama (Khusus Bisnis/Org)
    if (selectedTier.id !== 'personal_pro' && !entityName.trim()) {
        alert("Nama Bisnis/Organisasi wajib diisi!");
        return;
    }

    setLoading(true);
    
    // 1. SIMULASI PAYMENT (Delay 2 detik)
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
        // 2. UPDATE DATABASE
        // personal_pro -> Kita simpan sebagai 'personal_pro' agar terdeteksi bedanya dengan 'personal' biasa (free)
        // business -> 'business'
        // organization -> 'organization'

        const dbType = selectedTier.id; // 'personal_pro', 'business', 'organization'

        const updateData = {
            account_type: dbType,
            // Update entity name hanya jika bukan personal_pro
            ...(selectedTier.id !== 'personal_pro' && { entity_name: entityName }) 
        };

        const { error } = await supabase
            .from('profiles')
            .update(updateData)
            .eq('id', user.id);

        if (error) throw error;

        // 3. UPDATE LOCAL STORAGE
        // Mapping untuk Dashboard logic (Dashboard baca 'personal' atau 'personal_pro' sama2 sbg PERSONAL mode)
        const appModeMap = dbType === 'business' ? 'BUSINESS' : dbType === 'organization' ? 'ORGANIZATION' : 'PERSONAL';
        localStorage.setItem('app_mode', appModeMap);
        
        // 4. SUKSES -> TUTUP INPUT MODAL -> BUKA SUCCESS MODAL
        setShowInputModal(false);
        setShowSuccessModal(true);
        
        // Refresh state current plan biar UI update di background
        setCurrentPlan(dbType);

    } catch (error) {
        alert("Gagal upgrade: " + error.message);
        setLoading(false);
    }
  };

  // --- DATA PAKET ---
  const plans = [
    {
        id: 'personal_pro',
        title: 'Personal Pro',
        icon: User,
        price: '19.000',
        color: 'from-pink-500 to-rose-500',
        text: 'text-pink-500',
        desc: 'Bebas limit harian. Catat keuangan pribadi sepuasnya.',
        features: ['Unlimited Scan Struk', 'Unlimited Voice Input', 'Export Laporan PDF', 'Tanpa Iklan']
    },
    {
        id: 'organization',
        title: 'Komunitas / Org',
        icon: Users,
        price: '29.000',
        color: 'from-teal-500 to-emerald-500',
        text: 'text-teal-500',
        desc: 'Transparansi dana untuk Masjid, BEM, RT/RW, & Komunitas.',
        features: ['Semua Fitur Personal Pro', 'Kelola Iuran Anggota', 'Laporan Arus Kas Publik', 'Manajemen Proposal', 'Multi-Admin (Segera)']
    },
    {
        id: 'business',
        title: 'Juragan Bisnis',
        icon: Building2,
        price: '49.000',
        color: 'from-blue-600 to-indigo-600',
        text: 'text-blue-600',
        desc: 'Full power untuk UMKM. Kelola stok, karyawan, dan profit.',
        features: ['Semua Fitur Personal Pro', 'Cetak Invoice & Struk', 'Manajemen Stok Gudang', 'Hitung Gaji Karyawan', 'Laporan Laba Rugi']
    }
  ];

  return (
    <div className="min-h-screen bg-[#0F172A] text-white flex flex-col relative overflow-hidden font-sans">
      
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-indigo-900/50 to-[#0F172A] z-0"></div>
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500 rounded-full blur-[150px] opacity-20"></div>
      <div className="absolute top-40 -left-20 w-72 h-72 bg-pink-500 rounded-full blur-[150px] opacity-10"></div>

      {/* Header */}
      <div className="relative z-10 p-6 flex justify-between items-center">
        <button onClick={() => navigate('/dashboard')} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition">
            <X size={20} />
        </button>
        <div className="flex items-center gap-2 bg-yellow-500/20 px-3 py-1 rounded-full border border-yellow-500/30">
            <Crown size={14} className="text-yellow-400 fill-yellow-400 animate-pulse"/>
            <span className="text-xs font-bold text-yellow-400">Premium Access</span>
        </div>
      </div>

      <div className="relative z-10 px-6 pb-20">
        <div className="text-center mb-10">
            <h1 className="text-3xl font-extrabold mb-3">Upgrade Levelmu 🚀</h1>
            <p className="text-slate-400 text-sm max-w-xs mx-auto leading-relaxed">
                Pilih paket yang cocok buat kebutuhanmu. Bisa ganti kapan saja.
            </p>
        </div>

        {/* --- CARDS CONTAINER --- */}
        <div className="flex flex-col gap-6 max-w-md mx-auto">
            {plans.map((plan) => {
                const isActive = currentPlan === plan.id; // Cek status aktif
                const Icon = plan.icon;

                return (
                    <motion.div 
                        key={plan.id}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className={`relative rounded-3xl p-1 ${isActive ? 'bg-gradient-to-r from-yellow-400 to-orange-500' : 'bg-slate-800/50 border border-slate-700'}`}
                    >
                        {/* Label Active */}
                        {isActive && (
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-400 text-black text-[10px] font-extrabold px-3 py-1 rounded-full shadow-lg flex items-center gap-1 z-20">
                                <CheckCircle2 size={12}/> PAKET SAAT INI
                            </div>
                        )}

                        <div className="bg-[#1E293B] rounded-[1.3rem] p-6 h-full flex flex-col relative">
                            {/* Card Header */}
                            <div className="flex justify-between items-start mb-4">
                                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${plan.color} flex items-center justify-center shadow-lg`}>
                                    <Icon size={24} className="text-white"/>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-slate-400 mb-1">Mulai dari</p>
                                    <div className="flex items-baseline justify-end gap-1">
                                        <span className="text-2xl font-bold">Rp {plan.price}</span>
                                        <span className="text-xs text-slate-500">/bln</span>
                                    </div>
                                </div>
                            </div>

                            {/* Title & Desc */}
                            <h3 className={`text-xl font-bold mb-2 ${plan.text}`}>{plan.title}</h3>
                            <p className="text-sm text-slate-400 mb-6 leading-relaxed min-h-[40px]">
                                {plan.desc}
                            </p>

                            {/* Features */}
                            <ul className="space-y-3 mb-8 flex-1">
                                {plan.features.map((feat, idx) => (
                                    <li key={idx} className="flex items-start gap-3 text-sm text-slate-300">
                                        <CheckCircle2 size={16} className={`shrink-0 mt-0.5 ${plan.text}`}/>
                                        <span>{feat}</span>
                                    </li>
                                ))}
                            </ul>

                            {/* Button */}
                            <button 
                                onClick={() => handleSelectPlan(plan)}
                                disabled={isActive}
                                className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${
                                    isActive 
                                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                    : `bg-gradient-to-r ${plan.color} text-white shadow-lg hover:brightness-110`
                                }`}
                            >
                                {isActive ? 'Sedang Aktif' : 'Pilih Paket Ini'}
                                {!isActive && <ArrowRight size={18}/>}
                            </button>
                        </div>
                    </motion.div>
                );
            })}
        </div>

        {/* Footer Trust */}
        <div className="mt-12 flex flex-col items-center gap-4 text-center">
            <div className="flex items-center gap-2 text-slate-400 text-xs">
                <ShieldCheck size={16} className="text-green-500"/>
                <span>Pembayaran Aman & Terenkripsi</span>
            </div>
            <p className="text-[10px] text-slate-600 max-w-xs">
                Dengan berlangganan, Anda menyetujui Syarat & Ketentuan Rapikus. Langganan diperpanjang otomatis.
            </p>
        </div>
      </div>

      {/* === MODAL INPUT / KONFIRMASI BAYAR (DINAMIS) === */}
      <AnimatePresence>
        {showInputModal && selectedTier && (
            <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
                <motion.div 
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    className="bg-white w-full max-w-md rounded-t-[2rem] md:rounded-[2rem] p-8 pb-10"
                >
                    <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6 md:hidden"></div>
                    
                    {/* Header Modal */}
                    <div className="text-center mb-6">
                        <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${selectedTier.color} flex items-center justify-center mx-auto mb-4 shadow-xl`}>
                            {selectedTier.id === 'personal_pro' ? <User size={32} className="text-white"/> : <Building2 size={32} className="text-white"/>}
                        </div>
                        <h3 className="text-2xl font-extrabold text-slate-900">
                            {selectedTier.id === 'personal_pro' ? 'Konfirmasi Upgrade' : `Setup ${selectedTier.title}`}
                        </h3>
                        <p className="text-slate-500 text-sm mt-1">
                            {selectedTier.id === 'personal_pro' 
                                ? 'Nikmati fitur unlimited sekarang juga!' 
                                : 'Lengkapi data sebelum lanjut pembayaran.'}
                        </p>
                    </div>

                    <div className="space-y-4">
                        {/* INPUT NAMA (HANYA MUNCUL JIKA BUKAN PERSONAL PRO) */}
                        {selectedTier.id !== 'personal_pro' && (
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">
                                    Nama {selectedTier.id === 'business' ? 'Toko / Usaha' : 'Komunitas / Organisasi'}
                                </label>
                                <input 
                                    type="text" 
                                    value={entityName}
                                    onChange={(e) => setEntityName(e.target.value)}
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 font-bold"
                                    placeholder={selectedTier.id === 'business' ? "Contoh: Kopi Kenangan Mantan" : "Contoh: Karang Taruna 01"}
                                    autoFocus
                                />
                            </div>
                        )}

                        {/* Rincian Bayar */}
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex justify-between items-center">
                            <span className="text-sm text-slate-500 font-medium">Total Tagihan</span>
                            <div className="text-right">
                                <span className="block text-lg font-bold text-slate-900">Rp {selectedTier.price}</span>
                                <span className="text-[10px] text-slate-400">/bulan (Bisa cancel kapan aja)</span>
                            </div>
                        </div>

                        <button 
                            onClick={processUpgrade}
                            disabled={loading || (selectedTier.id !== 'personal_pro' && !entityName.trim())}
                            className={`w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg transition flex items-center justify-center gap-2 ${
                                (selectedTier.id !== 'personal_pro' && !entityName.trim()) 
                                ? 'bg-slate-300 cursor-not-allowed' 
                                : `bg-gradient-to-r ${selectedTier.color} hover:scale-[1.02]`
                            }`}
                        >
                            {loading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                                    Memproses...
                                </>
                            ) : (
                                <>Bayar & Aktifkan <Star size={18} fill="currentColor"/></>
                            )}
                        </button>

                        <button onClick={() => setShowInputModal(false)} className="w-full py-3 text-slate-400 font-bold text-sm hover:text-slate-600">
                            Batal
                        </button>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      {/* === MODAL SUKSES (CUSTOM UI) === */}
      <AnimatePresence>
        {showSuccessModal && selectedTier && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4">
                <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-white w-full max-w-sm rounded-3xl p-8 text-center relative overflow-hidden"
                >
                    {/* Confetti Effect Background */}
                    <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/confetti.png')]"></div>

                    <div className="relative z-10 flex flex-col items-center">
                        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 animate-bounce">
                            <PartyPopper size={48} className="text-green-600"/>
                        </div>
                        
                        <h2 className="text-2xl font-extrabold text-slate-900 mb-2">Hore! Berhasil 🎉</h2>
                        <p className="text-slate-500 mb-6 leading-relaxed">
                            Paket <strong>{selectedTier.title}</strong> kamu sudah aktif. Sekarang kamu bisa pakai semua fitur kerennya!
                        </p>

                        <button 
                            onClick={() => navigate('/dashboard')}
                            className="w-full py-3.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition shadow-xl"
                        >
                            Lanjut ke Dashboard
                        </button>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

    </div>
  );
}