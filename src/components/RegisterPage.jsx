import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Sparkles, User, Phone, Mail, Lock, Eye, EyeOff, ArrowRight, CheckCircle, AlertTriangle, 
  Briefcase, Users, UserCircle, Building2 // Tambah Icon Building
} from 'lucide-react';

export default function RegisterPage() {
  const navigate = useNavigate();
  
  // --- STATE ---
  const [accountType, setAccountType] = useState('personal'); // Default: Personal
  
  const [fullName, setFullName] = useState('');     // Nama Pendaftar (PIC)
  const [entityName, setEntityName] = useState(''); // Nama Bisnis / Organisasi (Baru)
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // --- STATE MODAL ---
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // --- LOGIKA REGISTER ---
  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Siapkan data metadata (yang akan disimpan ke Supabase)
      const metaData = {
        full_name: fullName,       // Nama Orang
        phone: phone,
        account_type: accountType, // Flagging Tipe Akun
        // Jika personal, entity_name null. Jika tidak, ambil dari input.
        entity_name: accountType === 'personal' ? null : entityName 
      };

      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: metaData // Simpan ke raw_user_meta_data
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
    <div className="min-h-screen bg-white flex flex-col justify-center items-center p-2 font-sans relative">
      
      {/* === MODAL SUKSES & ERROR === */}
      <AnimatePresence>
        {showSuccessModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-[2rem] p-8 max-w-sm w-full text-center shadow-2xl">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600"><CheckCircle size={40} /></div>
              <h3 className="text-2xl font-extrabold text-slate-900 mb-2">Siap Rapikus! 🎉</h3>
              <p className="text-slate-500 mb-8">
                Akun <strong>{accountType === 'personal' ? 'Pribadi' : entityName}</strong> berhasil dibuat.
              </p>
              <button onClick={() => navigate('/login')} className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold hover:bg-indigo-700 transition">Masuk Dashboard</button>
            </motion.div>
          </div>
        )}
        {showErrorModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
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
        className="bg-white w-full max-w-[480px] p-2 md:p-10"
      >
        <div className="text-center mb-6">
            <div className="inline-flex justify-center items-center bg-gradient-to-br from-indigo-600 to-violet-600 p-4 rounded-2xl text-white shadow-lg shadow-indigo-200 mb-4">
                <Sparkles size={28} />
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900">Pilih Tipe Akunmu</h2>
        </div>

        {/* === PILIHAN TIPE AKUN === */}
        <div className="grid grid-cols-3 gap-3 mb-8">
            <div onClick={() => setAccountType('personal')} className={`cursor-pointer rounded-2xl p-3 border-2 flex flex-col items-center gap-2 transition-all ${accountType === 'personal' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 hover:border-indigo-200 text-slate-500'}`}>
                <UserCircle size={24} />
                <span className="text-xs font-bold">Pribadi</span>
            </div>
            <div onClick={() => setAccountType('organization')} className={`cursor-pointer rounded-2xl p-3 border-2 flex flex-col items-center gap-2 transition-all ${accountType === 'organization' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 hover:border-indigo-200 text-slate-500'}`}>
                <Users size={24} />
                <span className="text-xs font-bold">Organisasi</span>
            </div>
            <div onClick={() => setAccountType('business')} className={`cursor-pointer rounded-2xl p-3 border-2 flex flex-col items-center gap-2 transition-all ${accountType === 'business' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 hover:border-indigo-200 text-slate-500'}`}>
                <Briefcase size={24} />
                <span className="text-xs font-bold">Bisnis</span>
            </div>
        </div>

        {/* FORM */}
        <form onSubmit={handleRegister} className="flex flex-col gap-4">
            
            {/* INPUT 1: NAMA PENDAFTAR (SELALU MUNCUL) */}
            <div className="space-y-1">
                <label className="text-sm font-bold text-slate-700 ml-1">Nama Pendaftar</label>
                <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><User size={18} /></div>
                    <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium text-slate-800 placeholder:text-slate-400" placeholder="Nama Lengkap Anda" required />
                </div>
            </div>

            {/* INPUT 2: NAMA BISNIS / ORGANISASI (KONDISIONAL) */}
            {accountType !== 'personal' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-1">
                    <label className="text-sm font-bold text-slate-700 ml-1">
                        {accountType === 'business' ? 'Nama Bisnis / Toko' : 'Nama Organisasi'}
                    </label>
                    <div className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><Building2 size={18} /></div>
                        <input 
                            type="text" 
                            value={entityName} 
                            onChange={(e) => setEntityName(e.target.value)} 
                            className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium text-slate-800 placeholder:text-slate-400" 
                            placeholder={accountType === 'business' ? 'Contoh: Kopi Senja Abadi' : 'Contoh: BEM Univ. Rapikus'} 
                            required 
                        />
                    </div>
                </motion.div>
            )}

            {/* INPUT 3: WHATSAPP */}
            <div className="space-y-1">
                <label className="text-sm font-bold text-slate-700 ml-1">No. WhatsApp</label>
                <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><Phone size={18} /></div>
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium text-slate-800 placeholder:text-slate-400" placeholder="0812xxxx" required />
                </div>
            </div>

            {/* INPUT 4: EMAIL */}
            <div className="space-y-1">
                <label className="text-sm font-bold text-slate-700 ml-1">Email</label>
                <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><Mail size={18} /></div>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium text-slate-800 placeholder:text-slate-400" placeholder="nama@email.com" required />
                </div>
            </div>

            {/* INPUT 5: PASSWORD */}
            <div className="space-y-1 relative">
                <label className="text-sm font-bold text-slate-700 ml-1">Password</label>
                <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><Lock size={18} /></div>
                    <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-11 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium text-slate-800 placeholder:text-slate-400" placeholder="Minimal 6 karakter" required />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors">
                        {showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                    </button>
                </div>
            </div>

            <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 active:scale-[0.98] mt-4 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {loading ? 'Memproses...' : 'Daftar Sekarang'} {!loading && <ArrowRight size={20}/>}
            </button>
        </form>
        
        <p className="text-center mt-8 text-slate-500 text-sm font-medium">
            Sudah punya akun? <span onClick={() => navigate('/login')} className="text-indigo-600 font-bold cursor-pointer hover:underline">Masuk disini</span>
        </p>
      </motion.div>

      <button onClick={() => navigate('/')} className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 font-bold transition-colors text-sm group">
        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform"/> Kembali ke Beranda
      </button>

    </div>
  );
}