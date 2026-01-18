import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthProvider';
import { 
  ArrowLeft, Plus, Copy, ChevronLeft, ChevronRight, 
  Trash2, AlertCircle, X, CheckCircle2, HelpCircle, RefreshCcw,
  Wallet, TrendingUp, TrendingDown, Clock, Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function BudgetPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // --- STATE ---
  const [currentDate, setCurrentDate] = useState(new Date()); 
  const [budgets, setBudgets] = useState([]);
  
  // State Detail View
  const [selectedBudget, setSelectedBudget] = useState(null); 
  const [relatedTransactions, setRelatedTransactions] = useState([]); 
  const [loadingDetail, setLoadingDetail] = useState(false);

  // State Summary
  const [totalSummary, setTotalSummary] = useState({ limit: 0, used: 0 });

  // State Loading
  const [loadingBudgets, setLoadingBudgets] = useState(true);
  const [loadingSync, setLoadingSync] = useState(false); 

  // Modal & Notif
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ category: '', amount: '', details: [] });
  const [notif, setNotif] = useState({ show: false, type: 'info', title: '', message: '', onConfirm: null });
  
  // --- FORMATTER ---
  const formatIDR = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  const getMonthYear = (date) => date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  const getPeriodDate = (date) => new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
  
  // 1. Load Budget
  useEffect(() => {
    if (user) fetchBudgetsAndSavedData();
  }, [user, currentDate]);

  const fetchBudgetsAndSavedData = async () => {
    try {
      setLoadingBudgets(true);
      const period = getPeriodDate(currentDate);
      
      const { data } = await supabase
        .from('budgets')
        .select('*')
        .eq('user_id', user.id)
        .eq('month_period', period)
        .order('amount_limit', { ascending: false });

      const budgetList = data || [];
      setBudgets(budgetList);

      const totalLimit = budgetList.reduce((acc, curr) => acc + Number(curr.amount_limit), 0);
      const totalUsed = budgetList.reduce((acc, curr) => acc + (Number(curr.current_usage) || 0), 0);
      
      setTotalSummary({ limit: totalLimit, used: totalUsed });

    } catch (error) {
      console.error("Error fetching budget:", error);
    } finally {
      setLoadingBudgets(false);
    }
  };

  // --- LOGIC SYNC & SAVE (UDPATED: EXACT MATCH) ---
  const syncRealization = async () => {
    if (budgets.length === 0) return;

    try {
      setLoadingSync(true);
      const period = getPeriodDate(currentDate);
      const startOfMonth = period;
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString().split('T')[0];

      // 1. Ambil Transaksi Real (Expense Only)
      const { data: transData, error: transError } = await supabase
        .from('transaction_headers')
        .select('total_amount, category') 
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .gte('date', startOfMonth)
        .lte('date', endOfMonth);

      if (transError) throw transError;

      // 2. Logic Pencocokan (EXACT MATCHING - No Synonyms)
      // Karena input AI sudah distandarisasi ke kategori baku/user
      const updates = {}; 
      budgets.forEach(b => updates[b.id] = 0); // Init 0

      if (transData) {
        transData.forEach(t => {
            const transCat = (t.category || '').toLowerCase().trim();

            // Cari budget yang namanya SAMA PERSIS (case-insensitive)
            const match = budgets.find(b => b.category.toLowerCase().trim() === transCat);

            if (match) {
                const amount = Number(t.total_amount) || 0;
                updates[match.id] += amount;
            }
        });
      }

      // 3. Update DB
      const now = new Date().toISOString();
      const updatePromises = budgets.map(b => {
          const safeUsage = updates[b.id] || 0;
          return supabase.from('budgets')
            .update({ current_usage: safeUsage, last_calculated_at: now })
            .eq('id', b.id);
      });

      await Promise.all(updatePromises);

      // 4. Refresh State
      await fetchBudgetsAndSavedData();
      
    } catch (error) {
      console.error("Sync error:", error); 
      showAlert('error', 'Gagal', 'Gagal sinkronisasi: ' + error.message);
    } finally {
      setLoadingSync(false);
    }
  };

  // --- LOGIC DETAIL TRANSAKSI (DRILL DOWN) ---
  const handleBudgetClick = async (budget) => {
      setSelectedBudget(budget);
      setLoadingDetail(true);
      
      try {
        const period = getPeriodDate(currentDate);
        const startOfMonth = period;
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString().split('T')[0];

        const { data } = await supabase
            .from('transaction_headers')
            .select('*') 
            .eq('user_id', user.id)
            .eq('type', 'expense')
            .gte('date', startOfMonth)
            .lte('date', endOfMonth)
            .order('date', { ascending: false });

        // Filter EXACT MATCH juga untuk tampilan detail
        const targetCategory = budget.category.toLowerCase().trim();
        
        const filtered = (data || []).filter(t => {
            const transCat = (t.category || '').toLowerCase().trim();
            return transCat === targetCategory;
        });

        setRelatedTransactions(filtered);

      } catch (e) {
          console.error(e);
      } finally {
          setLoadingDetail(false);
      }
  };

  // --- HELPER LAINNYA ---
  const showAlert = (type, title, message) => setNotif({ show: true, type, title, message, onConfirm: null });
  const closeNotif = () => setNotif({ ...notif, show: false });
  const changeMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const handleSaveBudget = async () => { 
    try {
        if (!formData.category || !formData.amount) { showAlert('error', 'Eits!', 'Data belum lengkap.'); return; }
        const period = getPeriodDate(currentDate);
        // Simpan kategori dengan format Title Case agar rapi dan konsisten
        const cleanCategory = formData.category.trim().charAt(0).toUpperCase() + formData.category.trim().slice(1).toLowerCase();
        
        const payload = { user_id: user.id, category: cleanCategory, amount_limit: formData.amount, month_period: period, details: formData.details };
        const { error } = await supabase.from('budgets').upsert(payload, { onConflict: 'user_id, category, month_period' });
        if (error) throw error;
        setShowModal(false); setFormData({ category: '', amount: '', details: [] }); fetchBudgetsAndSavedData(); showAlert('success', 'Berhasil!', 'Budget tersimpan.');
    } catch (e) { showAlert('error', 'Gagal', e.message); }
  };

  const checkPrevMonthData = async () => { 
    setLoadingBudgets(true);
    try {
      const prevDate = new Date(currentDate); prevDate.setMonth(prevDate.getMonth() - 1); const prevPeriod = getPeriodDate(prevDate);
      const { data: prevData } = await supabase.from('budgets').select('*').eq('user_id', user.id).eq('month_period', prevPeriod);
      if (!prevData || prevData.length === 0) { showAlert('info', 'Data Kosong', 'Tidak ada budget bulan lalu.'); } 
      else { setNotif({ show: true, type: 'confirm', title: 'Salin Budget?', message: `Salin ${prevData.length} budget?`, onConfirm: () => executeCopy(prevData) }); }
    } catch (e) { showAlert('error', 'Error', e.message); } finally { setLoadingBudgets(false); }
  };

  const executeCopy = async (prevData) => { 
    try {
        const period = getPeriodDate(currentDate);
        const newBudgets = prevData.map(b => ({ user_id: user.id, category: b.category, amount_limit: b.amount_limit, details: b.details, month_period: period }));
        await supabase.from('budgets').insert(newBudgets); closeNotif(); fetchBudgetsAndSavedData();
    } catch (e) { showAlert('error', 'Gagal', e.message); }
  };

  const confirmDelete = (e, id) => {
      e.stopPropagation(); 
      setNotif({ show: true, type: 'confirm', title: 'Hapus?', message: 'Hapus budget ini?', onConfirm: () => executeDelete(id) });
  };
  const executeDelete = async (id) => {
      await supabase.from('budgets').delete().eq('id', id); closeNotif(); fetchBudgetsAndSavedData();
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-24">
      {/* HEADER */}
      <div className="bg-white p-4 sticky top-0 z-10 border-b border-slate-100 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')} className="p-2 rounded-full hover:bg-slate-100"><ArrowLeft size={20}/></button>
            <div>
                <h1 className="font-bold text-lg text-slate-800 leading-none">Budgeting</h1>
                <p className="text-[10px] text-slate-400 mt-1">
                    {budgets[0]?.last_calculated_at 
                        ? `Update: ${new Date(budgets[0].last_calculated_at).toLocaleString('id-ID', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'})}`
                        : 'Belum disinkron'}
                </p>
            </div>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={syncRealization} 
                disabled={loadingSync || budgets.length === 0}
                className={`p-2 rounded-full border transition flex items-center gap-2 ${loadingSync ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-white text-indigo-600 border-indigo-100 hover:bg-indigo-50'}`}
            >
                <RefreshCcw size={20} className={loadingSync ? "animate-spin" : ""}/>
            </button>
            <button onClick={() => setShowModal(true)} className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 shadow-lg transition">
                <Plus size={20}/>
            </button>
        </div>
      </div>

      {/* MONTH NAVIGATOR */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-100">
         <button onClick={() => changeMonth(-1)} className="p-2 text-slate-400 hover:text-indigo-600"><ChevronLeft/></button>
         <span className="font-bold text-slate-700 text-lg">{getMonthYear(currentDate)}</span>
         <button onClick={() => changeMonth(1)} className="p-2 text-slate-400 hover:text-indigo-600"><ChevronRight/></button>
      </div>

      <div className="p-4 space-y-6">
        {/* SUMMARY CARD */}
        {budgets.length > 0 && (
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white opacity-10 rounded-full blur-2xl transform translate-x-10 -translate-y-10"></div>
                <div className="flex justify-between items-start mb-4 relative z-10">
                    <div>
                        <p className="text-indigo-100 text-xs font-medium mb-1">Total Anggaran</p>
                        <h2 className="text-2xl font-extrabold">{formatIDR(totalSummary.limit)}</h2>
                    </div>
                    <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm"><Wallet size={20} className="text-white"/></div>
                </div>
                <div className="grid grid-cols-2 gap-4 relative z-10">
                    <div className="bg-black/20 rounded-xl p-3 backdrop-blur-sm">
                        <div className="flex items-center gap-1 text-red-200 text-[10px] font-bold mb-1"><TrendingUp size={12}/> Terpakai</div>
                        <p className="font-bold text-sm">{formatIDR(totalSummary.used)}</p>
                    </div>
                    <div className="bg-white/20 rounded-xl p-3 backdrop-blur-sm">
                        <div className="flex items-center gap-1 text-green-200 text-[10px] font-bold mb-1"><TrendingDown size={12}/> Sisa</div>
                        <p className="font-bold text-sm">{formatIDR(totalSummary.limit - totalSummary.used)}</p>
                    </div>
                </div>
            </div>
        )}

        {/* COPY PROMPT & LOADING */}
        {loadingBudgets && <div className="space-y-3 p-2">{[1,2,3].map(i => <div key={i} className="h-24 bg-slate-200 rounded-2xl animate-pulse"></div>)}</div>}
        
        {budgets.length === 0 && !loadingBudgets && (
            <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} className="bg-indigo-50 border border-indigo-100 p-6 rounded-2xl text-center">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm text-indigo-600"><Copy size={24}/></div>
                <h3 className="font-bold text-slate-800">Mulai Budget Baru</h3>
                <p className="text-sm text-slate-500 mb-4">Salin setup dari bulan lalu atau buat baru?</p>
                <button onClick={checkPrevMonthData} className="bg-indigo-600 text-white px-6 py-2 rounded-full font-bold text-sm hover:bg-indigo-700 transition">Cek & Salin Budget Lama</button>
            </motion.div>
        )}

        {/* LIST BUDGET CARDS */}
        {budgets.map(b => {
            const limit = b.amount_limit;
            const used = b.current_usage || 0; 
            const percent = Math.min((used / limit) * 100, 100);
            
            let color = "bg-green-500";
            if (percent > 100) color = "bg-black"; 
            else if (percent > 80) color = "bg-red-500";
            else if (percent > 50) color = "bg-yellow-500";

            return (
                <motion.div 
                    key={b.id} layout initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}} whileTap={{scale:0.98}}
                    onClick={() => handleBudgetClick(b)} 
                    className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 cursor-pointer hover:shadow-md transition relative overflow-hidden"
                >
                    <div className="absolute bottom-0 left-0 h-1 bg-slate-100 w-full">
                        <div style={{width: `${percent}%`}} className={`h-full ${color}`}></div>
                    </div>

                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                {b.category}
                                <ChevronRight size={14} className="text-slate-300"/>
                            </h3>
                            {b.details && b.details.length > 0 && (
                                <p className="text-xs text-slate-400 truncate max-w-[200px]">{b.details.map(d => d.name).join(', ')}</p>
                            )}
                        </div>
                        <button onClick={(e) => confirmDelete(e, b.id)} className="text-slate-300 hover:text-red-500 p-1"><Trash2 size={16}/></button>
                    </div>

                    <div className="flex justify-between items-end mb-1 mt-4">
                        <span className={`text-sm font-bold ${used > limit ? 'text-red-600' : 'text-slate-600'}`}>{formatIDR(used)}</span>
                        <span className="text-xs text-slate-400">dari {formatIDR(limit)}</span>
                    </div>
                    
                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden relative">
                        <motion.div initial={{width: 0}} animate={{width: `${percent}%`}} className={`h-full rounded-full ${color}`}/>
                    </div>

                    <div className="mt-2 text-right">
                        {used > limit ? (
                            <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded-md inline-flex items-center gap-1"><AlertCircle size={10}/> Over {formatIDR(used - limit)}</span>
                        ) : (
                            <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-md">Sisa {formatIDR(limit - used)}</span>
                        )}
                    </div>
                </motion.div>
            );
        })}
      </div>

      {/* === MODAL DETAIL TRANSAKSI === */}
      <AnimatePresence>
        {selectedBudget && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={() => setSelectedBudget(null)}>
                <motion.div initial={{y: "100%"}} animate={{y: 0}} exit={{y: "100%"}} className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-4 shrink-0">
                        <div><h3 className="font-bold text-lg text-slate-900">Riwayat {selectedBudget.category}</h3><p className="text-xs text-slate-500">Transaksi yang masuk ke budget ini</p></div>
                        <button onClick={() => setSelectedBudget(null)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition"><X size={20}/></button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                        {loadingDetail ? (
                            <div className="text-center py-10 text-slate-400 animate-pulse"><p className="mb-2">⏳</p> Memuat data transaksi...</div>
                        ) : relatedTransactions.length === 0 ? (
                            <div className="text-center py-10 text-slate-400 flex flex-col items-center"><Search size={32} className="mb-2 opacity-50"/><p>Belum ada transaksi yang cocok.</p><p className="text-[10px] mt-1">Coba sinkronisasi data lagi.</p></div>
                        ) : (
                            relatedTransactions.map((t, idx) => {
                                const fullDate = new Date(t.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
                                const dayDate = new Date(t.date).getDate();
                                return (
                                    <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-white hover:shadow-sm transition">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-white p-2 w-12 h-12 flex flex-col items-center justify-center rounded-xl border border-slate-200 text-slate-600 shadow-sm shrink-0">
                                                <span className="text-sm font-extrabold leading-none">{dayDate}</span>
                                                <span className="text-[9px] font-medium uppercase mt-0.5">{new Date(t.date).toLocaleDateString('id-ID', { month: 'short' })}</span>
                                            </div>
                                            <div className="flex flex-col gap-0.5">
                                                <p className="text-sm font-bold text-slate-800 line-clamp-1">{t.merchant || 'Transaksi Tanpa Nama'}</p>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-medium capitalize">{t.category}</span>
                                                    <span className="text-[10px] text-slate-400 flex items-center gap-1">• {fullDate}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <span className="text-sm font-bold text-slate-700 whitespace-nowrap">{formatIDR(t.total_amount)}</span>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL INPUT & NOTIF */}
      <AnimatePresence>
        {showModal && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
                <motion.div initial={{y: "100%"}} animate={{y: 0}} exit={{y: "100%"}} className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl">
                    <h3 className="font-bold text-lg mb-4">Buat Budget Baru</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 mb-1 block">Kategori</label>
                            <input list="categoryOptions" type="text" placeholder="Pilih atau ketik baru..." className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-indigo-500 font-bold" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} />
                            <datalist id="categoryOptions">
                                <option value="Makanan" /><option value="Transport" /><option value="Belanja" /><option value="Tagihan" /><option value="Hiburan" /><option value="Kesehatan" />
                            </datalist>
                        </div>
                        <div><label className="text-xs font-bold text-slate-500 mb-1 block">Batas Maksimal (Rp)</label><input type="number" placeholder="0" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-indigo-500 font-bold text-lg" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} /></div>
                        <div><label className="text-xs font-bold text-slate-500 mb-1 block">Detail (Opsional)</label><textarea placeholder="Misal: Makan Siang, Kopi" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-indigo-500 text-sm" onChange={e => setFormData({...formData, details: e.target.value.split(',').map(s => ({ name: s.trim() })).filter(x => x.name)})} /></div>
                        <div className="flex gap-3 pt-2"><button onClick={() => setShowModal(false)} className="flex-1 py-3 text-slate-500 font-bold">Batal</button><button onClick={handleSaveBudget} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg">Simpan</button></div>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {notif.show && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                <motion.div initial={{scale:0.9}} animate={{scale:1}} exit={{scale:0.9}} className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl text-center">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${notif.type === 'success' ? 'bg-green-100 text-green-600' : notif.type === 'error' ? 'bg-red-100 text-red-600' : notif.type === 'confirm' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600'}`}>
                        {notif.type === 'success' ? <CheckCircle2 size={32}/> : notif.type === 'error' ? <AlertCircle size={32}/> : notif.type === 'confirm' ? <HelpCircle size={32}/> : <AlertCircle size={32}/>}
                    </div>
                    <h3 className="text-xl font-extrabold text-slate-900 mb-2">{notif.title}</h3>
                    <p className="text-slate-500 text-sm mb-6 leading-relaxed">{notif.message}</p>
                    <div className="flex gap-3 justify-center">
                        {notif.type === 'confirm' ? (
                            <><button onClick={closeNotif} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200">Batal</button><button onClick={notif.onConfirm} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg">Ya, Lanjut</button></>
                        ) : (
                            <button onClick={closeNotif} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800">Oke, Siap!</button>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}