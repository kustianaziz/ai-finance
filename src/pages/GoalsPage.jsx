import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthProvider';
import { 
  ArrowLeft, Plus, Target, Plane, Car, Home, 
  Smartphone, Gift, TrendingUp, X, CheckCircle2, 
  AlertCircle, Calendar, Wallet, History
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function GoalsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // --- STATE ---
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // State Modal Add
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({ 
      name: '', target: '', initial: '', deadline: '', icon: 'Target', color: 'bg-blue-500' 
  });

  // State Modal Detail (Nabung/Tarik)
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [amountInput, setAmountInput] = useState('');
  const [transactionType, setTransactionType] = useState('deposit'); // 'deposit' or 'withdraw'
  const [logs, setLogs] = useState([]); // Riwayat transaksi goal tsb

  // Helper State
  const [monthlyRecommendation, setMonthlyRecommendation] = useState(0);

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

  useEffect(() => {
    if (user) fetchGoals();
  }, [user]);

  // --- FETCH DATA ---
  const fetchGoals = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setGoals(data || []);
    } catch (error) {
      console.error("Error goals:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async (goalId) => {
      const { data } = await supabase.from('goal_logs').select('*').eq('goal_id', goalId).order('created_at', { ascending: false }).limit(5);
      setLogs(data || []);
  };

  // --- SMART CALCULATION (RECOMMENDATION) ---
  useEffect(() => {
      if (formData.target && formData.deadline) {
          const target = Number(formData.target) - (Number(formData.initial) || 0);
          const today = new Date();
          const due = new Date(formData.deadline);
          
          // Hitung selisih bulan
          const months = (due.getFullYear() - today.getFullYear()) * 12 + (due.getMonth() - today.getMonth());
          
          if (months > 0 && target > 0) {
              setMonthlyRecommendation(target / months);
          } else {
              setMonthlyRecommendation(0);
          }
      } else {
          setMonthlyRecommendation(0);
      }
  }, [formData.target, formData.deadline, formData.initial]);

  // --- ACTIONS ---
  const handleCreateGoal = async () => {
      try {
          if (!formData.name || !formData.target) return alert("Nama dan Target wajib diisi");

          const payload = {
              user_id: user.id,
              name: formData.name,
              target_amount: formData.target,
              current_amount: formData.initial || 0,
              deadline: formData.deadline || null,
              icon: formData.icon,
              color: formData.color
          };

          const { error } = await supabase.from('goals').insert(payload);
          if (error) throw error;

          setShowAddModal(false);
          setFormData({ name: '', target: '', initial: '', deadline: '', icon: 'Target', color: 'bg-blue-500' });
          fetchGoals();
      } catch (e) {
          alert("Gagal membuat goal: " + e.message);
      }
  };

  const handleTransaction = async () => {
      try {
          const amount = Number(amountInput);
          if (!amount || amount <= 0) return alert("Masukkan nominal valid");

          const isDeposit = transactionType === 'deposit';
          const newAmount = isDeposit 
              ? Number(selectedGoal.current_amount) + amount 
              : Number(selectedGoal.current_amount) - amount;

          if (newAmount < 0) return alert("Saldo tidak cukup!");

          // 1. Update Goal Balance
          const { error: updateError } = await supabase
              .from('goals')
              .update({ current_amount: newAmount })
              .eq('id', selectedGoal.id);
          
          if (updateError) throw updateError;

          // 2. Insert Log
          const { error: logError } = await supabase
              .from('goal_logs')
              .insert({
                  goal_id: selectedGoal.id,
                  amount: isDeposit ? amount : -amount,
                  note: isDeposit ? 'Tabung' : 'Tarik'
              });

          if (logError) throw logError;

          // Refresh
          setSelectedGoal(null);
          setAmountInput('');
          fetchGoals();

      } catch (e) {
          alert("Gagal transaksi: " + e.message);
      }
  };

  const handleDelete = async () => {
      if(!window.confirm("Yakin hapus impian ini? Saldo tersimpan akan hilang.")) return;
      await supabase.from('goals').delete().eq('id', selectedGoal.id);
      setSelectedGoal(null);
      fetchGoals();
  };

  const openDetail = (goal) => {
      setSelectedGoal(goal);
      setTransactionType('deposit'); // Default nabung
      fetchLogs(goal.id);
  };

  // Hitung Total Tabungan
  const totalSavings = goals.reduce((acc, curr) => acc + Number(curr.current_amount), 0);

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-24">
      
      {/* HEADER */}
      <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-6 pb-20 rounded-b-[2.5rem] shadow-xl relative overflow-hidden">
         <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full blur-3xl transform translate-x-10 -translate-y-10"></div>
         
         <div className="flex items-center gap-3 mb-6 relative z-10">
            <button onClick={() => navigate('/dashboard')} className="p-2 bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-white/30"><ArrowLeft size={20}/></button>
            <h1 className="text-xl font-bold text-white">Impian & Goals</h1>
         </div>

         <div className="text-center text-white relative z-10">
             <p className="text-indigo-100 text-sm mb-1">Total Tabungan Impian</p>
             <h2 className="text-4xl font-extrabold tracking-tight">{formatIDR(totalSavings)}</h2>
         </div>
      </div>

      {/* LIST GOALS */}
      <div className="px-6 -mt-10 relative z-20 space-y-4">
          
          {loading ? (
              <p className="text-center text-slate-400 py-10">Memuat impian...</p>
          ) : goals.length === 0 ? (
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 text-center">
                  <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-500">
                      <Target size={32}/>
                  </div>
                  <h3 className="font-bold text-slate-800">Belum Ada Goals</h3>
                  <p className="text-sm text-slate-500 mt-1 mb-4">Mulai wujudkan impianmu sekarang!</p>
                  <button onClick={() => setShowAddModal(true)} className="bg-indigo-600 text-white px-6 py-2 rounded-full font-bold text-sm shadow-lg shadow-indigo-200">Tambah Baru</button>
              </div>
          ) : (
              <>
                <button onClick={() => setShowAddModal(true)} className="w-full py-3 bg-white border border-dashed border-indigo-200 text-indigo-500 rounded-2xl font-bold text-sm hover:bg-indigo-50 transition flex items-center justify-center gap-2">
                    <Plus size={18}/> Tambah Impian Baru
                </button>

                {goals.map(goal => {
                    const IconComp = ICONS[goal.icon] || Target;
                    const percent = Math.min((goal.current_amount / goal.target_amount) * 100, 100);
                    // Parse color string -> 'bg-blue-500' -> ambil class tailwind
                    // Biar simpel kita hardcode logic warna di render
                    const colorClass = goal.color || 'bg-blue-500';
                    const textClass = colorClass.replace('bg-', 'text-');

                    return (
                        <motion.div 
                            key={goal.id} 
                            layout
                            onClick={() => openDetail(goal)}
                            className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 cursor-pointer active:scale-98 transition"
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-3">
                                    <div className={`p-3 rounded-2xl ${colorClass} bg-opacity-10`}>
                                        <IconComp size={24} className={textClass}/>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800">{goal.name}</h3>
                                        <p className="text-xs text-slate-400">Target: {formatIDR(goal.target_amount)}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-xs font-bold text-slate-500">{percent.toFixed(0)}%</span>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-2">
                                <motion.div 
                                    initial={{width: 0}} 
                                    animate={{width: `${percent}%`}} 
                                    className={`h-full rounded-full ${colorClass}`}
                                />
                            </div>

                            <div className="flex justify-between items-center text-xs">
                                <span className="font-bold text-slate-700">{formatIDR(goal.current_amount)}</span>
                                {percent < 100 ? (
                                    <span className="text-slate-400">Kurang {formatIDR(goal.target_amount - goal.current_amount)}</span>
                                ) : (
                                    <span className="text-green-600 font-bold flex items-center gap-1"><CheckCircle2 size={12}/> Tercapai!</span>
                                )}
                            </div>
                        </motion.div>
                    );
                })}
              </>
          )}
      </div>

      {/* --- MODAL ADD GOAL --- */}
      <AnimatePresence>
        {showAddModal && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
                <motion.div initial={{y: "100%"}} animate={{y: 0}} exit={{y: "100%"}} className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl h-[90vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-xl text-slate-900">Buat Impian Baru</h3>
                        <button onClick={() => setShowAddModal(false)} className="p-2 bg-slate-100 rounded-full"><X size={20}/></button>
                    </div>

                    <div className="space-y-5">
                        {/* Ikon Picker */}
                        <div>
                            <label className="text-xs font-bold text-slate-500 mb-2 block">Pilih Ikon</label>
                            <div className="flex gap-3 overflow-x-auto pb-2">
                                {Object.keys(ICONS).map(k => {
                                    const Icon = ICONS[k];
                                    const isSelected = formData.icon === k;
                                    return (
                                        <div key={k} onClick={() => setFormData({...formData, icon: k})} 
                                            className={`p-3 rounded-xl border-2 cursor-pointer transition flex-shrink-0 ${isSelected ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-slate-100 text-slate-400'}`}>
                                            <Icon size={24}/>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Warna Picker */}
                        <div>
                            <label className="text-xs font-bold text-slate-500 mb-2 block">Pilih Warna</label>
                            <div className="flex gap-3">
                                {COLORS.map((c, i) => (
                                    <div key={i} onClick={() => setFormData({...formData, color: c.bg})} 
                                        className={`w-8 h-8 rounded-full cursor-pointer ring-2 ring-offset-2 ${c.bg} ${formData.color === c.bg ? 'ring-slate-400' : 'ring-transparent'}`}>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Inputs */}
                        <div>
                            <label className="text-xs font-bold text-slate-500 mb-1 block">Nama Impian</label>
                            <input type="text" placeholder="Contoh: Beli MacBook" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 font-bold" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 mb-1 block">Target Dana (Rp)</label>
                            <input type="number" placeholder="0" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 font-bold text-lg" value={formData.target} onChange={e => setFormData({...formData, target: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 mb-1 block">Saldo Awal (Opsional)</label>
                            <input type="number" placeholder="0" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200" value={formData.initial} onChange={e => setFormData({...formData, initial: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 mb-1 block">Target Tercapai (Deadline)</label>
                            <input type="date" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200" value={formData.deadline} onChange={e => setFormData({...formData, deadline: e.target.value})} />
                        </div>

                        {/* Smart Insight Box */}
                        {monthlyRecommendation > 0 && (
                            <div className="bg-indigo-50 p-4 rounded-xl flex items-start gap-3 border border-indigo-100">
                                <div className="p-2 bg-white rounded-full text-indigo-600 shadow-sm"><TrendingUp size={16}/></div>
                                <div>
                                    <p className="text-xs font-bold text-indigo-800">Rekomendasi Rapikus</p>
                                    <p className="text-xs text-indigo-600 mt-1 leading-relaxed">
                                        Supaya tercapai tepat waktu, kamu perlu nabung sekitar <span className="font-bold">{formatIDR(monthlyRecommendation)}</span> setiap bulannya. Semangat! 🔥
                                    </p>
                                </div>
                            </div>
                        )}

                        <button onClick={handleCreateGoal} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg mt-4">Simpan Impian</button>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      {/* --- MODAL DETAIL (TOP UP) --- */}
      <AnimatePresence>
        {selectedGoal && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
                <motion.div initial={{y: "100%"}} animate={{y: 0}} exit={{y: "100%"}} className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl h-[85vh] flex flex-col">
                    
                    {/* Header Modal Detail */}
                    <div className="flex justify-between items-center mb-6 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl ${selectedGoal.color} bg-opacity-10 text-opacity-100`}>
                                {React.createElement(ICONS[selectedGoal.icon] || Target, { size: 24, className: selectedGoal.color.replace('bg-', 'text-') })}
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-slate-900">{selectedGoal.name}</h3>
                                <p className="text-xs text-slate-500">Target: {formatIDR(selectedGoal.target_amount)}</p>
                            </div>
                        </div>
                        <button onClick={() => setSelectedGoal(null)} className="p-2 bg-slate-100 rounded-full"><X size={20}/></button>
                    </div>

                    {/* Progress Besar */}
                    <div className="text-center mb-6 shrink-0">
                        <p className="text-slate-400 text-sm mb-1">Terkumpul Saat Ini</p>
                        <h2 className={`text-4xl font-extrabold ${selectedGoal.color.replace('bg-', 'text-')}`}>{formatIDR(selectedGoal.current_amount)}</h2>
                        
                        <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden mt-4">
                            <div style={{ width: `${Math.min((selectedGoal.current_amount / selectedGoal.target_amount) * 100, 100)}%` }} className={`h-full rounded-full ${selectedGoal.color}`}></div>
                        </div>
                        <p className="text-xs text-slate-400 mt-2">
                            Kurang {formatIDR(selectedGoal.target_amount - selectedGoal.current_amount)} lagi
                        </p>
                    </div>

                    {/* Action Tabs */}
                    <div className="flex bg-slate-100 p-1 rounded-xl mb-4 shrink-0">
                        <button onClick={() => setTransactionType('deposit')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${transactionType === 'deposit' ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}>Nabung 💰</button>
                        <button onClick={() => setTransactionType('withdraw')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${transactionType === 'withdraw' ? 'bg-white shadow text-red-600' : 'text-slate-400'}`}>Tarik 💸</button>
                    </div>

                    {/* Input Amount */}
                    <div className="mb-6 shrink-0">
                        <div className="relative">
                            <span className="absolute left-4 top-3.5 text-slate-400 font-bold">Rp</span>
                            <input 
                                type="number" 
                                placeholder="0" 
                                className="w-full p-3 pl-12 bg-slate-50 rounded-xl border border-slate-200 font-bold text-lg outline-indigo-500"
                                value={amountInput}
                                onChange={e => setAmountInput(e.target.value)}
                            />
                        </div>
                        <button onClick={handleTransaction} className={`w-full py-3 mt-3 rounded-xl font-bold text-white shadow-lg transition ${transactionType === 'deposit' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-red-500 hover:bg-red-600'}`}>
                            {transactionType === 'deposit' ? 'Tabung Sekarang' : 'Tarik Saldo'}
                        </button>
                    </div>

                    {/* History Log */}
                    <div className="flex-1 overflow-y-auto border-t border-slate-100 pt-4">
                        <h4 className="font-bold text-sm text-slate-700 mb-3 flex items-center gap-2"><History size={16}/> Riwayat Transaksi</h4>
                        {logs.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-4">Belum ada riwayat.</p>
                        ) : (
                            <div className="space-y-3">
                                {logs.map(log => (
                                    <div key={log.id} className="flex justify-between items-center text-sm">
                                        <div>
                                            <p className="font-bold text-slate-700">{log.note}</p>
                                            <p className="text-[10px] text-slate-400">{new Date(log.created_at).toLocaleDateString('id-ID')}</p>
                                        </div>
                                        <span className={`font-bold ${log.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                            {log.amount > 0 ? '+' : ''}{formatIDR(log.amount)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Delete Button */}
                    <div className="pt-4 border-t border-slate-100 mt-auto shrink-0 text-center">
                        <button onClick={handleDelete} className="text-xs font-bold text-red-400 hover:text-red-600">Hapus Impian Ini</button>
                    </div>

                </motion.div>
            </div>
        )}
      </AnimatePresence>

    </div>
  );
}