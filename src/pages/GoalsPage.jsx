import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthProvider';
import { 
  ArrowLeft, Plus, Target, Plane, Car, Home, 
  Smartphone, Gift, TrendingUp, X, CheckCircle2, 
  AlertCircle, Calendar, Wallet, History, Edit2, Trash2,
  ArrowDownLeft, ArrowUpRight
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

export default function GoalsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // --- STATE ---
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // State Modal Add/Edit
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); 
  const [formData, setFormData] = useState({ 
      id: null, name: '', target: '', initial: '', deadline: '', icon: 'Target', color: 'bg-blue-500' 
  });

  // State Detail (Full Page)
  const [selectedGoal, setSelectedGoal] = useState(null);
  
  // State Nabung/Tarik (Inside Detail)
  const [amountInput, setAmountInput] = useState('');
  const [transactionType, setTransactionType] = useState('deposit'); 
  
  // State History & Filter
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [filterType, setFilterType] = useState('ALL'); 
  const [filterDate, setFilterDate] = useState('ALL'); 
  
  const [monthlyRecommendation, setMonthlyRecommendation] = useState(0);
  const [notif, setNotif] = useState({ show: false, type: 'info', title: '', message: '', onConfirm: null });

  // --- ICONS & COLORS ---
  const ICONS = { Target, Plane, Car, Home, Smartphone, Gift, Wallet };
  const COLORS = [
      { bg: 'bg-blue-500', text: 'text-blue-500', border: 'border-blue-500' },
      { bg: 'bg-emerald-500', text: 'text-emerald-500', border: 'border-emerald-500' },
      { bg: 'bg-violet-500', text: 'text-violet-500', border: 'border-violet-500' },
      { bg: 'bg-rose-500', text: 'text-rose-500', border: 'border-rose-500' },
      { bg: 'bg-amber-500', text: 'text-amber-500', border: 'border-amber-500' },
  ];

  const formatIDR = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

  useEffect(() => { if (user) fetchGoals(); }, [user]);

  useEffect(() => { if (selectedGoal) fetchLogs(selectedGoal.id); }, [selectedGoal?.id, filterType, filterDate]);

  // --- FETCH DATA ---
  const fetchGoals = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('goals').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      if (error) throw error;
      setGoals(data || []);
    } catch (error) { console.error("Error goals:", error); } finally { setLoading(false); }
  };

  const fetchLogs = async (goalId) => {
      setLoadingLogs(true);
      try {
          let query = supabase.from('goal_logs').select('*').eq('goal_id', goalId).order('created_at', { ascending: false });

          if (filterType === 'deposit') query = query.gt('amount', 0);
          else if (filterType === 'withdraw') query = query.lt('amount', 0);

          const today = new Date();
          if (filterDate === 'WEEK') {
              const weekAgo = new Date(); weekAgo.setDate(today.getDate() - 7);
              query = query.gte('created_at', weekAgo.toISOString());
          } else if (filterDate === 'MONTH') {
              const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
              query = query.gte('created_at', startOfMonth);
          } else {
              query = query.limit(50);
          }

          const { data, error } = await query;
          if (error) throw error;
          setLogs(data || []);
      } catch (e) { console.error(e); } finally { setLoadingLogs(false); }
  };

  // --- ACTIONS ---
  const handleSaveGoal = async () => {
      try {
          if (!formData.name || !formData.target) return showAlert('error', 'Eits!', 'Nama dan Target wajib diisi.');
          const payload = {
              user_id: user.id, name: formData.name, target_amount: Number(formData.target),
              deadline: formData.deadline || null, icon: formData.icon, color: formData.color
          };

          if (modalMode === 'add') {
              payload.current_amount = Number(formData.initial) || 0;
              const { error } = await supabase.from('goals').insert(payload);
              if (error) throw error;
          } else {
              const { error } = await supabase.from('goals').update(payload).eq('id', formData.id);
              if (error) throw error;
              if (selectedGoal && selectedGoal.id === formData.id) setSelectedGoal({ ...selectedGoal, ...payload });
          }
          setShowModal(false); fetchGoals(); showAlert('success', 'Berhasil!', modalMode === 'add' ? 'Impian dibuat.' : 'Impian diupdate.');
      } catch (e) { showAlert('error', 'Gagal', e.message); }
  };

  const handleTransaction = async () => {
      try {
          const amount = Number(amountInput);
          if (!amount || amount <= 0) return showAlert('error', 'Eits!', 'Masukkan nominal valid.');
          const isDeposit = transactionType === 'deposit';
          const newAmount = isDeposit ? Number(selectedGoal.current_amount) + amount : Number(selectedGoal.current_amount) - amount;
          if (newAmount < 0) return showAlert('error', 'Gagal', 'Saldo impian tidak cukup!');

          const { error: updateError } = await supabase.from('goals').update({ current_amount: newAmount }).eq('id', selectedGoal.id);
          if (updateError) throw updateError;

          const { error: logError } = await supabase.from('goal_logs').insert({
              goal_id: selectedGoal.id, amount: isDeposit ? amount : -amount, note: isDeposit ? 'Tabung Impian' : 'Tarik Saldo'
          });
          if (logError) throw logError;

          setSelectedGoal({ ...selectedGoal, current_amount: newAmount });
          setAmountInput(''); fetchLogs(selectedGoal.id); fetchGoals();
          showAlert('success', 'Sukses!', isDeposit ? 'Tabungan berhasil masuk!' : 'Saldo berhasil ditarik.');
      } catch (e) { showAlert('error', 'Gagal', e.message); }
  };

  const requestDelete = () => { setNotif({ show: true, type: 'confirm', title: 'Hapus Impian?', message: 'Semua saldo dan riwayat di impian ini akan dihapus permanen.', onConfirm: handleDelete }); };
  const handleDelete = async () => { await supabase.from('goals').delete().eq('id', selectedGoal.id); setNotif({ ...notif, show: false }); setSelectedGoal(null); fetchGoals(); };

  // --- UI HELPERS ---
  const openAdd = () => { setModalMode('add'); setFormData({ id: null, name: '', target: '', initial: '', deadline: '', icon: 'Target', color: 'bg-blue-500' }); setShowModal(true); };
  const openEdit = () => { setModalMode('edit'); setFormData({ id: selectedGoal.id, name: selectedGoal.name, target: selectedGoal.target_amount, initial: selectedGoal.current_amount, deadline: selectedGoal.deadline, icon: selectedGoal.icon, color: selectedGoal.color }); setShowModal(true); };
  const openDetail = (goal) => { setSelectedGoal(goal); setTransactionType('deposit'); setFilterType('ALL'); setFilterDate('ALL'); };
  const showAlert = (type, title, message) => setNotif({ show: true, type, title, message, onConfirm: null });
  const closeNotif = () => setNotif({ ...notif, show: false });
  const totalSavings = goals.reduce((acc, curr) => acc + Number(curr.current_amount), 0);

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-24">
      {/* HEADER DASHBOARD */}
      <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-6 pb-20 rounded-b-[2.5rem] shadow-xl relative overflow-hidden">
         <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full blur-3xl transform translate-x-10 -translate-y-10"></div>
         <div className="flex items-center gap-3 mb-6 relative z-10">
            <button onClick={() => navigate('/dashboard')} className="p-2 bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-white/30"><ArrowLeft size={20}/></button>
            <h1 className="text-xl font-bold text-white">Impian & Goals</h1>
         </div>
         <div className="text-center text-white relative z-10">
             <p className="text-indigo-100 text-xs font-bold uppercase tracking-widest mb-1">Total Tabungan</p>
             <h2 className="text-4xl font-extrabold tracking-tight">{formatIDR(totalSavings)}</h2>
         </div>
      </div>

      {/* LIST GOALS */}
      <div className="px-6 -mt-10 relative z-20 space-y-3">
         {loading ? ( <div className="space-y-3 pt-4">{[1,2,3].map(i => <div key={i} className="h-24 bg-white rounded-2xl animate-pulse"></div>)}</div> ) : goals.length === 0 ? (
             <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 text-center">
                 <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-500"><Target size={32}/></div>
                 <h3 className="font-bold text-slate-800">Belum Ada Goals</h3>
                 <p className="text-sm text-slate-500 mt-1 mb-4">Mulai wujudkan impianmu sekarang!</p>
                 <button onClick={openAdd} className="bg-indigo-600 text-white px-6 py-2 rounded-full font-bold text-sm shadow-lg shadow-indigo-200">Tambah Baru</button>
             </div>
         ) : (
             <>
                <button onClick={openAdd} className="w-full py-3 bg-white border border-dashed border-indigo-200 text-indigo-500 rounded-2xl font-bold text-sm hover:bg-indigo-50 transition flex items-center justify-center gap-2"><Plus size={18}/> Tambah Impian Baru</button>
                {goals.map(goal => {
                    const IconComp = ICONS[goal.icon] || Target;
                    const percent = Math.min((goal.current_amount / goal.target_amount) * 100, 100);
                    const colorClass = goal.color || 'bg-blue-500';
                    const textClass = colorClass.replace('bg-', 'text-');
                    return (
                        <motion.div key={goal.id} layout onClick={() => openDetail(goal)} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 cursor-pointer active:scale-98 transition flex items-center gap-4 relative overflow-hidden">
                            <div className="absolute bottom-0 left-0 h-1 bg-slate-100 w-full"><div style={{width: `${percent}%`}} className={`h-full ${colorClass}`}></div></div>
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${colorClass} bg-opacity-10`}><IconComp size={20} className={textClass}/></div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-1">
                                    <h3 className="font-bold text-slate-800 text-sm truncate">{goal.name}</h3>
                                    <span className={`text-xs font-bold ${textClass}`}>{percent.toFixed(0)}%</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-600">{formatIDR(goal.current_amount)}</span>
                                    <span className="text-[10px] text-slate-400">Target {formatIDR(goal.target_amount)}</span>
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
             </>
         )}
      </div>

      {/* === FULL PAGE DETAIL (ULTRA COMPACT) === */}
      <AnimatePresence>
        {selectedGoal && (
            <motion.div 
                initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} 
                transition={{ type: "spring", damping: 25, stiffness: 200 }} 
                className="fixed inset-0 z-50 bg-slate-50 flex flex-col h-full w-full max-w-[420px] mx-auto"
            >
                {/* 1. Header (Integrated Nav + Goal Info) */}
                <div className="bg-white px-4 py-3 shadow-sm z-10 shrink-0 border-b border-slate-100 flex items-center justify-between sticky top-0">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setSelectedGoal(null)} className="p-2 -ml-2 rounded-full text-slate-600 hover:bg-slate-100 transition"><ArrowLeft size={22}/></button>
                        
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${selectedGoal.color} bg-opacity-10`}>
                                {React.createElement(ICONS[selectedGoal.icon] || Target, { size: 20, className: selectedGoal.color.replace('bg-', 'text-') })}
                            </div>
                            <div>
                                <h2 className="font-bold text-base text-slate-900 leading-tight">{selectedGoal.name}</h2>
                                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                                    <span>Tgt: {formatIDR(selectedGoal.target_amount)}</span>
                                    {selectedGoal.deadline && <span>• {new Date(selectedGoal.deadline).toLocaleDateString('id-ID', {day:'numeric', month:'short'})}</span>}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-1">
                        <button onClick={openEdit} className="p-2 text-slate-400 hover:text-indigo-600 transition"><Edit2 size={18}/></button>
                        <button onClick={requestDelete} className="p-2 text-slate-400 hover:text-red-500 transition"><Trash2 size={18}/></button>
                    </div>
                </div>

                {/* 2. Progress & Actions (Compact) */}
                <div className="bg-white px-5 pt-4 pb-2 border-b border-slate-100">
                    {/* Progress Bar & Saldo */}
                    <div className="mb-4">
                        <div className="flex justify-between items-end mb-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Terkumpul</span>
                            <div className="text-right">
                                <span className={`text-2xl font-black ${selectedGoal.color.replace('bg-', 'text-')}`}>{formatIDR(selectedGoal.current_amount)}</span>
                            </div>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden relative">
                            <div style={{ width: `${Math.min((selectedGoal.current_amount / selectedGoal.target_amount) * 100, 100)}%` }} className={`h-full rounded-full ${selectedGoal.color}`}></div>
                        </div>
                        <p className="text-[10px] text-slate-400 text-right mt-1">Kurang {formatIDR(selectedGoal.target_amount - selectedGoal.current_amount)}</p>
                    </div>

                    {/* Action Row */}
                    <div className="flex items-center gap-2">
                        {/* Toggle Nabung/Tarik */}
                        <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
                            <button onClick={() => setTransactionType('deposit')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition ${transactionType === 'deposit' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}>Masuk</button>
                            <button onClick={() => setTransactionType('withdraw')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition ${transactionType === 'withdraw' ? 'bg-white shadow text-red-600' : 'text-slate-400'}`}>Keluar</button>
                        </div>
                        
                        {/* Input & Button */}
                        <div className="flex-1 flex gap-2">
                            <div className="relative flex-1">
                                <span className={`absolute left-3 top-1/2 -translate-y-1/2 font-bold text-xs ${transactionType === 'deposit' ? 'text-indigo-300' : 'text-red-300'}`}>Rp</span>
                                <NumberInput value={amountInput} onChange={setAmountInput} placeholder="0" className={`w-full py-2 pl-8 pr-3 text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 transition`} />
                            </div>
                            <button onClick={handleTransaction} className={`w-10 h-10 flex items-center justify-center rounded-xl text-white shadow-md transition active:scale-95 shrink-0 ${transactionType === 'deposit' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-red-500 hover:bg-red-600'}`}>
                                {transactionType === 'deposit' ? <Plus size={20}/> : <ArrowUpRight size={20}/>}
                            </button>
                        </div>
                    </div>
                </div>

                {/* 3. Filter & History List */}
                <div className="flex-1 overflow-hidden flex flex-col bg-slate-50">
                    <div className="px-5 pt-3 pb-2 flex gap-2 overflow-x-auto scrollbar-hide shrink-0 items-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Filter:</span>
                        {['ALL', 'deposit', 'withdraw'].map(f => (
                            <button key={f} onClick={() => setFilterType(f)} className={`px-3 py-1 rounded-lg text-[10px] font-bold border transition capitalize ${filterType === f ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>{f === 'ALL' ? 'Semua' : f === 'deposit' ? 'Masuk' : 'Keluar'}</button>
                        ))}
                        <div className="w-px h-4 bg-slate-300 mx-1"></div>
                        {['ALL', 'WEEK', 'MONTH'].map(f => (
                            <button key={f} onClick={() => setFilterDate(f)} className={`px-3 py-1 rounded-lg text-[10px] font-bold border transition ${filterDate === f ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200'}`}>{f === 'ALL' ? 'Semua' : f === 'WEEK' ? '7 Hari' : 'Bulan Ini'}</button>
                        ))}
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 pt-2 space-y-2 custom-scrollbar">
                        {loadingLogs ? (<div className="space-y-2 pt-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-slate-200 rounded-xl animate-pulse"></div>)}</div>) : logs.length === 0 ? (<div className="text-center py-10 text-slate-400"><History size={24} className="mx-auto mb-2 opacity-50"/><p className="text-xs">Belum ada riwayat.</p></div>) : (
                            logs.map(log => (
                                <div key={log.id} className="flex justify-between items-center p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${log.amount > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{log.amount > 0 ? <ArrowDownLeft size={14}/> : <ArrowUpRight size={14}/>}</div>
                                        <div><p className="font-bold text-xs text-slate-800">{log.note}</p><p className="text-[10px] text-slate-400">{new Date(log.created_at).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', hour:'2-digit', minute:'2-digit'})}</p></div>
                                    </div>
                                    <span className={`text-xs font-bold ${log.amount > 0 ? 'text-green-600' : 'text-slate-800'}`}>{log.amount > 0 ? '+' : ''}{formatIDR(log.amount)}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* --- MODAL ADD / EDIT --- */}
      <AnimatePresence>
        {showModal && (
            <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <motion.div initial={{y: "100%"}} animate={{y: 0}} exit={{y: "100%"}} className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl h-[80vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-6"><h3 className="font-bold text-xl text-slate-900">{modalMode === 'add' ? 'Buat Impian Baru' : 'Edit Impian'}</h3><button onClick={() => setShowModal(false)} className="p-2 bg-slate-100 rounded-full"><X size={20}/></button></div>
                    <div className="space-y-5">
                        <div><label className="text-xs font-bold text-slate-500 mb-2 block">Pilih Ikon</label><div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">{Object.keys(ICONS).map(k => {const Icon = ICONS[k]; const isSelected = formData.icon === k; return (<div key={k} onClick={() => setFormData({...formData, icon: k})} className={`p-3 rounded-xl border-2 cursor-pointer transition flex-shrink-0 ${isSelected ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-slate-100 text-slate-400'}`}><Icon size={24}/></div>)})}</div></div>
                        <div><label className="text-xs font-bold text-slate-500 mb-2 block">Pilih Warna</label><div className="flex gap-3">{COLORS.map((c, i) => (<div key={i} onClick={() => setFormData({...formData, color: c.bg})} className={`w-8 h-8 rounded-full cursor-pointer ring-2 ring-offset-2 ${c.bg} ${formData.color === c.bg ? 'ring-slate-400' : 'ring-transparent'}`}></div>))}</div></div>
                        <div><label className="text-xs font-bold text-slate-500 mb-1 block">Nama Impian</label><input type="text" placeholder="Contoh: Beli MacBook" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 font-bold outline-indigo-500" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
                        <div><label className="text-xs font-bold text-slate-500 mb-1 block">Target Dana (Rp)</label><NumberInput placeholder="0" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 font-bold text-lg outline-indigo-500" value={formData.target} onChange={val => setFormData({...formData, target: val})} /></div>
                        {modalMode === 'add' && (<div><label className="text-xs font-bold text-slate-500 mb-1 block">Saldo Awal (Opsional)</label><NumberInput placeholder="0" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-indigo-500" value={formData.initial} onChange={val => setFormData({...formData, initial: val})} /></div>)}
                        <div><label className="text-xs font-bold text-slate-500 mb-1 block">Target Tercapai (Deadline)</label><input type="date" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-indigo-500" value={formData.deadline} onChange={e => setFormData({...formData, deadline: e.target.value})} /></div>
                        <button onClick={handleSaveGoal} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg mt-4">{modalMode === 'add' ? 'Simpan Impian' : 'Update Impian'}</button>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      {/* NOTIFIKASI */}
      <AnimatePresence>
        {notif.show && (
            <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <motion.div initial={{scale:0.9}} animate={{scale:1}} exit={{scale:0.9}} className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl text-center">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${notif.type === 'success' ? 'bg-green-100 text-green-600' : notif.type === 'error' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}`}>{notif.type === 'success' ? <CheckCircle2 size={32}/> : notif.type === 'error' ? <AlertCircle size={32}/> : <AlertCircle size={32}/>}</div>
                    <h3 className="text-xl font-extrabold text-slate-900 mb-2">{notif.title}</h3>
                    <p className="text-slate-500 text-sm mb-6 leading-relaxed">{notif.message}</p>
                    <div className="flex gap-3 justify-center">{notif.type === 'confirm' ? (<><button onClick={closeNotif} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200">Batal</button><button onClick={notif.onConfirm} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg">Ya, Lanjut</button></>) : (<button onClick={closeNotif} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800">Oke, Siap!</button>)}</div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>
    </div>
  );
}