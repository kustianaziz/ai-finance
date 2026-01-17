import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowRight, CheckCircle2, Menu, X, ShieldCheck, Sparkles, 
  Star, Zap, Building2, Users, User, ChevronDown,
  Receipt, Package, Target, HandCoins, ScrollText, PiggyBank,
  Landmark, Calculator, Calendar, TrendingUp,
  BookText, Scale, FileBarChart2, FileSpreadsheet,
  Instagram, Twitter, Youtube, Facebook, ArrowUp
} from 'lucide-react';

// --- DATA FITUR CORE ---
const coreFeatures = [
    { 
        image: "/landing/feat-scan.png", 
        title: "Scan Struk Sat-Set 📸", 
        desc: "Gak jaman ketik manual! Foto struk belanjaanmu, AI Rapikus otomatis membaca item, total, dan tanggal. Ajaib & Akurat." 
    },
    { 
        image: "/landing/feat-voice.png", 
        title: "Input Suara (Voice AI) 🎙️", 
        desc: "Lagi nyetir? Cukup bilang: 'Beli bensin 20 ribu'. Asisten AI kami langsung mencatatnya ke pos pengeluaran yang benar." 
    },
    { 
        image: "/landing/feat-wallet.png",
        title: "Pemisah Saldo Otomatis 🛡️", 
        desc: "Jangan campur uang dapur sama uang modal! Dompet bisnis dan pribadi terpisah secara tegas biar cashflow aman." 
    },
    { 
        image: "/landing/feat-chart.png",
        title: "Dashboard Visual Real-time", 
        desc: "Cek grafik cantik yang jujur. Produk mana yang paling laris? Di mana bocornya uangmu? Semua terjawab instan." 
    },
];

// --- DATA LAPORAN ---
const reportFeatures = [
    { icon: BookText, title: "Jurnal Umum Otomatis", desc: "Transaksi tercatat debit-kredit sesuai standar akuntansi (SAK EMKM)." },
    { icon: FileSpreadsheet, title: "Buku Besar Rapi", desc: "Mutasi akun (Kas, Pendapatan, Beban) terkelompok otomatis." },
    { icon: Scale, title: "Neraca Saldo Seimbang", desc: "Posisi aset, hutang, dan modal selalu balance secara real-time." },
    { icon: FileBarChart2, title: "Laba Rugi Detail", desc: "Pantau profit bersih (Net Income) untuk evaluasi performa bisnis." },
];

// --- DATA EKOSISTEM ---
const detailedFeatures = {
    business: [
        { icon: Receipt, title: "Invoice Profesional", desc: "Buat & kirim tagihan ke klien via WA/Email." },
        { icon: Package, title: "Stok Gudang", desc: "Pantau keluar masuk barang, cegah stok kosong." },
        { icon: Calculator, title: "Catat Hutang", desc: "Pengingat piutang otomatis biar gak lupa nagih." },
        { icon: Target, title: "Target Omzet", desc: "Set target bulanan dan pantau progress harian." },
    ],
    organization: [
        { icon: HandCoins, title: "Manajemen Iuran", desc: "Transparansi siapa yang sudah/belum bayar kas." },
        { icon: Users, title: "Database Anggota", desc: "Data lengkap anggota organisasi dalam satu akses." },
        { icon: ScrollText, title: "Proposal & RAB", desc: "Catat pengajuan anggaran kegiatan secara rinci." },
        { icon: Package, title: "Inventaris Aset", desc: "Kelola barang milik bersama agar tidak hilang." },
    ],
    personal: [
        { icon: PiggyBank, title: "Smart Budgeting", desc: "Pos-poskan gaji ke dompet digital biar nggak boncos." },
        { icon: Target, title: "Financial Goals", desc: "Tabungan nikah, rumah, atau gadget impian." },
        { icon: Landmark, title: "Kalender Tagihan", desc: "Reminder bayar listrik, air, dan cicilan tepat waktu." },
        { icon: Calendar, title: "Event Tracker", desc: "Budget khusus untuk liburan atau kondangan." },
    ]
};

// --- DATA PRICING ---
const pricingData = [
    {
        id: 'personal', name: 'Pribadi Pro', price: '19.000', icon: User, color: 'pink',
        desc: 'Disiplin finansial dimulai dari sini.',
        features: ['Unlimited Scan & Voice', 'Export PDF Laporan', 'Tanpa Iklan', 'Budgeting & Goals', 'Investasi Tracker']
    },
    {
        id: 'org', name: 'Komunitas', price: '29.000', icon: Users, color: 'teal',
        desc: 'Transparansi dana himpunan/masjid.',
        features: ['Semua Fitur Personal', 'Kelola Iuran Anggota', 'Laporan Kas Publik', 'Manajemen Proposal', 'Aset Inventaris']
    },
    {
        id: 'biz', name: 'Juragan Bisnis', price: '49.000', icon: Building2, color: 'blue', isPopular: true,
        desc: 'Full power untuk UMKM naik kelas.',
        features: ['Semua Fitur Personal', 'Cetak Invoice & Struk', 'Stok & Gudang', 'Gaji Karyawan', 'Laporan Laba Rugi']
    }
];

const testimonials = [
    { name: "Sarah, Owner Cafe", role: "Bisnis User", text: "Bon belanjaan numpuk? Dulu iya. Sekarang pake Rapikus tinggal jepret, kelar! Laporan akhir bulan jadi hobi baru.", rating: 5 },
    { name: "Budi, Ketua BEM", role: "Organisasi User", text: "Transparansi dana proker jadi gampang. Anggota bisa liat arus kas iuran langsung, gak ada lagi curiga-curigaan.", rating: 5 },
    { name: "Dinda, Gen Z", role: "Personal User", text: "Fitur Goals bikin semangat nabung. Voice input-nya juga nolong banget pas lagi mager ngetik pengeluaran receh.", rating: 5 }
];

// --- COMPONENT HELPERS ---

// 1. ACCOUNTING ANIMATION (PENGGANTI GAMBAR LAPORAN)
const AccountingAnim = () => {
    // Komponen baris laporan
    const ReportRow = ({ label, value, type = "neutral", delay = 0 }) => (
        <motion.div 
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ delay: delay, duration: 0.5 }}
            className={`flex justify-between items-center py-2 px-3 rounded-lg ${type === 'header' ? 'bg-indigo-50 font-bold mb-2' : 'border-b border-slate-50 last:border-0'}`}
        >
            <span className={`text-xs ${type === 'header' ? 'text-indigo-800' : 'text-slate-500'}`}>{label}</span>
            <span className={`text-xs font-mono font-bold ${type === 'income' ? 'text-green-600' : type === 'expense' ? 'text-red-500' : 'text-slate-700'}`}>
                {value}
            </span>
        </motion.div>
    );

    return (
        <div className="relative w-full max-w-sm mx-auto">
            {/* Background Blob */}
            <div className="absolute top-10 -left-10 w-40 h-40 bg-purple-200 rounded-full blur-3xl opacity-50 animate-pulse"></div>
            <div className="absolute -bottom-5 -right-5 w-40 h-40 bg-blue-200 rounded-full blur-3xl opacity-50 animate-pulse"></div>

            {/* Main Card (Laporan Laba Rugi) */}
            <motion.div 
                className="relative bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden"
                initial={{ y: 20, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8 }}
            >
                {/* Header Card */}
                <div className="bg-slate-900 p-4 flex justify-between items-center">
                    <div className="flex gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-400"/>
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-400"/>
                        <div className="w-2.5 h-2.5 rounded-full bg-green-400"/>
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Laporan Laba Rugi</div>
                </div>

                {/* Content */}
                <div className="p-5 space-y-1">
                    <ReportRow label="Pendapatan Jasa" value="+ 25.000.000" type="income" delay={0.2} />
                    <ReportRow label="Penjualan Produk" value="+ 15.500.000" type="income" delay={0.4} />
                    <div className="h-2"></div>
                    <ReportRow label="Beban Sewa" value="- 5.000.000" type="expense" delay={0.6} />
                    <ReportRow label="Beban Gaji" value="- 8.200.000" type="expense" delay={0.8} />
                    <ReportRow label="Beban Listrik & Air" value="- 1.500.000" type="expense" delay={1.0} />
                    
                    <motion.div 
                        initial={{ scaleX: 0 }} 
                        whileInView={{ scaleX: 1 }} 
                        transition={{ delay: 1.2, duration: 0.5 }}
                        className="h-0.5 bg-slate-200 my-3 origin-left"
                    />
                    
                    <motion.div 
                        initial={{ scale: 0.8, opacity: 0 }}
                        whileInView={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 1.4, type: "spring" }}
                        className="flex justify-between items-center bg-indigo-600 text-white p-3 rounded-xl shadow-lg shadow-indigo-200"
                    >
                        <span className="text-xs font-medium">Laba Bersih</span>
                        <span className="text-sm font-extrabold font-mono">Rp 25.800.000</span>
                    </motion.div>
                </div>

                {/* Floating "Balanced" Badge */}
                <motion.div 
                    className="absolute top-1/2 -right-6 bg-white py-2 px-4 rounded-full shadow-xl border border-green-100 flex items-center gap-2 z-20"
                    initial={{ x: 20, opacity: 0 }}
                    whileInView={{ x: 0, opacity: 1 }}
                    transition={{ delay: 1.8, type: "spring" }}
                >
                    <div className="bg-green-100 p-1 rounded-full text-green-600">
                        <CheckCircle2 size={16} />
                    </div>
                    <span className="text-xs font-bold text-green-700">Balance!</span>
                </motion.div>
            </motion.div>
        </div>
    );
};

// 2. BG BUSINESS ANIMATION (STONKS 📈)
const BgBusinessAnim = () => {
    const linePath = "M0 95 C 20 90, 30 100, 50 60 C 70 20, 85 40, 100 10";
    const areaPath = `${linePath} V 110 H 0 Z`;

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 opacity-15 text-blue-600">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
                <defs>
                    <linearGradient id="businessGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="currentColor" stopOpacity="0.5" />
                        <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                    </linearGradient>
                </defs>
                <motion.path
                    d={areaPath}
                    fill="url(#businessGradient)"
                    initial={{ y: 15, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                />
                <motion.path
                    d={linePath}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 2, ease: "easeInOut" }}
                />
                {[60, 10].map((yPos, i) => (
                    <motion.circle
                        key={i}
                        cx={i === 0 ? 50 : 100}
                        cy={yPos}
                        r="2.5"
                        fill="currentColor"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: [1, 1.8, 1], opacity: 1 }}
                        transition={{ delay: 1.8 + (i * 0.5), duration: 2, repeat: Infinity }}
                    />
                ))}
            </svg>
        </div>
    );
};

const BgOrgAnim = () => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
         <div className="absolute w-full h-full opacity-15">
             {[...Array(8)].map((_, i) => (
                 <motion.div key={i} 
                    className="absolute bg-teal-500 rounded-full w-3 h-3 md:w-5 md:h-5"
                    style={{ top: `${Math.random()*80 + 10}%`, left: `${Math.random()*80 + 10}%` }}
                    animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.8, 0.3] }}
                    transition={{ duration: 3 + i, repeat: Infinity }}
                 >
                     <motion.div className="absolute top-1/2 left-1/2 h-px bg-teal-500 origin-left -z-10" 
                        initial={{ width: 0 }} animate={{ width: [0, 100, 0], rotate: i * 45 }} transition={{ duration: 4, repeat: Infinity }} 
                     />
                 </motion.div>
             ))}
         </div>
    </div>
);

const BgPersonalAnim = () => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute w-full h-full opacity-10">
            {[Target, PiggyBank, TrendingUp, HandCoins].map((Icon, i) => (
                <motion.div key={i} className="absolute text-pink-500"
                    style={{ top: `${20 + i * 20}%`, left: `${10 + i * 20}%` }}
                    animate={{ y: [0, -40, 0], rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 5 + i, repeat: Infinity, ease: "easeInOut" }}
                >
                    <Icon size={60 + i * 20} />
                </motion.div>
            ))}
        </div>
    </div>
);

const FeatureTabBtn = ({ active, onClick, label, icon: Icon }) => (
    <button 
        onClick={onClick}
        className={`relative z-10 flex items-center gap-2 px-5 py-3 md:px-8 md:py-4 rounded-full font-bold text-sm md:text-base transition-all ${
            active 
            ? 'bg-slate-900 text-white shadow-xl scale-105 ring-4 ring-slate-100' 
            : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
        }`}
    >
        <Icon size={18} /> {label}
    </button>
);

const PricingCard = ({ item }) => {
    const isPop = item.isPopular;
    const colorMap = {
        pink: 'from-pink-500 to-rose-500 text-pink-600 bg-pink-50',
        teal: 'from-teal-500 to-emerald-500 text-teal-600 bg-teal-50',
        blue: 'from-blue-600 to-indigo-600 text-blue-600 bg-blue-50'
    };

    return (
        <motion.div 
            whileHover={{ y: -10 }}
            className={`relative p-8 rounded-[2rem] bg-white border ${isPop ? 'border-indigo-500 shadow-2xl shadow-indigo-200/50 ring-4 ring-indigo-500/10' : 'border-slate-100 shadow-xl'}`}
        >
            {isPop && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg">
                    Paling Laris 🔥
                </div>
            )}
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 ${colorMap[item.color].split(' ')[2]}`}>
                <item.icon size={28} className={colorMap[item.color].split(' ')[1]} />
            </div>
            <h3 className="text-xl font-bold text-slate-900">{item.name}</h3>
            <p className="text-slate-500 text-sm mt-2 mb-6 h-10">{item.desc}</p>
            
            <div className="flex items-end gap-1 mb-6">
                <span className="text-sm text-slate-400 mb-1">Rp</span>
                <span className="text-4xl font-extrabold text-slate-900">{item.price}</span>
                <span className="text-slate-400">/bln</span>
            </div>

            <ul className="space-y-3 mb-8">
                {item.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-slate-700">
                        <CheckCircle2 size={18} className="text-green-500 shrink-0"/> {f}
                    </li>
                ))}
            </ul>

            <button className={`w-full py-4 rounded-xl font-bold text-white transition shadow-lg active:scale-95 bg-gradient-to-r ${colorMap[item.color].split(' ')[0]}`}>
                Pilih Paket
            </button>
        </motion.div>
    );
};

const ZigZagSection = ({ image, title, desc, isReversed, index }) => (
  <motion.div 
    initial={{ opacity: 0, y: 50 }}
    whileInView={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6, delay: 0.1 }}
    viewport={{ once: true, margin: "-100px" }}
    className={`flex flex-col ${isReversed ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-10 md:gap-20 py-12 md:py-16`}
  >
    <div className="w-full md:w-1/2 flex justify-center">
        <div className="relative w-full max-w-md aspect-[4/3] flex items-center justify-center">
             <div className={`absolute inset-0 bg-gradient-to-tr ${index % 2 === 0 ? 'from-indigo-100 to-white' : 'from-pink-100 to-white'} rounded-[3rem] -rotate-3 transform scale-95 -z-10`}></div>
             <img src={image} alt={title} className="w-full h-full object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-500" />
        </div>
    </div>
    <div className="w-full md:w-1/2 text-center md:text-left">
       <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold uppercase tracking-wide">
          <Sparkles size={12} className="text-yellow-500" /> Core Technology
       </div>
       <h3 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4 leading-tight">{title}</h3>
       <p className="text-lg text-slate-600 leading-relaxed">{desc}</p>
    </div>
  </motion.div>
);

// --- MAIN PAGE ---
export default function LandingPage() {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const heroWords = ["Bisnis 🚀", "Organisasi", "Pribadi 🏠"];
  const heroGradients = ["from-blue-50 via-indigo-50 to-white", "from-teal-50 via-emerald-50 to-white", "from-pink-50 via-purple-50 to-white"];
  const heroTextColors = ["text-blue-600", "text-teal-600", "text-pink-600"];
  const [activeFeatureTab, setActiveFeatureTab] = useState('business');

  useEffect(() => {
    const handleScroll = () => {
        setIsScrolled(window.scrollY > 20);
        setShowBackToTop(window.scrollY > 500);
    };
    window.addEventListener('scroll', handleScroll);
    
    const interval = setInterval(() => {
        setHeroIndex((prev) => (prev + 1) % heroWords.length);
    }, 3000);
    
    return () => {
        window.removeEventListener('scroll', handleScroll);
        clearInterval(interval);
    };
  }, []);

  const scrollToSection = (id) => {
      setMobileMenuOpen(false); 
      setTimeout(() => {
          const el = document.getElementById(id);
          if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
      }, 150); 
  };

  const scrollToTop = () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-white font-sans overflow-x-hidden selection:bg-indigo-100 selection:text-indigo-700 scroll-smooth">
      
      {/* NAVBAR */}
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

          {/* DESKTOP MENU */}
          <div className="hidden lg:flex items-center gap-6 font-semibold text-slate-600 text-sm">
            <button onClick={() => scrollToSection('fitur')} className="hover:text-indigo-600 transition">Fitur</button>
            <button onClick={() => scrollToSection('laporan')} className="hover:text-indigo-600 transition">Laporan</button>
            <button onClick={() => scrollToSection('solusi')} className="hover:text-indigo-600 transition">Solusi</button>
            <button onClick={() => scrollToSection('harga')} className="hover:text-indigo-600 transition">Harga</button>
            <button onClick={() => scrollToSection('testimoni')} className="hover:text-indigo-600 transition">Testimoni</button>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <button onClick={() => navigate('/login')} className="text-slate-900 font-bold hover:text-indigo-600 transition">Masuk</button>
            <button onClick={() => navigate('/register')} className="bg-slate-900 text-white px-6 py-2.5 rounded-full font-bold hover:bg-slate-800 transition shadow-lg active:scale-95">Daftar Gratis</button>
          </div>

          <button className="lg:hidden text-slate-700" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X size={28}/> : <Menu size={28}/>}
          </button>
        </div>

        {/* MOBILE MENU */}
        <AnimatePresence>
            {mobileMenuOpen && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="absolute top-full left-0 right-0 bg-white border-b border-slate-100 overflow-hidden shadow-xl lg:hidden">
                    <div className="p-6 flex flex-col gap-6 font-bold text-slate-700">
                        <button onClick={() => scrollToSection('fitur')} className="text-left text-lg hover:text-indigo-600">Fitur</button>
                        <button onClick={() => scrollToSection('laporan')} className="text-left text-lg hover:text-indigo-600">Laporan</button>
                        <button onClick={() => scrollToSection('solusi')} className="text-left text-lg hover:text-indigo-600">Solusi</button>
                        <button onClick={() => scrollToSection('harga')} className="text-left text-lg hover:text-indigo-600">Harga</button>
                        <button onClick={() => scrollToSection('testimoni')} className="text-left text-lg hover:text-indigo-600">Testimoni</button>
                        
                        <hr className="border-slate-100"/>
                        <div className="flex flex-col gap-3">
                            <button onClick={() => navigate('/login')} className="w-full py-3 text-slate-900 border rounded-xl font-bold">Masuk</button>
                            <button onClick={() => navigate('/register')} className="w-full py-3 bg-indigo-600 text-white rounded-xl shadow-lg font-bold">Daftar Gratis</button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
      </nav>

      {/* HERO SECTION */}
      <section className="pt-40 pb-20 px-6 relative overflow-hidden transition-colors duration-1000">
        <motion.div 
            key={heroIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
            className={`absolute inset-0 bg-gradient-to-b ${heroGradients[heroIndex]} -z-20`}
        />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 -z-10 mix-blend-multiply"></div>

        <div className="max-w-7xl mx-auto text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <div className="inline-flex items-center gap-2 py-2 px-5 rounded-full bg-white/80 border border-white/50 backdrop-blur-sm text-slate-600 text-xs md:text-sm font-bold uppercase tracking-wider mb-8 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Aplikasi Keuangan Gen Z #1
            </div>
            
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold text-slate-900 leading-[1.1] mb-6 tracking-tight">
              Satu Aplikasi, <br/> Kelola 
              <span className="relative inline-flex ml-4 min-w-[320px] md:min-w-[480px] h-[1.1em] overflow-hidden align-top">
                 <AnimatePresence mode='wait'>
                    <motion.span 
                        key={heroIndex}
                        initial={{ y: 50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -50, opacity: 0 }}
                        transition={{ duration: 0.4, ease: "backOut" }}
                        className={`absolute left-0 top-0 w-full ${heroTextColors[heroIndex]} pb-2`}
                    >
                        {heroWords[heroIndex]}
                    </motion.span>
                 </AnimatePresence>
              </span>
            </h1>
            
            <p className="text-lg md:text-2xl text-slate-600 mb-10 max-w-3xl mx-auto leading-relaxed">
              Jujur deh, catat keuangan manual itu <i>so yesterday</i>. <br className="hidden md:block"/>
              Pakai <b>Rapikus</b>, tinggal scan & ngomong, semua beres.
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <button onClick={() => navigate('/register')} className="bg-slate-900 text-white px-10 py-5 rounded-full font-bold text-lg hover:bg-slate-800 transition shadow-2xl shadow-slate-900/30 active:scale-95 flex items-center justify-center gap-3">
                Coba Gratis Sekarang <ArrowRight size={20}/>
              </button>
              <button onClick={() => scrollToSection('fitur')} className="bg-white/80 backdrop-blur text-slate-700 px-10 py-5 rounded-full font-bold text-lg border border-white hover:border-indigo-300 hover:bg-white transition active:scale-95 flex items-center justify-center gap-2 group">
                Lihat Keajaiban <ChevronDown size={20} className="group-hover:translate-y-1 transition-transform"/>
              </button>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.8 }} className="mt-20 max-w-6xl mx-auto relative">
              <div className="relative z-10 hover:scale-[1.01] transition-transform duration-700 group">
                  <img src="src/assets/landing/hero-mockup.png" alt="Tampilan Dashboard dan Laporan Rapikus" className="relative w-full h-auto drop-shadow-2xl rounded-[2rem] border-4 border-white/50" />
              </div>
          </motion.div>
        </div>
      </section>

      {/* CORE FEATURES SECTION (ID: FITUR) */}
      <section id="fitur" className="py-24 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <span className="text-indigo-600 font-bold tracking-wider uppercase mb-2 block">Teknologi Inti</span>
            <h2 className="text-3xl md:text-5xl font-extrabold text-slate-900 mb-4">Kerja Cerdas, Bukan Keras</h2>
            <p className="text-slate-600 text-xl max-w-2xl mx-auto">Teknologi AI Rapikus yang bekerja, kamu tinggal menikmati hasilnya.</p>
          </div>
          
          <div className="flex flex-col gap-4">
            {coreFeatures.map((item, index) => (
                <ZigZagSection key={index} {...item} index={index} isReversed={index % 2 !== 0} />
            ))}
          </div>
        </div>
      </section>

      {/* SECTION: LAPORAN AKUNTABEL (LIGHT MODE ANIMATED) */}
      <section id="laporan" className="py-24 px-6 bg-slate-50 relative overflow-hidden border-y border-slate-100">
         <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.05] mix-blend-multiply"></div>
         <div className="max-w-7xl mx-auto relative z-10">
            <div className="flex flex-col md:flex-row items-center gap-16">
                <div className="w-full md:w-1/2 text-center md:text-left">
                    <span className="inline-block py-1 px-3 rounded-lg bg-indigo-100 text-indigo-600 font-bold text-xs tracking-wider uppercase mb-6">
                        Standar Akuntansi Profesional
                    </span>
                    <h2 className="text-3xl md:text-5xl font-extrabold mb-6 leading-tight text-slate-900">Laporan Keuangan Standar akuntansi</h2>
                    <p className="text-slate-600 text-lg leading-relaxed mb-10">
                        Bukan sekadar catatan keluar-masuk. <b>Rapikus</b> menghasilkan laporan keuangan standar akuntansi (SAK EMKM) secara otomatis. Rapi, akurat, dan bisa dipertanggungjawabkan.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {reportFeatures.map((item, index) => (
                            <div key={index} className="flex flex-col gap-3 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition hover:-translate-y-1 hover:border-indigo-200 group">
                                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                                    <item.icon size={20} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-base mb-1 text-slate-900">{item.title}</h4>
                                    <p className="text-slate-500 text-xs leading-relaxed">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="w-full md:w-1/2 flex justify-center relative">
                    <AccountingAnim />
                </div>
            </div>
         </div>
      </section>

      {/* SECTION: EKOSISTEM FITUR LENGKAP (ID: SOLUSI) */}
      <section id="solusi" className="py-24 px-6 bg-slate-50 relative overflow-hidden transition-colors duration-500 border-b border-slate-100">
          <div className="absolute inset-0 z-0">
            <AnimatePresence mode='wait'>
                {activeFeatureTab === 'business' && <BgBusinessAnim key="biz-bg" />}
                {activeFeatureTab === 'organization' && <BgOrgAnim key="org-bg" />}
                {activeFeatureTab === 'personal' && <BgPersonalAnim key="pers-bg" />}
            </AnimatePresence>
          </div>
          
          <div className="max-w-7xl mx-auto text-center relative z-10">
              <span className="text-emerald-600 font-bold tracking-wider uppercase mb-2 block">Satu Aplikasi, Segudang Fitur</span>
              <h2 className="text-3xl md:text-5xl font-extrabold text-slate-900 mb-10">Solusi Lengkap Untuk...</h2>

              <div className="flex justify-center gap-4 mb-16 flex-wrap">
                  <FeatureTabBtn active={activeFeatureTab === 'business'} onClick={() => setActiveFeatureTab('business')} label="Bisnis" icon={Building2} />
                  <FeatureTabBtn active={activeFeatureTab === 'organization'} onClick={() => setActiveFeatureTab('organization')} label="Organisasi" icon={Users} />
                  <FeatureTabBtn active={activeFeatureTab === 'personal'} onClick={() => setActiveFeatureTab('personal')} label="Pribadi" icon={User} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <AnimatePresence mode='wait'>
                      {detailedFeatures[activeFeatureTab].map((feat, idx) => (
                          <motion.div 
                            key={`${activeFeatureTab}-${idx}`}
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -20, scale: 0.95 }}
                            transition={{ duration: 0.3, delay: idx * 0.1 }}
                            className="bg-white/90 backdrop-blur-sm p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-indigo-200 transition text-left hover:-translate-y-1 group"
                          >
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-colors ${activeFeatureTab === 'business' ? 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white' : activeFeatureTab === 'organization' ? 'bg-teal-50 text-teal-600 group-hover:bg-teal-600 group-hover:text-white' : 'bg-pink-50 text-pink-600 group-hover:bg-pink-600 group-hover:text-white'}`}>
                                  <feat.icon size={24}/>
                              </div>
                              <h4 className="text-lg font-bold text-slate-900 mb-2">{feat.title}</h4>
                              <p className="text-slate-500 text-sm leading-relaxed">{feat.desc}</p>
                          </motion.div>
                      ))}
                  </AnimatePresence>
              </div>
          </div>
      </section>

      {/* PRICING SECTION (ID: HARGA) */}
      <section id="harga" className="py-24 px-6 bg-white relative">
         <div className="max-w-7xl mx-auto relative z-10">
            <div className="text-center mb-16">
                <span className="text-indigo-600 font-bold tracking-wider uppercase mb-2 block">Investasi Terbaik</span>
                <h2 className="text-3xl md:text-5xl font-extrabold text-slate-900 mb-6">Harga Kaki Lima, Fitur Bintang Lima</h2>
                <p className="text-slate-600 text-xl max-w-2xl mx-auto">Pilih paket yang sesuai dengan fase hidup & bisnismu saat ini.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                {pricingData.map((item) => (
                    <PricingCard key={item.id} item={item} />
                ))}
            </div>
         </div>
      </section>

      {/* TESTIMONIALS SECTION (ID: TESTIMONI) */}
      <section id="testimoni" className="py-24 px-6 bg-slate-50 overflow-hidden border-t border-slate-100">
         <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
                <h2 className="text-3xl md:text-5xl font-extrabold text-slate-900 mb-6">Apa Kata Mereka? 🗣️</h2>
                <p className="text-slate-600 text-xl">Jangan percaya kami, percaya pada ribuan user yang sudah move on dari Excel.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {testimonials.map((t, i) => (
                    <motion.div 
                        key={i} 
                        whileHover={{ y: -5 }}
                        className="bg-white p-8 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50"
                    >
                        <div className="flex gap-1 text-yellow-400 mb-4">
                            {[...Array(t.rating)].map((_, r) => <Star key={r} size={18} fill="currentColor"/>)}
                        </div>
                        <p className="text-slate-700 text-lg leading-relaxed mb-6 italic">"{t.text}"</p>
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xl">
                                {t.name.charAt(0)}
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-900">{t.name}</h4>
                                <span className="text-xs text-indigo-500 font-bold uppercase tracking-wide">{t.role}</span>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
         </div>
      </section>

      {/* CTA BOTTOM */}
      <section className="py-32 px-6 bg-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/40 via-slate-900 to-slate-900"></div>
        <div className="max-w-4xl mx-auto text-center relative z-10 text-white">
          <h2 className="text-4xl md:text-6xl font-extrabold mb-8 leading-tight">
            Udah, Gak Usah Mikir Lama. <br/> <span className="text-indigo-400">Cobain Aja Dulu.</span>
          </h2>
          <p className="text-slate-300 mb-10 text-lg md:text-2xl max-w-2xl mx-auto">
            14 Hari Gratis fitur Premium. Gak cocok? Tinggal uninstall, no hard feelings.
          </p>
          <div className="flex justify-center">
            <button onClick={() => navigate('/register')} className="bg-white text-slate-900 px-12 py-5 rounded-full font-bold text-xl hover:bg-indigo-50 transition shadow-2xl active:scale-95 flex items-center gap-3">
               <Zap size={24} className="text-yellow-500 fill-yellow-500"/> Daftar Sekarang
            </button>
          </div>
          <p className="text-slate-500 text-sm mt-8">Tanpa Kartu Kredit • Setup 1 Menit</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
                <div className="flex items-center gap-2 font-bold text-slate-800">
                    <div className="bg-indigo-600 p-1.5 rounded-lg text-white"><Sparkles size={16} /></div>
                    Rapikus
                </div>
                <p className="text-slate-400 text-sm">© 2026 Rapikus Indonesia.</p>
            </div>

            <div className="flex gap-6 text-sm text-slate-500 font-medium">
                <a href="#" className="hover:text-indigo-600 transition">Tentang Kami</a>
                <a href="#" className="hover:text-indigo-600 transition">Syarat & Ketentuan</a>
                <a href="#" className="hover:text-indigo-600 transition">Kebijakan Privasi</a>
            </div>

            <div className="flex items-center gap-4">
                <a href="#" className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition"><Instagram size={20}/></a>
                <a href="#" className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition"><Twitter size={20}/></a>
                <a href="#" className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition"><Youtube size={20}/></a>
                <a href="#" className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition"><Facebook size={20}/></a>
            </div>
        </div>
      </footer>

      {/* BACK TO TOP BUTTON */}
      <AnimatePresence>
        {showBackToTop && (
            <motion.button
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                onClick={scrollToTop}
                className="fixed bottom-8 right-8 z-40 bg-indigo-600 text-white p-3 rounded-full shadow-lg hover:bg-indigo-700 transition"
            >
                <ArrowUp size={24} />
            </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}