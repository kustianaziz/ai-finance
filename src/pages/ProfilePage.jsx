import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// IMPORT MUNDUR 2 LEVEL (Sesuai posisi src/page/public/)
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthProvider';
import ModalInfo from '../components/ModalInfo'; 

import { 
  ArrowLeft, Camera, User, Phone, 
  Calendar, Building2, Save, LogOut, Loader2, Info, X, 
  CheckCircle2, AlertCircle, HelpCircle, Store, Copy, ExternalLink, Globe, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- KOMPONEN PICKER TANGGAL (GRID 1-31) ---
const DayPickerModal = ({ isOpen, onClose, onSelect, currentVal }) => {
    const days = Array.from({ length: 31 }, (_, i) => i + 1);

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
                    <motion.div 
                        initial={{ y: "100%" }} 
                        animate={{ y: 0 }} 
                        exit={{ y: "100%" }} 
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl" 
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="font-extrabold text-lg text-slate-900">Pilih Tanggal Cut-off</h3>
                                <p className="text-xs text-slate-500">Kapan siklus budgetmu dimulai?</p>
                            </div>
                            <button onClick={onClose} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition"><X size={20}/></button>
                        </div>

                        <div className="grid grid-cols-7 gap-2 mb-6">
                            {days.map(day => {
                                const isSelected = currentVal === day;
                                return (
                                    <button
                                        key={day}
                                        onClick={() => { onSelect(day); onClose(); }}
                                        className={`
                                            aspect-square rounded-xl flex items-center justify-center text-sm font-bold transition-all active:scale-90
                                            ${isSelected 
                                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 ring-2 ring-indigo-600 ring-offset-2' 
                                                : 'bg-slate-50 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-100'}
                                        `}
                                    >
                                        {day}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="bg-blue-50 p-3 rounded-xl flex gap-3 items-start text-blue-700 text-xs leading-relaxed">
                            <Info size={16} className="shrink-0 mt-0.5"/>
                            <p>
                                <b>Tips:</b> Pilih tanggal gajianmu. <br/>
                                Jika gajian akhir bulan (tgl 28-31), disarankan pilih tanggal <b>1</b> agar hitungan bulan kalender lebih rapi.
                            </p>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false); // State baru
  
  // State Notifikasi Custom
  const [notif, setNotif] = useState({ show: false, type: 'info', title: '', message: '', onConfirm: null });

  // State Form Data
  const [formData, setFormData] = useState({
    full_name: '',
    email: '', 
    phone: '',
    entity_name: '',
    account_type: 'personal',
    start_date_cycle: 1, 
    avatar_url: null,
    store_slug: '' 
  });

  // Helper Notifikasi
  const showAlert = (type, title, message) => setNotif({ show: true, type, title, message, onConfirm: null });
  const showConfirm = (title, message, onConfirm) => setNotif({ show: true, type: 'confirm', title, message, onConfirm });
  const closeNotif = () => setNotif({ ...notif, show: false });

  // 1. Fetch Profile Data
  useEffect(() => {
    if (user) getProfile();
  }, [user]);

  const getProfile = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (data) {
        setFormData({
          full_name: data.full_name || '',
          email: data.email || user.email,
          phone: data.phone || '',
          entity_name: data.entity_name || '',
          account_type: data.account_type || 'personal',
          start_date_cycle: data.start_date_cycle || 1,
          avatar_url: data.avatar_url,
          store_slug: data.store_slug || ''
        });
        localStorage.setItem('user_profile_cache', JSON.stringify(data));
      }
    } catch (error) {
      showAlert('error', 'Gagal', 'Gagal memuat profil: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. Handle Update
  const updateProfile = async () => {
    try {
      setUpdating(true);

      const updates = {
        id: user.id,
        full_name: formData.full_name,
        phone: formData.phone,
        entity_name: formData.entity_name,
        start_date_cycle: parseInt(formData.start_date_cycle),
        store_slug: formData.store_slug || null, 
        updated_at: new Date(),
      };

      const { error } = await supabase.from('profiles').upsert(updates);

      if (error) throw error;

      const cached = JSON.parse(localStorage.getItem('user_profile_cache') || '{}');
      const newCache = { ...cached, ...updates };
      localStorage.setItem('user_profile_cache', JSON.stringify(newCache));

      showAlert('success', 'Berhasil', 'Profil berhasil diperbarui!');
      
      setTimeout(() => {
          navigate('/dashboard'); 
      }, 1500);

    } catch (error) {
      showAlert('error', 'Gagal', 'Gagal update: ' + error.message);
    } finally {
      setUpdating(false);
    }
  };

  // 3. Handle Logout
  const handleLogout = () => {
    showConfirm(
        "Logout?", 
        "Kamu yakin ingin keluar dari akun?", 
        async () => {
            await signOut();
            localStorage.removeItem('app_mode');
            localStorage.removeItem('user_profile_cache');
            navigate('/login');
        }
    );
  };

  const getTypeLabel = (type) => {
      if (type === 'business') return 'Akun Bisnis';
      if (type === 'organization') return 'Akun Organisasi';
      if (type === 'personal_pro') return 'Personal Pro';
      return 'Personal (Free)';
  };

  // Helper Copy Link (FIXED: Tanpa Alert Popup)
  const copyLink = () => {
      if (!formData.store_slug) return;
      const url = `${window.location.origin}/portal/${formData.store_slug}`;
      navigator.clipboard.writeText(url);
      
      // Tampilkan indikator sukses kecil
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000); // Hilang setelah 2 detik
  };

  // Helper Open Link
  const openLink = () => {
      if (!formData.store_slug) return;
      const url = `/portal/${formData.store_slug}`;
      window.open(url, '_blank');
  };

  return (
    <motion.div 
        initial={{ x: "-100%" }} 
        animate={{ x: 0 }} 
        exit={{ x: "-100%" }} 
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="min-h-screen bg-slate-50 font-sans pb-20"
    >
      {/* Header */}
      <div className="bg-white p-4 sticky top-0 z-20 border-b border-slate-100 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')} className="p-2 rounded-full hover:bg-slate-100 transition">
                <ArrowLeft size={20} className="text-slate-600"/>
            </button>
            <h1 className="font-bold text-lg text-slate-800">Profil Saya</h1>
        </div>
        <button onClick={handleLogout} className="text-red-500 p-2 hover:bg-red-50 rounded-full transition">
            <LogOut size={20}/>
        </button>
      </div>

      {loading ? (
          <div className="p-10 text-center text-slate-400 animate-pulse">Memuat profil...</div>
      ) : (
          <div className="p-6 max-w-md mx-auto space-y-6">
            
            {/* AVATAR */}
            <div className="flex flex-col items-center text-center">
                <div className="relative mb-3">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                        {formData.full_name ? formData.full_name.charAt(0).toUpperCase() : <User size={40}/>}
                    </div>
                    <button className="absolute bottom-0 right-0 p-2 bg-white rounded-full shadow-md border border-slate-100 text-slate-500 hover:text-indigo-600">
                        <Camera size={16}/>
                    </button>
                </div>
                <h2 className="text-xl font-extrabold text-slate-900">{formData.full_name || 'User Vizofin'}</h2>
                <p className="text-sm text-slate-500 mb-2">{formData.email}</p>
                <span className="bg-indigo-50 text-indigo-600 text-[10px] font-bold px-3 py-1 rounded-full border border-indigo-100 uppercase tracking-wide">
                    {getTypeLabel(formData.account_type)}
                </span>
            </div>

            {/* FORM DASAR */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                <h3 className="font-bold text-slate-800 text-sm border-b border-slate-50 pb-2 mb-2">Informasi Dasar</h3>
                
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 flex items-center gap-1"><User size={12}/> Nama Lengkap</label>
                    <input 
                        type="text" 
                        value={formData.full_name} 
                        onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                        className="w-full p-3 bg-slate-50 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 ring-indigo-100 transition"
                    />
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 flex items-center gap-1"><Phone size={12}/> No. WhatsApp</label>
                    <input 
                        type="tel" 
                        value={formData.phone} 
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        placeholder="08xxxxxxxx"
                        className="w-full p-3 bg-slate-50 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 ring-indigo-100 transition"
                    />
                </div>

                {['business', 'organization'].includes(formData.account_type) && (
                    <div className="space-y-1 animate-fade-in">
                        <label className="text-xs font-bold text-slate-400 flex items-center gap-1"><Building2 size={12}/> Nama {formData.account_type === 'business' ? 'Bisnis' : 'Organisasi'}</label>
                        <input 
                            type="text" 
                            value={formData.entity_name} 
                            onChange={(e) => setFormData({...formData, entity_name: e.target.value})}
                            className="w-full p-3 bg-slate-50 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 ring-indigo-100 transition"
                        />
                    </div>
                )}
            </div>

            {/* KONFIGURASI TOKO / LINK PORTAL (FITUR BARU) */}
            {['business', 'organization'].includes(formData.account_type) && (
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                    <h3 className="font-bold text-slate-800 text-sm border-b border-slate-50 pb-2 mb-2 flex items-center gap-2">
                        <Store size={16} className="text-indigo-600"/> Portal Karyawan
                    </h3>
                    
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-600">ID Toko (Slug)</label>
                        <div className="flex gap-2 items-center">
                            <div className="p-3 bg-slate-50 rounded-xl text-xs flex items-center text-slate-400 font-bold border border-slate-200">
                                vizofin.app/
                            </div>
                            <input 
                                type="text" 
                                placeholder="toko-kamu"
                                value={formData.store_slug}
                                onChange={(e) => setFormData({...formData, store_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')})}
                                className="flex-1 p-3 bg-indigo-50 rounded-xl text-sm font-bold text-indigo-700 outline-none focus:ring-2 ring-indigo-100 transition placeholder:text-indigo-300"
                            />
                        </div>

                        {formData.store_slug && (
                            <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2 animate-fade-in relative">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <Globe size={16} className="text-slate-400 shrink-0"/>
                                    <span className="text-xs font-medium text-slate-600 truncate">
                                        {window.location.origin}/portal/<span className="font-bold text-indigo-600">{formData.store_slug}</span>
                                    </span>
                                </div>
                                <div className="flex gap-1 shrink-0 relative">
                                    <button onClick={copyLink} className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition" title="Salin Link">
                                        {copySuccess ? <Check size={14} className="text-green-500"/> : <Copy size={14}/>}
                                    </button>
                                    <button onClick={openLink} className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition" title="Buka Portal">
                                        <ExternalLink size={14}/>
                                    </button>
                                </div>
                                {/* INDIKATOR SUKSES (KECIL DI BAWAH) */}
                                {copySuccess && (
                                    <span className="absolute -bottom-5 right-0 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100 animate-fade-in">
                                        Link tersalin!
                                    </span>
                                )}
                            </div>
                        )}

                        <div className="bg-blue-50 p-2.5 rounded-lg flex gap-2 items-start text-[10px] text-blue-600 font-medium leading-relaxed mt-1">
                            <Info size={14} className="shrink-0 mt-0.5"/>
                            <p>Link ini digunakan karyawan untuk Login POS tanpa perlu akun email/password Owner.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* PENGATURAN SIKLUS */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                <h3 className="font-bold text-slate-800 text-sm border-b border-slate-50 pb-2 mb-2 flex items-center gap-2">
                    <Calendar size={16} className="text-indigo-600"/> Pengaturan Siklus
                </h3>

                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600">Tanggal Mulai Budget (Gajian)</label>
                    <button 
                        onClick={() => setShowDayPicker(true)}
                        className="w-full p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-between group hover:bg-indigo-100 transition"
                    >
                        <div className="flex items-center gap-3">
                            <div className="bg-white p-2 rounded-lg text-indigo-600 font-bold shadow-sm group-hover:scale-110 transition-transform">
                                {formData.start_date_cycle}
                            </div>
                            <div className="text-left">
                                <p className="text-sm font-bold text-indigo-900">Setiap Tanggal {formData.start_date_cycle}</p>
                                <p className="text-[10px] text-indigo-500">Klik untuk ubah tanggal</p>
                            </div>
                        </div>
                        <Calendar size={18} className="text-indigo-400"/>
                    </button>
                    <div className="bg-slate-50 p-3 rounded-xl flex gap-3 items-start text-slate-500 text-xs leading-relaxed mt-2 border border-slate-100">
                        <Info size={16} className="shrink-0 mt-0.5 text-slate-400"/>
                        <p>
                            Ini menentukan kapan laporan bulananmu di-reset. <br/>
                            Saat ini: <b>Tgl {formData.start_date_cycle} s/d Tgl {formData.start_date_cycle - 1}</b> bulan depan.
                        </p>
                    </div>
                </div>
            </div>

            {/* TOMBOL SIMPAN */}
            <button 
                onClick={updateProfile} 
                disabled={updating}
                className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-base shadow-lg hover:scale-[1.02] transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70"
            >
                {updating ? <Loader2 size={20} className="animate-spin"/> : <Save size={20}/>}
                {updating ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>

            <div className="text-center pt-4 pb-10">
                <p className="text-[10px] text-slate-300">Vizofin v1.0.0 • Build with ❤️</p>
            </div>

          </div>
      )}

      {/* RENDER MODAL PICKER */}
      <DayPickerModal 
          isOpen={showDayPicker} 
          onClose={() => setShowDayPicker(false)} 
          currentVal={parseInt(formData.start_date_cycle)}
          onSelect={(day) => setFormData({...formData, start_date_cycle: day})}
      />

      {/* RENDER MODAL NOTIFIKASI */}
      <AnimatePresence>
        {notif.show && (
            <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                <motion.div 
                    initial={{ scale: 0.9 }} 
                    animate={{ scale: 1 }} 
                    exit={{ scale: 0.9 }} 
                    className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl text-center"
                >
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${notif.type === 'success' ? 'bg-green-100 text-green-600' : notif.type === 'error' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                        {notif.type === 'success' ? <CheckCircle2 size={32}/> : 
                         notif.type === 'error' ? <AlertCircle size={32}/> : 
                         notif.type === 'confirm' ? <HelpCircle size={32}/> : <Info size={32}/>}
                    </div>
                    <h3 className="text-xl font-extrabold text-slate-900 mb-2">{notif.title}</h3>
                    <p className="text-slate-500 text-sm mb-6 leading-relaxed">{notif.message}</p>
                    <div className="flex gap-3 justify-center">
                        {notif.type === 'confirm' ? (
                            <>
                                <button onClick={closeNotif} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200">Batal</button>
                                <button onClick={() => { closeNotif(); notif.onConfirm && notif.onConfirm(); }} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-lg">Ya, Keluar</button>
                            </>
                        ) : (
                            <button onClick={closeNotif} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800">Oke, Siap!</button>
                        )}
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}