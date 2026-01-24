import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthProvider';
import { 
  ArrowLeft, Plus, Zap, Wifi, Smartphone, CreditCard, 
  Home, Droplets, MonitorPlay, Calendar, CheckCircle2, 
  AlertCircle, Clock, Trash2, X, Hourglass, Edit2, History,
  ChevronLeft, ChevronRight
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

export default function BillsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // --- STATE UTAMA ---
  const [viewDate, setViewDate] = useState(new Date()); 
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('rutin'); 
  const [summary, setSummary] = useState({ total: 0, paid: 0, unpaid: 0 });

  // State Detail (Full Page)
  const [selectedBill, setSelectedBill] = useState(null); 

  // Counters Badge
  const [badges, setBadges] = useState({ rutin: 0, cicilan: 0 });

  // Modal Input & Notif
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
  const [formData, setFormData] = useState({ 
      id: null, name: '', amount: '', due_date: '', icon: 'Zap',
      type: 'rutin', total_tenor: '', start_date: '' 
  });
  const [notif, setNotif] = useState({ show: false, type: 'info', title: '', message: '', onConfirm: null });

  const ICONS = { Zap, Wifi, Smartphone, CreditCard, Home, Droplets, MonitorPlay };
  const formatIDR = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  const getMonthName = (date) => date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  // 1. FETCH DATA
  useEffect(() => {
    if (user) fetchBills();
  }, [user, viewDate]); 

  const fetchBills = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('bills').select('*').eq('user_id', user.id);
      if (error) throw error;

      let rutinCount = 0;
      let cicilanCount = 0;

      const processedData = (data || []).map(b => {
          const status = getStatusForDate(b, viewDate);
          if (!status.isPaid) {
              if (b.bill_type === 'rutin') rutinCount++;
              else if (b.bill_type === 'cicilan') {
                  const info = getInstallmentInfo(b);
                  if (!info?.isFinished) cicilanCount++;
              }
          }
          return { ...b, ...status }; 
      });

      const sortedData = processedData.sort((a, b) => {
          if (a.isPaid === b.isPaid) return a.due_date - b.due_date;
          return a.isPaid ? 1 : -1; 
      });

      setBills(sortedData);
      setBadges({ rutin: rutinCount, cicilan: cicilanCount });
      calculateSummary(sortedData);

    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  // --- LOGIC STATUS ---
  const getStatusForDate = (bill, targetDate) => {
      const today = new Date();
      const isCurrentMonth = targetDate.getMonth() === today.getMonth() && targetDate.getFullYear() === today.getFullYear();
      
      let isPaid = false;
      let paidAt = null;

      if (bill.last_paid_at) {
          const paidDate = new Date(bill.last_paid_at);
          if (paidDate.getMonth() === targetDate.getMonth() && paidDate.getFullYear() === targetDate.getFullYear()) {
              isPaid = true;
              paidAt = paidDate;
          }
      }

      let statusText = 'Belum Bayar';
      let statusColor = 'bg-slate-100 text-slate-500';
      let urgent = false;

      if (isPaid) {
          statusText = 'Lunas';
          statusColor = 'bg-green-100 text-green-600';
      } else {
          const dueDateThisMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), bill.due_date);
          const diffTime = dueDateThisMonth - today; 
          const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (isCurrentMonth) {
              if (daysLeft < 0) {
                  statusText = `Telat ${Math.abs(daysLeft)} Hari`;
                  statusColor = 'bg-red-50 text-red-600 border border-red-100';
                  urgent = true;
              } else if (daysLeft === 0) {
                  statusText = 'Hari Ini!';
                  statusColor = 'bg-amber-50 text-amber-600 border border-amber-100';
                  urgent = true;
              } else if (daysLeft <= 3) {
                  statusText = `${daysLeft} Hari Lagi`;
                  statusColor = 'bg-indigo-50 text-indigo-600';
                  urgent = true;
              } else {
                  statusText = `${daysLeft} Hari Lagi`;
                  statusColor = 'bg-slate-50 text-slate-500';
              }
          } else {
              if (daysLeft > 0) {
                  statusText = `Estimasi ${daysLeft} Hari Lagi`;
                  statusColor = 'bg-slate-50 text-slate-400';
              } else {
                  statusText = 'Lewat Tanggal';
                  statusColor = 'bg-slate-50 text-slate-400';
              }
          }
      }
      return { isPaid, statusText, statusColor, urgent, paidAt };
  };

  const getInstallmentInfo = (bill) => {
      if (bill.bill_type !== 'cicilan' || !bill.start_date) return null;
      const start = new Date(bill.start_date);
      let monthsPassed = (viewDate.getFullYear() - start.getFullYear()) * 12 + (viewDate.getMonth() - start.getMonth()) + 1;
      const endDate = new Date(start);
      endDate.setMonth(start.getMonth() + bill.total_tenor);

      return {
          current: Math.max(0, Math.min(monthsPassed, bill.total_tenor)), 
          total: bill.total_tenor,
          endDate: endDate.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }),
          isFinished: monthsPassed > bill.total_tenor
      };
  };

  const calculateSummary = (data) => {
      let total = 0, unpaid = 0;
      data.forEach(b => {
          const installmentInfo = getInstallmentInfo(b);
          if (b.bill_type === 'cicilan' && installmentInfo?.isFinished) return;
          total += Number(b.amount);
          if (!b.isPaid) unpaid += Number(b.amount);
      });
      setSummary({ total, unpaid });
  };

  // --- ACTIONS ---
  const changeMonth = (direction) => {
      const newDate = new Date(viewDate);
      newDate.setMonth(newDate.getMonth() + direction);
      setViewDate(newDate);
  };

  const handleSaveBill = async () => {
      try {
          if (!formData.name || !formData.amount || !formData.due_date) return showAlert('error', 'Eits!', 'Data belum lengkap.');
          
          const payload = {
              user_id: user.id, name: formData.name, amount: formData.amount, due_date: formData.due_date, icon: formData.icon, bill_type: formData.type,
              total_tenor: formData.type === 'cicilan' ? formData.total_tenor : 0, start_date: formData.type === 'cicilan' ? formData.start_date : null
          };

          if (modalMode === 'add') {
              const { error } = await supabase.from('bills').insert(payload);
              if (error) throw error;
          } else {
              const { error } = await supabase.from('bills').update(payload).eq('id', formData.id);
              if (error) throw error;
              if (selectedBill && selectedBill.id === formData.id) setSelectedBill({ ...selectedBill, ...payload });
          }

          setShowModal(false); fetchBills(); showAlert('success', 'Berhasil!', modalMode === 'add' ? 'Tagihan dibuat.' : 'Tagihan diupdate.');
      } catch (e) { showAlert('error', 'Gagal', e.message); }
  };

  const markAsPaid = async () => {
      try {
          const paymentDate = new Date(viewDate);
          const today = new Date();
          if (paymentDate.getMonth() === today.getMonth()) paymentDate.setDate(today.getDate());
          else paymentDate.setDate(selectedBill.due_date); 

          const { error } = await supabase.from('bills').update({ last_paid_at: paymentDate.toISOString() }).eq('id', selectedBill.id);
          if (error) throw error;
          
          fetchBills(); 
          // Update local state untuk refleksi instan
          setSelectedBill({ ...selectedBill, isPaid: true, paidAt: paymentDate });
          showAlert('success', 'Lunas!', `Tagihan ${selectedBill.name} tercatat lunas.`);
      } catch (e) { showAlert('error', 'Gagal', e.message); }
  };

  const requestDelete = () => {
      setNotif({ show: true, type: 'confirm', title: 'Hapus Tagihan?', message: 'Data tagihan ini akan dihapus permanen.', onConfirm: handleDelete });
  };

  const handleDelete = async () => {
      await supabase.from('bills').delete().eq('id', selectedBill.id);
      setNotif({ ...notif, show: false });
      setSelectedBill(null);
      fetchBills();
  };

  // --- UI HELPERS ---
  const openAdd = () => { setModalMode('add'); setFormData({ id: null, name: '', amount: '', due_date: '', icon: 'Zap', type: activeTab, total_tenor: '', start_date: '' }); setShowModal(true); };
  const openEdit = () => { setModalMode('edit'); setFormData({ id: selectedBill.id, name: selectedBill.name, amount: selectedBill.amount, due_date: selectedBill.due_date, icon: selectedBill.icon, type: selectedBill.bill_type, total_tenor: selectedBill.total_tenor, start_date: selectedBill.start_date }); setShowModal(true); };
  const openDetail = (bill) => { setSelectedBill(bill); };
  const showAlert = (type, title, message) => setNotif({ show: true, type, title, message, onConfirm: null });
  const closeNotif = () => setNotif({ ...notif, show: false });

  const filteredBills = bills.filter(b => {
      const info = getInstallmentInfo(b);
      if (b.bill_type === 'cicilan' && info?.isFinished && b.isPaid) return false;
      return b.bill_type === activeTab;
  });

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-24">
      {/* HEADER */}
      <div className="bg-indigo-600 p-6 pb-24 rounded-b-[2.5rem] shadow-xl relative overflow-hidden">
         <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
         <div className="flex items-center gap-3 mb-6 relative z-10">
            <button onClick={() => navigate('/dashboard')} className="p-2 bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-white/30"><ArrowLeft size={20}/></button>
            <h1 className="text-xl font-bold text-white">Tagihan & Cicilan</h1>
         </div>
         <div className="flex items-center justify-between mb-4 relative z-10 text-white/90">
             <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-white/10 rounded-full"><ChevronLeft/></button>
             <span className="font-bold text-lg">{getMonthName(viewDate)}</span>
             <button onClick={() => changeMonth(1)} className="p-1 hover:bg-white/10 rounded-full"><ChevronRight/></button>
         </div>
         <div className="flex justify-between items-end relative z-10 text-white">
             <div><p className="text-indigo-200 text-xs mb-1">Total Tagihan {activeTab === 'rutin' ? 'Bulanan' : 'Cicilan'}</p><h2 className="text-3xl font-extrabold">{formatIDR(summary.total)}</h2></div>
             <div className="text-right"><p className="text-indigo-200 text-xs mb-1">Belum Bayar</p><p className="text-xl font-bold text-amber-300">{formatIDR(summary.unpaid)}</p></div>
         </div>
      </div>

      <div className="px-6 -mt-16 relative z-20 space-y-5">
         <div className="bg-white p-1 rounded-2xl shadow-lg border border-indigo-50 flex">
             <button onClick={() => setActiveTab('rutin')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition relative ${activeTab === 'rutin' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400'}`}>Rutin {badges.rutin > 0 && <span className="absolute top-2 right-4 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}</button>
             <button onClick={() => setActiveTab('cicilan')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition relative ${activeTab === 'cicilan' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400'}`}>Cicilan {badges.cicilan > 0 && <span className="absolute top-2 right-4 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}</button>
         </div>

         {/* --- PERBAIKAN: Tombol Tambah ditaruh di luar kondisi filteredBills --- */}
         <button onClick={openAdd} className="w-full py-4 bg-white rounded-2xl shadow-sm border border-dashed border-indigo-200 text-indigo-600 font-bold text-sm flex items-center justify-center gap-2 hover:bg-indigo-50 transition active:scale-95">
            <Plus size={18}/> Tambah {activeTab === 'rutin' ? 'Tagihan' : 'Cicilan'}
         </button>

         {/* LIST UTAMA */}
         {loading ? ( 
             <div className="space-y-3 pt-2">{[1,2,3].map(i => <div key={i} className="h-24 bg-slate-200 rounded-2xl animate-pulse"></div>)}</div> 
         ) : filteredBills.length === 0 ? (
             <div className="text-center py-10 text-slate-400"><div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm text-indigo-300"><Calendar size={32}/></div><p>Tidak ada tagihan {activeTab} di bulan ini.</p></div>
         ) : (
             <div className="space-y-3">
                 {filteredBills.map(bill => {
                     const Icon = ICONS[bill.icon] || Zap;
                     const installment = getInstallmentInfo(bill);
                     return (
                         <motion.div key={bill.id} layout onClick={() => openDetail(bill)} className={`bg-white p-4 rounded-2xl shadow-sm border flex flex-col gap-3 relative overflow-hidden transition active:scale-98 cursor-pointer ${bill.urgent && !bill.isPaid ? 'border-red-300 ring-2 ring-red-50' : 'border-slate-100 hover:border-indigo-200'}`}>
                             <div className="flex items-center justify-between relative z-10">
                                 <div className="flex items-center gap-3">
                                     <div className={`p-3 rounded-xl ${bill.isPaid ? 'bg-green-50 text-green-600' : 'bg-indigo-50 text-indigo-600'}`}><Icon size={24}/></div>
                                     <div>
                                         <h3 className={`font-bold ${bill.isPaid ? 'text-slate-500' : 'text-slate-800'}`}>{bill.name}</h3>
                                         <div className="flex items-center gap-2 mt-0.5">
                                             <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${bill.isPaid ? 'bg-green-100 text-green-600' : bill.statusColor}`}>{bill.statusText}</span>
                                             {installment && (<span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><Hourglass size={10}/> {installment.current}/{installment.total}</span>)}
                                         </div>
                                     </div>
                                 </div>
                                 <div className="text-right">
                                     <p className={`font-bold ${bill.isPaid ? 'text-slate-400' : 'text-slate-800'}`}>{formatIDR(bill.amount)}</p>
                                     <span className="text-[10px] text-slate-400 flex items-center justify-end gap-1"><Calendar size={10}/> Tgl {bill.due_date}</span>
                                 </div>
                             </div>
                         </motion.div>
                     );
                 })}
             </div>
         )}
      </div>

      {/* === FULL PAGE DETAIL (COMPACT & MODERN) === */}
      <AnimatePresence>
        {selectedBill && (
            <motion.div 
                initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} 
                transition={{ type: "spring", damping: 25, stiffness: 200 }} 
                className="fixed inset-0 z-50 bg-slate-50 flex flex-col h-full w-full max-w-[420px] mx-auto"
            >
                {/* Header Detail */}
                <div className="bg-white px-5 pt-5 pb-4 shadow-sm z-10 shrink-0 border-b border-slate-100 flex items-center justify-between sticky top-0">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setSelectedBill(null)} className="p-2 -ml-2 rounded-full text-slate-600 hover:bg-slate-100 transition"><ArrowLeft size={24}/></button>
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${selectedBill.isPaid ? 'bg-green-50 text-green-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                {React.createElement(ICONS[selectedBill.icon] || Zap, { size: 20 })}
                            </div>
                            <div>
                                <h2 className="font-bold text-base text-slate-900 leading-tight">{selectedBill.name}</h2>
                                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{selectedBill.bill_type} • Tgl {selectedBill.due_date}</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-1">
                        <button onClick={openEdit} className="p-2 text-slate-400 hover:text-indigo-600 transition"><Edit2 size={18}/></button>
                        <button onClick={requestDelete} className="p-2 text-slate-400 hover:text-red-500 transition"><Trash2 size={18}/></button>
                    </div>
                </div>

                {/* Body Detail */}
                <div className="p-5 space-y-4">
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 text-center">
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-1">Total Tagihan</p>
                        <h2 className="text-3xl font-black text-slate-800">{formatIDR(selectedBill.amount)}</h2>
                        
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full mt-3 text-xs font-bold ${selectedBill.isPaid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                            {selectedBill.isPaid ? <CheckCircle2 size={14}/> : <AlertCircle size={14}/>}
                            {selectedBill.isPaid ? 'LUNAS' : 'BELUM DIBAYAR'}
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-100 space-y-3">
                        <div className="flex justify-between text-sm py-2 border-b border-slate-50">
                            <span className="text-slate-500">Jatuh Tempo</span>
                            <span className="font-bold text-slate-800">Tanggal {selectedBill.due_date} {getMonthName(viewDate)}</span>
                        </div>
                        {selectedBill.isPaid && selectedBill.paidAt && (
                            <div className="flex justify-between text-sm py-2 border-b border-slate-50">
                                <span className="text-slate-500">Dibayar Pada</span>
                                <span className="font-bold text-green-600">{new Date(selectedBill.paidAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                            </div>
                        )}
                        {selectedBill.bill_type === 'cicilan' && (
                            <div className="flex justify-between text-sm py-2">
                                <span className="text-slate-500">Tenor</span>
                                <span className="font-bold text-slate-800">{selectedBill.total_tenor} Bulan</span>
                            </div>
                        )}
                    </div>

                    {!selectedBill.isPaid && (
                        <button onClick={markAsPaid} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 active:scale-95 transition flex items-center justify-center gap-2">
                            <CheckCircle2 size={20}/> Tandai Sudah Bayar
                        </button>
                    )}
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* --- MODAL ADD / EDIT --- */}
      <AnimatePresence>
        {showModal && (
            <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <motion.div initial={{y: "100%"}} animate={{y: 0}} exit={{y: "100%"}} className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl h-[80vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-6"><h3 className="font-bold text-xl text-slate-900">{modalMode === 'add' ? `Tambah ${activeTab === 'rutin' ? 'Tagihan' : 'Cicilan'}` : 'Edit Tagihan'}</h3><button onClick={() => setShowModal(false)} className="p-2 bg-slate-100 rounded-full"><X size={20}/></button></div>
                    <div className="space-y-5">
                        <div><label className="text-xs font-bold text-slate-500 mb-2 block">Pilih Ikon</label><div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">{Object.keys(ICONS).map(k => {const Icon = ICONS[k]; const isSelected = formData.icon === k; return (<div key={k} onClick={() => setFormData({...formData, icon: k})} className={`p-3 rounded-xl border-2 cursor-pointer transition flex-shrink-0 ${isSelected ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-slate-100 text-slate-400'}`}><Icon size={24}/></div>)})}</div></div>
                        <div><label className="text-xs font-bold text-slate-500 mb-1 block">Nama Tagihan</label><input type="text" placeholder="Contoh: Listrik" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 font-bold outline-indigo-500" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
                        <div className="flex gap-3">
                            <div className="flex-1"><label className="text-xs font-bold text-slate-500 mb-1 block">Nominal (Rp)</label><NumberInput placeholder="0" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 font-bold outline-indigo-500" value={formData.amount} onChange={val => setFormData({...formData, amount: val})} /></div>
                            <div className="w-1/3"><label className="text-xs font-bold text-slate-500 mb-1 block">Jatuh Tempo</label><div className="relative"><input type="number" min="1" max="31" placeholder="Tgl" className="w-full p-3 pl-8 bg-slate-50 rounded-xl border border-slate-200 font-bold outline-indigo-500" value={formData.due_date} onChange={e => setFormData({...formData, due_date: e.target.value})} /><span className="absolute left-3 top-3.5 text-slate-400"><Clock size={14}/></span></div></div>
                        </div>
                        {activeTab === 'cicilan' && (
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                                <div><label className="text-xs font-bold text-slate-500 mb-1 block">Total Tenor (Bulan)</label><input type="number" placeholder="Contoh: 12" className="w-full p-3 bg-white rounded-xl border border-slate-200 font-bold outline-indigo-500" value={formData.total_tenor} onChange={e => setFormData({...formData, total_tenor: e.target.value})} /></div>
                                <div><label className="text-xs font-bold text-slate-500 mb-1 block">Mulai Cicilan</label><input type="date" className="w-full p-3 bg-white rounded-xl border border-slate-200 font-bold outline-indigo-500" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} /></div>
                            </div>
                        )}
                        <button onClick={handleSaveBill} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg mt-4">{modalMode === 'add' ? 'Simpan' : 'Update'}</button>
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