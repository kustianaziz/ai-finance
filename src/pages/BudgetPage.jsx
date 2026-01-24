import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthProvider';
import { 
  ArrowLeft, Plus, Copy, ChevronLeft, ChevronRight, 
  Trash2, AlertCircle, X, CheckCircle2, HelpCircle, RefreshCcw,
  Wallet, TrendingUp, TrendingDown, Clock, Search, Edit2, ArrowDownLeft, ArrowUpRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- HELPER INPUT FORMAT RP ---
const NumberInput = ({ value, onChange, placeholder, className }) => {
    const format = (val) => {
        if (!val && val !== 0) return '';
        return new Intl.NumberFormat('id-ID').format(val);
    };
    const handleChange = (e) => {
        const raw = e.target.value.replace(/\D/g, ''); 
        onChange(raw);
    };
    return (
        <input 
            type="text" 
            value={format(value)} 
            onChange={handleChange} 
            placeholder={placeholder} 
            className={className} 
        />
    );
};

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
  const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
  const [formData, setFormData] = useState({ id: null, category: '', amount: '', details: [] });
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

  // --- LOGIC SYNC & SAVE ---
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

      // 2. Logic Pencocokan
      const updates = {}; 
      budgets.forEach(b => updates[b.id] = 0); // Init 0

      if (transData) {
        transData.forEach(t => {
            const transCat = (t.category || '').toLowerCase().trim();
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

  // --- ACTIONS: ADD / EDIT / DELETE ---
  const openAdd = () => {
      setModalMode('add');
      setFormData({ id: null, category: '', amount: '', details: [] });
      setShowModal(true);
  };

  const openEdit = (budget) => {
      setModalMode('edit');
      setFormData({ 
          id: budget.id, 
          category: budget.category, 
          amount: budget.amount_limit, 
          details: budget.details || [] 
      });
      setShowModal(true);
  };

  const handleSaveBudget = async () => { 
    try {
        if (!formData.category || !formData.amount) { showAlert('error', 'Eits!', 'Data belum lengkap.'); return; }
        const period = getPeriodDate(currentDate);
        
        // Format Title Case
        const cleanCategory = formData.category.trim().charAt(0).toUpperCase() + formData.category.trim().slice(1).toLowerCase();
        
        const payload = { 
            user_id: user.id, 
            category: cleanCategory, 
            amount_limit: Number(formData.amount), 
            month_period: period, 
            details: formData.details 
        };

        if (modalMode === 'add') {
            // Cek duplikat manual untuk Insert
            const exists = budgets.find(b => b.category.toLowerCase() === cleanCategory.toLowerCase());
            if (exists) throw new Error("Kategori budget ini sudah ada di bulan ini.");

            const { error } = await supabase.from('budgets').insert(payload);
            if (error) throw error;
        } else {
            // Update
            const { error } = await supabase.from('budgets').update(payload).eq('id', formData.id);
            if (error) throw error;
            
            // Update tampilan detail real-time jika sedang dibuka
            if (selectedBudget && selectedBudget.id === formData.id) {
                setSelectedBudget({ ...selectedBudget, ...payload });
            }
        }

        setShowModal(false); 
        fetchBudgetsAndSavedData(); 
        showAlert('success', 'Berhasil!', modalMode === 'add' ? 'Budget dibuat.' : 'Budget diperbarui.');
    } catch (e) { showAlert('error', 'Gagal', e.message); }
  };

  const requestDelete = (budget) => {
      setNotif({ 
          show: true, 
          type: 'confirm', 
          title: 'Hapus Budget?', 
          message: `Budget "${budget.category}" akan dihapus.`, 
          onConfirm: () => executeDelete(budget.id) 
      });
  };

  const executeDelete = async (id) => {
      await supabase.from('budgets').delete().eq('id', id); 
      closeNotif(); 
      setSelectedBudget(null); // Tutup detail view
      fetchBudgetsAndSavedData();
  };

  // --- HELPER LAINNYA ---
  const showAlert = (type, title, message) => setNotif({ show: true, type, title, message, onConfirm: null });
  const closeNotif = () => setNotif({ ...notif, show: false });
  const changeMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
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
            <button onClick={openAdd} className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 shadow-lg transition">
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
                        {/* Tombol Hapus Pindah ke Dalam Detail View, disini view only atau quick action */}
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

      {/* === FULL PAGE DETAIL (SLIDE FROM RIGHT) === */}
      <AnimatePresence>
        {selectedBudget && (
            <motion.div 
                initial={{ x: "100%" }} 
                animate={{ x: 0 }} 
                exit={{ x: "100%" }} 
                transition={{ type: "spring", damping: 25, stiffness: 200 }} 
                className="fixed inset-0 z-50 bg-slate-50 flex flex-col h-full w-full max-w-[420px] mx-auto"
            >
                {/* Header Detail */}
                <div className="bg-white px-5 pt-5 pb-3 shadow-sm z-10 shrink-0 border-b border-slate-100">
                    <div className="flex items-center gap-3 mb-4">
                        <button onClick={() => setSelectedBudget(null)} className="p-2 -ml-2 rounded-full text-slate-600 hover:bg-slate-100 transition"><ArrowLeft size={24}/></button>
                        <div className="flex-1">
                            <h2 className="font-extrabold text-xl text-slate-900 leading-none">{selectedBudget.category}</h2>
                            <p className="text-xs text-slate-400 mt-1 uppercase font-bold tracking-wider">{getMonthYear(currentDate)}</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => openEdit(selectedBudget)} className="p-2 bg-slate-50 border border-slate-200 text-slate-500 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-100 transition"><Edit2 size={18}/></button>
                            <button onClick={() => requestDelete(selectedBudget)} className="p-2 bg-slate-50 border border-slate-200 text-slate-500 rounded-xl hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition"><Trash2 size={18}/></button>
                        </div>
                    </div>

                    <div className="flex justify-between items-end mb-2">
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Limit Anggaran</p>
                            <h3 className="text-2xl font-black text-slate-800 tracking-tight">{formatIDR(selectedBudget.amount_limit)}</h3>
                        </div>
                        <div className="text-right">
                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Terpakai</p>
                             <h3 className={`text-xl font-bold ${selectedBudget.current_usage > selectedBudget.amount_limit ? 'text-red-600' : 'text-green-600'}`}>{formatIDR(selectedBudget.current_usage)}</h3>
                        </div>
                    </div>
                </div>

                {/* List Transaksi */}
                <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-3 pb-10 custom-scrollbar">
                    <h4 className="font-bold text-sm text-slate-700 mb-2 flex items-center gap-2"><Clock size={16}/> Riwayat Transaksi</h4>
                    
                    {loadingDetail ? (
                        <div className="text-center py-10 text-slate-400 animate-pulse"><p className="mb-2">⏳</p> Memuat data transaksi...</div>
                    ) : relatedTransactions.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 flex flex-col items-center">
                            <Search size={32} className="mb-2 opacity-50"/>
                            <p className="text-sm font-medium">Belum ada transaksi.</p>
                            <p className="text-[10px] mt-1 text-slate-400">Pastikan nama kategori transaksi sama persis dengan budget.</p>
                        </div>
                    ) : (
                        relatedTransactions.map((t, idx) => {
                            const fullDate = new Date(t.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
                            return (
                                <motion.div 
                                    key={idx} 
                                    initial={{opacity:0, y:10}} animate={{opacity:1, y:0}}
                                    className="flex justify-between items-center p-3 bg-white rounded-2xl border border-slate-100 shadow-sm"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 rounded-xl bg-red-50 text-red-600">
                                            <ArrowUpRight size={18}/>
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-slate-800 line-clamp-1">{t.merchant || 'Tanpa Nama'}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold capitalize">{t.category}</span>
                                                <span className="text-[10px] text-slate-400">{fullDate}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <span className="text-sm font-bold text-slate-800">{formatIDR(t.total_amount)}</span>
                                </motion.div>
                            );
                        })
                    )}
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL INPUT ADD / EDIT */}
      <AnimatePresence>
        {showModal && (
            <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <motion.div initial={{y: "100%"}} animate={{y: 0}} exit={{y: "100%"}} className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-lg text-slate-900">{modalMode === 'add' ? 'Buat Budget Baru' : 'Edit Budget'}</h3>
                        <button onClick={() => setShowModal(false)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition"><X size={20}/></button>
                    </div>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 mb-1 block">Kategori</label>
                            <input 
                                list="categoryOptions" 
                                type="text" 
                                placeholder="Pilih atau ketik baru..." 
                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition" 
                                value={formData.category} 
                                onChange={e => setFormData({...formData, category: e.target.value})} 
                            />
                            <datalist id="categoryOptions">
                                <option value="Makanan" /><option value="Transport" /><option value="Belanja" /><option value="Tagihan" /><option value="Hiburan" /><option value="Kesehatan" />
                            </datalist>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 mb-1 block">Batas Maksimal (Rp)</label>
                            <NumberInput 
                                value={formData.amount} 
                                onChange={(val) => setFormData({...formData, amount: val})} 
                                placeholder="0" 
                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-lg outline-none focus:border-indigo-500 focus:bg-white transition" 
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 mb-1 block">Detail (Opsional, pisahkan koma)</label>
                            <textarea 
                                placeholder="Misal: Makan Siang, Kopi, Jajan" 
                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-600 text-sm outline-none focus:border-indigo-500 focus:bg-white transition" 
                                value={formData.details.map(d => d.name).join(', ')}
                                onChange={e => setFormData({...formData, details: e.target.value.split(',').map(s => ({ name: s.trim() })).filter(x => x.name)})} 
                            />
                        </div>
                        
                        <div className="pt-2">
                            <button onClick={handleSaveBudget} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg shadow-lg hover:scale-[1.02] transition active:scale-95">
                                {modalMode === 'add' ? 'Simpan Budget' : 'Update Budget'}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      {/* NOTIFIKASI */}
      <AnimatePresence>
        {notif.show && (
            <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
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
            </div>
        )}
      </AnimatePresence>
    </div>
  );
}