import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, User, Phone, Mail, Lock, Eye, EyeOff, ArrowRight, CheckCircle, AlertTriangle, 
  Briefcase, Users, UserCircle, Building2 
} from 'lucide-react';

// --- IMPORT ASSETS (Path Diperbarui) ---
import logoVizofinHorizontal from '../assets/vizofinhorizontal.png'; 
import faviconImg from '../assets/fapicon.png';

export default function RegisterPage() {
  const navigate = useNavigate();
  
  // --- STATE ---
  const [accountType, setAccountType] = useState('personal'); // Default: Personal
  
  const [fullName, setFullName] = useState('');     
  const [entityName, setEntityName] = useState(''); 
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // --- STATE MODAL ---
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // --- SET FAVICON & TITLE ---
  useEffect(() => {
    document.title = "Daftar Akun - Vizofin";
    const link = document.querySelector("link[rel~='icon']");
    if (link) {
        link.href = faviconImg;
    } else {
        const newLink = document.createElement('link');
        newLink.rel = 'icon';
        newLink.href = faviconImg;
        document.head.appendChild(newLink);
    }
  }, []);

  // --- LOGIKA REGISTER ---
  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const metaData = {
        full_name: fullName,       
        phone: phone,
        account_type: accountType, 
        entity_name: accountType === 'personal' ? null : entityName 
      };

      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: metaData 
        }
      });

      if (error) throw error;
      setShowSuccessModal(true);

    } catch (error) {
      let msg = error.message;
      if (msg.includes("already registered")) msg = "Email ini sudah terdaftar. Silakan login saja.";
      else if (msg.includes("Password should be")) msg = "Password terlalu pendek. Minimal 6 karakter.";
      
      setErrorMessage(msg);
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col justify-center items-center p-4 font-sans relative">
      
      {/* Background Decoration */}
      <div className="absolute top-0 left-0 w-full h-[300px] z-0 pointer-events-none"></div>

      {/* === MODAL SUKSES & ERROR === */}
      <AnimatePresence>
        {showSuccessModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-[2rem] p-8 max-w-sm w-full text-center shadow-2xl">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600 animate-bounce"><CheckCircle size={40} /></div>
              <h3 className="text-2xl font-extrabold text-slate-900 mb-2">Siap Vizofin! 🎉</h3>
              <p className="text-slate-500 mb-8 leading-relaxed">
                Akun <strong>{accountType === 'personal' ? 'Pribadi' : entityName}</strong> berhasil dibuat. Silakan cek email untuk verifikasi.
              </p>
              <button onClick={() => navigate('/login')} className="w-full bg-blue-900 text-white py-3.5 rounded-xl font-bold hover:bg-blue-800 transition shadow-lg active:scale-95">Masuk Dashboard</button>
            </motion.div>
          </div>
        )}
        {showErrorModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-[2rem] p-8 max-w-sm w-full text-center shadow-2xl border border-red-50">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600"><AlertTriangle size={40} /></div>
              <h3 className="text-xl font-extrabold text-slate-900 mb-2">Gagal Daftar</h3>
              <p className="text-slate-500 mb-6">{errorMessage}</p>
              <button onClick={() => setShowErrorModal(false)} className="w-full bg-slate-100 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-200 transition">Coba Lagi</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* === KARTU REGISTER === */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-white w-full max-w-[480px] p-6 md:p-4 z-10"
      >
        <div className="text-center mb-8">
            {/* LOGO VIZOFIN HORIZONTAL */}
            <div className="flex justify-center mb-4">
                <img 
                    src={logoVizofinHorizontal} 
                    alt="Vizofin Logo" 
                    className="h-10 md:h-12 w-auto object-contain" // Ukuran disesuaikan untuk logo horizontal
                />
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900">Buat Akun Baru</h2>
            <p className="text-slate-400 text-sm mt-1">Mulai kelola keuanganmu dengan cerdas.</p>
        </div>

        {/* === PILIHAN TIPE AKUN (REORDERED) === */}
        <div className="grid grid-cols-3 gap-3 mb-8">
            {/* 1. PRIBADI (Active) */}
            <div 
                onClick={() => setAccountType('personal')} 
                className={`cursor-pointer rounded-2xl p-3 border-2 flex flex-col items-center gap-2 transition-all active:scale-95 ${accountType === 'personal' ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm' : 'border-slate-100 hover:border-blue-200 text-slate-400 hover:text-slate-600'}`}
            >
                <UserCircle size={24} />
                <span className="text-[10px] md:text-xs font-bold">Pribadi</span>
            </div>

            {/* 2. BISNIS (Active - Pindah Posisi ke Tengah) */}
            <div 
                onClick={() => setAccountType('business')} 
                className={`cursor-pointer rounded-2xl p-3 border-2 flex flex-col items-center gap-2 transition-all active:scale-95 ${accountType === 'business' ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm' : 'border-slate-100 hover:border-indigo-200 text-slate-400 hover:text-slate-600'}`}
            >
                <Briefcase size={24} />
                <span className="text-[10px] md:text-xs font-bold">Bisnis</span>
            </div>

            {/* 3. ORGANISASI (DISABLED - Pindah Posisi ke Akhir) */}
            <div 
                className="rounded-2xl p-3 border-2 border-slate-100 bg-slate-50 flex flex-col items-center gap-2 cursor-not-allowed opacity-50 relative overflow-hidden group"
            >
                {/* Badge Coming Soon */}
                <div className="absolute top-1 right-1 bg-slate-200 text-[8px] font-bold px-1.5 py-0.5 rounded text-slate-500">SOON</div>
                
                <Users size={24} className="text-slate-300"/>
                <span className="text-[10px] md:text-xs font-bold text-slate-400">Organisasi</span>
            </div>
        </div>

        {/* FORM */}
        <form onSubmit={handleRegister} className="flex flex-col gap-5 text-left">
            
            {/* INPUT 1: NAMA PENDAFTAR */}
            <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Nama Pendaftar</label>
                <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><User size={18} /></div>
                    <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all font-bold text-slate-800 placeholder:text-slate-300" placeholder="Nama Lengkap Anda" required />
                </div>
            </div>

            {/* INPUT 2: NAMA BISNIS (Hanya Muncul jika tipe BISNIS) */}
            {accountType === 'business' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-1.5 overflow-hidden">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                        Nama Bisnis / Toko
                    </label>
                    <div className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><Building2 size={18} /></div>
                        <input 
                            type="text" 
                            value={entityName} 
                            onChange={(e) => setEntityName(e.target.value)} 
                            className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all font-bold text-slate-800 placeholder:text-slate-300" 
                            placeholder="Contoh: Kopi Senja Abadi" 
                            required 
                        />
                    </div>
                </motion.div>
            )}

            {/* INPUT 3: WHATSAPP */}
            <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">No. WhatsApp</label>
                <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><Phone size={18} /></div>
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all font-bold text-slate-800 placeholder:text-slate-300" placeholder="0812xxxx" required />
                </div>
            </div>

            {/* INPUT 4: EMAIL */}
            <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Email</label>
                <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><Mail size={18} /></div>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all font-bold text-slate-800 placeholder:text-slate-300" placeholder="nama@email.com" required />
                </div>
            </div>

            {/* INPUT 5: PASSWORD */}
            <div className="space-y-1.5 relative">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Password</label>
                <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><Lock size={18} /></div>
                    <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-11 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all font-bold text-slate-800 placeholder:text-slate-300" placeholder="Minimal 6 karakter" required />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors p-1">
                        {showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                    </button>
                </div>
            </div>

            <button type="submit" disabled={loading} className="w-full bg-blue-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-800 hover:shadow-lg hover:shadow-blue-200 transition active:scale-[0.98] mt-4 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {loading ? 'Memproses...' : 'Daftar Sekarang'} {!loading && <ArrowRight size={20}/>}
            </button>
        </form>
        
        <p className="text-center mt-8 text-slate-500 text-sm font-medium">
            Sudah punya akun? <span onClick={() => navigate('/login')} className="text-blue-700 font-extrabold cursor-pointer hover:underline decoration-2 underline-offset-4">Masuk disini</span>
        </p>
      </motion.div>

      <button onClick={() => navigate('/')} className="mt-8 flex items-center gap-2 text-slate-400 hover:text-slate-600 font-bold transition-colors text-sm group z-10">
         <div className="p-2 bg-white rounded-full shadow-sm group-hover:scale-110 transition-transform">
            <ArrowLeft size={16}/>
        </div>
        Kembali ke Beranda
      </button>

    </div>
  );
}