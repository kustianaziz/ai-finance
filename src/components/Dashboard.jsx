import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';
import { supabase } from '../supabaseClient';
import { generateFinancialInsights } from '../utils/aiLogic';
import { 
  Bell, LogOut, ArrowUpRight, ArrowDownLeft, X,
  ScanLine, Mic, BarChart3, Keyboard, 
  Briefcase, Sparkles, ChevronRight, Crown, RefreshCcw,
  BookOpenCheck, ClipboardList, LayoutGrid, 
  Package, Receipt, Calculator, Users, ScrollText, HandCoins, 
  PiggyBank, Target, Landmark, Calendar, TrendingUp, CheckCircle2, Rocket, Lightbulb
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Dashboard() {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  
  // --- STATE ---
  const [profile, setProfile] = useState(() => {
      const saved = localStorage.getItem('user_profile_cache');
      return saved ? JSON.parse(saved) : null;
  });
  
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 });
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(!profile); 
  
  // STATE BARU UNTUK BADGE TAGIHAN
  const [billAlert, setBillAlert] = useState(0);
  
  // --- GLOBAL MODE ---
  const [activeMode, setActiveMode] = useState(() => {
      return localStorage.getItem('app_mode') || 'PERSONAL';
  });

  const [showNotif, setShowNotif] = useState(false); 
  const [showMoreMenu, setShowMoreMenu] = useState(false); 
  const [showUpsell, setShowUpsell] = useState(false); 
  
  const [aiTips, setAiTips] = useState([]);
  const [loadingTips, setLoadingTips] = useState(false);

  // 1. INIT DATA
  useEffect(() => {
    if (user) {
        loadDashboardData();
    }
  }, [user]);

  // 2. SAVE MODE CHANGES
  useEffect(() => {
    localStorage.setItem('app_mode', activeMode);
  }, [activeMode]);

  // --- FUNGSI UTAMA (OPTIMIZED + BILLS CHECK) ---
  const loadDashboardData = async () => {
    try {
        if (!profile) setLoading(true); 

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        // 1. CEK PROFIL (HEMAT REQUEST)
        let currentUserProfile = profile; 

        if (!currentUserProfile) {
            const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            if (data) {
                currentUserProfile = data;
                setProfile(data); 
                localStorage.setItem('user_profile_cache', JSON.stringify(data)); 
                
                const isPersonalGroup = ['personal', 'personal_pro'].includes(data.account_type);
                if (isPersonalGroup) {
                    setActiveMode('PERSONAL');
                    localStorage.setItem('app_mode', 'PERSONAL');
                } else if (!localStorage.getItem('app_mode')) {
                    setActiveMode(data.account_type === 'business' ? 'BUSINESS' : 'ORGANIZATION');
                }
            }
        }

        // 2. FETCH DATA KEUANGAN & TAGIHAN (PARALLEL)
        const [summaryRes, recentRes, billsRes] = await Promise.all([
            // A. Ringkasan Saldo
            supabase.from('transaction_headers')
                .select('type, total_amount')
                .eq('user_id', user.id)
                .gte('date', startOfMonth),

            // B. Transaksi Terakhir
            supabase.from('transaction_headers')
                .select('*')
                .eq('user_id', user.id)
                .order('date', { ascending: false })
                .limit(5),

            // C. Cek Tagihan (NEW)
            supabase.from('bills').select('*').eq('user_id', user.id)
        ]);

        // --- PROCESS SUMMARY ---
        if (summaryRes.data) {
            let inc = 0, exp = 0;
            for (let i = 0; i < summaryRes.data.length; i++) {
                const t = summaryRes.data[i];
                if (t.type === 'income') inc += Number(t.total_amount);
                else exp += Number(t.total_amount);
            }
            setSummary({ income: inc, expense: exp, balance: inc - exp });
        }

        // --- PROCESS RECENT ---
        if (recentRes.data) {
            setTransactions(recentRes.data);
        }

        // --- PROCESS BILL ALERT (NEW LOGIC) ---
        if (billsRes.data) {
            const today = new Date();
            const currentDay = today.getDate();
            const currentMonth = today.getMonth();
            const currentYear = today.getFullYear();

            // Hitung tagihan yang: BELUM LUNAS + (Jatuh tempo < 3 hari atau sudah lewat)
            const alertCount = billsRes.data.filter(bill => {
                let isPaid = false;
                if (bill.last_paid_at) {
                    const paidDate = new Date(bill.last_paid_at);
                    // Cek lunas bulan ini
                    if (paidDate.getMonth() === currentMonth && paidDate.getFullYear() === currentYear) {
                        isPaid = true;
                    }
                }
                
                // Logic H-3 Warning
                const daysUntilDue = bill.due_date - currentDay;
                const isUrgent = daysUntilDue <= 3; // Termasuk yang minus (telat)

                return !isPaid && isUrgent;
            }).length;

            setBillAlert(alertCount);
        }

    } catch (err) {
        console.error("Dashboard Load Error:", err);
    } finally {
        setLoading(false);
    }
  };

  const handleLogout = async () => {
      try {
          localStorage.removeItem('app_mode'); 
          localStorage.removeItem('user_profile_cache');
          await signOut(); 
      } catch (error) {
          console.warn("Logout error ignored:", error);
      } finally {
          navigate('/login');
      }
  };

  const handleSwitchNav = (path, targetMode) => {
      if (targetMode && targetMode !== activeMode) {
          setActiveMode(targetMode);
      }
      setShowMoreMenu(false);
      navigate(path);
  };

  const toggleMode = () => {
    const isPersonalGroup = ['personal', 'personal_pro'].includes(profile?.account_type);
    if (isPersonalGroup) {
        setShowUpsell(true); 
        return;
    }
    const mainMode = profile?.account_type === 'organization' ? 'ORGANIZATION' : 'BUSINESS';
    setActiveMode(activeMode === 'PERSONAL' ? mainMode : 'PERSONAL');
  };

  const getThemeColor = () => {
      if (activeMode === 'BUSINESS') return 'bg-blue-600';
      if (activeMode === 'ORGANIZATION') return 'bg-teal-600';
      return 'bg-indigo-600'; 
  };

  // --- LOGIC AI YANG SUDAH DIPERBAIKI (FILTER BULAN INI) ---
  const handleAiAdvice = async () => {
    setShowNotif(!showNotif);
    
    // Hanya panggil AI jika belum ada tips
    if (!showNotif && aiTips.length === 0) {
        setLoadingTips(true);
        try {
           const now = new Date();
           // Ambil tanggal awal bulan ini (misal: 2026-01-01)
           const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

           // Fetch transaksi HANYA dari awal bulan ini
           const { data: history } = await supabase.from('transaction_headers')
                .select('*')
                .eq('user_id', user.id)
                .gte('date', startOfMonth) // Filter tanggal >= awal bulan
                .order('date', { ascending: false }); // Urutkan terbaru
           
           // Kirim data bulan ini ke AI
           const insights = await generateFinancialInsights(history || []);
           setAiTips(insights.length ? insights : ["Belum cukup data bulan ini. Yuk catat transaksi! 📝"]);
        } catch (e) { 
            console.error("AI Error:", e);
            setAiTips(["AI sedang sibuk. Coba lagi nanti! 😴"]); 
        } finally { 
            setLoadingTips(false); 
        }
    }
  };

  const formatIDR = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

  // UPDATE: MenuCard menerima props badgeCount
  const MenuCard = ({ icon: Icon, label, onClick, colorClass, isLocked = false, isPro = false, badgeCount = 0 }) => (
    <button 
      onClick={isLocked ? () => setShowUpsell(true) : onClick} 
      className={`relative p-3 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-2 transition active:scale-95 hover:shadow-md hover:border-indigo-100 h-[85px] w-full ${isLocked ? 'opacity-60 grayscale' : ''}`}
    >
      {/* BADGE MERAH (NEW) */}
      {badgeCount > 0 && (
          <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white shadow-sm z-10 animate-bounce">
              {badgeCount}
          </div>
      )}

      {isPro && (
          <div className={`absolute top-1 right-1 ${isLocked ? 'text-amber-500' : 'text-blue-500'}`}>
              <Crown size={12} fill="currentColor"/>
          </div>
      )}
      <div className={`p-2 rounded-xl ${colorClass} bg-opacity-10`}>
         <Icon size={20} className={colorClass.replace('bg-', 'text-')} />
      </div>
      <span className="text-[11px] font-bold text-slate-700 text-center leading-tight">{label}</span>
    </button>
  );

  const isBusinessUser = profile?.account_type === 'business';
  const isOrgUser = profile?.account_type === 'organization';
  const isPersonalUser = ['personal', 'personal_pro'].includes(profile?.account_type);

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans pb-28 relative">
      
      {/* HEADER */}
      <div className={`${getThemeColor()} pb-20 pt-8 px-6 rounded-b-[2.5rem] relative overflow-hidden transition-colors duration-500`}>
         <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
         
         <div className="relative z-10 flex justify-between items-start mb-6">
            <div className="flex items-center gap-3">
               <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm border border-white/10">
                  {profile?.account_type === 'business' ? <Briefcase className="text-white" size={24}/> : 
                   profile?.account_type === 'organization' ? <Users className="text-white" size={24}/> : 
                   <Sparkles className="text-white" size={24}/>}
               </div>
               
               <div>
                  <div onClick={toggleMode} className="flex items-center gap-1.5 cursor-pointer group">
                      <p className="text-white/80 text-xs font-medium mb-0.5 group-hover:text-white transition">
                        {activeMode === 'BUSINESS' ? 'Mode Bisnis' : 
                         activeMode === 'ORGANIZATION' ? 'Mode Organisasi' : 'Mode Pribadi'}
                      </p>
                      {!isPersonalUser && (
                          <RefreshCcw size={10} className="text-white/70 group-hover:text-white group-hover:rotate-180 transition-transform duration-500"/>
                      )}
                  </div>
                  <h1 className="text-lg font-bold text-white leading-tight truncate max-w-[200px]">
                     {activeMode === 'PERSONAL' ? profile?.full_name : (profile?.entity_name || profile?.full_name)}
                  </h1>
               </div>
            </div>
            
            <div className="flex gap-3">
               <button onClick={handleAiAdvice} className="relative p-2 bg-white/10 rounded-full text-white hover:bg-white/20 transition">
                  <Bell size={20} />
                  {!showNotif && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white animate-pulse"></span>}
               </button>
               <button onClick={handleLogout} className="p-2 bg-white/10 rounded-full text-red-200 hover:bg-red-500/20 hover:text-red-100 transition">
                  <LogOut size={20} />
               </button>
            </div>
         </div>

         <div className="text-center text-white relative z-10">
            <p className="text-white/80 text-sm mb-1">
                {activeMode === 'PERSONAL' ? 'Dompet Pribadi' : 'Kas Operasional'}
            </p>
            <h2 className="text-4xl font-extrabold tracking-tight mb-2 min-h-[40px]">
               {loading && summary.balance === 0 ? (
                   <span className="animate-pulse opacity-50">...</span> 
               ) : formatIDR(summary.balance)}
            </h2>
            
            {profile?.account_type === 'personal' && (
               <div onClick={() => setShowUpsell(true)} className="inline-flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full text-[10px] font-bold border border-white/30 cursor-pointer hover:bg-white/30 transition">
                  <span>🚀 Upgrade Fitur</span>
                  <ChevronRight size={12}/>
               </div>
            )}
            
            {profile?.account_type === 'personal_pro' && (
               <div className="inline-flex items-center gap-1 bg-amber-400/20 px-3 py-1 rounded-full text-[10px] font-bold border border-amber-400/50 text-amber-100">
                  <Crown size={12} fill="currentColor" className="text-amber-300"/>
                  <span>Personal Pro</span>
               </div>
            )}

            {!isPersonalUser && activeMode === 'PERSONAL' && (
               <div onClick={toggleMode} className="inline-flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full text-[10px] font-bold border border-white/30 cursor-pointer hover:bg-white/30 transition">
                  {/* UPDATE: Icon Dinamis */}
                  {profile?.account_type === 'organization' ? <Users size={12}/> : <Briefcase size={12}/>}
                  <span>{profile?.account_type === 'organization' ? 'Kembali ke Organisasi' : 'Kembali ke Bisnis'}</span>
               </div>
            )}
         </div>
      </div>

      {/* CARD SUMMARY */}
      <div className="px-6 -mt-12 relative z-20">
         <div className="bg-white p-4 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 flex justify-between items-center">
            <div className="flex-1 flex flex-col items-center border-r border-slate-100">
               <div className="flex items-center gap-1 text-green-500 text-xs font-bold mb-1"><ArrowDownLeft size={14}/> Pemasukan</div>
               <span className="font-bold text-slate-800">{formatIDR(summary.income)}</span>
            </div>
            <div className="flex-1 flex flex-col items-center">
               <div className="flex items-center gap-1 text-red-500 text-xs font-bold mb-1"><ArrowUpRight size={14}/> Pengeluaran</div>
               <span className="font-bold text-slate-800">{formatIDR(summary.expense)}</span>
            </div>
         </div>
      </div>

      {/* ZONA INTI */}
      <div className="px-6 mt-8">
         <h3 className="text-slate-900 font-bold text-base mb-3">Aksi Cepat</h3>
         <div className="grid grid-cols-4 gap-3">
            <MenuCard icon={ScanLine} label="Scan" onClick={() => navigate('/scan')} colorClass="bg-indigo-50 text-indigo-600" isPro={isPersonalUser} isLocked={false} />
            <MenuCard icon={Mic} label="Suara" onClick={() => navigate('/voice')} colorClass="bg-purple-50 text-purple-600" isPro={isPersonalUser} isLocked={false} />
            <MenuCard icon={Keyboard} label="Input" onClick={() => navigate('/manual-input')} colorClass="bg-teal-50 text-teal-600"/>
            <MenuCard icon={BarChart3} label="Analisa" onClick={() => navigate('/analytics')} colorClass="bg-blue-50 text-blue-600"/>
         </div>
      </div>

      {/* ZONA SPESIFIK */}
      <div className="px-6 mt-6">
         {activeMode === 'BUSINESS' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-slate-900 font-bold text-base">Menu Bisnis</h3>
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">Juragan</span>
                </div>
                <div className="grid grid-cols-4 gap-3">
                    <MenuCard icon={BookOpenCheck} label="Jurnal" onClick={() => navigate('/journal-process')} colorClass="bg-indigo-50 text-indigo-600"/>
                    <MenuCard icon={ClipboardList} label="Laporan" onClick={() => navigate('/reports-menu')} colorClass="bg-rose-50 text-rose-600"/>
                    <MenuCard icon={Package} label="Stok" onClick={() => navigate('/stock')} colorClass="bg-orange-50 text-orange-600"/>
                    <MenuCard icon={LayoutGrid} label="Lainnya" onClick={() => setShowMoreMenu(true)} colorClass="bg-slate-50 text-slate-600"/>
                </div>
            </motion.div>
         )}

         {activeMode === 'ORGANIZATION' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-slate-900 font-bold text-base">Menu Organisasi</h3>
                    <span className="text-[10px] bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-bold">Admin</span>
                </div>
                <div className="grid grid-cols-4 gap-3">
                    <MenuCard icon={BookOpenCheck} label="Jurnal" onClick={() => navigate('/journal-process')} colorClass="bg-indigo-50 text-indigo-600"/>
                    <MenuCard icon={ClipboardList} label="Laporan" onClick={() => navigate('/reports-menu')} colorClass="bg-rose-50 text-rose-600"/>
                    <MenuCard icon={Users} label="Anggota" onClick={() => navigate('/members')} colorClass="bg-cyan-50 text-cyan-600"/>
                    <MenuCard icon={LayoutGrid} label="Lainnya" onClick={() => setShowMoreMenu(true)} colorClass="bg-slate-50 text-slate-600"/>
                </div>
            </motion.div>
         )}

         {activeMode === 'PERSONAL' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-slate-900 font-bold text-base">Menu Pribadi</h3>
                </div>
                <div className="grid grid-cols-4 gap-3">
                    <MenuCard icon={PiggyBank} label="Budget" onClick={() => navigate('/budget')} colorClass="bg-pink-50 text-pink-600"/>
                    <MenuCard icon={Target} label="Goals" onClick={() => navigate('/goals')} colorClass="bg-emerald-50 text-emerald-600"/>
                    {/* UPDATE: Menu Tagihan dengan Badge */}
                    <MenuCard icon={Landmark} label="Tagihan" onClick={() => navigate('/bills')} colorClass="bg-violet-50 text-violet-600" badgeCount={billAlert}/>
                    <MenuCard icon={LayoutGrid} label="Lainnya" onClick={() => setShowMoreMenu(true)} colorClass="bg-slate-50 text-slate-600"/>
                </div>
            </motion.div>
         )}
      </div>

      {/* TRANSAKSI TERAKHIR */}
      <div className="px-6 mt-8 mb-4">
         <div className="flex justify-between items-center mb-4">
            <h3 className="text-slate-900 font-bold text-base">Riwayat Terbaru</h3>
            <span onClick={() => navigate('/transactions')} className="text-indigo-600 text-xs font-bold cursor-pointer hover:underline">Lihat Semua</span>
         </div>
         <div className="flex flex-col gap-3">
            {loading && transactions.length === 0 ? (
               <div className="space-y-3">
                   {[1,2,3].map(i => <div key={i} className="h-16 bg-slate-100 rounded-2xl animate-pulse"></div>)}
               </div>
            ) : transactions.length === 0 ? (
               <div className="text-center py-8 bg-white rounded-2xl border border-slate-100 border-dashed">
                  <p className="text-4xl mb-2">🍃</p>
                  <p className="text-slate-400 text-sm">Belum ada transaksi.</p>
               </div>
            ) : (
               transactions.map((t, idx) => (
                  <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-50 shadow-sm flex justify-between items-center hover:bg-slate-50 transition">
                     <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-xl ${t.type === 'income' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                           {t.type === 'income' ? <ArrowDownLeft size={18}/> : <ArrowUpRight size={18}/>}
                        </div>
                        <div>
                           <p className="text-sm font-bold text-slate-800 truncate w-32">{t.merchant || 'Transaksi'}</p>
                           <p className="text-xs text-slate-400 capitalize">{t.category}</p>
                        </div>
                     </div>
                     <span className={`font-bold text-sm ${t.type === 'income' ? 'text-green-600' : 'text-slate-800'}`}>
                        {t.type === 'income' ? '+' : '-'} {formatIDR(t.total_amount)}
                     </span>
                  </div>
               ))
            )}
         </div>
      </div>

      {/* === MODAL SMART INSIGHT === */}
      <AnimatePresence>
        {showNotif && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setShowNotif(false)}
          >
            <motion.div 
                initial={{ scale: 0.9, opacity: 0 }} 
                animate={{ scale: 1, opacity: 1 }} 
                exit={{ scale: 0.9, opacity: 0 }} 
                transition={{ type: "spring", damping: 25 }} 
                className="w-full max-w-sm bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-indigo-100"
                onClick={e => e.stopPropagation()} 
            >
                <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl transform translate-x-10 -translate-y-10"></div>
                    <div className="flex justify-between items-center relative z-10">
                        <h3 className="text-white font-bold text-lg flex items-center gap-2">
                            <Sparkles size={20} className="text-yellow-300 fill-yellow-300 animate-pulse"/> 
                            Smart Insight
                        </h3>
                        <button onClick={() => setShowNotif(false)} className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition"><X size={20}/></button>
                    </div>
                    <p className="text-indigo-100 text-xs mt-1">Analisa otomatis kesehatan keuanganmu</p>
                </div>

                <div className="p-5 max-h-[60vh] overflow-y-auto bg-slate-50">
                    {loadingTips ? (
                        <div className="py-8 text-center">
                            <div className="animate-spin w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full mx-auto mb-3"></div>
                            <p className="text-xs text-slate-500 font-medium">Sedang menganalisa data...</p>
                        </div>
                    ) : aiTips.length > 0 ? (
                        <div className="space-y-3">
                            {aiTips.map((tip, i) => (
                                <motion.div 
                                    key={i} 
                                    initial={{ x: 20, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    transition={{ delay: i * 0.1 }}
                                    className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex gap-3"
                                >
                                    <div className="shrink-0 bg-indigo-50 p-2 rounded-xl h-fit text-indigo-600">
                                        <Lightbulb size={20}/>
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-700 leading-relaxed font-medium">{tip}</p>
                                    </div>
                                </motion.div>
                            ))}
                            <div className="text-center pt-2">
                                <p className="text-[10px] text-slate-400">Diperbarui secara real-time oleh AI</p>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <p className="text-4xl mb-2">🍃</p>
                            <p className="text-sm text-slate-500">Belum ada insight baru.</p>
                        </div>
                    )}
                </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL UPSELL */}
      <AnimatePresence>
        {showUpsell && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm" onClick={() => setShowUpsell(false)}>
             <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 overflow-hidden relative" onClick={e => e.stopPropagation()}>
                 <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-b-[50%] scale-150 -translate-y-10 z-0"></div>
                    <div className="relative z-10 flex flex-col items-center text-center mt-4">
                        <div className="w-20 h-20 bg-white rounded-full p-1.5 shadow-xl mb-4 flex items-center justify-center relative">
                            <div className="absolute inset-0 bg-amber-100 rounded-full animate-ping opacity-30"></div>
                            <div className="w-full h-full bg-amber-100 rounded-full flex items-center justify-center text-amber-500 relative z-10">
                                <Crown size={40} fill="currentColor"/>
                            </div>
                        </div>
                        <h2 className="text-2xl font-extrabold text-slate-900 mb-2">Buka Akses Sultan! 👑</h2>
                        <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                            Kelola Bisnis & Organisasi tanpa batas. Fitur profesional untuk level-up usahamu.
                        </p>
                        <div className="w-full bg-slate-50 rounded-xl p-4 mb-6 space-y-3 border border-slate-100 text-left">
                            <div className="flex items-center gap-3 text-sm text-slate-700">
                                <CheckCircle2 size={18} className="text-green-500 shrink-0"/> <span>Manajemen <b>Stok & Gudang</b></span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-slate-700">
                                <CheckCircle2 size={18} className="text-green-500 shrink-0"/> <span>Buat <b>Invoice & Tagihan</b> Otomatis</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-slate-700">
                                <CheckCircle2 size={18} className="text-green-500 shrink-0"/> <span><b>Laporan Keuangan</b> Lengkap (PDF)</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-slate-700">
                                <CheckCircle2 size={18} className="text-green-500 shrink-0"/> <span>Kelola <b>Karyawan & Anggota</b></span>
                            </div>
                        </div>
                        <button onClick={() => navigate('/upgrade')} className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:scale-[1.02] transition flex items-center justify-center gap-2 relative overflow-hidden group">
                            <span className="relative flex items-center gap-2">Upgrade Sekarang <Rocket size={18}/></span>
                        </button>
                        <button onClick={() => setShowUpsell(false)} className="mt-4 text-sm font-bold text-slate-400 hover:text-slate-600 transition">Nanti Saja</button>
                    </div>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMoreMenu && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowMoreMenu(false)} className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }} className="fixed bottom-0 left-0 right-0 z-50 w-full md:max-w-[410px] mx-auto h-[85vh] bg-[#F8FAFC] rounded-t-[2rem] shadow-2xl flex flex-col overflow-hidden">
              <div className="px-6 pt-4 pb-4 bg-[#F8FAFC] z-10 shrink-0 border-b border-slate-100/50">
                 <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-6"></div>
                 <div className="flex justify-between items-center px-1">
                    <div>
                        <h3 className="font-extrabold text-xl text-slate-900">Fitur Lainnya</h3>
                        <p className="text-slate-500 text-sm mt-1">
                           Menu Mode {activeMode === 'BUSINESS' ? 'Bisnis' : activeMode === 'ORGANIZATION' ? 'Organisasi' : 'Pribadi'}
                        </p>
                    </div>
                    <button onClick={() => setShowMoreMenu(false)} className="p-2 bg-slate-200 text-slate-600 rounded-full hover:bg-slate-300 transition"><X size={20}/></button>
                 </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 pb-20">
                 <div className="grid grid-cols-3 gap-4">
                    
                    {activeMode === 'BUSINESS' && (
                       <>
                          <MenuCard icon={Receipt} label="Invoice" onClick={() => navigate('/invoice')} colorClass="bg-red-50 text-red-600"/>
                          <MenuCard icon={Calculator} label="Hutang" onClick={() => navigate('/debt')} colorClass="bg-cyan-50 text-cyan-600"/>
                          <MenuCard icon={Users} label="Karyawan" onClick={() => navigate('/employees')} colorClass="bg-emerald-50 text-emerald-600"/>
                          <MenuCard icon={Landmark} label="Pajak" onClick={() => navigate('/tax')} colorClass="bg-violet-50 text-violet-600"/>
                          <MenuCard icon={Package} label="Gudang" onClick={() => navigate('/warehouse')} colorClass="bg-amber-50 text-amber-600"/>
                          <MenuCard icon={Target} label="Target" onClick={() => navigate('/targets')} colorClass="bg-lime-50 text-lime-600"/>

                          <div className="col-span-3 mt-6 mb-2 flex items-center gap-3">
                             <div className="h-px bg-slate-200 flex-1"></div>
                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Menu Mode Pribadi</p>
                             <div className="h-px bg-slate-200 flex-1"></div>
                          </div>
                          <MenuCard icon={PiggyBank} label="Budget" onClick={() => handleSwitchNav('/budget', 'PERSONAL')} colorClass="bg-pink-50 text-pink-600"/>
                          <MenuCard icon={Target} label="Goals" onClick={() => handleSwitchNav('/goals', 'PERSONAL')} colorClass="bg-emerald-50 text-emerald-600"/>
                          
                          {/* UPDATE: Tagihan di Menu Lainnya */}
                          <MenuCard icon={Landmark} label="Tagihan" onClick={() => handleSwitchNav('/bills', 'PERSONAL')} colorClass="bg-violet-50 text-violet-600" badgeCount={billAlert}/>
                          
                          <MenuCard icon={TrendingUp} label="Investasi" onClick={() => handleSwitchNav('/invest', 'PERSONAL')} colorClass="bg-emerald-50 text-emerald-600"/>
                          <MenuCard icon={Calendar} label="Event" onClick={() => handleSwitchNav('/events', 'PERSONAL')} colorClass="bg-purple-50 text-purple-600"/>
                       </>
                    )}

                    {activeMode === 'ORGANIZATION' && (
                       <>
                          <MenuCard icon={HandCoins} label="Iuran" onClick={() => navigate('/dues')} colorClass="bg-pink-50 text-pink-600"/>
                          <MenuCard icon={ScrollText} label="Proposal" onClick={() => navigate('/proposals')} colorClass="bg-yellow-50 text-yellow-600"/>
                          <MenuCard icon={Target} label="Program" onClick={() => navigate('/programs')} colorClass="bg-lime-50 text-lime-600"/>
                          <MenuCard icon={Package} label="Aset" onClick={() => navigate('/inventory')} colorClass="bg-orange-50 text-orange-600"/>

                          <div className="col-span-3 mt-6 mb-2 flex items-center gap-3">
                             <div className="h-px bg-slate-200 flex-1"></div>
                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Menu Mode Pribadi</p>
                             <div className="h-px bg-slate-200 flex-1"></div>
                          </div>
                          <MenuCard icon={PiggyBank} label="Budget" onClick={() => handleSwitchNav('/budget', 'PERSONAL')} colorClass="bg-pink-50 text-pink-600"/>
                          <MenuCard icon={Target} label="Goals" onClick={() => handleSwitchNav('/goals', 'PERSONAL')} colorClass="bg-emerald-50 text-emerald-600"/>
                          
                          {/* UPDATE: Tagihan di Menu Lainnya */}
                          <MenuCard icon={Landmark} label="Tagihan" onClick={() => handleSwitchNav('/bills', 'PERSONAL')} colorClass="bg-violet-50 text-violet-600" badgeCount={billAlert}/>
                          
                          <MenuCard icon={TrendingUp} label="Investasi" onClick={() => handleSwitchNav('/invest', 'PERSONAL')} colorClass="bg-emerald-50 text-emerald-600"/>
                          <MenuCard icon={Calendar} label="Event" onClick={() => handleSwitchNav('/events', 'PERSONAL')} colorClass="bg-purple-50 text-purple-600"/>
                       </>
                    )}

                    {activeMode === 'PERSONAL' && (
                       <>
                          <MenuCard icon={Landmark} label="Tagihan" onClick={() => navigate('/bills')} colorClass="bg-violet-50 text-violet-600" badgeCount={billAlert}/>
                          <MenuCard icon={TrendingUp} label="Investasi" onClick={() => navigate('/invest')} colorClass="bg-emerald-50 text-emerald-600"/>
                          <MenuCard icon={Calendar} label="Event" onClick={() => navigate('/events')} colorClass="bg-purple-50 text-purple-600"/>
                          
                          {!isPersonalUser && (
                              <>
                                <div className="col-span-3 mt-6 mb-2 flex items-center gap-3">
                                    <div className="h-px bg-slate-200 flex-1"></div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        Menu Mode {isOrgUser ? 'Organisasi' : 'Bisnis'}
                                    </p>
                                    <div className="h-px bg-slate-200 flex-1"></div>
                                </div>
                                {isBusinessUser ? (
                                    <>
                                        <MenuCard icon={Receipt} label="Invoice" onClick={() => handleSwitchNav('/invoice', 'BUSINESS')} colorClass="bg-red-50 text-red-600"/>
                                        <MenuCard icon={Package} label="Stok" onClick={() => handleSwitchNav('/stock', 'BUSINESS')} colorClass="bg-orange-50 text-orange-600"/>
                                        <MenuCard icon={BookOpenCheck} label="Jurnal" onClick={() => handleSwitchNav('/journal-process', 'BUSINESS')} colorClass="bg-indigo-50 text-indigo-600"/>
                                        <MenuCard icon={Users} label="Karyawan" onClick={() => handleSwitchNav('/employees', 'BUSINESS')} colorClass="bg-emerald-50 text-emerald-600"/>
                                        <MenuCard icon={ClipboardList} label="Laporan" onClick={() => handleSwitchNav('/reports-menu', 'BUSINESS')} colorClass="bg-rose-50 text-rose-600"/>
                                    </>
                                ) : (
                                    <>
                                        <MenuCard icon={HandCoins} label="Iuran" onClick={() => handleSwitchNav('/dues', 'ORGANIZATION')} colorClass="bg-pink-50 text-pink-600"/>
                                        <MenuCard icon={Users} label="Anggota" onClick={() => handleSwitchNav('/members', 'ORGANIZATION')} colorClass="bg-cyan-50 text-cyan-600"/>
                                        <MenuCard icon={BookOpenCheck} label="Jurnal" onClick={() => handleSwitchNav('/journal-process', 'ORGANIZATION')} colorClass="bg-indigo-50 text-indigo-600"/>
                                        <MenuCard icon={ClipboardList} label="Laporan" onClick={() => handleSwitchNav('/reports-menu', 'ORGANIZATION')} colorClass="bg-rose-50 text-rose-600"/>
                                    </>
                                )}
                              </>
                          )}

                          {isPersonalUser && (
                              <>
                                <div className="col-span-3 mt-6 mb-2 flex items-center gap-3">
                                    <div className="h-px bg-slate-200 flex-1"></div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fitur Bisnis (Pro)</p>
                                    <div className="h-px bg-slate-200 flex-1"></div>
                                </div>
                                <MenuCard icon={Package} label="Stok" isLocked={true} isPro={true} colorClass="bg-slate-50 text-slate-400"/>
                                <MenuCard icon={Receipt} label="Invoice" isLocked={true} isPro={true} colorClass="bg-slate-50 text-slate-400"/>
                                <MenuCard icon={BookOpenCheck} label="Jurnal" isLocked={true} isPro={true} colorClass="bg-slate-50 text-slate-400"/>
                                <MenuCard icon={ClipboardList} label="Laporan" isLocked={true} isPro={true} colorClass="bg-slate-50 text-slate-400"/>
                                <MenuCard icon={Users} label="Karyawan" isLocked={true} isPro={true} colorClass="bg-slate-50 text-slate-400"/>

                                <div className="col-span-3 mt-6 mb-2 flex items-center gap-3">
                                    <div className="h-px bg-slate-200 flex-1"></div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fitur Organisasi (Pro)</p>
                                    <div className="h-px bg-slate-200 flex-1"></div>
                                </div>
                                <MenuCard icon={HandCoins} label="Iuran" isLocked={true} isPro={true} colorClass="bg-slate-50 text-slate-400"/>
                                <MenuCard icon={ScrollText} label="Proposal" isLocked={true} isPro={true} colorClass="bg-slate-50 text-slate-400"/>
                                <MenuCard icon={Target} label="Program" isLocked={true} isPro={true} colorClass="bg-slate-50 text-slate-400"/>
                                <MenuCard icon={Package} label="Aset" isLocked={true} isPro={true} colorClass="bg-slate-50 text-slate-400"/>
                                <MenuCard icon={Users} label="Anggota" isLocked={true} isPro={true} colorClass="bg-slate-50 text-slate-400"/>
                              </>
                          )}
                       </>
                    )}
                 </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}