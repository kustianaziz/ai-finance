import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthProvider';
import ModalInfo from '../../components/ModalInfo';
import MoneyInput from '../../components/MoneyInput';
import { 
  ArrowLeft, Save, Loader2, ArrowUpRight, ArrowDownLeft, 
  Calendar, History, X, Edit2, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function InventoryDetailPage() {
  const { id } = useParams(); 
  const navigate = useNavigate();
  const { user, activeEmployee } = useAuth();
  const actorName = activeEmployee ? activeEmployee.name : 'Owner';

  const [item, setItem] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filter Date
  const [startDate, setStartDate] = useState(() => {
      const date = new Date();
      return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
      const date = new Date();
      return new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
  });

  const [showTransModal, setShowTransModal] = useState(false);
  const [transType, setTransType] = useState('restock'); 
  const [stockForm, setStockForm] = useState({ amount: '', notes: '', price: 0 });
  const [processing, setProcessing] = useState(false);
  
  // Notif Custom
  const [notif, setNotif] = useState({ isOpen: false, type: 'info', title: '', message: '', onConfirm: null });
  const showAlert = (type, title, message) => setNotif({ isOpen: true, type, title, message, onConfirm: null });
  const showConfirm = (title, message, onConfirm) => setNotif({ isOpen: true, type: 'error', title, message, onConfirm, confirmText: 'Ya, Hapus' });

  useEffect(() => { fetchDetail(); }, [id, startDate, endDate]);

  const fetchDetail = async () => {
      try {
          const { data: itemData } = await supabase.from('inventory_items').select('*, warehouses(name)').eq('id', id).single();
          setItem(itemData);

          let query = supabase.from('inventory_transactions').select('*').eq('inventory_item_id', id).order('created_at', { ascending: false });
          if (startDate) query = query.gte('created_at', `${startDate}T00:00:00`);
          if (endDate) query = query.lte('created_at', `${endDate}T23:59:59`);

          const { data: historyData } = await query;
          setHistory(historyData || []);
      } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const handleUpdateStock = async () => {
      if (!stockForm.amount || stockForm.amount <= 0) return showAlert('error', 'Error', 'Jumlah harus diisi');
      setProcessing(true);
      try {
          let finalAmount = parseFloat(stockForm.amount);
          if (transType !== 'restock') finalAmount = -finalAmount;

          const { error } = await supabase.rpc('update_stock_transaction', {
              p_item_id: id,
              p_amount: finalAmount,
              p_type: transType,
              p_notes: stockForm.notes,
              p_actor_name: actorName,
              p_price: transType === 'restock' ? stockForm.price : 0
          });

          if (error) throw error;
          showAlert('success', 'Sukses', 'Stok diperbarui');
          setStockForm({ amount: '', notes: '', price: 0 });
          setShowTransModal(false);
          fetchDetail();
      } catch (e) {
          showAlert('error', 'Gagal', e.message);
      } finally {
          setProcessing(false);
      }
  };

  const handleDeleteLog = (logId) => {
      showConfirm('Batalkan Riwayat?', 'Stok akan dikembalikan ke kondisi sebelum transaksi ini. Lanjutkan?', async () => {
          setNotif(prev => ({...prev, type: 'loading', title: 'Memproses...', message: ''}));
          try {
              const { data, error } = await supabase.rpc('delete_inventory_log_rollback', { p_log_id: logId });
              if (error) throw error;
              
              setNotif({ isOpen: false });
              fetchDetail(); 
          } catch (e) {
              showAlert('error', 'Gagal Hapus', e.message);
          }
      });
  };

  const formatIDR = (val) => new Intl.NumberFormat('id-ID', {style:'currency', currency:'IDR', minimumFractionDigits:0}).format(val);
  const formatDate = (date) => new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  if (!item) return <div className="p-10 text-center text-slate-400">Loading Detail...</div>;

  return (
    <div className="h-screen bg-slate-50 font-sans flex flex-col overflow-hidden">
        
        {/* HEADER FIXED (COMPACT) */}
        <div className="shrink-0 bg-teal-600 shadow-xl z-50">
            <div className="px-6 pt-6 pb-6">
                <div className="flex items-center gap-3 mb-6">
                    <button onClick={() => navigate('/inventory')} className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition backdrop-blur-sm"><ArrowLeft size={20}/></button>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-lg font-bold text-white truncate">{item.name}</h1>
                        <p className="text-[10px] text-teal-100">{item.warehouses?.name} • {item.type === 'tool' ? 'Alat' : 'Bahan'}</p>
                    </div>
                </div>

                {/* INFO STOK & ACTION DALAM HEADER */}
                <div className="flex justify-between items-end">
                    <div>
                        <p className="text-[10px] text-teal-200 uppercase font-bold mb-1">Stok Saat Ini</p>
                        <div className="flex items-baseline gap-2">
                            <h2 className="text-3xl font-extrabold text-white">{item.current_stock}</h2>
                            <span className="text-sm font-medium text-teal-100">{item.unit}</span>
                        </div>
                        <p className="text-[10px] text-teal-200 mt-1">HPP: {formatIDR(item.cost_per_unit)}</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={()=>{setTransType('restock'); setShowTransModal(true);}} className="p-2 bg-white text-teal-700 rounded-xl shadow-lg active:scale-95 transition font-bold text-xs flex items-center gap-1">
                            <ArrowDownLeft size={16}/> Masuk
                        </button>
                        <button onClick={()=>{setTransType('usage'); setShowTransModal(true);}} className="p-2 bg-orange-100 text-orange-700 rounded-xl shadow-lg active:scale-95 transition font-bold text-xs flex items-center gap-1">
                            <ArrowUpRight size={16}/> Pakai
                        </button>
                    </div>
                </div>
            </div>
        </div>

        {/* CONTENT (RIWAYAT SCROLLABLE) */}
        <div className="flex-1 overflow-y-auto bg-slate-50 flex flex-col">
            {/* Filter Tanggal Sticky di dalam container */}
            <div className="sticky top-0 z-40 bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center shadow-sm">
                <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2"><History size={16} className="text-teal-500"/> Riwayat</h3>
                <div className="flex bg-white border border-slate-200 rounded-lg p-1 gap-2 shadow-sm items-center px-2">
                    <Calendar size={12} className="text-slate-400"/>
                    <input type="date" className="text-[10px] bg-transparent outline-none w-20 text-slate-600 font-bold" value={startDate} onChange={e=>setStartDate(e.target.value)} />
                    <span className="text-slate-300">-</span>
                    <input type="date" className="text-[10px] bg-transparent outline-none w-20 text-slate-600 font-bold" value={endDate} onChange={e=>setEndDate(e.target.value)} />
                </div>
            </div>

            <div className="p-4 space-y-3 pb-20">
                {history.length === 0 ? (
                    <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl">
                        <p className="text-slate-400 text-xs">Belum ada riwayat transaksi.</p>
                    </div>
                ) : (
                    history.map(log => (
                        <div key={log.id} className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${log.change_amount > 0 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                        {log.type === 'restock' ? 'Beli' : log.type === 'usage' ? 'Pakai' : log.type}
                                    </span>
                                    <span className="text-[10px] text-slate-400">{formatDate(log.created_at)}</span>
                                </div>
                                <p className="text-xs text-slate-700 font-medium">{log.notes || '-'}</p>
                                <p className="text-[9px] text-slate-400 mt-0.5">Oleh: {log.created_by}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="text-right">
                                    <p className={`text-sm font-extrabold ${log.change_amount > 0 ? 'text-green-600' : 'text-orange-600'}`}>
                                        {log.change_amount > 0 ? '+' : ''}{log.change_amount} {item.unit}
                                    </p>
                                    {log.price_per_unit > 0 && <p className="text-[9px] text-slate-400">@ {formatIDR(log.price_per_unit)}</p>}
                                    <p className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded mt-1 inline-block">Sisa: {log.final_stock}</p>
                                </div>
                                <button onClick={() => handleDeleteLog(log.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 size={14}/></button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>

        {/* MODAL TRANSAKSI (SAMA SEPERTI SEBELUMNYA) */}
        <AnimatePresence>
            {showTransModal && (
                <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => setShowTransModal(false)}>
                    <motion.div initial={{y:"100%"}} animate={{y:0}} exit={{y:"100%"}} className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl" onClick={e=>e.stopPropagation()}>
                        <div className={`p-5 border-b flex justify-between items-center ${transType === 'restock' ? 'bg-green-50' : 'bg-orange-50'}`}>
                            <h3 className={`font-extrabold text-lg ${transType === 'restock' ? 'text-green-800' : 'text-orange-800'}`}>
                                {transType === 'restock' ? 'Tambah Stok Masuk' : 'Catat Stok Keluar'}
                            </h3>
                            <button onClick={() => setShowTransModal(false)} className="p-1 rounded-full bg-white/50 hover:bg-white transition"><X size={20}/></button>
                        </div>
                        <div className="p-6 space-y-5 bg-slate-50/50">
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 mb-2 block">Jumlah ({item.unit})</label>
                                    <input type="number" autoFocus className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 text-xl font-bold outline-none focus:border-teal-500 text-center" placeholder="0" value={stockForm.amount} onChange={e => setStockForm({...stockForm, amount: e.target.value})} />
                                </div>
                                {transType === 'restock' && (
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 mb-2 block">Harga Beli Satuan</label>
                                        <MoneyInput className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:border-teal-500" placeholder="Rp 0" value={stockForm.price} onChange={val => setStockForm({...stockForm, price: val})} />
                                    </div>
                                )}
                                <div>
                                    <label className="text-xs font-bold text-slate-500 mb-2 block">Catatan</label>
                                    <input type="text" placeholder={transType === 'restock' ? "Cth: Belanja Pasar" : "Cth: Produksi Harian"} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm font-medium outline-none focus:border-teal-500" value={stockForm.notes} onChange={e => setStockForm({...stockForm, notes: e.target.value})} />
                                </div>
                            </div>
                            <button onClick={handleUpdateStock} disabled={processing} className={`w-full py-4 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 ${transType === 'restock' ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'}`}>
                                {processing ? <Loader2 className="animate-spin" size={20}/> : "Simpan Transaksi"}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>

        <ModalInfo isOpen={notif.isOpen} type={notif.type} title={notif.title} message={notif.message} onClose={() => setNotif(prev => ({...prev, isOpen: false}))} onConfirm={notif.onConfirm} confirmText={notif.confirmText} />
    </div>
  );
}