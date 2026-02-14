import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthProvider';
import ModalInfo from '../../components/ModalInfo';
import MoneyInput from '../../components/MoneyInput'; // Pastikan komponen ini ada/sama pathnya
import { 
  ArrowLeft, Plus, Search, Filter, Wallet, 
  ArrowUpRight, ArrowDownLeft, CheckCircle2, 
  Clock, AlertCircle, X, Loader2, Calendar, Banknote
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const formatIDR = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

export default function DebtPage() {
  const navigate = useNavigate();
  const { user, activeEmployee } = useAuth();
  
  // LOGIC ID (SAMA PERSIS DENGAN INVENTORYPAGE)
  const ownerId = user?.id || activeEmployee?.storeId;

  // --- STATE ---
  const [activeTab, setActiveTab] = useState('payable'); // 'payable' (Hutang) | 'receivable' (Piutang)
  const [debts, setDebts] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState(null);
  const [processing, setProcessing] = useState(false);

  // Form Data
  const [formData, setFormData] = useState({
    contact_name: '',
    amount: '',
    due_date: '',
    description: ''
  });

  const [payData, setPayData] = useState({
    amount: '',
    wallet_id: '',
    notes: ''
  });

  // Notif
  const [notif, setNotif] = useState({ isOpen: false, type: 'info', title: '', message: '' });
  const showAlert = (type, title, message) => setNotif({ isOpen: true, type, title, message });

  // --- INIT ---
  useEffect(() => {
    if (ownerId) {
        fetchDebts();
        fetchWallets();
    }
  }, [ownerId, activeTab]);

  const fetchDebts = async () => {
    setLoading(true);
    try {
        const { data, error } = await supabase
            .from('debts')
            .select('*')
            .eq('user_id', ownerId)
            .eq('type', activeTab) // Filter sesuai tab
            .order('created_at', { ascending: false });

        if (error) throw error;
        setDebts(data || []);
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  const fetchWallets = async () => {
      // Tambahkan filter allocation_type
      const { data } = await supabase
        .from('wallets')
        .select('id, name, initial_balance')
        .eq('user_id', ownerId)
        .eq('allocation_type', 'BUSINESS'); // <--- Tambah baris ini
      if (data) setWallets(data);
  };

  // --- ACTIONS ---
  
  // 1. BUAT HUTANG/PIUTANG BARU
  const handleCreate = async () => {
      if (!formData.contact_name || !formData.amount) {
          return showAlert('error', 'Gagal', 'Nama dan Jumlah wajib diisi.');
      }

      setProcessing(true);
      try {
          const { error } = await supabase.from('debts').insert({
              user_id: ownerId,
              type: activeTab,
              contact_name: formData.contact_name,
              amount: parseInt(formData.amount),
              remaining_amount: parseInt(formData.amount), // Awalnya sisa = total
              due_date: formData.due_date || null,
              description: formData.description,
              status: 'unpaid'
          });

          if (error) throw error;

          showAlert('success', 'Berhasil', 'Data berhasil dicatat.');
          setShowCreateModal(false);
          setFormData({ contact_name: '', amount: '', due_date: '', description: '' });
          fetchDebts();
      } catch (e) {
          showAlert('error', 'Error', e.message);
      } finally {
          setProcessing(false);
      }
  };

  // 2. BAYAR CICILAN / LUNAS
  const handlePayment = async () => {
      if (!payData.amount || !payData.wallet_id) {
          return showAlert('error', 'Gagal', 'Jumlah bayar dan sumber dana wajib diisi.');
      }

      const payAmount = parseInt(payData.amount);
      if (payAmount > selectedDebt.remaining_amount) {
          return showAlert('error', 'Gagal', 'Jumlah bayar melebihi sisa tagihan.');
      }

      setProcessing(true);
      try {
          // Panggil RPC Sakti (Sekali panggil, semua beres)
          const { error } = await supabase.rpc('pay_manual_debt', {
              p_debt_id: selectedDebt.id,
              p_wallet_id: payData.wallet_id,
              p_amount: payAmount,
              p_notes: payData.notes || `Pembayaran ${activeTab === 'payable' ? 'Hutang' : 'Piutang'}`,
              p_employee_id: activeEmployee?.id || null
          });

          if (error) throw error;

          showAlert('success', 'Berhasil', 'Pembayaran berhasil dicatat & jurnal diperbarui.');
          setShowPayModal(false);
          setPayData({ amount: '', wallet_id: '', notes: '' });
          fetchDebts();
          fetchWallets(); // Refresh saldo tampilan

      } catch (e) {
          console.error(e);
          showAlert('error', 'Gagal Bayar', e.message);
      } finally {
          setProcessing(false);
      }
  };

  // --- UI HELPER ---
  const filteredDebts = debts.filter(d => 
      d.contact_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalOutstanding = filteredDebts.reduce((acc, curr) => acc + curr.remaining_amount, 0);

  // Warna Tema berdasarkan Tab
  const themeColor = activeTab === 'payable' ? 'text-red-600' : 'text-green-600';
  const bgColor = activeTab === 'payable' ? 'bg-red-50' : 'bg-green-50';
  const borderColor = activeTab === 'payable' ? 'border-red-200' : 'border-green-200';
  const buttonColor = activeTab === 'payable' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700';

  return (
    <div className="h-screen bg-slate-50 font-sans flex flex-col overflow-hidden">
      
      {/* HEADER FIXED (Gaya InventoryPage) */}
      <div className="shrink-0 bg-slate-50 z-50 shadow-md">
          {/* Top Bar (Dynamic Color) */}
          <div className={`${activeTab === 'payable' ? 'bg-red-600' : 'bg-green-600'} px-6 pt-6 pb-6 rounded-b-[2rem] relative z-10 transition-colors duration-300`}>
              <div className="flex items-center gap-3 mb-4">
                  <button 
                        // Logic: Cek user (Owner) dulu, jika ada lempar ke /dashboard. Jika tidak, baru ke dashboard karyawan.
                        onClick={() => navigate(user ? '/dashboard' : '/employee-dashboard')} 
                        className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition backdrop-blur-sm"
                    >
                        <ArrowLeft size={20}/>
                    </button>
                  <div className="flex-1"><h1 className="text-xl font-extrabold text-white">Catatan Hutang</h1><p className="text-xs text-white/80 font-medium">Manajemen Keuangan</p></div>
                  <button onClick={() => setShowCreateModal(true)} className="p-2 bg-white text-slate-800 rounded-xl shadow-md hover:bg-slate-100 transition active:scale-95"><Plus size={20}/></button>
              </div>
              
              {/* Search Bar */}
              <div className="bg-white/10 p-2 rounded-xl border border-white/20 flex items-center px-3 backdrop-blur-sm">
                  <Search size={18} className="text-white"/>
                  <input type="text" placeholder="Cari nama..." className="w-full bg-transparent p-1 text-sm text-white placeholder:text-white/70 outline-none font-medium" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                  {searchTerm && <button onClick={()=>setSearchTerm('')}><X size={16} className="text-white/70"/></button>}
              </div>
          </div>

          {/* TABS & SUMMARY (White BG) */}
          <div className="bg-white pb-3 pt-3 px-4 border-b border-slate-100">
              <div className="flex p-1 bg-slate-100 rounded-xl mb-3">
                  <button onClick={() => setActiveTab('payable')} className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1 ${activeTab === 'payable' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-400'}`}>
                      <ArrowUpRight size={14}/> Hutang Kita
                  </button>
                  <button onClick={() => setActiveTab('receivable')} className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1 ${activeTab === 'receivable' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-400'}`}>
                      <ArrowDownLeft size={14}/> Piutang Orang
                  </button>
              </div>

              <div className={`p-4 rounded-xl border ${bgColor} ${borderColor} flex flex-col items-center justify-center`}>
                  <p className={`text-[10px] font-bold uppercase tracking-wider opacity-70 ${activeTab==='payable'?'text-red-800':'text-green-800'}`}>
                      Total {activeTab === 'payable' ? 'Yang Harus Dibayar' : 'Yang Harus Ditagih'}
                  </p>
                  <h2 className={`text-2xl font-black mt-1 ${themeColor}`}>{formatIDR(totalOutstanding)}</h2>
              </div>
          </div>
      </div>

      {/* CONTENT LIST (SCROLLABLE) */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-slate-50 pb-20">
          {loading ? <div className="text-center py-10 text-slate-400 text-xs">Memuat data...</div> : 
           filteredDebts.length === 0 ? <div className="text-center py-16 text-slate-300"><Wallet size={48} className="mx-auto mb-2 opacity-50"/><p className="text-sm font-medium">Belum ada catatan.</p></div> : 
           filteredDebts.map(debt => {
               const percentage = Math.round(((debt.amount - debt.remaining_amount) / debt.amount) * 100);
               return (
                   <div key={debt.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                       <div className="flex justify-between items-start mb-2">
                           <div>
                               <h3 className="font-bold text-slate-800 text-base">{debt.contact_name}</h3>
                               <p className="text-[10px] text-slate-400 flex items-center gap-1"><Calendar size={10}/> Jatuh Tempo: {debt.due_date ? new Date(debt.due_date).toLocaleDateString('id-ID') : '-'}</p>
                           </div>
                           <div className={`px-2 py-1 rounded text-[9px] font-bold uppercase ${debt.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                               {debt.status === 'paid' ? 'Lunas' : debt.status === 'partial' ? 'Cicilan' : 'Belum Lunas'}
                           </div>
                       </div>

                       <div className="flex justify-between items-end mb-3">
                           <div>
                               <p className="text-[9px] text-slate-400 mb-0.5">Sisa Tagihan</p>
                               <p className={`text-base font-extrabold ${themeColor}`}>{formatIDR(debt.remaining_amount)}</p>
                           </div>
                           <div className="text-right">
                               <p className="text-[9px] text-slate-400">Total Awal</p>
                               <p className="text-xs font-bold text-slate-600 line-through decoration-slate-300">{formatIDR(debt.amount)}</p>
                           </div>
                       </div>

                       {/* Progress Bar */}
                       <div className="w-full bg-slate-100 rounded-full h-1.5 mb-3 overflow-hidden">
                           <div className={`h-full rounded-full transition-all duration-500 ${activeTab==='payable'?'bg-red-500':'bg-green-500'}`} style={{width: `${percentage}%`}}></div>
                       </div>

                       {debt.status !== 'paid' && (
                        <>
                            {/* Cek apakah ini piutang dari Invoice (berdasarkan kata 'Invoice #' di deskripsi) */}
                            {debt.type === 'receivable' && debt.description?.includes('Invoice #') ? (
                                <div className="w-full py-2 px-3 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-indigo-600 flex items-center gap-1 italic">
                                        <AlertCircle size={12}/> Kelola via Menu Invoice
                                    </span>
                                    <button 
                                        onClick={() => navigate('/invoice')} // Arahkan user ke menu invoice
                                        className="text-[10px] font-black text-indigo-700 underline underline-offset-2"
                                    >
                                        Buka
                                    </button>
                                </div>
                            ) : (
                                /* Jika hutang manual biasa, tombol bayar tetap muncul */
                                <button 
                                    onClick={() => { setSelectedDebt(debt); setShowPayModal(true); }} 
                                    className={`w-full py-2 rounded-lg font-bold text-xs border border-dashed ${activeTab==='payable'?'border-red-200 text-red-600 hover:bg-red-50':'border-green-200 text-green-600 hover:bg-green-50'} transition flex items-center justify-center gap-2`}
                                >
                                    <Banknote size={14}/> {activeTab === 'payable' ? 'Bayar Hutang' : 'Terima Pembayaran'}
                                </button>
                            )}
                        </>
                    )}
                   </div>
               );
           })
          }
      </div>

      {/* MODAL CREATE */}
      <AnimatePresence>
          {showCreateModal && (
              <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                  <motion.div initial={{y:"100%"}} animate={{y:0}} exit={{y:"100%"}} className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">
                      <div className="p-5 border-b bg-white flex justify-between items-center">
                          <h3 className="font-extrabold text-lg text-slate-800">Catatan {activeTab === 'payable' ? 'Hutang' : 'Piutang'} Baru</h3>
                          <button onClick={() => setShowCreateModal(false)} className="p-1 rounded-full bg-slate-100 hover:text-red-500 transition"><X size={20}/></button>
                      </div>
                      <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto bg-slate-50/50">
                          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-3">
                              <div>
                                  <label className="text-xs font-bold text-slate-500 mb-1 block">{activeTab === 'payable' ? "Hutang ke Siapa? (Supplier)" : "Siapa yang Ngutang? (Pelanggan)"}</label>
                                  <input type="text" className="w-full p-3 bg-slate-50 rounded-xl outline-none border focus:border-indigo-500 text-sm font-bold" value={formData.contact_name} onChange={e => setFormData({...formData, contact_name: e.target.value})} />
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-slate-500 mb-1 block">Nominal (Rp)</label>
                                  <MoneyInput className="w-full p-3 bg-slate-50 rounded-xl outline-none border focus:border-indigo-500 font-extrabold text-lg" value={formData.amount} onChange={val => setFormData({...formData, amount: val})} placeholder="0"/>
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-slate-500 mb-1 block">Jatuh Tempo (Opsional)</label>
                                  <input type="date" className="w-full p-3 bg-slate-50 rounded-xl outline-none border text-sm" value={formData.due_date} onChange={e => setFormData({...formData, due_date: e.target.value})} />
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-slate-500 mb-1 block">Catatan</label>
                                  <textarea className="w-full p-3 bg-slate-50 rounded-xl outline-none border text-sm" rows="2" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}></textarea>
                              </div>
                          </div>
                          <button onClick={handleCreate} disabled={processing} className={`w-full py-4 text-white rounded-xl font-bold text-sm shadow-lg ${buttonColor}`}>{processing ? <Loader2 className="animate-spin mx-auto"/> : 'Simpan Catatan'}</button>
                      </div>
                  </motion.div>
              </div>
          )}
      </AnimatePresence>

      {/* MODAL PAY */}
      <AnimatePresence>
          {showPayModal && selectedDebt && (
              <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                  <motion.div initial={{y:"100%"}} animate={{y:0}} exit={{y:"100%"}} className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">
                      <div className="p-5 border-b bg-white flex justify-between items-center">
                          <h3 className="font-extrabold text-lg text-slate-800">{activeTab === 'payable' ? 'Bayar Hutang' : 'Terima Pembayaran'}</h3>
                          <button onClick={() => setShowPayModal(false)} className="p-1 rounded-full bg-slate-100 hover:text-red-500 transition"><X size={20}/></button>
                      </div>
                      <div className="p-6 space-y-4 bg-slate-50/50">
                          <div className="bg-white p-4 rounded-xl border border-slate-100 text-center shadow-sm">
                              <p className="text-xs text-slate-500 uppercase font-bold">Sisa Tagihan</p>
                              <p className="text-3xl font-black text-slate-800">{formatIDR(selectedDebt.remaining_amount)}</p>
                              <p className="text-xs text-slate-400 mt-1 font-medium">{selectedDebt.contact_name}</p>
                          </div>
                          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-3">
                              <div>
                                  <label className="text-xs font-bold text-slate-500 mb-1 block">Jumlah Bayar</label>
                                  <MoneyInput className="w-full p-3 bg-slate-50 rounded-xl outline-none border focus:border-indigo-500 font-extrabold text-lg" value={payData.amount} onChange={val => setPayData({...payData, amount: val})} placeholder="0"/>
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-slate-500 mb-1 block">Sumber Dana</label>
                                  <select className="w-full p-3 bg-slate-50 rounded-xl outline-none border text-sm font-bold" value={payData.wallet_id} onChange={e => setPayData({...payData, wallet_id: e.target.value})}>
                                      <option value="">-- Pilih Dompet --</option>
                                      {wallets.map(w => <option key={w.id} value={w.id}>{w.name} (Saldo: {formatIDR(w.initial_balance)})</option>)}
                                  </select>
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-slate-500 mb-1 block">Catatan Pembayaran</label>
                                  <input type="text" className="w-full p-3 bg-slate-50 rounded-xl outline-none border text-sm" value={payData.notes} onChange={e => setPayData({...payData, notes: e.target.value})} />
                              </div>
                          </div>
                          <button onClick={handlePayment} disabled={processing} className={`w-full py-4 text-white rounded-xl font-bold text-sm shadow-lg ${buttonColor}`}>{processing ? <Loader2 className="animate-spin mx-auto"/> : 'Konfirmasi Pembayaran'}</button>
                      </div>
                  </motion.div>
              </div>
          )}
      </AnimatePresence>

      <ModalInfo isOpen={notif.isOpen} type={notif.type} title={notif.title} message={notif.message} onClose={() => setNotif(prev => ({...prev, isOpen: false}))} />
    </div>
  );
}