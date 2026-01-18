import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthProvider';
import { 
  ArrowLeft, Plus, Zap, Wifi, Smartphone, CreditCard, 
  Home, Droplets, MonitorPlay, Calendar, CheckCircle2, 
  AlertCircle, Clock, Trash2, X, Hourglass, Siren, ChevronRight, ChevronLeft, History
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function BillsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // --- STATE UTAMA ---
  const [viewDate, setViewDate] = useState(new Date()); // Navigasi Bulan
  const [bills, setBills] = useState([]);
  const [urgentBills, setUrgentBills] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('rutin'); 
  const [summary, setSummary] = useState({ total: 0, paid: 0, unpaid: 0 });

  // State Detail & History (NEW)
  const [selectedBill, setSelectedBill] = useState(null); // Untuk modal detail

  // Counters Badge
  const [badges, setBadges] = useState({ rutin: 0, cicilan: 0 });

  // Modal Input & Notif
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ 
      name: '', amount: '', due_date: '', icon: 'Zap',
      type: 'rutin', total_tenor: '', start_date: '' 
  });
  const [notif, setNotif] = useState({ show: false, type: 'info', title: '', message: '', onConfirm: null });

  const ICONS = { Zap, Wifi, Smartphone, CreditCard, Home, Droplets, MonitorPlay };
  const formatIDR = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  const getMonthName = (date) => date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  // 1. FETCH DATA (Optimized)
  useEffect(() => {
    if (user) fetchBills();
  }, [user, viewDate]); // Re-fetch saat user ganti bulan

  const fetchBills = async () => {
    try {
      setLoading(true);
      
      // Ambil semua tagihan user
      const { data, error } = await supabase.from('bills').select('*').eq('user_id', user.id);
      if (error) throw error;

      // PROSES DATA LOKAL (Cepat)
      const currentMonth = viewDate.getMonth();
      const currentYear = viewDate.getFullYear();
      
      const urgentList = [];
      let rutinCount = 0;
      let cicilanCount = 0;

      const processedData = (data || []).map(b => {
          // Hitung Status Berdasarkan viewDate (Bukan hari ini saja)
          const status = getStatusForDate(b, viewDate);
          
          // Logic Badge & Urgent (Hanya relevan untuk bulan ini/depan yg belum bayar)
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
          
          return { ...b, ...status }; // Merge status ke object bill biar gampang diakses
      });

      // Sorting: Belum Bayar di atas, Lunas di bawah
      const sortedData = processedData.sort((a, b) => {
          if (a.isPaid === b.isPaid) return a.due_date - b.due_date;
          return a.isPaid ? 1 : -1; 
      });

      setBills(sortedData);
      setUrgentBills(urgentList); 
      setBadges({ rutin: rutinCount, cicilan: cicilanCount });
      calculateSummary(sortedData);

    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  // --- LOGIC STATUS (DINAMIS SESUAI BULAN VIEW) ---
  const getStatusForDate = (bill, targetDate) => {
      const today = new Date();
      const isCurrentMonth = targetDate.getMonth() === today.getMonth() && targetDate.getFullYear() === today.getFullYear();
      
      // Logic Cek Lunas
      let isPaid = false;
      let paidAt = null;

      if (bill.last_paid_at) {
          const paidDate = new Date(bill.last_paid_at);
          // Cek apakah pembayaran dilakukan di bulan & tahun target
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
          // Hitung selisih hari
          // Kita asumsikan "due date" adalah tanggal X di bulan target
          const dueDateThisMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), bill.due_date);
          
          // Kalau lihat bulan depan, hitung selisih dari hari ini ke tanggal itu
          const diffTime = dueDateThisMonth - today; 
          const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (isCurrentMonth) {
              // Logic Bulan Ini (Ada Urgent)
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
              // Logic Bulan Depan/Lain (Estimasi)
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
      // Hitung bulan berjalan relatif terhadap viewDate
      let monthsPassed = (viewDate.getFullYear() - start.getFullYear()) * 12 + (viewDate.getMonth() - start.getMonth()) + 1;
      
      const endDate = new Date(start);
      endDate.setMonth(start.getMonth() + bill.total_tenor);

      return {
          current: Math.max(0, Math.min(monthsPassed, bill.total_tenor)), // Clamp 0 - max
          total: bill.total_tenor,
          endDate: endDate.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }),
          isFinished: monthsPassed > bill.total_tenor
      };
  };

  const calculateSummary = (data) => {
      let total = 0, unpaid = 0;
      data.forEach(b => {
          const installmentInfo = getInstallmentInfo(b);
          // Skip jika cicilan sudah lunas di masa lalu
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
          // Bayar sesuai bulan yang sedang dilihat (viewDate)
          // Agar user bisa tandai lunas bulan lalu/depan manual
          const paymentDate = new Date(viewDate);
          // Set tanggal ke hari ini jika bulan sama, atau tgl 1 jika beda bulan (default)
          const today = new Date();
          if (paymentDate.getMonth() === today.getMonth()) {
              paymentDate.setDate(today.getDate());
          } else {
              paymentDate.setDate(bill.due_date); // Asumsi bayar pas tgl jatuh tempo
          }

          const { error } = await supabase.from('bills').update({ last_paid_at: paymentDate.toISOString() }).eq('id', bill.id);
          if (error) throw error;
          fetchBills(); showAlert('success', 'Lunas!', `Tagihan ${bill.name} tercatat lunas.`);
      } catch (e) { showAlert('error', 'Gagal', e.message); }
  };

  const handleDelete = async (id) => { await supabase.from('bills').delete().eq('id', id); closeNotif(); fetchBills(); };
  const showAlert = (type, title, message) => setNotif({ show: true, type, title, message, onConfirm: null });
  const closeNotif = () => setNotif({ ...notif, show: false });
  
  const confirmDelete = (e, id) => {
      e.stopPropagation();
      setNotif({ show: true, type: 'confirm', title: 'Hapus?', message: 'Data akan dihapus permanen.', onConfirm: () => handleDelete(id) });
  };
  
  const confirmPay = (e, bill) => {
      e.stopPropagation();
      setNotif({ show: true, type: 'confirm', title: 'Bayar?', message: `Bayar tagihan ${bill.name}?`, onConfirm: () => { closeNotif(); markAsPaid(bill); }});
  };

  // Klik card untuk detail (terutama kalau sudah lunas)
  const handleCardClick = (bill) => {
      setSelectedBill(bill);
  };

  const filteredBills = bills.filter(b => {
      const info = getInstallmentInfo(b);
      // Sembunyikan cicilan yang SUDAH SELESAI di masa lalu
      // Tapi kalau baru selesai bulan ini, tetap tampilkan status lunasnya
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
         
         {/* NAVIGASI BULAN (NEW) */}
         <div className="flex items-center justify-between mb-4 relative z-10 text-white/90">
             <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-white/10 rounded-full"><ChevronLeft/></button>
             <span className="font-bold text-lg">{getMonthName(viewDate)}</span>
             <button onClick={() => changeMonth(1)} className="p-1 hover:bg-white/10 rounded-full"><ChevronRight/></button>
         </div>

         <div className="flex justify-between items-end relative z-10 text-white">
             <div><p className="text-indigo-200 text-xs mb-1">Total Tagihan {activeTab}</p><h2 className="text-3xl font-extrabold">{formatIDR(summary.total)}</h2></div>
             <div className="text-right"><p className="text-indigo-200 text-xs mb-1">Sisa Belum Bayar</p><p className="text-xl font-bold text-amber-300">{formatIDR(summary.unpaid)}</p></div>
         </div>
      </div>

      <div className="px-6 -mt-16 relative z-20 space-y-5">
          
          {/* TAB SWITCHER */}
          <div className="bg-white p-1 rounded-2xl shadow-lg border border-indigo-50 flex">
              <button onClick={() => setActiveTab('rutin')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition relative ${activeTab === 'rutin' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400'}`}>
                  Rutin {badges.rutin > 0 && <span className="absolute top-2 right-4 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
              </button>
              <button onClick={() => setActiveTab('cicilan')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition relative ${activeTab === 'cicilan' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400'}`}>
                  Cicilan {badges.cicilan > 0 && <span className="absolute top-2 right-4 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
              </button>
          </div>

          <button onClick={() => setShowModal(true)} className="w-full py-4 bg-white rounded-2xl shadow-sm border border-indigo-50 text-indigo-600 font-bold text-sm flex items-center justify-center gap-2 hover:bg-indigo-50 transition">
              <Plus size={18}/> Tambah {activeTab === 'rutin' ? 'Tagihan' : 'Cicilan'}
          </button>

          {/* LIST UTAMA */}
          {loading ? (
              <div className="space-y-3 pt-2">{[1,2,3].map(i => <div key={i} className="h-24 bg-slate-200 rounded-2xl animate-pulse"></div>)}</div>
          ) : filteredBills.length === 0 ? (
              <div className="text-center py-10 text-slate-400"><p className="text-4xl mb-2">🍃</p><p>Tidak ada tagihan {activeTab} di bulan ini.</p></div>
          ) : (
              <div className="space-y-3">
                  {filteredBills.map(bill => {
                      const Icon = ICONS[bill.icon] || Zap;
                      const installment = getInstallmentInfo(bill);

                      return (
                          <motion.div 
                              key={bill.id} layout
                              onClick={() => handleCardClick(bill)}
                              className={`bg-white p-4 rounded-2xl shadow-sm border flex flex-col gap-3 relative overflow-hidden transition active:scale-98 cursor-pointer ${bill.urgent && !bill.isPaid ? 'border-red-300 ring-2 ring-red-50' : 'border-slate-100 hover:border-indigo-200'}`}
                          >
                              <div className="flex items-center justify-between relative z-10">
                                  <div className="flex items-center gap-3">
                                      <div className={`p-3 rounded-xl ${bill.isPaid ? 'bg-green-50 text-green-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                          <Icon size={24}/>
                                      </div>
                                      <div>
                                          <h3 className={`font-bold ${bill.isPaid ? 'text-slate-500' : 'text-slate-800'}`}>{bill.name}</h3>
                                          <div className="flex items-center gap-2 mt-0.5">
                                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${bill.isPaid ? 'bg-green-100 text-green-600' : bill.statusColor}`}>
                                                  {bill.statusText}
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
                                      <p className={`font-bold ${bill.isPaid ? 'text-slate-400' : 'text-slate-800'}`}>{formatIDR(bill.amount)}</p>
                                      <span className="text-[10px] text-slate-400 flex items-center justify-end gap-1">
                                          <Calendar size={10}/> Tgl {bill.due_date}
                                      </span>
                                  </div>
                              </div>

                              <div className="flex items-center justify-between border-t border-slate-50 pt-3 relative z-10">
                                  <div className="text-xs text-slate-400">
                                      {installment ? `Lunas: ${installment.endDate}` : (bill.isPaid ? 'Sudah Lunas' : 'Tagihan Rutin')}
                                  </div>
                                  <div className="flex items-center gap-2">
                                      {/* PROTEKSI HAPUS: Hanya muncul jika BELUM LUNAS */}
                                      {!bill.isPaid && (
                                          <button onClick={(e) => confirmDelete(e, bill.id)} className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition"><Trash2 size={16}/></button>
                                      )}
                                      
                                      {!bill.isPaid ? (
                                          <button onClick={(e) => confirmPay(e, bill)} className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 shadow-md active:scale-95 transition">
                                              Bayar Sekarang
                                          </button>
                                      ) : (
                                          <span className="text-xs font-bold text-green-600 flex items-center gap-1"><CheckCircle2 size={14}/> Lunas</span>
                                      )}
                                  </div>
                              </div>
                          </motion.div>
                      );
                  })}
              </div>
          )}
      </div>

      {/* === MODAL DETAIL (VIEW ONLY) === */}
      <AnimatePresence>
        {selectedBill && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={() => setSelectedBill(null)}>
                <motion.div initial={{y: "100%"}} animate={{y: 0}} exit={{y: "100%"}} className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="font-bold text-lg text-slate-900">{selectedBill.name}</h3>
                            <p className="text-slate-500 text-sm">{selectedBill.bill_type === 'rutin' ? 'Tagihan Bulanan' : `Cicilan ${selectedBill.total_tenor} Bulan`}</p>
                        </div>
                        <button onClick={() => setSelectedBill(null)} className="p-2 bg-slate-100 rounded-full"><X size={20}/></button>
                    </div>
                    
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Jumlah Tagihan</span>
                            <span className="font-bold text-slate-800">{formatIDR(selectedBill.amount)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Jatuh Tempo</span>
                            <span className="font-bold text-slate-800">Tanggal {selectedBill.due_date}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Status</span>
                            <span className={`font-bold ${selectedBill.isPaid ? 'text-green-600' : 'text-amber-600'}`}>{selectedBill.isPaid ? 'Lunas' : 'Belum Bayar'}</span>
                        </div>
                        {selectedBill.isPaid && selectedBill.paidAt && (
                            <div className="flex justify-between text-sm pt-2 border-t border-slate-200">
                                <span className="text-slate-500 flex items-center gap-1"><History size={14}/> Dibayar Pada</span>
                                <span className="font-bold text-slate-800">{selectedBill.paidAt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                            </div>
                        )}
                    </div>
                    
                    {/* Tombol Hapus ada di dalam detail juga jika user MEMAKSA hapus history (Opsional) */}
                    <div className="mt-6 flex gap-3">
                        <button onClick={() => setSelectedBill(null)} className="flex-1 py-3 bg-slate-100 font-bold text-slate-600 rounded-xl">Tutup</button>
                    </div>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL INPUT & NOTIF (Sama) */}
      <AnimatePresence>
        {showModal && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
                <motion.div initial={{y: "100%"}} animate={{y: 0}} exit={{y: "100%"}} className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl h-[80vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-lg text-slate-900">Tambah {activeTab === 'rutin' ? 'Tagihan' : 'Cicilan'}</h3>
                        <button onClick={() => setShowModal(false)} className="p-2 bg-slate-100 rounded-full"><X size={20}/></button>
                    </div>
                    <div className="space-y-4">
                        {/* ... (INPUT FORM SAMA SEPERTI SEBELUMNYA) ... */}
                        <div><label className="text-xs font-bold text-slate-500 mb-2 block">Pilih Ikon</label><div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">{Object.keys(ICONS).map(k => { const Icon = ICONS[k]; const isSelected = formData.icon === k; return (<div key={k} onClick={() => setFormData({...formData, icon: k})} className={`p-3 rounded-xl border-2 cursor-pointer flex-shrink-0 transition ${isSelected ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-slate-100 text-slate-400'}`}><Icon size={24}/></div>) })}</div></div>
                        <div><label className="text-xs font-bold text-slate-500 mb-1 block">Nama Tagihan</label><input type="text" placeholder="Contoh: Listrik" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 font-bold" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value, type: activeTab})} /></div>
                        <div className="flex gap-4"><div className="flex-1"><label className="text-xs font-bold text-slate-500 mb-1 block">Nominal (Rp)</label><input type="number" placeholder="0" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 font-bold" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} /></div><div className="w-1/3"><label className="text-xs font-bold text-slate-500 mb-1 block">Jatuh Tempo</label><div className="relative"><input type="number" min="1" max="31" placeholder="Tgl" className="w-full p-3 pl-8 bg-slate-50 rounded-xl border border-slate-200 font-bold" value={formData.due_date} onChange={e => setFormData({...formData, due_date: e.target.value})} /><span className="absolute left-3 top-3.5 text-slate-400"><Clock size={14}/></span></div></div></div>
                        {activeTab === 'cicilan' && (<div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3"><div><label className="text-xs font-bold text-slate-500 mb-1 block">Total Tenor (Bulan)</label><input type="number" placeholder="Contoh: 12" className="w-full p-3 bg-white rounded-xl border border-slate-200 font-bold" value={formData.total_tenor} onChange={e => setFormData({...formData, total_tenor: e.target.value})} /></div><div><label className="text-xs font-bold text-slate-500 mb-1 block">Mulai Cicilan</label><input type="date" className="w-full p-3 bg-white rounded-xl border border-slate-200 font-bold" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} /></div></div>)}
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
                            <><button onClick={closeNotif} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200">Batal</button><button onClick={notif.onConfirm} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg">Ya, Lanjut</button></>
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