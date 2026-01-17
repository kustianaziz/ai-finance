import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthProvider';
import { 
  ArrowLeft, Plus, Zap, Wifi, Smartphone, CreditCard, 
  Home, Droplets, MonitorPlay, Calendar, CheckCircle2, 
  AlertCircle, Clock, Trash2, X, Hourglass, Siren, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function BillsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // --- STATE ---
  const [bills, setBills] = useState([]);
  const [urgentBills, setUrgentBills] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('rutin'); 
  const [summary, setSummary] = useState({ total: 0, paid: 0, unpaid: 0 });

  // Counters for Badges
  const [badges, setBadges] = useState({ rutin: 0, cicilan: 0 });

  // Modal & Notif
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ 
      name: '', amount: '', due_date: '', icon: 'Zap',
      type: 'rutin', total_tenor: '', start_date: '' 
  });
  const [notif, setNotif] = useState({ show: false, type: 'info', title: '', message: '', onConfirm: null });

  const ICONS = { Zap, Wifi, Smartphone, CreditCard, Home, Droplets, MonitorPlay };
  const formatIDR = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

  useEffect(() => {
    if (user) fetchBills();
  }, [user]);

  const fetchBills = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('bills').select('*').eq('user_id', user.id);
      if (error) throw error;

      // 1. Separate Urgent Bills & Calculate Badges
      const urgentList = [];
      let rutinCount = 0;
      let cicilanCount = 0;

      const processedData = (data || []).map(b => {
          const status = getStatus(b);
          
          if (!status.isPaid) {
              if (b.bill_type === 'rutin') rutinCount++;
              else if (b.bill_type === 'cicilan') {
                  const info = getInstallmentInfo(b);
                  if (!info?.isFinished) cicilanCount++;
              }
          }

          if (status.urgent && !status.isPaid) {
              urgentList.push({ ...b, ...status });
          }
          
          return b;
      });

      const sortedData = processedData.sort((a, b) => {
          const statusA = getStatus(a);
          const statusB = getStatus(b);
          if (statusA.isPaid === statusB.isPaid) return a.due_date - b.due_date;
          return statusA.isPaid ? 1 : -1; 
      });

      setBills(sortedData);
      setUrgentBills(urgentList); 
      setBadges({ rutin: rutinCount, cicilan: cicilanCount });
      calculateSummary(sortedData);

    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  // --- LOGIC STATUS ---
  const getStatus = (bill) => {
      const today = new Date();
      const currentDay = today.getDate();
      
      let isPaid = false;
      let statusText = 'Belum Bayar';
      let statusColor = 'bg-slate-100 text-slate-500';
      let urgent = false; 

      if (bill.last_paid_at) {
          const paidDate = new Date(bill.last_paid_at);
          if (paidDate.getMonth() === today.getMonth() && paidDate.getFullYear() === today.getFullYear()) {
              isPaid = true;
              statusText = 'Lunas';
              statusColor = 'bg-green-100 text-green-600';
          }
      }

      if (!isPaid) {
          const daysLeft = bill.due_date - currentDay;
          
          if (daysLeft < 0) {
              statusText = `Telat ${Math.abs(daysLeft)} Hari`;
              statusColor = 'bg-white text-red-600'; // Updated style for urgent card
              urgent = true;
          } else if (daysLeft === 0) {
              statusText = 'Hari Ini!';
              statusColor = 'bg-white text-amber-600';
              urgent = true;
          } else if (daysLeft <= 3) {
              statusText = `${daysLeft} Hari Lagi`;
              statusColor = 'bg-white/20 text-white';
              urgent = true;
          }
      }

      return { isPaid, statusText, statusColor, urgent };
  };

  const getInstallmentInfo = (bill) => {
      if (bill.bill_type !== 'cicilan' || !bill.start_date) return null;
      const start = new Date(bill.start_date);
      const today = new Date();
      let monthsPassed = (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth()) + 1;
      const endDate = new Date(start);
      endDate.setMonth(start.getMonth() + bill.total_tenor);

      return {
          current: Math.min(monthsPassed, bill.total_tenor),
          total: bill.total_tenor,
          endDate: endDate.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }),
          isFinished: monthsPassed > bill.total_tenor
      };
  };

  const calculateSummary = (data) => {
      let total = 0, unpaid = 0;
      data.forEach(b => {
          const s = getStatus(b);
          const installmentInfo = getInstallmentInfo(b);
          if (b.bill_type === 'cicilan' && installmentInfo?.isFinished) return;
          total += Number(b.amount);
          if (!s.isPaid) unpaid += Number(b.amount);
      });
      setSummary({ total, unpaid });
  };

  // --- ACTIONS ---
  const handleCreateBill = async () => {
      try {
          if (!formData.name || !formData.amount || !formData.due_date) return showAlert('error', 'Eits!', 'Data belum lengkap.');
          const payload = {
              user_id: user.id, name: formData.name, amount: formData.amount, due_date: formData.due_date, icon: formData.icon, bill_type: formData.type,
              total_tenor: formData.type === 'cicilan' ? formData.total_tenor : 0, start_date: formData.type === 'cicilan' ? formData.start_date : null
          };
          const { error } = await supabase.from('bills').insert(payload);
          if (error) throw error;
          setShowModal(false); setFormData({ name: '', amount: '', due_date: '', icon: 'Zap', type: 'rutin', total_tenor: '', start_date: '' });
          fetchBills(); showAlert('success', 'Sip!', 'Tagihan berhasil dibuat.');
      } catch (e) { showAlert('error', 'Gagal', e.message); }
  };

  const markAsPaid = async (bill) => {
      try {
          const now = new Date().toISOString();
          const { error } = await supabase.from('bills').update({ last_paid_at: now }).eq('id', bill.id);
          if (error) throw error;
          fetchBills(); showAlert('success', 'Lunas!', `Tagihan ${bill.name} bulan ini lunas.`);
      } catch (e) { showAlert('error', 'Gagal', e.message); }
  };

  const handleDelete = async (id) => { await supabase.from('bills').delete().eq('id', id); closeNotif(); fetchBills(); };
  const showAlert = (type, title, message) => setNotif({ show: true, type, title, message, onConfirm: null });
  const closeNotif = () => setNotif({ ...notif, show: false });
  const confirmDelete = (id) => setNotif({ show: true, type: 'confirm', title: 'Hapus?', message: 'Data akan dihapus permanen.', onConfirm: () => handleDelete(id) });
  const confirmPay = (bill) => setNotif({ show: true, type: 'confirm', title: 'Bayar?', message: `Bayar tagihan ${bill.name}?`, onConfirm: () => { closeNotif(); markAsPaid(bill); }});

  const filteredBills = bills.filter(b => {
      const info = getInstallmentInfo(b);
      if (b.bill_type === 'cicilan' && info?.isFinished) return false;
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
         <div className="flex justify-between items-end relative z-10 text-white">
             <div><p className="text-indigo-200 text-xs mb-1">Total Kewajiban Bulan Ini</p><h2 className="text-3xl font-extrabold">{formatIDR(summary.total)}</h2></div>
             <div className="text-right"><p className="text-indigo-200 text-xs mb-1">Sisa Belum Bayar</p><p className="text-xl font-bold text-amber-300">{formatIDR(summary.unpaid)}</p></div>
         </div>
      </div>

      <div className="px-6 -mt-16 relative z-20 space-y-5">
          
          {/* === ZONA DARURAT (COMPACT STYLE) === */}
          {urgentBills.length > 0 && (
              <motion.div initial={{opacity:0, y:-20}} animate={{opacity:1, y:0}} className="bg-gradient-to-r from-red-500 to-rose-600 p-4 rounded-3xl shadow-lg shadow-red-200 text-white relative overflow-hidden">
                  <div className="absolute right-0 top-0 p-3 opacity-20"><Siren size={60}/></div>
                  
                  <div className="relative z-10">
                      <h3 className="font-bold text-sm flex items-center gap-2 mb-3">
                          <AlertCircle size={18} className="animate-pulse"/> Perlu Perhatian ({urgentBills.length})
                      </h3>
                      
                      {/* Horizontal Scroll - Slim Cards */}
                      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                          {urgentBills.map((bill, idx) => {
                              const Icon = ICONS[bill.icon] || Zap;
                              const { statusText } = getStatus(bill);
                              return (
                                  <div key={idx} className="min-w-[280px] bg-white/10 backdrop-blur-md border border-white/20 p-3 rounded-2xl flex items-center gap-3 active:scale-95 transition">
                                      {/* Icon */}
                                      <div className="p-2 bg-white rounded-full text-red-600 shadow-sm shrink-0">
                                          <Icon size={18}/>
                                      </div>
                                      
                                      {/* Info */}
                                      <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-0.5">
                                              <p className="text-sm font-bold truncate">{bill.name}</p>
                                              <span className="text-[10px] bg-red-800/30 px-1.5 py-0.5 rounded text-red-100 whitespace-nowrap">
                                                  {statusText}
                                              </span>
                                          </div>
                                          <p className="text-xs text-white/80">
                                              {bill.bill_type === 'rutin' ? 'Tagihan' : 'Cicilan'} • {formatIDR(bill.amount)}
                                          </p>
                                      </div>

                                      {/* Action Button */}
                                      <button onClick={() => confirmPay(bill)} className="bg-white text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-50 shadow-sm whitespace-nowrap">
                                          Bayar
                                      </button>
                                  </div>
                              )
                          })}
                      </div>
                  </div>
              </motion.div>
          )}

          {/* TAB SWITCHER */}
          <div className="bg-white p-1 rounded-2xl shadow-sm border border-indigo-50 flex">
              <button onClick={() => setActiveTab('rutin')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition relative ${activeTab === 'rutin' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400'}`}>
                  Rutin
                  {badges.rutin > 0 && <span className="absolute top-2 right-4 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
              </button>
              <button onClick={() => setActiveTab('cicilan')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition relative ${activeTab === 'cicilan' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400'}`}>
                  Cicilan
                  {badges.cicilan > 0 && <span className="absolute top-2 right-4 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
              </button>
          </div>

          <button onClick={() => setShowModal(true)} className="w-full py-4 bg-white rounded-2xl shadow-sm border border-indigo-50 text-indigo-600 font-bold text-sm flex items-center justify-center gap-2 hover:bg-indigo-50 transition">
              <Plus size={18}/> Tambah {activeTab === 'rutin' ? 'Tagihan' : 'Cicilan'} Baru
          </button>

          {/* LIST UTAMA */}
          {loading ? (
              <div className="space-y-3 pt-2">{[1,2,3].map(i => <div key={i} className="h-24 bg-slate-200 rounded-2xl animate-pulse"></div>)}</div>
          ) : filteredBills.length === 0 ? (
              <div className="text-center py-10 text-slate-400"><p className="text-4xl mb-2">🍃</p><p>Tidak ada data {activeTab}.</p></div>
          ) : (
              filteredBills.map(bill => {
                  const Icon = ICONS[bill.icon] || Zap;
                  const { isPaid, statusText, statusColor, urgent } = getStatus(bill);
                  const installment = getInstallmentInfo(bill);

                  return (
                      <motion.div 
                          key={bill.id} 
                          layout
                          className={`bg-white p-4 rounded-2xl shadow-sm border flex flex-col gap-3 relative overflow-hidden transition ${urgent && !isPaid ? 'border-red-300 ring-2 ring-red-50' : 'border-indigo-50'}`}
                      >
                          <div className="flex items-center justify-between relative z-10">
                              <div className="flex items-center gap-3">
                                  <div className={`p-3 rounded-xl ${isPaid ? 'bg-green-50 text-green-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                      <Icon size={24}/>
                                  </div>
                                  <div>
                                      <h3 className={`font-bold ${isPaid ? 'text-slate-500' : 'text-slate-800'}`}>{bill.name}</h3>
                                      <div className="flex items-center gap-2 mt-0.5">
                                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isPaid ? 'bg-green-100 text-green-600' : statusColor.replace('text-white', 'text-slate-500').replace('bg-white/20', 'bg-slate-100')}`}>
                                              {statusText}
                                          </span>
                                          {installment && (
                                              <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                                  <Hourglass size={10}/> {installment.current}/{installment.total}
                                              </span>
                                          )}
                                      </div>
                                  </div>
                              </div>
                              <div className="text-right">
                                  <p className={`font-bold ${isPaid ? 'text-slate-400' : 'text-slate-800'}`}>{formatIDR(bill.amount)}</p>
                                  <span className="text-[10px] text-slate-400 flex items-center justify-end gap-1">
                                      <Calendar size={10}/> Tgl {bill.due_date}
                                  </span>
                              </div>
                          </div>

                          <div className="flex items-center justify-between border-t border-slate-50 pt-3 relative z-10">
                              <div className="text-xs text-slate-400">
                                  {installment ? `Lunas: ${installment.endDate}` : 'Tagihan Rutin'}
                              </div>
                              <div className="flex items-center gap-2">
                                  <button onClick={() => confirmDelete(bill.id)} className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition"><Trash2 size={16}/></button>
                                  {!isPaid ? (
                                      <button onClick={() => confirmPay(bill)} className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 shadow-md active:scale-95 transition">
                                          Bayar Sekarang
                                      </button>
                                  ) : (
                                      <span className="text-xs font-bold text-green-600 flex items-center gap-1"><CheckCircle2 size={14}/> Lunas</span>
                                  )}
                              </div>
                          </div>
                      </motion.div>
                  );
              })
          )}
      </div>

      {/* MODAL & NOTIF (Tetap sama) */}
      <AnimatePresence>
        {showModal && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
                <motion.div initial={{y: "100%"}} animate={{y: 0}} exit={{y: "100%"}} className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl h-[80vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-lg text-slate-900">Tambah {activeTab === 'rutin' ? 'Tagihan' : 'Cicilan'}</h3>
                        <button onClick={() => setShowModal(false)} className="p-2 bg-slate-100 rounded-full"><X size={20}/></button>
                    </div>
                    <div className="space-y-4">
                        <div className="hidden"><input value={activeTab} onChange={()=>{}}/></div>
                        <div><label className="text-xs font-bold text-slate-500 mb-2 block">Pilih Ikon</label>
                            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                                {Object.keys(ICONS).map(k => { const Icon = ICONS[k]; const isSelected = formData.icon === k; return (<div key={k} onClick={() => setFormData({...formData, icon: k})} className={`p-3 rounded-xl border-2 cursor-pointer flex-shrink-0 transition ${isSelected ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-slate-100 text-slate-400'}`}><Icon size={24}/></div>) })}
                            </div>
                        </div>
                        <div><label className="text-xs font-bold text-slate-500 mb-1 block">Nama Tagihan</label><input type="text" placeholder="Contoh: Listrik" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 font-bold" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value, type: activeTab})} /></div>
                        <div className="flex gap-4">
                            <div className="flex-1"><label className="text-xs font-bold text-slate-500 mb-1 block">Nominal (Rp)</label><input type="number" placeholder="0" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 font-bold" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} /></div>
                            <div className="w-1/3"><label className="text-xs font-bold text-slate-500 mb-1 block">Jatuh Tempo</label><div className="relative"><input type="number" min="1" max="31" placeholder="Tgl" className="w-full p-3 pl-8 bg-slate-50 rounded-xl border border-slate-200 font-bold" value={formData.due_date} onChange={e => setFormData({...formData, due_date: e.target.value})} /><span className="absolute left-3 top-3.5 text-slate-400"><Clock size={14}/></span></div></div>
                        </div>
                        {activeTab === 'cicilan' && (
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                                <div><label className="text-xs font-bold text-slate-500 mb-1 block">Total Tenor (Bulan)</label><input type="number" placeholder="Contoh: 12" className="w-full p-3 bg-white rounded-xl border border-slate-200 font-bold" value={formData.total_tenor} onChange={e => setFormData({...formData, total_tenor: e.target.value})} /></div>
                                <div><label className="text-xs font-bold text-slate-500 mb-1 block">Mulai Cicilan</label><input type="date" className="w-full p-3 bg-white rounded-xl border border-slate-200 font-bold" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} /></div>
                            </div>
                        )}
                        <button onClick={handleCreateBill} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg mt-2">Simpan</button>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {notif.show && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                <motion.div initial={{scale:0.9}} animate={{scale:1}} exit={{scale:0.9}} className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl text-center">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${notif.type === 'success' ? 'bg-green-100 text-green-600' : notif.type === 'error' ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'}`}>
                        {notif.type === 'success' ? <CheckCircle2 size={32}/> : notif.type === 'error' ? <AlertCircle size={32}/> : <AlertCircle size={32}/>}
                    </div>
                    <h3 className="text-xl font-extrabold text-slate-900 mb-2">{notif.title}</h3>
                    <p className="text-slate-500 text-sm mb-6 leading-relaxed">{notif.message}</p>
                    <div className="flex gap-3 justify-center">
                        {notif.type === 'confirm' ? (
                            <>
                                <button onClick={closeNotif} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200">Batal</button>
                                <button onClick={notif.onConfirm} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg">Ya, Lanjut</button>
                            </>
                        ) : (
                            <button onClick={closeNotif} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800">Oke</button>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}