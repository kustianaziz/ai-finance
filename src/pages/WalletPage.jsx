import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthProvider';
import { 
  ArrowLeft, Plus, Wallet, CreditCard, Banknote, 
  Trash2, Briefcase, Users, User, Edit2, History,
  ArrowDownLeft, ArrowUpRight, X, AlertTriangle, Calendar, Lock, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- HELPER INPUT ---
const NumberInput = ({ value, onChange, placeholder, className, minVal = 0 }) => {
    const format = (val) => {
        if (!val && val !== 0) return '';
        return new Intl.NumberFormat('id-ID').format(val);
    };
    const handleChange = (e) => {
        const raw = e.target.value.replace(/\D/g, ''); 
        onChange(raw);
    };
    return (
        <div className="relative">
            <input 
                type="text" 
                value={format(value)} 
                onChange={handleChange} 
                placeholder={placeholder} 
                className={`${className} ${Number(value) < minVal ? 'border-red-500 text-red-600 focus:border-red-500 bg-red-50' : ''}`} 
            />
            {Number(value) < minVal && (
                <div className="absolute right-3 top-3 text-red-500 animate-pulse">
                    <AlertCircle size={20}/>
                </div>
            )}
        </div>
    );
};

export default function WalletPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // --- STATE ---
  const [activeMode, setActiveMode] = useState(() => localStorage.getItem('app_mode') || 'PERSONAL');
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalBalance, setTotalBalance] = useState(0);

  // --- STATE MODAL ---
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); 
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [form, setForm] = useState({ id: null, name: '', type: 'cash', initial_balance: '' });
  
  // --- VALIDATION STATE ---
  const [minInitial, setMinInitial] = useState(0); // Batas minimal saldo awal
  const [calculatingMin, setCalculatingMin] = useState(false);

  // --- STATE DETAIL / HISTORY ---
  const [showDetail, setShowDetail] = useState(null); 
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  const [filterType, setFilterType] = useState('ALL'); 
  const [customRange, setCustomRange] = useState({ start: '', end: '' });

  const [notif, setNotif] = useState({ show: false, type: 'info', title: '', message: '', onConfirm: null });

  useEffect(() => {
    if (user) fetchWallets();
  }, [user, activeMode]);

  useEffect(() => {
      if (showDetail) fetchHistory(showDetail.id);
  }, [filterType, customRange]);

  const fetchWallets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('wallets').select('*').eq('user_id', user.id).eq('allocation_type', activeMode).order('initial_balance', { ascending: false });
      if (error) throw error;
      setWallets(data || []);
      setTotalBalance((data || []).reduce((acc, curr) => acc + (curr.initial_balance || 0), 0));
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const fetchHistory = async (walletId) => {
      if (filterType === 'CUSTOM' && (!customRange.start || !customRange.end)) return;
      setLoadingHistory(true);
      try {
          let query = supabase.from('transaction_headers').select('*').eq('wallet_id', walletId).order('date', { ascending: false });
          const today = new Date();
          
          if (filterType === 'WEEK') {
              const weekAgo = new Date(); weekAgo.setDate(today.getDate() - 7);
              query = query.gte('date', weekAgo.toISOString());
          } else if (filterType === 'MONTH') {
              const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
              query = query.gte('date', startOfMonth);
          } else if (filterType === 'CUSTOM') {
              query = query.gte('date', customRange.start).lte('date', customRange.end);
          } else {
              query = query.limit(50);
          }

          const { data, error } = await query;
          if(error) throw error;
          setHistory(data || []);
      } catch (e) { console.error(e); } finally { setLoadingHistory(false); }
  };

  // --- LOGIC CALCULATE MINIMUM BALANCE ---
  const calculateMinRequirement = async (walletId) => {
      setCalculatingMin(true);
      try {
          // Ambil semua transaksi wallet ini (hanya nominal & tipe)
          const { data, error } = await supabase
            .from('transaction_headers')
            .select('type, total_amount')
            .eq('wallet_id', walletId);
          
          if(error) throw error;

          let totalIncome = 0;
          let totalExpense = 0;

          data.forEach(t => {
              if (t.type === 'income') totalIncome += Number(t.total_amount);
              else if (t.type === 'expense') totalExpense += Number(t.total_amount);
          });

          // Rumus: NewInitial + Income - Expense >= 0
          // NewInitial >= Expense - Income
          const minReq = totalExpense - totalIncome;
          
          // Jika Income lebih besar, minReq jadi minus (artinya saldo awal boleh 0).
          // Jika Expense lebih besar, minReq positif (user harus cover selisihnya).
          setMinInitial(Math.max(0, minReq));

      } catch (error) {
          console.error("Gagal hitung min balance:", error);
          setMinInitial(0);
      } finally {
          setCalculatingMin(false);
      }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    
    // Validasi Akhir
    if (parseFloat(form.initial_balance || 0) < minInitial) {
        return alert(`Saldo awal tidak boleh kurang dari Rp ${new Intl.NumberFormat('id-ID').format(minInitial)} karena sudah ada pengeluaran.`);
    }

    try {
      const payload = { user_id: user.id, name: form.name, type: form.type, initial_balance: parseFloat(form.initial_balance || 0), currency: 'IDR', allocation_type: activeMode };
      if (modalMode === 'add') await supabase.from('wallets').insert(payload);
      else await supabase.from('wallets').update(payload).eq('id', form.id);
      setShowModal(false); fetchWallets(); 
      if(showDetail && modalMode === 'edit') {
          setShowDetail({ ...showDetail, ...payload, id: form.id });
      }
    } catch (err) { alert("Gagal menyimpan: " + err.message); }
  };

  const requestDelete = async (wallet) => {
      const { count, error } = await supabase.from('transaction_headers').select('*', { count: 'exact', head: true }).eq('wallet_id', wallet.id);
      if (error) return;

      if (count > 0) {
          setNotif({
              show: true, type: 'blocked', title: 'Tidak Bisa Dihapus',
              message: `Akun "${wallet.name}" masih memiliki ${count} riwayat transaksi aktif. Data tidak boleh dihapus demi keamanan pembukuan.`,
              onConfirm: null
          });
      } else {
          setNotif({
              show: true, type: 'confirm', title: 'Hapus Akun?',
              message: `Akun "${wallet.name}" belum memiliki transaksi. Aman untuk dihapus.`,
              onConfirm: () => executeDelete(wallet.id)
          });
      }
  };

  const executeDelete = async (id) => {
    try {
      const { error } = await supabase.from('wallets').delete().eq('id', id);
      if (error) throw error;
      setNotif({ show: false }); setShowDetail(null); fetchWallets();
    } catch (err) { setNotif({ show: true, type: 'info', title: 'Gagal', message: err.message }); }
  };

  const openAdd = () => { 
      setModalMode('add'); 
      setForm({ id: null, name: '', type: 'cash', initial_balance: '' }); 
      setMinInitial(0); // Tambah baru selalu mulai dari 0 aman
      setShowModal(true); 
  };

  const openEdit = (w) => { 
      setModalMode('edit'); 
      setForm({ id: w.id, name: w.name, type: w.type, initial_balance: w.initial_balance }); 
      calculateMinRequirement(w.id); // HITUNG MINIMAL
      setShowModal(true); 
  };
  
  const openDetail = (w) => { setSelectedWallet(w); setShowDetail(w); setFilterType('ALL'); setCustomRange({start: '', end: ''}); };

  const formatIDR = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  const getWalletIcon = (type) => { switch (type) { case 'bank': return <CreditCard className="text-blue-600" size={20}/>; case 'ewallet': return <Wallet className="text-purple-600" size={20}/>; default: return <Banknote className="text-emerald-600" size={20}/>; } };
  const getWalletColor = (type) => { switch (type) { case 'bank': return 'bg-blue-50 border-blue-100 text-blue-600'; case 'ewallet': return 'bg-purple-50 border-purple-100 text-purple-600'; default: return 'bg-emerald-50 border-emerald-100 text-emerald-600'; } };
  const getModeLabel = () => { if (activeMode === 'BUSINESS') return 'Kas Bisnis'; if (activeMode === 'ORGANIZATION') return 'Kas Organisasi'; return 'Dompet Pribadi'; };
  const getThemeColor = () => { if (activeMode === 'BUSINESS') return 'bg-blue-600'; if (activeMode === 'ORGANIZATION') return 'bg-teal-600'; return 'bg-indigo-600'; };

  return (
    <div className="max-w-[420px] mx-auto bg-white min-h-screen relative shadow-2xl overflow-hidden border-x border-gray-100 font-sans pb-24">
      {/* HEADER */}
      <div className={`${getThemeColor()} pb-16 pt-6 px-6 rounded-b-[2.5rem] relative overflow-hidden transition-colors duration-500`}>
         <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
         <div className="relative z-10 flex items-center justify-between mb-6">
            <button onClick={() => navigate('/dashboard')} className="p-2 bg-white/10 rounded-full text-white hover:bg-white/20 transition backdrop-blur-sm"><ArrowLeft size={20}/></button>
            <div className="flex flex-col items-center">
                <h1 className="text-lg font-bold text-white tracking-wide">Dompet & Rekening</h1>
                <div className="flex items-center gap-1 text-[10px] text-white/80 bg-white/10 px-2 py-0.5 rounded-full mt-1">
                    {activeMode === 'BUSINESS' ? <Briefcase size={10}/> : activeMode === 'ORGANIZATION' ? <Users size={10}/> : <User size={10}/>}
                    {getModeLabel()}
                </div>
            </div>
            <div className="w-10"></div> 
         </div>
         <div className="text-center text-white relative z-10">
            <p className="text-white/70 text-xs font-bold uppercase tracking-widest mb-1">Total Aset {activeMode !== 'PERSONAL' ? 'Usaha' : ''}</p>
            <h2 className="text-3xl font-extrabold tracking-tight">{loading ? <span className="animate-pulse opacity-50">...</span> : formatIDR(totalBalance)}</h2>
         </div>
      </div>

      {/* LIST DOMPET */}
      <div className="px-6 -mt-8 relative z-20 space-y-3">
         <button onClick={openAdd} className="w-full bg-white p-4 rounded-2xl shadow-lg shadow-slate-200/50 border border-dashed border-slate-300 flex items-center justify-center gap-2 text-slate-600 font-bold hover:bg-slate-50 transition active:scale-95">
            <Plus size={20}/> Tambah Akun {activeMode === 'PERSONAL' ? '' : 'Baru'}
         </button>
         {loading ? ( <div className="space-y-3 pt-2">{[1,2,3].map(i => <div key={i} className="h-20 bg-white rounded-2xl animate-pulse"></div>)}</div> ) : wallets.length === 0 ? ( <div className="text-center py-10 pt-16"><div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-300"><Wallet size={32}/></div><p className="text-slate-400 text-sm font-medium">Belum ada akun di mode {getModeLabel()}.</p></div> ) : (
             <div className="space-y-3 pt-2">
                 {wallets.map((w) => (
                     <motion.div key={w.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileTap={{ scale: 0.98 }} onClick={() => openDetail(w)} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center relative overflow-hidden hover:bg-slate-50 transition cursor-pointer">
                        <div className="flex items-center gap-4 relative z-10">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${getWalletColor(w.type)}`}>{getWalletIcon(w.type)}</div>
                            <div><h3 className="font-bold text-slate-800 text-sm">{w.name}</h3><div className="flex items-center gap-2 mt-0.5"><span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md font-bold uppercase tracking-wider">{w.type}</span></div></div>
                        </div>
                        <div className="text-right relative z-10">
                            <span className="block font-bold text-slate-800 text-sm mb-1">{formatIDR(w.initial_balance)}</span>
                            <span className="text-[10px] text-slate-400 flex items-center justify-end gap-1">Lihat Detail <ArrowDownLeft size={10} className="-rotate-90"/></span>
                        </div>
                     </motion.div>
                 ))}
             </div>
         )}
      </div>

      {/* MODAL FULL PAGE DETAIL */}
      <AnimatePresence>
        {showDetail && selectedWallet && (
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="fixed inset-0 z-[60] bg-slate-50 flex flex-col h-full w-full max-w-[420px] mx-auto">
                <div className="bg-white px-5 pt-5 pb-3 shadow-sm z-10 shrink-0 border-b border-slate-100">
                    <div className="flex items-center gap-3 mb-4">
                        <button onClick={() => setShowDetail(null)} className="p-2 -ml-2 rounded-full text-slate-600 hover:bg-slate-100 transition"><ArrowLeft size={24}/></button>
                        <div className="flex-1"><h2 className="font-extrabold text-xl text-slate-900 leading-none">{selectedWallet.name}</h2><p className="text-xs text-slate-400 mt-1 uppercase font-bold tracking-wider">{selectedWallet.type}</p></div>
                        <div className="flex gap-2">
                            <button onClick={() => openEdit(selectedWallet)} className="p-2 bg-slate-50 border border-slate-200 text-slate-500 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-100 transition"><Edit2 size={18}/></button>
                            <button onClick={() => requestDelete(selectedWallet)} className="p-2 bg-slate-50 border border-slate-200 text-slate-500 rounded-xl hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition"><Trash2 size={18}/></button>
                        </div>
                    </div>
                    <div className="flex justify-between items-end mb-4"><div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Saldo Tersedia</p><h3 className="text-3xl font-black text-slate-800 tracking-tight">{formatIDR(selectedWallet.initial_balance)}</h3></div></div>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">{['ALL', 'WEEK', 'MONTH', 'CUSTOM'].map(f => (<button key={f} onClick={() => setFilterType(f)} className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition border ${filterType === f ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>{f === 'ALL' ? '50 Terakhir' : f === 'WEEK' ? '7 Hari' : f === 'MONTH' ? 'Bulan Ini' : 'Custom'}</button>))}</div>
                    <AnimatePresence>{filterType === 'CUSTOM' && (<motion.div initial={{height:0, opacity:0}} animate={{height:'auto', opacity:1}} exit={{height:0, opacity:0}} className="overflow-hidden"><div className="flex gap-2 mt-2 bg-slate-50 p-2 rounded-xl border border-slate-200"><input type="date" value={customRange.start} onChange={e => setCustomRange({...customRange, start: e.target.value})} className="flex-1 p-2 bg-white rounded-lg border border-slate-200 text-xs font-bold text-slate-600 outline-none focus:border-indigo-500"/><span className="self-center text-slate-400 font-bold">-</span><input type="date" value={customRange.end} onChange={e => setCustomRange({...customRange, end: e.target.value})} className="flex-1 p-2 bg-white rounded-lg border border-slate-200 text-xs font-bold text-slate-600 outline-none focus:border-indigo-500"/></div></motion.div>)}</AnimatePresence>
                </div>
                <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-3 pb-10">
                    {loadingHistory ? (<div className="space-y-3 pt-2">{[1,2,3,4].map(i => <div key={i} className="h-16 bg-slate-200 rounded-2xl animate-pulse"></div>)}</div>) : history.length === 0 ? (<div className="text-center py-20 text-slate-400"><div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm"><History size={24}/></div><p className="font-bold text-sm text-slate-500">Tidak ada riwayat.</p><p className="text-xs mt-1">Belum ada transaksi di periode ini.</p></div>) : (history.map(t => (<motion.div key={t.id} initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} className="flex justify-between items-center p-4 bg-white rounded-2xl border border-slate-100 shadow-sm"><div className="flex items-center gap-3"><div className={`p-2.5 rounded-xl ${t.type === 'income' ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'}`}>{t.type === 'income' ? <ArrowDownLeft size={18}/> : <ArrowUpRight size={18}/>}</div><div><p className="font-bold text-sm text-slate-800 line-clamp-1">{t.merchant}</p><div className="flex items-center gap-2 mt-0.5"><span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold capitalize">{t.category}</span><span className="text-[10px] text-slate-400">{new Date(t.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})}</span></div></div></div><span className={`text-sm font-bold whitespace-nowrap ${t.type === 'income' ? 'text-green-600' : 'text-slate-800'}`}>{t.type === 'income' ? '+' : '-'} {formatIDR(t.total_amount)}</span></motion.div>)))}
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL ADD / EDIT */}
      <AnimatePresence>
        {showModal && (
            <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl relative">
                    <div className="flex justify-between items-center mb-6"><div><h3 className="font-extrabold text-xl text-slate-900">{modalMode === 'add' ? 'Tambah Akun' : 'Edit Akun'}</h3><p className="text-xs text-slate-400 mt-1">Mode: <b>{getModeLabel()}</b></p></div><button onClick={() => setShowModal(false)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition"><X className="text-slate-500" size={20}/></button></div>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div><label className="text-xs font-bold text-slate-500 ml-1 mb-1.5 block">Nama Akun</label><input type="text" placeholder={activeMode === 'BUSINESS' ? "Contoh: Kas Toko" : "Contoh: Gopay"} value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition" required/></div>
                        <div className="grid grid-cols-2 gap-3">
                            <div><label className="text-xs font-bold text-slate-500 ml-1 mb-1.5 block">Tipe</label><div className="relative"><select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-800 outline-none focus:border-indigo-500 appearance-none"><option value="cash">Tunai</option><option value="bank">Bank</option><option value="ewallet">E-Wallet</option></select></div></div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 ml-1 mb-1.5 flex items-center justify-between">
                                    Saldo Awal
                                    {calculatingMin && <span className="text-[9px] text-indigo-500 animate-pulse">Menghitung...</span>}
                                </label>
                                <NumberInput 
                                    value={form.initial_balance} 
                                    onChange={(val) => setForm({...form, initial_balance: val})} 
                                    placeholder="0" 
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition"
                                    minVal={minInitial}
                                />
                                {minInitial > 0 && <p className="text-[10px] text-red-500 mt-1 font-bold">Minimal Rp {formatIDR(minInitial)} (Ada transaksi)</p>}
                            </div>
                        </div>
                        <div className="pt-4"><button type="submit" disabled={parseFloat(form.initial_balance || 0) < minInitial} className={`w-full py-4 text-white rounded-xl font-bold text-lg shadow-lg hover:scale-[1.02] transition active:scale-95 flex justify-center items-center gap-2 ${getThemeColor()} disabled:opacity-50 disabled:cursor-not-allowed`}>{modalMode === 'add' ? 'Simpan Akun' : 'Update Akun'}</button></div>
                    </form>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      {/* NOTIFIKASI CONFIRM DELETE / BLOCKED */}
      <AnimatePresence>
        {notif.show && (
            <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white w-full max-w-xs rounded-3xl p-6 shadow-2xl text-center">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${notif.type === 'blocked' ? 'bg-slate-100 text-slate-500' : 'bg-red-100 text-red-600'}`}>{notif.type === 'blocked' ? <Lock size={32}/> : <AlertTriangle size={32}/>}</div>
                    <h3 className="text-xl font-extrabold text-slate-900 mb-2">{notif.title}</h3>
                    <p className="text-slate-500 text-sm mb-6 leading-relaxed">{notif.message}</p>
                    <div className="flex gap-3">
                        {notif.type === 'blocked' ? (
                            <button onClick={() => setNotif({ show: false })} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800">Oke, Paham</button>
                        ) : (
                            <><button onClick={() => setNotif({ show: false })} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200">Batal</button><button onClick={notif.onConfirm} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-lg">Ya, Hapus</button></>
                        )}
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>
    </div>
  );
}