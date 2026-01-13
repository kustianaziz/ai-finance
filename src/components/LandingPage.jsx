import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowRight, CheckCircle2, BrainCircuit, Menu, X, ShieldCheck, Sparkles
} from 'lucide-react';

// --- IMPORT GAMBAR ASET ---
import heroImg from '../assets/landing/hero-mockup.png';
import featScan from '../assets/landing/feat-scan.png';
import featVoice from '../assets/landing/feat-voice.png';
import featWallet from '../assets/landing/feat-wallet.png';
import featChart from '../assets/landing/feat-chart.png';
import painReceipt from '../assets/landing/pain-receipt.png';
import painWallet from '../assets/landing/pain-wallet.png';
import painConfused from '../assets/landing/pain-confused.png';

// --- DATA UNTUK FITUR & PAIN POINTS ---
const featuresData = [
    { 
        image: featScan, 
        title: "Smart Scan Struk AI", 
        desc: "Malas ngetik? Foto aja struk belanjaanmu. AI canggih kami akan otomatis membaca total, tanggal, nama toko, dan langsung menebak apakah itu pengeluaran Bisnis atau Pribadi." 
    },
    { 
        image: featVoice, 
        title: "Voice Input Sat-set", 
        desc: "Lagi nyetir atau tangan kotor? Tinggal ngomong: 'Keluar 20 ribu buat bensin dan 15 ribu buat kopi'. Transaksi tercatat rapi dalam hitungan detik." 
    },
    { 
        image: featWallet, 
        title: "Pemisah Saldo Otomatis", 
        desc: "Fitur penyelamat UMKM! Jangan sampai uang modal usaha terpakai buat jajan pribadi. Dompet bisnis dan pribadi terpisah secara tegas dan jelas." 
    },
    { 
        image: featChart, 
        title: "Analisa Visual Real-time", 
        desc: "Bukan sekadar angka. Lihat grafik cantik yang memberi insight: Produk mana yang paling laris? Di hari apa pengeluaran paling boncos? Semua terjawab." 
    },
];

const painPointsData = [
    {
        image: painReceipt,
        title: "Struk Numpuk, Pas Dicari Hilang",
        desc: "Niatnya mau dicatat akhir bulan biar sekalian. Eh, pas waktunya tiba, struknya udah luntur, sobek, atau malah kebuang sama sampah lain. Rugi bandar!"
    },
    {
        image: painWallet,
        title: "Jualan Rame, Tapi Saldo Kosong?",
        desc: "Perasaan omzet hari ini gede banget, tapi kok pas mau belanja modal lagi, duit di ATM/laci kasir gak ada? Kemana bocornya uangmu?"
    },
    {
        image: painConfused,
        title: "Pusing Selisih Tiap Tutup Buku",
        desc: "Udah ngitung pakai kalkulator sampai tiga kali, hasilnya beda terus. Ujung-ujungnya capek sendiri dan terpaksa nombok pakai uang pribadi biar 'balance'."
    },
];

// --- KOMPONEN BARU: ZIG-ZAG SECTION (FLEXIBEL) ---
const ZigZagSection = ({ image, title, desc, isReversed, index }) => (
  <motion.div 
    initial={{ opacity: 0, y: 50 }}
    whileInView={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.7, delay: index * 0.1 }}
    viewport={{ once: true, margin: "-100px" }}
    // Logic: Kalau isReversed=true, gambar di kanan (flex-row-reverse). Kalau false, gambar di kiri.
    className={`flex flex-col ${isReversed ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-2 md:gap-4 py 3 md:py 2`}
  >
    {/* --- BAGIAN GAMBAR (LEBIH BESAR & FIT) --- */}
    <div className="w-full md:w-1/2 flex justify-center">
        {/* Container Gambar dengan Background Halus */}
        <div className="w-full max-w-lg h-[200px] md:h-[300px] bg-indigo-50/40 rounded-[2.5rem] p-6 md:p-10 flex items-center justify-center shadow-sm border border-indigo-100/50 hover:shadow-md transition-shadow">
             {/* Gambar di-set object-contain agar PAS dan tidak terpotong */}
             <img 
                src={image} 
                alt={title} 
                className="w-full h-full object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-500" 
             />
        </div>
    </div>
    
    {/* --- BAGIAN TEKS --- */}
    <div className="w-full md:w-1/2 text-center md:text-left px-4 md:px-0">
       <h3 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-6 leading-tight">{title}</h3>
       <p className="text-lg md:text-xl text-slate-600 leading-relaxed max-w-xl mx-auto md:mx-0">{desc}</p>
    </div>
  </motion.div>
);


// --- MAIN PAGE ---
export default function LandingPage() {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans overflow-x-hidden selection:bg-indigo-100 selection:text-indigo-700">
      
      {/* === 1. NAVBAR === */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-white/90 backdrop-blur-md shadow-sm py-4' : 'bg-transparent py-6'}`}>
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo(0,0)}>
            <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-200">
                <Sparkles size={24} />
            </div>
            <span className={`text-xl font-extrabold tracking-tight ${isScrolled ? 'text-slate-800' : 'text-slate-900'}`}>
              Rapikus
            </span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <button onClick={() => navigate('/login')} className="text-slate-600 font-bold hover:text-indigo-600 transition">Masuk</button>
            <button onClick={() => navigate('/register')} className="bg-slate-900 text-white px-6 py-2.5 rounded-full font-bold hover:bg-slate-800 transition shadow-lg active:scale-95">Daftar Gratis</button>
          </div>
          <button className="md:hidden text-slate-700" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X size={28}/> : <Menu size={28}/>}
          </button>
        </div>
        {mobileMenuOpen && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="absolute top-full left-0 right-0 bg-white border-b border-slate-100 p-6 flex flex-col gap-4 shadow-xl md:hidden">
            <button onClick={() => navigate('/login')} className="w-full py-3 text-slate-600 font-bold border rounded-xl">Masuk</button>
            <button onClick={() => navigate('/register')} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg">Daftar Sekarang</button>
          </motion.div>
        )}
      </nav>

      {/* === 2. HERO SECTION === */}
      <section className="pt-40 pb-20 px-6 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] md:w-[1000px] h-[600px] bg-gradient-to-r from-indigo-200 via-purple-100 to-teal-100 blur-[100px] -z-10 rounded-full opacity-50 pointer-events-none"></div>

        <div className="max-w-5xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <span className="inline-flex items-center gap-2 py-1.5 px-4 rounded-full bg-white border border-indigo-100 text-indigo-600 text-xs md:text-sm font-bold uppercase tracking-wider mb-8 shadow-sm">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span></span>
              Teknologi AI Terbaru 2026
            </span>
            <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 leading-[1.1] mb-8 tracking-tight">
              Kelola Uang <br className="hidden md:block"/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">Jadi Lebih Chill.</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">Scan struk pakai AI, catat pakai suara, dan pisahkan uang bisnis vs pribadi otomatis. Cocok buat kamu yang benci ribet.</p>
            <p className="text-lg md:text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">Rapikan Keuangan Untuk Sukses <b>Rapikus</b>.</p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <button onClick={() => navigate('/register')} className="bg-indigo-600 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-indigo-700 transition shadow-xl shadow-indigo-200 active:scale-95 flex items-center justify-center gap-2">Mulai Gratis <ArrowRight size={20}/></button>
              <button className="bg-white text-slate-700 px-8 py-4 rounded-full font-bold text-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition active:scale-95">Lihat Demo</button>
            </div>
          </motion.div>

          {/* HERO IMAGE MOCKUP */}
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.8 }} className="mt-20 max-w-4xl mx-auto relative">
             <div className="relative z-10 hover:scale-[1.02] transition-transform duration-700">
                 <img src={heroImg} alt="Tampilan Aplikasi KeuanganAI" className="w-full h-auto drop-shadow-2xl" />
             </div>
             <div className="absolute -right-4 -top-10 md:-right-12 md:top-20 bg-white p-4 rounded-2xl shadow-xl border border-slate-100 animate-bounce-slow hidden md:block z-20">
                <div className="flex items-center gap-3">
                   <div className="bg-green-100 p-2 rounded-full text-green-600"><CheckCircle2 size={20}/></div>
                   <div>
                      <p className="text-xs text-slate-400 font-bold">Analisa</p>
                      <p className="text-sm font-bold text-slate-800">Hemat 30%</p>
                   </div>
                </div>
             </div>
          </motion.div>
        </div>
      </section>

      {/* === 3. FEATURES SECTION (ZIG-ZAG LAYOUT) === */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-extrabold text-slate-900 mb-6">Fitur Pintar, Hasil Instan</h2>
            <p className="text-slate-600 text-lg md:text-xl max-w-3xl mx-auto leading-relaxed">Kami mendesain ulang cara mencatat keuangan agar secepat dan semudah kamu update status di medsos.</p>
          </div>
          
          {/* Loop Data Fitur */}
          <div className="flex flex-col">
            {featuresData.map((item, index) => (
                // isReversed bernilai true jika index ganjil (1, 3, ...) -> Gambar di kanan
                <ZigZagSection key={index} {...item} index={index} isReversed={index % 2 !== 0} />
            ))}
          </div>

           {/* Card Tambahan (Privasi) - Tetap pakai style lama sebagai penutup */}
           <div className="mt-12 max-w-md mx-auto">
                <motion.div initial={{opacity:0}} whileInView={{opacity:1}} transition={{delay:0.5}} className="bg-slate-50 p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-center items-center text-center">
                    <div className="bg-white p-4 rounded-full shadow-sm mb-4 border border-slate-100">
                        <ShieldCheck size={32} className="text-indigo-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Data 100% Privat & Aman</h3>
                    <p className="text-slate-600">Hanya kamu yang bisa akses. Dienkripsi tingkat tinggi.</p>
                </motion.div>
           </div>
        </div>
      </section>
      
      {/* === 4. PAIN POINTS SECTION (ZIG-ZAG LAYOUT) === */}
      <section className="py-32 px-6 bg-slate-900 relative overflow-hidden">
        {/* Background Gelap biar Gambar 3D Makin Pop-Up */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/40 via-slate-900 to-slate-900"></div>
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-24 text-white">
             <span className="text-indigo-400 font-bold tracking-wider uppercase mb-4 block">Masalah Umum Pengusaha</span>
             <h2 className="text-3xl md:text-5xl font-extrabold mb-6">Masih Pakai Cara Kuno? 😴</h2>
             <p className="text-slate-300 text-lg md:text-xl max-w-2xl mx-auto">Stop menyiksa diri dengan pencatatan manual yang rawan salah dan bikin stres.</p>
          </div>
          
          {/* Loop Data Pain Points */}
          <div className="flex flex-col text-white">
            {painPointsData.map((item, index) => (
                 // Mulai dengan gambar di KANAN (isReversed=true) untuk variasi dari section sebelumnya
                <ZigZagSection key={index} {...item} index={index} isReversed={index % 2 === 0} />
            ))}
          </div>
        </div>
      </section>

      {/* === 5. CTA SECTION === */}
      <section className="py-32 px-6 bg-white relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-50/50 rounded-full blur-3xl -z-10 pointer-events-none"></div>
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <h2 className="text-4xl md:text-6xl font-extrabold text-slate-900 mb-8 leading-tight tracking-tight">Level Up Bisnismu <span className="text-indigo-600">Sekarang Juga.</span></h2>
          <p className="text-slate-600 mb-12 text-lg md:text-2xl max-w-3xl mx-auto leading-relaxed">Bergabung dengan ribuan UMKM modern. Coba semua fitur premium gratis selama 14 hari. Gak cocok? Tinggalin aja.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button onClick={() => navigate('/register')} className="bg-indigo-600 text-white px-12 py-5 rounded-full font-bold text-xl hover:bg-indigo-700 transition shadow-2xl shadow-indigo-200/50 active:scale-95 flex items-center justify-center gap-3">
                Gas, Daftar Gratis! 🚀
            </button>
          </div>
          <p className="text-slate-500 font-medium text-base mt-8 flex items-center justify-center gap-6">
            <span className="flex items-center gap-2"><CheckCircle2 size={18} className="text-emerald-500"/> Tanpa kartu kredit</span>
            <span className="flex items-center gap-2"><CheckCircle2 size={18} className="text-emerald-500"/> Setup 1 menit</span>
          </p>
        </div>
      </section>

      {/* === 6. FOOTER === */}
      <footer className="py-12 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2 font-bold text-slate-800">
                <div className="bg-indigo-600 p-1.5 rounded-lg text-white"><BrainCircuit size={16} /></div>
                RapiKus
            </div>
            <p className="text-slate-500 text-sm">© 2026 Rapikus. Made with ❤️ in Indonesia.</p>
        </div>
      </footer>
    </div>
  );
}