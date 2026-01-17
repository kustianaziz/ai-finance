import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider'; // LOGIKA ASLI TETAP ADA
import { motion } from 'framer-motion';
import { 
  ArrowLeft, Sparkles, Eye, EyeOff 
} from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth(); // Hook auth asli abang

  // --- STATE GABUNGAN (LOGIKA + UI) ---
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false); // State baru untuk mata

  // --- FUNGSI LOGIN (TIDAK DIUBAH LOGIKANYA) ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const { error } = await signIn({ email, password });

    if (error) {
      setErrorMsg('Email atau Password salah!');
      setLoading(false);
    } else {
      // Login sukses, redirect ke dashboard
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col justify-center items-center p-2 font-sans">
      
      {/* === KARTU LOGIN UTAMA === */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="bg-white w-full max-w-[400px] p-8 md:p-10 text-center"
      >
        
        {/* LOGO & BRANDING (Rapikus Style) */}
        <div className="flex justify-center mb-2">
            <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-4 rounded-2xl text-white shadow-lg shadow-indigo-200">
                <Sparkles size={32} />
            </div>
        </div>
        
        <h2 className="text-2xl font-extrabold text-slate-900 mb-1">Rapikus</h2>
        <p className="text-slate-500 text-sm mb-6">Masuk ke akun Rapikus kamu</p>

        {/* PESAN ERROR (MUNCUL JIKA GAGAL LOGIN) */}
        {errorMsg && (
            <div className="bg-red-50 border border-red-100 text-red-600 p-3 rounded-xl mb-6 text-sm font-bold flex items-center justify-center animate-pulse">
             ⚠️ {errorMsg}
            </div>
        )}

        {/* FORM */}
        <form onSubmit={handleLogin} className="flex flex-col gap-5 text-left">
            
            {/* Input Email */}
            <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700 ml-1">Email</label>
                <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium text-slate-800 placeholder:text-slate-400"
                    placeholder="nama@email.com"
                    required
                />
            </div>

            {/* Input Password dengan Icon Mata */}
            <div className="space-y-1.5 relative">
                <div className="flex justify-between items-center ml-1">
                    <label className="text-sm font-bold text-slate-700">Password</label>
                </div>
                <div className="relative">
                    <input 
                        type={showPassword ? "text" : "password"} 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium text-slate-800 pr-12" 
                        placeholder="••••••••"
                        required
                    />
                    {/* Tombol Mata (Show/Hide) */}
                    <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors"
                    >
                        {showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                    </button>
                </div>
            </div>

            {/* Tombol Login */}
            <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 active:scale-[0.98] mt-2 disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
                {loading ? 'Sedang Memuat...' : 'Masuk Sekarang'}
            </button>

        </form>

        {/* Link Daftar */}
        <p className="text-center mt-8 text-slate-500 text-sm font-medium">
            Belum punya akun? <span onClick={() => navigate('/register')} className="text-indigo-600 font-bold cursor-pointer hover:underline">Daftar Gratis</span>
        </p>

      </motion.div>

      {/* === TOMBOL KEMBALI (POSISI DI BAWAH) === */}
      <button 
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 font-bold transition-colors text-sm group"
      >
        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform"/>
        Kembali ke Beranda
      </button>

    </div>
  );
}