import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthProvider';
import { 
  ArrowLeft, Plus, Wallet, CreditCard, Banknote, 
  Trash2, Briefcase, Users, User
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function WalletPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // --- STATE MODE (SAMA SEPERTI DASHBOARD) ---
  const [activeMode, setActiveMode] = useState(() => {
      return localStorage.getItem('app_mode') || 'PERSONAL';
  });

  // --- STATE DATA ---
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalBalance, setTotalBalance] = useState(0);

  // --- STATE MODAL ---
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'cash', initial_balance: '' });
  const [saving, setSaving] = useState(false);

  // --- LOAD DATA (Trigger saat User / Mode berubah) ---
  useEffect(() => {
    if (user) fetchWallets();
  }, [user, activeMode]); // <--- Reload kalau ganti mode

  const fetchWallets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user.id)
        .eq('allocation_type', activeMode) // <--- FILTER PENTING: Hanya ambil dompet mode aktif
        .order('created_at', { ascending: true });

      if (error) throw error;

      const list = data || [];
      setWallets(list);
      
      const total = list.reduce((acc, curr) => acc + (curr.initial_balance || 0), 0);
      setTotalBalance(total);

    } catch (err) {
      console.error("Error fetching wallets:", err);
    } finally {
      setLoading(false);
    }
  };

  // --- SIMPAN DOMPET (SESUAI MODE) ---
  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        name: form.name,
        type: form.type,
        initial_balance: parseFloat(form.initial_balance || 0),
        currency: 'IDR',
        allocation_type: activeMode // <--- SIMPAN SESUAI MODE YANG AKTIF
      };

      const { error } = await supabase.from('wallets').insert(payload);
      if (error) throw error;

      setShowModal(false);
      setForm({ name: '', type: 'cash', initial_balance: '' });
      fetchWallets(); 
    } catch (err) {
      alert("Gagal menyimpan: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // --- HAPUS DOMPET ---
  const handleDelete = async (id) => {
    if (!confirm("Yakin hapus dompet ini?")) return;
    try {
      const { error } = await supabase.from('wallets').delete().eq('id', id);
      if (error) throw error;
      setWallets(wallets.filter(w => w.id !== id));
    } catch (err) {
      alert("Gagal hapus (Mungkin ada transaksi terkait): " + err.message);
    }
  };

  // --- HELPER UI ---
  const formatIDR = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

  const getWalletIcon = (type) => {
    switch (type) {
        case 'bank': return <CreditCard className="text-blue-600" size={24}/>;
        case 'ewallet': return <Wallet className="text-purple-600" size={24}/>;
        default: return <Banknote className="text-emerald-600" size={24}/>;
    }
  };

  const getWalletColor = (type) => {
      switch (type) {
          case 'bank': return 'bg-blue-50 border-blue-100 text-blue-600';
          case 'ewallet': return 'bg-purple-50 border-purple-100 text-purple-600';
          default: return 'bg-emerald-50 border-emerald-100 text-emerald-600';
      }
  };

  const getModeLabel = () => {
      if (activeMode === 'BUSINESS') return 'Kas Bisnis';
      if (activeMode === 'ORGANIZATION') return 'Kas Organisasi';
      return 'Dompet Pribadi';
  }

  const getThemeColor = () => {
      if (activeMode === 'BUSINESS') return 'bg-blue-600';
      if (activeMode === 'ORGANIZATION') return 'bg-teal-600';
      return 'bg-indigo-600'; 
  };

  return (
    <div className="max-w-[420px] mx-auto bg-white min-h-screen relative shadow-2xl overflow-hidden border-x border-gray-100 font-sans pb-24">
      
      {/* --- HEADER --- */}
      <div className={`${getThemeColor()} pb-16 pt-6 px-6 rounded-b-[2.5rem] relative overflow-hidden transition-colors duration-500`}>
         <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
         
         {/* Top Bar */}
         <div className="relative z-10 flex items-center justify-between mb-6">
            <button onClick={() => navigate('/dashboard')} className="p-2 bg-white/10 rounded-full text-white hover:bg-white/20 transition backdrop-blur-sm">
                <ArrowLeft size={20}/>
            </button>
            <div className="flex flex-col items-center">
                <h1 className="text-lg font-bold text-white tracking-wide">Dompet & Rekening</h1>
                <div className="flex items-center gap-1 text-[10px] text-white/80 bg-white/10 px-2 py-0.5 rounded-full mt-1">
                    {activeMode === 'BUSINESS' ? <Briefcase size={10}/> : activeMode === 'ORGANIZATION' ? <Users size={10}/> : <User size={10}/>}
                    {getModeLabel()}
                </div>
            </div>
            <div className="w-10"></div> 
         </div>

         {/* Total Balance Info */}
         <div className="text-center text-white relative z-10">
            <p className="text-white/70 text-xs font-bold uppercase tracking-widest mb-1">Total Aset {activeMode !== 'PERSONAL' ? 'Usaha' : ''}</p>
            <h2 className="text-3xl font-extrabold tracking-tight">
               {loading ? <span className="animate-pulse opacity-50">...</span> : formatIDR(totalBalance)}
            </h2>
         </div>
      </div>

      {/* --- LIST DOMPET --- */}
      <div className="px-6 -mt-8 relative z-20 space-y-3">
         
         <button 
            onClick={() => setShowModal(true)}
            className="w-full bg-white p-4 rounded-2xl shadow-lg shadow-slate-200/50 border border-dashed border-slate-300 flex items-center justify-center gap-2 text-slate-600 font-bold hover:bg-slate-50 transition active:scale-95"
         >
            <Plus size={20}/> Tambah Akun {activeMode === 'PERSONAL' ? '' : 'Baru'}
         </button>

         {/* List Data */}
         {loading ? (
             <div className="space-y-3 pt-2">
                 {[1,2,3].map(i => <div key={i} className="h-20 bg-white rounded-2xl animate-pulse"></div>)}
             </div>
         ) : wallets.length === 0 ? (
             <div className="text-center py-10 pt-16">
                 <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-300">
                     <Wallet size={32}/>
                 </div>
                 <p className="text-slate-400 text-sm font-medium">Belum ada akun di mode {getModeLabel()}.</p>
             </div>
         ) : (
             <div className="space-y-3 pt-2">
                 {wallets.map((w) => (
                     <motion.div 
                        key={w.id} 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center relative overflow-hidden hover:bg-slate-50 transition"
                     >
                        <div className="flex items-center gap-4 relative z-10">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${getWalletColor(w.type)}`}>
                                {getWalletIcon(w.type)}
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 text-sm">{w.name}</h3>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md font-bold uppercase tracking-wider">{w.type}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="text-right relative z-10">
                            <span className="block font-bold text-slate-800 text-sm mb-1">{formatIDR(w.initial_balance)}</span>
                            <button 
                                onClick={() => handleDelete(w.id)}
                                className="text-[10px] text-red-400 hover:text-red-600 font-bold bg-red-50 hover:bg-red-100 px-2 py-1 rounded-md transition"
                            >
                                Hapus
                            </button>
                        </div>
                     </motion.div>
                 ))}
             </div>
         )}
      </div>

      {/* --- MODAL TAMBAH --- */}
      <AnimatePresence>
        {showModal && (
            <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <motion.div 
                    initial={{ y: "100%" }} 
                    animate={{ y: 0 }} 
                    exit={{ y: "100%" }} 
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl relative"
                >
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="font-extrabold text-xl text-slate-900">Tambah Akun</h3>
                            <p className="text-xs text-slate-400 mt-1">Untuk Mode: <b>{getModeLabel()}</b></p>
                        </div>
                        <button onClick={() => setShowModal(false)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition"><X className="text-slate-500" size={20}/></button>
                    </div>

                    <form onSubmit={handleSave} className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 ml-1 mb-1.5 block">Nama Akun</label>
                            <input 
                                type="text" 
                                placeholder={activeMode === 'BUSINESS' ? "Contoh: Kas Toko / BCA Bisnis" : "Contoh: Dompet Saku / Gopay"}
                                value={form.name}
                                onChange={e => setForm({...form, name: e.target.value})}
                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold text-slate-500 ml-1 mb-1.5 block">Tipe</label>
                                <div className="relative">
                                    <select 
                                        value={form.type}
                                        onChange={e => setForm({...form, type: e.target.value})}
                                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-800 outline-none focus:border-indigo-500 appearance-none"
                                    >
                                        <option value="cash">Tunai (Cash)</option>
                                        <option value="bank">Bank</option>
                                        <option value="ewallet">E-Wallet</option>
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">▼</div>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 ml-1 mb-1.5 block">Saldo Awal</label>
                                <input 
                                    type="number" 
                                    placeholder="0" 
                                    value={form.initial_balance}
                                    onChange={e => setForm({...form, initial_balance: e.target.value})}
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition"
                                />
                            </div>
                        </div>

                        <div className="pt-4">
                            <button 
                                type="submit" 
                                disabled={saving} 
                                className={`w-full py-4 text-white rounded-xl font-bold text-lg shadow-lg hover:scale-[1.02] transition active:scale-95 disabled:opacity-70 flex justify-center items-center gap-2 ${getThemeColor()}`}
                            >
                                {saving ? 'Menyimpan...' : 'Simpan Akun'}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

    </div>
  );
}

const X = ({size, className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M18 6 6 18"/><path d="m6 6 18 18"/></svg>
);