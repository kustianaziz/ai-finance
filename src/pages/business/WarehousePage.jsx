import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthProvider'; // Pastikan import ini benar
import { 
  ArrowLeft, Plus, Edit2, Trash2, X, Save, Loader2, Search, 
  Package, MapPin, CheckCircle2, Store
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function WarehousePage() {
  const navigate = useNavigate();
  const { user, activeEmployee } = useAuth(); // Ambil data Owner & Karyawan

  // Tentukan siapa yang sedang akses? (Owner ID)
  // Jika Owner login -> pakai user.id
  // Jika Karyawan login -> pakai activeEmployee.storeId
  const ownerId = user?.id || activeEmployee?.storeId;

  // State
  const [loading, setLoading] = useState(true);
  const [warehouses, setWarehouses] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal & Processing
  const [showModal, setShowModal] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Form Data
  const [formData, setFormData] = useState({ id: null, name: '', address: '', is_default: false });

  // 1. Fetch Data
  useEffect(() => {
    if (ownerId) fetchData();
  }, [ownerId]);

  const fetchData = async () => {
    try {
        setLoading(true);
        const { data, error } = await supabase
            .from('warehouses')
            .select('*')
            .eq('user_id', ownerId) // Gunakan ID Pemilik Toko
            .order('is_default', { ascending: false })
            .order('created_at', { ascending: true });

        if (error) throw error;
        setWarehouses(data || []);
    } catch (error) {
        console.error("Error:", error);
    } finally {
        setLoading(false);
    }
  };

  // 2. Handlers
  const handleSubmit = async () => {
      if (!formData.name) return alert("Nama gudang wajib diisi!");
      
      // Proteksi: Karyawan biasanya tidak boleh edit gudang (Tergantung kebijakan)
      if (activeEmployee && !activeEmployee.permissions.includes('STOCK_MANAGE')) {
          return alert("Anda tidak memiliki izin mengelola gudang.");
      }

      setProcessing(true);
      try {
          const payload = {
              user_id: ownerId,
              name: formData.name,
              address: formData.address,
              is_default: formData.is_default
          };

          // Logic Exclusive Default
          if (formData.is_default) {
              await supabase.from('warehouses')
                .update({ is_default: false })
                .eq('user_id', ownerId);
          }

          if (formData.id) {
              await supabase.from('warehouses').update(payload).eq('id', formData.id);
          } else {
              if (warehouses.length === 0) payload.is_default = true;
              await supabase.from('warehouses').insert(payload);
          }

          setShowModal(false);
          fetchData();
      } catch (e) {
          alert("Gagal simpan: " + e.message);
      } finally {
          setProcessing(false);
      }
  };

  const deleteItem = async (id, isDefault) => {
      if (activeEmployee) return alert("Hanya Owner yang boleh menghapus gudang.");
      
      if (isDefault) return alert("Gudang Utama tidak bisa dihapus!");
      if (window.confirm("Hapus gudang ini?")) {
          await supabase.from('warehouses').delete().eq('id', id);
          fetchData();
      }
  };

  // --- SMART BACK BUTTON ---
  const handleBack = () => {
    // 1. Cek User Supabase (Owner Asli)
    if (user) {
        navigate('/dashboard'); // Owner pulangnya ke sini
    } 
    // 2. Kalau gak ada User tapi ada Sesi Karyawan
    else if (activeEmployee) {
        navigate('/employee-dashboard'); // Karyawan pulangnya ke sini
    }
    // 3. Fallback (Jaga-jaga)
    else {
        navigate('/login');
    }
};

  // Filter Helper
  const filteredData = warehouses.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.address || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans max-w-md mx-auto relative shadow-2xl shadow-slate-200">
      
      {/* HEADER */}
      <div className="bg-blue-600 p-5 pb-20 rounded-b-[2.5rem] shadow-lg sticky top-0 z-20">
        <div className="flex items-center gap-3 mb-6">
            <button onClick={handleBack} className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition backdrop-blur-sm"><ArrowLeft size={18} /></button>
            <div className="flex-1"><h1 className="text-lg font-extrabold text-white">Gudang & Lokasi</h1><p className="text-[10px] text-blue-100 font-medium">Atur Penyimpanan Stok</p></div>
        </div>

        {/* SEARCH BAR */}
        <div className="bg-white/10 p-1 rounded-xl backdrop-blur-sm border border-white/20 flex items-center px-3">
            <Search size={16} className="text-blue-100"/>
            <input 
                type="text" 
                placeholder="Cari gudang..." 
                className="w-full bg-transparent p-2 text-sm text-white placeholder:text-blue-200 outline-none font-medium"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
            />
        </div>
      </div>

      {/* CONTENT */}
      <div className="px-4 -mt-12 relative z-30 space-y-3">
          {loading ? (
             <div className="bg-white rounded-2xl p-6 shadow-sm text-center text-gray-400 animate-pulse"><p className="text-xl mb-1">📦</p><span className="text-xs">Memuat Data...</span></div>
          ) : (
             <>
                {filteredData.length === 0 ? (
                    <div className="text-center py-10 bg-white rounded-2xl border border-gray-100 shadow-sm">
                        <Store size={40} className="mx-auto mb-2 text-gray-300"/>
                        <p className="text-sm text-gray-400 font-medium">Belum ada gudang.</p>
                    </div>
                ) : (
                    filteredData.map(item => (
                        <motion.div initial={{opacity:0, y:5}} animate={{opacity:1, y:0}} key={item.id} className={`p-4 rounded-xl border shadow-sm flex justify-between items-center transition ${item.is_default ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-200' : 'bg-white border-gray-100 hover:shadow-md'}`}>
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm shrink-0 ${item.is_default ? 'bg-blue-600' : 'bg-slate-200 text-slate-500'}`}>
                                    {item.is_default ? <CheckCircle2 size={20}/> : <Package size={20}/>}
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className={`font-bold text-sm truncate ${item.is_default ? 'text-blue-800' : 'text-slate-800'}`}>{item.name}</h3>
                                        {item.is_default && <span className="bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded font-bold">UTAMA</span>}
                                    </div>
                                    <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5">
                                        <MapPin size={10}/>
                                        <span className="truncate">{item.address || 'Tidak ada alamat'}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-1 s{(!activeEmployee || activeEmployee.permissions.includes('STOCK_MANAGE')) && (hrink-0">
                                {/* Tombol Edit hanya muncul untuk Owner atau Karyawan berizin */}
                                {(!activeEmployee || activeEmployee.permissions.includes('STOCK_MANAGE')) && (
                                    <button onClick={() => { setFormData(item); setShowModal(true); }} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition"><Edit2 size={16}/></button>
                                )}
                                
                                {/* Tombol Hapus HANYA untuk Owner */}
                                {!activeEmployee && !item.is_default && (
                                    <button onClick={() => deleteItem(item.id, item.is_default)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-100 rounded-lg transition"><Trash2 size={16}/></button>
                                )}
                            </div>
                        </motion.div>
                    ))
                )}
             </>
          )}
      </div>

      {/* FAB ADD (Hanya untuk Owner atau Karyawan berizin) */}
      {/* FAB ADD - Disederhanakan dulu */}
    <div className="fixed bottom-6 left-0 right-0 mx-auto max-w-md px-5 z-40 pointer-events-none flex justify-end">
        <button 
        onClick={() => { setFormData({ id: null, name: '', address: '', is_default: false }); setShowModal(true); }}
        className="pointer-events-auto w-14 h-14 bg-blue-600 text-white rounded-full shadow-xl shadow-blue-200 flex items-center justify-center hover:bg-blue-700 transition active:scale-90"
        >
            <Plus size={24}/>
        </button>
    </div>

      {/* MODAL FORM (SAMA SEPERTI SEBELUMNYA) */}
      <AnimatePresence>
        {showModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={() => setShowModal(false)}>
                <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-3xl">
                        <h3 className="font-bold text-gray-800 text-lg">{formData.id ? 'Edit Gudang' : 'Gudang Baru'}</h3>
                        <button onClick={() => setShowModal(false)}><X size={20} className="text-gray-400"/></button>
                    </div>
                    <div className="p-5 space-y-4">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 mb-1 block">NAMA GUDANG / CABANG</label>
                            <input type="text" placeholder="Contoh: Toko Utama, Gudang Belakang" className="w-full p-3 bg-slate-50 rounded-xl font-bold border border-slate-200 focus:border-blue-500 outline-none text-sm text-slate-700" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 mb-1 block">ALAMAT (OPSIONAL)</label>
                            <textarea placeholder="Lokasi gudang..." className="w-full p-3 bg-slate-50 rounded-xl font-medium border border-slate-200 focus:border-blue-500 outline-none text-sm text-slate-700 h-20 resize-none" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                        </div>
                        
                        <div className="flex items-center gap-3 bg-blue-50 p-3 rounded-xl border border-blue-100 cursor-pointer" onClick={() => setFormData({...formData, is_default: !formData.is_default})}>
                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition ${formData.is_default ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'}`}>
                                {formData.is_default && <CheckCircle2 size={14} className="text-white"/>}
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-bold text-slate-800">Jadikan Gudang Utama</p>
                                <p className="text-[10px] text-slate-500">Stok POS akan dipotong dari gudang ini.</p>
                            </div>
                        </div>

                        <button onClick={handleSubmit} disabled={processing} className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-100 active:scale-95 transition">
                            {processing ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} Simpan
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}