import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthProvider';
import ModalInfo from '../../components/ModalInfo';
import MoneyInput from '../../components/MoneyInput';
import { 
  ArrowLeft, Plus, Search, Package, Loader2, 
  X, ChevronRight, Archive, AlertTriangle, CheckCircle2, 
  Wallet, ShoppingBag, Edit2, Trash2 // <--- Tambah Icon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function InventoryPage() {
  const navigate = useNavigate();
  const { user, activeEmployee } = useAuth();
  const ownerId = user?.id || activeEmployee?.storeId;

  // Data
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalItems: 0, totalValue: 0, lowStock: 0 });

  // Filter UI
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterWh, setFilterWh] = useState('all');
  
  // Modal Form
  const [showFormModal, setShowFormModal] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
      id: null, name: '', unit: '', cost_per_unit: 0, current_stock: 0, type: 'ingredient', warehouse_id: ''
  });
  
  // Purchase Mode (Hanya untuk Tambah Baru)
  const [isPurchaseMode, setIsPurchaseMode] = useState(false);
  const [purchaseData, setPurchaseData] = useState({ wallet_id: '', supplier: '' });

  // Notif
  const [notif, setNotif] = useState({ isOpen: false, type: 'info', title: '', message: '', onConfirm: null });
  const showAlert = (type, title, message) => setNotif({ isOpen: true, type, title, message });
  
  // Helper Konfirmasi Hapus
  const showConfirm = (title, message, onConfirm) => setNotif({ isOpen: true, type: 'error', title, message, onConfirm, confirmText: 'Ya, Hapus' });

  const UNIT_OPTIONS = {
      ingredient: ['kg', 'gram', 'liter', 'ml', 'oz', 'sachet', 'renceng', 'ikat', 'butir', 'buah', 'zak', 'karung'],
      tool: ['pcs', 'unit', 'set', 'lusin', 'kodi', 'box', 'roll', 'meter', 'lembar', 'pasang']
  };

  useEffect(() => { if (ownerId) fetchData(); }, [ownerId]);

  const fetchData = async () => {
      try {
          setLoading(true);
          const { data } = await supabase.from('inventory_items').select('*, warehouses(name)').eq('user_id', ownerId).order('name');
          setItems(data || []);
          
          const { data: wh } = await supabase.from('warehouses').select('id, name').eq('user_id', ownerId);
          setWarehouses(wh || []);

          const { data: wl } = await supabase.from('wallets').select('id, name, initial_balance').eq('user_id', ownerId).eq('allocation_type', 'BUSINESS');
          setWallets(wl || []);

          if(data) {
              const totalVal = data.reduce((acc, curr) => acc + (curr.current_stock * curr.cost_per_unit), 0);
              const low = data.filter(i => i.current_stock <= (i.min_stock_alert || 5)).length;
              setStats({ totalItems: data.length, totalValue: totalVal, lowStock: low });
          }
      } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  // --- HANDLER TAMBAH BARU ---
  const handleOpenAdd = () => {
      setFormData({ 
          id: null, name: '', type: 'ingredient', unit: 'kg', 
          cost_per_unit: 0, current_stock: 0, warehouse_id: warehouses[0]?.id || '' 
      });
      setIsPurchaseMode(false);
      setPurchaseData({ wallet_id: '', supplier: '' });
      setShowFormModal(true);
  };

  // --- HANDLER EDIT ---
  const handleEdit = (e, item) => {
      e.stopPropagation(); // Biar gak masuk ke detail page
      setFormData({
          id: item.id,
          name: item.name,
          type: item.type,
          unit: item.unit,
          cost_per_unit: item.cost_per_unit,
          current_stock: item.current_stock, // Stok ditampilkan tapi di-disabled
          warehouse_id: item.warehouse_id || ''
      });
      setIsPurchaseMode(false); // Edit tidak bisa ubah mode beli
      setShowFormModal(true);
  };

  // --- HANDLER HAPUS ---
  const handleDelete = (e, item) => {
      e.stopPropagation();
      showConfirm(
          'Hapus Barang?', 
          `Yakin ingin menghapus "${item.name}"? Data tidak bisa dihapus jika sudah ada riwayat transaksi detail.`,
          async () => {
              setNotif(prev => ({...prev, type: 'loading', title: 'Memproses...', message: ''}));
              try {
                  const { error } = await supabase.rpc('delete_inventory_item_safe', { p_item_id: item.id });
                  if(error) throw error;
                  
                  fetchData();
                  setNotif({ isOpen: false }); // Tutup modal
              } catch (err) {
                  showAlert('error', 'Gagal Hapus', err.message);
              }
          }
      );
  };

  const handleSubmitMaster = async () => {
      if (!formData.name) return showAlert('error', 'Gagal', 'Nama wajib diisi');
      
      if (isPurchaseMode && !purchaseData.wallet_id && !formData.id) {
         return showAlert('error', 'Pilih Dompet', 'Jika ini pembelian baru, harap pilih Sumber Dana.');
      }

      setProcessing(true);
      
      const costVal = parseInt(formData.cost_per_unit) || 0;
      const stockVal = parseFloat(formData.current_stock) || 0;
      const whVal = formData.warehouse_id === '' ? null : formData.warehouse_id;

      try {
          let newItemId = formData.id;

          if (formData.id) {
              // --- UPDATE (EDIT) ---
              // Stok tidak diupdate disini untuk menjaga konsistensi log. 
              // Stok hanya bisa diubah lewat Restock/Opname di detail page.
              const { error } = await supabase.from('inventory_items').update({
                  name: formData.name, 
                  unit: formData.unit,
                  cost_per_unit: costVal,
                  // current_stock: stockVal, // <--- KITA MATIKAN UPDATE STOK DI EDIT MASTER
                  type: formData.type, 
                  warehouse_id: whVal
              }).eq('id', formData.id);
              if(error) throw error;

          } else {
              // --- INSERT BARU ---
              const payload = {
                  user_id: ownerId, name: formData.name, unit: formData.unit,
                  cost_per_unit: costVal, current_stock: 0, // 0 dulu
                  type: formData.type, warehouse_id: whVal
              };

              const { data, error } = await supabase.from('inventory_items').insert([payload]).select().single();
              if(error) throw error;
              newItemId = data.id;

              // TRANSAKSI STOK AWAL / BELI BARU
              if (stockVal > 0) {
                  const transType = isPurchaseMode ? 'restock' : 'opening_stock';
                  const walletToUse = isPurchaseMode ? purchaseData.wallet_id : null;
                  const supplierToUse = isPurchaseMode ? purchaseData.supplier : null;
                  const notesToUse = isPurchaseMode ? 'Pembelian Barang Baru' : 'Stok Awal (Master Data)';

                  const { error: rpcError } = await supabase.rpc('update_stock_transaction', {
                      p_item_id: newItemId,
                      p_amount: stockVal,
                      p_type: transType,
                      p_notes: notesToUse,
                      p_actor_name: activeEmployee ? activeEmployee.name : 'Owner',
                      p_price: costVal,
                      p_wallet_id: walletToUse,
                      p_employee_id: activeEmployee ? activeEmployee.id : null,
                      p_merchant_name: supplierToUse
                  });
                  if (rpcError) throw rpcError;
              }
          }

          setShowFormModal(false);
          fetchData();
          showAlert('success', 'Tersimpan', 'Data berhasil disimpan.');
      } catch (e) {
          console.error("Save Error:", e);
          showAlert('error', 'Gagal Simpan', e.message);
      } finally {
          setProcessing(false);
      }
  };

  const formatIDR = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

  const filteredItems = items.filter(i => {
      const matchName = i.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchType = filterType === 'all' || i.type === filterType;
      const matchWh = filterWh === 'all' || i.warehouse_id === filterWh;
      return matchName && matchType && matchWh;
  });

  return (
    <div className="h-screen bg-slate-50 font-sans flex flex-col overflow-hidden">
        
        {/* HEADER FIXED */}
        <div className="shrink-0 bg-slate-50 z-50 shadow-md">
            <div className="bg-teal-600 px-6 pt-6 pb-6 rounded-b-[2rem] relative z-10">
                <div className="flex items-center gap-3 mb-4">
                    <button 
                        // Logic: Jika ada user (Owner) -> ke Dashboard Utama. Jika tidak -> ke Dashboard Karyawan.
                        onClick={() => navigate(user ? '/dashboard' : '/employee-dashboard')} 
                        className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition backdrop-blur-sm"
                    >
                        <ArrowLeft size={20}/>
                    </button>
                    <div className="flex-1"><h1 className="text-xl font-extrabold text-white">Stok & Inventori</h1><p className="text-xs text-teal-100 font-medium">Manajemen Aset Gudang</p></div>
                    <button onClick={handleOpenAdd} className="p-2 bg-white text-teal-600 rounded-xl shadow-md hover:bg-teal-50 transition active:scale-95"><Plus size={20}/></button>
                </div>
                <div className="bg-white/10 p-2 rounded-xl border border-white/20 flex items-center px-3 backdrop-blur-sm">
                    <Search size={18} className="text-teal-100"/>
                    <input type="text" placeholder="Cari nama barang..." className="w-full bg-transparent p-1 text-sm text-white placeholder:text-teal-100/70 outline-none font-medium" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    {searchTerm && <button onClick={()=>setSearchTerm('')}><X size={16} className="text-white/70"/></button>}
                </div>
            </div>

            <div className="bg-white pb-3 pt-3 px-4 border-b border-slate-100">
                {/* Stats & Filters (Sama seperti sebelumnya, dipersingkat di sini) */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                    <select className="bg-white text-slate-600 text-[10px] font-bold border border-slate-200 rounded-lg px-2 py-1.5 outline-none shadow-sm min-w-[100px]" value={filterType} onChange={e=>setFilterType(e.target.value)}>
                        <option value="all">Semua Jenis</option>
                        <option value="ingredient">Bahan Baku</option>
                        <option value="tool">Alat</option>
                    </select>
                    <select className="bg-white text-slate-600 text-[10px] font-bold border border-slate-200 rounded-lg px-2 py-1.5 outline-none shadow-sm min-w-[100px]" value={filterWh} onChange={e=>setFilterWh(e.target.value)}>
                        <option value="all">Semua Gudang</option>
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                </div>
            </div>
        </div>

        {/* LIST BARANG */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-slate-50 pb-20">
            {loading ? <div className="py-10 text-center text-slate-400 text-xs">Memuat data...</div> :
             filteredItems.length === 0 ? 
                <div className="text-center py-16 text-slate-300">
                    <Package size={48} className="mx-auto mb-2 opacity-50"/>
                    <p className="text-sm font-medium">Belum ada barang</p>
                </div>
             :
             filteredItems.map(item => (
                <motion.div 
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    key={item.id} 
                    onClick={() => navigate(`/inventory/${item.id}`)}
                    className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 active:scale-98 transition cursor-pointer group hover:shadow-md relative overflow-hidden"
                >
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg shrink-0 ${item.type === 'tool' ? 'bg-orange-50 text-orange-600' : 'bg-teal-50 text-teal-600'}`}>
                                {item.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                                <h3 className="font-bold text-slate-800 text-sm truncate">{item.name}</h3>
                                <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                    <Archive size={10}/> {item.warehouses?.name || 'Gudang Umum'}
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-base font-extrabold text-slate-800 leading-none">{item.current_stock} <span className="text-[9px] font-normal text-slate-500">{item.unit}</span></p>
                            <p className="text-[9px] text-teal-600 font-medium mt-0.5">@ {formatIDR(item.cost_per_unit)}</p>
                        </div>
                    </div>
                    
                    {/* Action Bar (Edit & Delete) - MUNCUL DI FOOTER */}
                    <div className="flex justify-between items-center pt-2 border-t border-slate-50 mt-2">
                        <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1 ${item.current_stock <= (item.min_stock_alert || 5) ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                            {item.current_stock <= (item.min_stock_alert || 5) ? <AlertTriangle size={8}/> : <CheckCircle2 size={8}/>}
                            {item.current_stock <= (item.min_stock_alert || 5) ? 'Stok Menipis' : 'Aman'}
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={(e) => handleEdit(e, item)}
                                className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition"
                            >
                                <Edit2 size={14}/>
                            </button>
                            <button 
                                onClick={(e) => handleDelete(e, item)}
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                            >
                                <Trash2 size={14}/>
                            </button>
                            <div className="h-4 w-[1px] bg-slate-200 mx-1"></div>
                            <div className="flex items-center gap-1 text-slate-300 group-hover:text-teal-500 transition">
                                <span className="text-[9px] font-bold">Detail</span>
                                <ChevronRight size={12}/>
                            </div>
                        </div>
                    </div>
                </motion.div>
             ))
            }
        </div>

        {/* MODAL FORM */}
        <AnimatePresence>
            {showFormModal && (
                <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => setShowFormModal(false)}>
                    <motion.div initial={{y:"100%"}} animate={{y:0}} exit={{y:"100%"}} className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl" onClick={e=>e.stopPropagation()}>
                        <div className="p-5 border-b bg-white flex justify-between items-center">
                            <h3 className="font-extrabold text-lg text-slate-800">{formData.id ? 'Edit Data Barang' : 'Barang Baru'}</h3>
                            <button onClick={() => setShowFormModal(false)} className="p-1 rounded-full bg-slate-100 hover:text-red-500 transition"><X size={20}/></button>
                        </div>
                        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto bg-slate-50/50">
                            
                            {/* CARD 1: Info Dasar */}
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 mb-2 block">Nama Barang</label>
                                    <input type="text" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:border-teal-500" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                                </div>
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <label className="text-xs font-bold text-slate-500 mb-2 block">Jenis</label>
                                        <select className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm font-medium outline-none focus:border-teal-500" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                                            <option value="ingredient">Bahan Baku</option>
                                            <option value="tool">Alat</option>
                                        </select>
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-xs font-bold text-slate-500 mb-2 block">Satuan</label>
                                        <select className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm font-medium outline-none focus:border-teal-500" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})}>
                                            {UNIT_OPTIONS[formData.type].map(u => <option key={u} value={u}>{u}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* CARD 2: Stok & Keuangan */}
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-4">
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <label className="text-xs font-bold text-slate-500 mb-2 block">Stok Saat Ini</label>
                                        <input 
                                            type="number" 
                                            disabled={!!formData.id} // Disabled jika Edit
                                            className={`w-full p-3 rounded-xl border border-slate-200 text-sm font-bold outline-none ${formData.id ? 'bg-slate-100 text-slate-400' : 'bg-slate-50 focus:border-teal-500'}`} 
                                            value={formData.current_stock} 
                                            onChange={e => setFormData({...formData, current_stock: e.target.value})} 
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-xs font-bold text-slate-500 mb-2 block">Harga Beli</label>
                                        <MoneyInput className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:border-teal-500" placeholder="0" value={formData.cost_per_unit} onChange={val => setFormData({...formData, cost_per_unit: val})} />
                                    </div>
                                </div>
                                
                                {/* --- TAMBAHAN KODE DI SINI --- */}
                                {/* Pesan Info Khusus Saat Edit */}
                                {formData.id && (
                                    <div className="bg-orange-50 border border-orange-100 p-3 rounded-lg flex gap-2 items-start">
                                        <AlertTriangle size={14} className="text-orange-500 shrink-0 mt-0.5"/>
                                        <div className="text-[10px] text-orange-700 leading-snug">
                                            <span className="font-bold block mb-0.5">Mode Edit Terbatas</span>
                                            Stok & Status Keuangan tidak bisa diubah di sini demi keamanan data. 
                                            <br/>Jika salah input (misal: harusnya beli baru), silakan <span className="font-bold underline cursor-pointer" onClick={() => { setShowFormModal(false); /* Trigger hapus manual nanti */ }}>Hapus Barang</span> lalu input ulang.
                                        </div>
                                    </div>
                                )}
                                {/* ----------------------------- */}

                                <div>
                                    <label className="text-xs font-bold text-slate-500 mb-2 block">Gudang</label>
                                    <select className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm font-medium outline-none focus:border-teal-500" value={formData.warehouse_id} onChange={e => setFormData({...formData, warehouse_id: e.target.value})}>
                                        <option value="">-- Pilih Gudang --</option>
                                        {warehouses.map(wh => <option key={wh.id} value={wh.id}>{wh.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* OPSI PEMBELIAN (HANYA BARANG BARU) */}
                            {!formData.id && parseFloat(formData.current_stock) > 0 && (
                                <div className={`p-4 rounded-xl border-2 transition-all duration-300 ${isPurchaseMode ? 'bg-teal-50 border-teal-200' : 'bg-slate-50 border-slate-100'}`}>
                                    <div className="flex items-center gap-3 mb-3 cursor-pointer" onClick={() => setIsPurchaseMode(!isPurchaseMode)}>
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition ${isPurchaseMode ? 'bg-teal-500 border-teal-500' : 'bg-white border-slate-300'}`}>
                                            {isPurchaseMode && <CheckCircle2 size={14} className="text-white"/>}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-700">Catat Sebagai Pembelian Baru?</p>
                                            <p className="text-[10px] text-slate-400">Centang jika barang ini dibeli pakai uang kas.</p>
                                        </div>
                                    </div>
                                    {isPurchaseMode && (
                                        <motion.div initial={{opacity:0, height:0}} animate={{opacity:1, height:'auto'}} className="space-y-3 pt-2 border-t border-teal-100/50">
                                            <div>
                                                <label className="text-[10px] font-bold text-teal-700 mb-1 block">Sumber Dana (Wajib)</label>
                                                <select className="w-full p-2.5 bg-white rounded-lg border border-teal-200 text-xs font-bold outline-none" value={purchaseData.wallet_id} onChange={e => setPurchaseData({...purchaseData, wallet_id: e.target.value})}>
                                                    <option value="">-- Pilih Dompet --</option>
                                                    {wallets.map(w => <option key={w.id} value={w.id}>{w.name} (Sisa: {formatIDR(w.initial_balance)})</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-teal-700 mb-1 block">Nama Supplier</label>
                                                <input type="text" placeholder="Cth: Toko Jaya" className="w-full p-2.5 bg-white rounded-lg border border-teal-200 text-xs font-bold outline-none" value={purchaseData.supplier} onChange={e => setPurchaseData({...purchaseData, supplier: e.target.value})} />
                                            </div>
                                        </motion.div>
                                    )}
                                </div>
                            )}

                            <button onClick={handleSubmitMaster} disabled={processing} className="w-full py-4 bg-teal-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-teal-200 hover:bg-teal-700 active:scale-95 transition flex items-center justify-center gap-2">
                                {processing ? <Loader2 className="animate-spin" size={18}/> : "Simpan Data"}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
        
        {/* Modal Notif dengan Callback onConfirm */}
        <ModalInfo isOpen={notif.isOpen} type={notif.type} title={notif.title} message={notif.message} onClose={()=>setNotif(prev => ({...prev, isOpen:false}))} onConfirm={notif.onConfirm} confirmText={notif.confirmText} />
    </div>
  );
}