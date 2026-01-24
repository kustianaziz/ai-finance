import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, Eye, EyeOff 
} from 'lucide-react';

// --- IMPORT LOGO DI SINI ---
// Pastikan path-nya sesuai dengan tempat abang simpan gambar
// Jika error, cek apakah nama filenya benar (misal .jpg atau .png)
import logoVizofin from '../assets/vizofin.png'; 

export default function LoginPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();

  // --- STATE ---
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // --- FUNGSI LOGIN ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const { error } = await signIn({ email, password });

    if (error) {
      setErrorMsg('Email atau Password salah!');
      setLoading(false);
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 font-sans">
      
      {/* === KARTU LOGIN UTAMA === */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="bg-white w-full max-w-[420px] p-8 md:p-10 rounded-3xl shadow-2xl shadow-indigo-100 text-center border border-white"
      >
        
        {/* === BAGIAN LOGO BARU === */}
        <div className="flex flex-col items-center justify-center mb-6">
            {/* Logo Image */}
            <motion.img 
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 300 }}
                src={logoVizofin} 
                alt="Vizofin Logo" 
                className="w-20 h-auto object-contain drop-shadow-sm" 
            />
            {/* Karena di logo sudah ada tulisan 'VIZOFIN', kita tidak perlu teks H2 lagi biar rapi */}
            <p className="text-slate-400 text-sm font-medium mt-2">Smart Financial Companion</p>
        </div>
        
        {/* PESAN ERROR */}
        {errorMsg && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-red-50 border border-red-100 text-red-600 p-3 rounded-xl mb-6 text-sm font-bold flex items-center justify-center gap-2">
             <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></div> {errorMsg}
            </motion.div>
        )}

        {/* FORM */}
        <form onSubmit={handleLogin} className="flex flex-col gap-5 text-left">
            
            {/* Input Email */}
            <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Email</label>
                <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-slate-800 placeholder:text-slate-300"
                    placeholder="nama@email.com"
                    required
                />
            </div>

            {/* Input Password */}
            <div className="space-y-1.5 relative">
                <div className="flex justify-between items-center ml-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Password</label>
                </div>
                <div className="relative">
                    <input 
                        type={showPassword ? "text" : "password"} 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-slate-800 pr-12 placeholder:text-slate-300" 
                        placeholder="••••••••"
                        required
                    />
                    <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors p-1"
                    >
                        {showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                    </button>
                </div>
            </div>

            {/* Tombol Login */}
            <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-4 rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-indigo-200 hover:scale-[1.02] transition-all active:scale-[0.98] mt-4 disabled:opacity-70 disabled:cursor-not-allowed"
            >
                {loading ? 'Sedang Memuat...' : 'Masuk Sekarang'}
            </button>

        </form>

        {/* Link Daftar */}
        <p className="text-center mt-8 text-slate-500 text-sm font-medium">
            Belum punya akun? <span onClick={() => navigate('/register')} className="text-indigo-600 font-extrabold cursor-pointer hover:underline decoration-2 underline-offset-4">Daftar Gratis</span>
        </p>

      </motion.div>

      {/* === TOMBOL KEMBALI === */}
      <button 
        onClick={() => navigate('/')}
        className="mt-8 flex items-center gap-2 text-slate-400 hover:text-slate-600 font-bold transition-colors text-sm group"
      >
        <div className="p-2 bg-white rounded-full shadow-sm group-hover:scale-110 transition-transform">
            <ArrowLeft size={16}/>
        </div>
        Kembali ke Beranda
      </button>

    </div>
  );
}