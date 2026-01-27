import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowRight, CheckCircle2, Menu, X, Sparkles, 
  Star, Zap, Building2, Users, User, ChevronDown,
  Receipt, Package, Target, HandCoins, ScrollText, PiggyBank,
  Landmark, Calculator, Calendar, TrendingUp,
  BookText, Scale, FileBarChart2, FileSpreadsheet,
  Instagram, Twitter, Youtube, Facebook, ArrowUp, Wallet, ShieldCheck
} from 'lucide-react';

// --- ASSETS (Pastikan file ini ada di folder assets) ---
import logoVizofin from '../assets/vizofinhorizontal.png'; 
// Favicon biasanya diatur di index.html, tapi kita bisa pakai logikanya nanti

// --- DATA FITUR CORE ---
const coreFeatures = [
    { 
        image: "/landing/feat-scan.png", 
        title: "Smart Scan OCR 📸", 
        desc: "Teknologi AI Vizofin membaca struk belanja otomatis. Data item, harga, dan tanggal langsung terekam akurat tanpa ketik manual." 
    },
    { 
        image: "/landing/feat-voice.png", 
        title: "Voice Command Finance 🎙️", 
        desc: "Cukup katakan pengeluaranmu, asisten pintar Vizofin akan mencatatnya ke pos anggaran yang tepat. Praktis saat di perjalanan." 
    },
    { 
        image: "/landing/feat-wallet.png",
        title: "Smart Wallet Separation 🛡️", 
        desc: "Pemisahan tegas antara dana pribadi, bisnis, dan organisasi. Jaga cashflow tetap sehat dan transparan." 
    },
    { 
        image: "/landing/feat-chart.png",
        title: "Real-time Analytics Dashboard", 
        desc: "Visualisasi data keuangan yang jujur dan mendalam. Pahami pola pengeluaran dan sumber kebocoran dana secara instan." 
    },
];

// --- DATA LAPORAN ---
const reportFeatures = [
    { icon: BookText, title: "Jurnal Umum Otomatis", desc: "Pencatatan debit-kredit standar SAK EMKM." },
    { icon: FileSpreadsheet, title: "Buku Besar Terintegrasi", desc: "Pengelompokan akun otomatis dan rapi." },
    { icon: Scale, title: "Neraca Saldo Real-time", desc: "Keseimbangan aset, liabilitas, dan ekuitas." },
    { icon: FileBarChart2, title: "Analisa Laba Rugi", desc: "Evaluasi profitabilitas bisnis secara detail." },
];

// --- DATA EKOSISTEM ---
const detailedFeatures = {
    business: [
        { icon: Receipt, title: "E-Invoicing", desc: "Kirim tagihan profesional via WhatsApp/Email." },
        { icon: Package, title: "Manajemen Stok", desc: "Monitoring keluar-masuk barang inventory." },
        { icon: Calculator, title: "Pencatatan Hutang", desc: "Reminder otomatis jatuh tempo piutang." },
        { icon: Target, title: "Revenue Goals", desc: "Tracking target omzet harian dan bulanan." },
    ],
    organization: [
        { icon: HandCoins, title: "Transparansi Iuran", desc: "Monitor status pembayaran kas anggota." },
        { icon: Users, title: "Database Keanggotaan", desc: "Pusat data anggota organisasi terpadu." },
        { icon: ScrollText, title: "Budgeting Acara", desc: "Kelola RAB kegiatan dan proposal dana." },
        { icon: Package, title: "Aset Inventaris", desc: "Pencatatan barang milik organisasi." },
    ],
    personal: [
        { icon: PiggyBank, title: "Smart Budgeting", desc: "Alokasi pos gaji anti boncos." },
        { icon: Target, title: "Financial Freedom", desc: "Tabungan impian dan dana darurat." },
        { icon: Landmark, title: "Bill Reminder", desc: "Pengingat bayar tagihan tepat waktu." },
        { icon: Calendar, title: "Expense Tracker", desc: "Catat pengeluaran harian dengan mudah." },
    ]
};

// --- DATA PRICING ---
const pricingData = [
    {
        id: 'personal', name: 'Personal Pro', price: '19.000', icon: User, color: 'blue',
        desc: 'Mulai perjalanan kebebasan finansialmu.',
        features: ['Unlimited Scan & Voice', 'Export PDF Laporan', 'Bebas Iklan', 'Budgeting & Goals', 'Investment Tracker']
    },
    {
        id: 'org', name: 'Komunitas', price: '29.000', icon: Users, color: 'orange',
        desc: 'Solusi transparan untuk dana umat/warga.',
        features: ['Semua Fitur Personal', 'Kelola Iuran Anggota', 'Laporan Kas Publik', 'Manajemen Proposal', 'Aset Inventaris']
    },
    {
        id: 'biz', name: 'Business Elite', price: '49.000', icon: Building2, color: 'darkblue', isPopular: true,
        desc: 'Sistem keuangan lengkap untuk UMKM modern.',
        features: ['Semua Fitur Personal', 'Cetak Invoice & Struk', 'Stok & Gudang', 'Penggajian', 'Laporan Laba Rugi']
    }
];

const testimonials = [
    { name: "Sarah", role: "Coffee Shop Owner", text: "Vizofin mengubah cara saya memandang laporan keuangan. Dulu momok, sekarang jadi insight berharga untuk strategi bisnis.", rating: 5 },
    { name: "Budi Santoso", role: "Ketua BEM Univ", text: "Transparansi dana organisasi meningkat drastis. Anggota lebih percaya karena laporan kas bisa diakses real-time.", rating: 5 },
    { name: "Dinda A.", role: "Freelancer", text: "Fitur Goals-nya juara! Akhirnya bisa disiplin nabung buat upgrade gadget tanpa merasa tersiksa.", rating: 5 }
];

// --- COMPONENT HELPERS ---

const AccountingAnim = () => {
    const ReportRow = ({ label, value, type = "neutral", delay = 0 }) => (
        <motion.div 
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ delay: delay, duration: 0.5 }}
            className={`flex justify-between items-center py-2 px-3 rounded-lg ${type === 'header' ? 'bg-slate-100 font-bold mb-2' : 'border-b border-slate-50 last:border-0'}`}
        >
            <span className={`text-xs ${type === 'header' ? 'text-slate-800' : 'text-slate-500'}`}>{label}</span>
            <span className={`text-xs font-mono font-bold ${type === 'income' ? 'text-emerald-600' : type === 'expense' ? 'text-red-500' : 'text-slate-700'}`}>
                {value}
            </span>
        </motion.div>
    );

    return (
        <div className="relative w-full max-w-sm mx-auto">
            {/* Dekorasi Blob ala Eduvizta (Biru & Orange) */}
            <div className="absolute top-10 -left-10 w-40 h-40 bg-blue-200 rounded-full blur-3xl opacity-40 animate-pulse"></div>
            <div className="absolute -bottom-5 -right-5 w-40 h-40 bg-orange-200 rounded-full blur-3xl opacity-40 animate-pulse"></div>

            <motion.div 
                className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
                initial={{ y: 20, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8 }}
            >
                <div className="bg-slate-900 p-4 flex justify-between items-center">
                    <div className="flex gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500"/>
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"/>
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500"/>
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Profit & Loss Statement</div>
                </div>

                <div className="p-5 space-y-1">
                    <ReportRow label="Revenue" value="+ 25.000.000" type="income" delay={0.2} />
                    <ReportRow label="Sales" value="+ 15.500.000" type="income" delay={0.4} />
                    <div className="h-2"></div>
                    <ReportRow label="Rent Expense" value="- 5.000.000" type="expense" delay={0.6} />
                    <ReportRow label="Salary Expense" value="- 8.200.000" type="expense" delay={0.8} />
                    <ReportRow label="Utilities" value="- 1.500.000" type="expense" delay={1.0} />
                    
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
                        className="flex justify-between items-center bg-blue-900 text-white p-3 rounded-xl shadow-lg shadow-blue-200"
                    >
                        <span className="text-xs font-medium">Net Income</span>
                        <span className="text-sm font-extrabold font-mono text-orange-400">Rp 25.800.000</span>
                    </motion.div>
                </div>

                <motion.div 
                    className="absolute top-1/2 -right-4 bg-white py-2 px-4 rounded-full shadow-xl border border-emerald-100 flex items-center gap-2 z-20"
                    initial={{ x: 20, opacity: 0 }}
                    whileInView={{ x: 0, opacity: 1 }}
                    transition={{ delay: 1.8, type: "spring" }}
                >
                    <div className="bg-emerald-100 p-1 rounded-full text-emerald-600">
                        <CheckCircle2 size={16} />
                    </div>
                    <span className="text-xs font-bold text-emerald-700">Balanced!</span>
                </motion.div>
            </motion.div>
        </div>
    );
};

// --- BACKGROUND ANIMATIONS (Disesuaikan Warna Vizofin) ---
const BgBusinessAnim = () => {
    // Grafik Biru Tua
    const linePath = "M0 95 C 20 90, 30 100, 50 60 C 70 20, 85 40, 100 10";
    const areaPath = `${linePath} V 110 H 0 Z`;

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 opacity-10 text-blue-800">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
                <defs>
                    <linearGradient id="businessGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="currentColor" stopOpacity="0.5" />
                        <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                    </linearGradient>
                </defs>
                <motion.path d={areaPath} fill="url(#businessGradient)" initial={{ y: 15, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 1.5, ease: "easeOut" }} />
                <motion.path d={linePath} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2, ease: "easeInOut" }} />
                {[60, 10].map((yPos, i) => (
                    <motion.circle key={i} cx={i === 0 ? 50 : 100} cy={yPos} r="2.5" fill="#f97316" initial={{ scale: 0, opacity: 0 }} animate={{ scale: [1, 1.8, 1], opacity: 1 }} transition={{ delay: 1.8 + (i * 0.5), duration: 2, repeat: Infinity }} />
                ))}
            </svg>
        </div>
    );
};

const BgOrgAnim = () => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
         <div className="absolute w-full h-full opacity-10">
             {[...Array(8)].map((_, i) => (
                 <motion.div key={i} className="absolute bg-orange-500 rounded-full w-3 h-3 md:w-5 md:h-5" style={{ top: `${Math.random()*80 + 10}%`, left: `${Math.random()*80 + 10}%` }} animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.8, 0.3] }} transition={{ duration: 3 + i, repeat: Infinity }}>
                     <motion.div className="absolute top-1/2 left-1/2 h-px bg-orange-500 origin-left -z-10" initial={{ width: 0 }} animate={{ width: [0, 100, 0], rotate: i * 45 }} transition={{ duration: 4, repeat: Infinity }} />
                 </motion.div>
             ))}
         </div>
    </div>
);

const BgPersonalAnim = () => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute w-full h-full opacity-10">
            {[Target, Wallet, TrendingUp, ShieldCheck].map((Icon, i) => (
                <motion.div key={i} className="absolute text-blue-600" style={{ top: `${20 + i * 20}%`, left: `${10 + i * 20}%` }} animate={{ y: [0, -40, 0], rotate: [0, 10, -10, 0] }} transition={{ duration: 5 + i, repeat: Infinity, ease: "easeInOut" }}>
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
            ? 'bg-blue-900 text-white shadow-xl scale-105 ring-4 ring-blue-100' 
            : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
        }`}
    >
        <Icon size={18} className={active ? "text-orange-400" : ""} /> {label}
    </button>
);

const PricingCard = ({ item }) => {
    const isPop = item.isPopular;
    // Update color map to Vizofin Brand Colors
    const colorMap = {
        blue: 'from-blue-500 to-blue-600 text-blue-600 bg-blue-50',
        orange: 'from-orange-500 to-amber-500 text-orange-600 bg-orange-50',
        darkblue: 'from-slate-800 to-slate-900 text-slate-800 bg-slate-100'
    };
    
    // Gradient button sesuai paket
    const btnGradient = {
        blue: 'bg-blue-600 hover:bg-blue-700',
        orange: 'bg-orange-500 hover:bg-orange-600',
        darkblue: 'bg-slate-900 hover:bg-slate-800'
    };

    return (
        <motion.div 
            whileHover={{ y: -10 }}
            className={`relative p-8 rounded-[2rem] bg-white border ${isPop ? 'border-blue-600 shadow-2xl shadow-blue-200/50 ring-4 ring-blue-600/10' : 'border-slate-100 shadow-xl'}`}
        >
            {isPop && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg">
                    Most Popular 🔥
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
                <span className="text-slate-400">/mo</span>
            </div>

            <ul className="space-y-3 mb-8">
                {item.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-slate-700">
                        <CheckCircle2 size={18} className="text-emerald-500 shrink-0"/> {f}
                    </li>
                ))}
            </ul>

            <button className={`w-full py-4 rounded-xl font-bold text-white transition shadow-lg active:scale-95 ${btnGradient[item.color]}`}>
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
             {/* Background Shape ganti warna jadi Biru/Orange */}
             <div className={`absolute inset-0 bg-gradient-to-tr ${index % 2 === 0 ? 'from-blue-100 to-white' : 'from-orange-100 to-white'} rounded-[3rem] -rotate-3 transform scale-95 -z-10`}></div>
             <img src={image} alt={title} className="w-full h-full object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-500" />
        </div>
    </div>
    <div className="w-full md:w-1/2 text-center md:text-left">
       <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold uppercase tracking-wide">
          <Sparkles size={12} className="text-orange-500" /> Core Technology
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
  
  // Update Hero Words & Colors sesuai Brand Vizofin
  const heroWords = ["Bisnis 🚀", "Organisasi", "Pribadi 🏠"];
  const heroGradients = ["from-blue-50 via-slate-50 to-white", "from-orange-50 via-amber-50 to-white", "from-indigo-50 via-blue-50 to-white"];
  const heroTextColors = ["text-blue-700", "text-orange-600", "text-indigo-700"];
  
  const [activeFeatureTab, setActiveFeatureTab] = useState('business');

  // Set Title & Favicon
  useEffect(() => {
    document.title = "Vizofin - Smart Financial Companion";
    // Untuk favicon, idealnya diatur di index.html, tapi ini untuk memastikan
    const link = document.querySelector("link[rel~='icon']");
    if (link) {
        link.href = '../assets/fapicon.png';
    }
  }, []);

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
    <div className="min-h-screen bg-white font-sans overflow-x-hidden selection:bg-blue-100 selection:text-blue-900 scroll-smooth">
      
      {/* NAVBAR */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-white/95 backdrop-blur-md shadow-sm py-3' : 'bg-transparent py-5'}`}>
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          {/* LOGO VIZOFIN */}
          <div className="flex items-center cursor-pointer" onClick={() => window.scrollTo(0,0)}>
             <img src={logoVizofin} alt="Vizofin" className="h-10 md:h-12 w-auto object-contain" />
          </div>

          {/* DESKTOP MENU */}
          <div className="hidden lg:flex items-center gap-8 font-semibold text-slate-600 text-sm">
            <button onClick={() => scrollToSection('fitur')} className="hover:text-blue-700 transition">Fitur</button>
            <button onClick={() => scrollToSection('laporan')} className="hover:text-blue-700 transition">Laporan</button>
            <button onClick={() => scrollToSection('solusi')} className="hover:text-blue-700 transition">Solusi</button>
            <button onClick={() => scrollToSection('harga')} className="hover:text-blue-700 transition">Harga</button>
            <button onClick={() => scrollToSection('testimoni')} className="hover:text-blue-700 transition">Testimoni</button>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <button onClick={() => navigate('/login')} className="text-slate-800 font-bold hover:text-blue-700 transition">Masuk</button>
            <button onClick={() => navigate('/register')} className="bg-blue-900 text-white px-6 py-2.5 rounded-full font-bold hover:bg-blue-800 transition shadow-lg shadow-blue-900/20 active:scale-95">Daftar Sekarang</button>
          </div>

          <button className="lg:hidden text-slate-800" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X size={28}/> : <Menu size={28}/>}
          </button>
        </div>

        {/* MOBILE MENU */}
        <AnimatePresence>
            {mobileMenuOpen && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="absolute top-full left-0 right-0 bg-white border-b border-slate-100 overflow-hidden shadow-xl lg:hidden">
                    <div className="p-6 flex flex-col gap-6 font-bold text-slate-700">
                        <button onClick={() => scrollToSection('fitur')} className="text-left text-lg hover:text-blue-600">Fitur</button>
                        <button onClick={() => scrollToSection('laporan')} className="text-left text-lg hover:text-blue-600">Laporan</button>
                        <button onClick={() => scrollToSection('solusi')} className="text-left text-lg hover:text-blue-600">Solusi</button>
                        <button onClick={() => scrollToSection('harga')} className="text-left text-lg hover:text-blue-600">Harga</button>
                        <button onClick={() => scrollToSection('testimoni')} className="text-left text-lg hover:text-blue-600">Testimoni</button>
                        
                        <hr className="border-slate-100"/>
                        <div className="flex flex-col gap-3">
                            <button onClick={() => navigate('/login')} className="w-full py-3 text-slate-900 border border-slate-200 rounded-xl font-bold">Masuk</button>
                            <button onClick={() => navigate('/register')} className="w-full py-3 bg-blue-900 text-white rounded-xl shadow-lg font-bold">Daftar Sekarang</button>
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
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
              #1 Financial Platform for Gen Z
            </div>
            
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold text-slate-900 leading-[1.1] mb-6 tracking-tight">
              One App to Manage <br/> Your 
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
              Catat keuangan manual itu kuno. <br className="hidden md:block"/>
              Dengan <b>Vizofin</b>, kelola arus kas jadi otomatis, cerdas, dan transparan.
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <button onClick={() => navigate('/register')} className="bg-blue-900 text-white px-10 py-5 rounded-full font-bold text-lg hover:bg-blue-800 transition shadow-2xl shadow-blue-900/30 active:scale-95 flex items-center justify-center gap-3">
                Mulai Gratis Sekarang <ArrowRight size={20}/>
              </button>
              <button onClick={() => scrollToSection('fitur')} className="bg-white/80 backdrop-blur text-slate-700 px-10 py-5 rounded-full font-bold text-lg border border-white hover:border-blue-200 hover:bg-white transition active:scale-95 flex items-center justify-center gap-2 group">
                Pelajari Fitur <ChevronDown size={20} className="group-hover:translate-y-1 transition-transform"/>
              </button>
            </div>
          </motion.div>
        
          <motion.div initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.8 }} className="mt-20 max-w-6xl mx-auto relative">
              <div className="relative z-10 hover:scale-[1.01] transition-transform duration-700 group">
                  <img src="/landing/hero-mockup.png" alt="Vizofin Dashboard Mockup" className="relative w-full h-auto drop-shadow-2xl rounded-[2rem] border-4 border-white/50" />
              </div>
          </motion.div>
        </div>
      </section>

      {/* CORE FEATURES SECTION (ID: FITUR) */}
      <section id="fitur" className="py-24 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <span className="text-blue-600 font-bold tracking-wider uppercase mb-2 block">Core Technology</span>
            <h2 className="text-3xl md:text-5xl font-extrabold text-slate-900 mb-4">Work Smarter, Not Harder</h2>
            <p className="text-slate-600 text-xl max-w-2xl mx-auto">Biarkan AI Vizofin yang bekerja keras membereskan angka-angkamu.</p>
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
                    <span className="inline-block py-1 px-3 rounded-lg bg-blue-100 text-blue-700 font-bold text-xs tracking-wider uppercase mb-6">
                        Professional Accounting Standard
                    </span>
                    <h2 className="text-3xl md:text-5xl font-extrabold mb-6 leading-tight text-slate-900">Laporan Standar SAK EMKM</h2>
                    <p className="text-slate-600 text-lg leading-relaxed mb-10">
                        Bukan sekadar catatan keluar-masuk. <b>Vizofin</b> menghasilkan laporan keuangan yang valid, rapi, dan siap audit secara otomatis.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {reportFeatures.map((item, index) => (
                            <div key={index} className="flex flex-col gap-3 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition hover:-translate-y-1 hover:border-blue-200 group">
                                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
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
              <span className="text-orange-500 font-bold tracking-wider uppercase mb-2 block">Comprehensive Ecosystem</span>
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
                            className="bg-white/90 backdrop-blur-sm p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-blue-200 transition text-left hover:-translate-y-1 group"
                          >
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-colors ${activeFeatureTab === 'business' ? 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white' : activeFeatureTab === 'organization' ? 'bg-orange-50 text-orange-600 group-hover:bg-orange-600 group-hover:text-white' : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white'}`}>
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
                <span className="text-blue-600 font-bold tracking-wider uppercase mb-2 block">Best Investment</span>
                <h2 className="text-3xl md:text-5xl font-extrabold text-slate-900 mb-6">Harga Kaki Lima, Kualitas Bintang Lima</h2>
                <p className="text-slate-600 text-xl max-w-2xl mx-auto">Investasi kecil untuk kesehatan finansial jangka panjang.</p>
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
                <p className="text-slate-600 text-xl">Ribuan user telah beralih ke cara cerdas mengelola uang bersama Vizofin.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {testimonials.map((t, i) => (
                    <motion.div 
                        key={i} 
                        whileHover={{ y: -5 }}
                        className="bg-white p-8 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50"
                    >
                        <div className="flex gap-1 text-orange-400 mb-4">
                            {[...Array(t.rating)].map((_, r) => <Star key={r} size={18} fill="currentColor"/>)}
                        </div>
                        <p className="text-slate-700 text-lg leading-relaxed mb-6 italic">"{t.text}"</p>
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-xl">
                                {t.name.charAt(0)}
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-900">{t.name}</h4>
                                <span className="text-xs text-blue-500 font-bold uppercase tracking-wide">{t.role}</span>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
         </div>
      </section>

      {/* CTA BOTTOM */}
      <section className="py-32 px-6 bg-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-900/40 via-slate-900 to-slate-900"></div>
        <div className="max-w-4xl mx-auto text-center relative z-10 text-white">
          <h2 className="text-4xl md:text-6xl font-extrabold mb-8 leading-tight">
            Stop Overthinking. <br/> <span className="text-blue-400">Start Managing.</span>
          </h2>
          <p className="text-slate-300 mb-10 text-lg md:text-2xl max-w-2xl mx-auto">
            Coba gratis 14 hari semua fitur Premium. Kendalikan masa depan finansialmu sekarang.
          </p>
          <div className="flex justify-center">
            <button onClick={() => navigate('/register')} className="bg-white text-slate-900 px-12 py-5 rounded-full font-bold text-xl hover:bg-blue-50 transition shadow-2xl active:scale-95 flex items-center gap-3">
               <Zap size={24} className="text-orange-500 fill-orange-500"/> Daftar Gratis Sekarang
            </button>
          </div>
          <p className="text-slate-500 text-sm mt-8">No Credit Card Required • Setup in 1 Minute</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
                <div className="flex items-center cursor-pointer">
                    <img src={logoVizofin} alt="Vizofin" className="h-8 w-auto grayscale hover:grayscale-0 transition opacity-70 hover:opacity-100" />
                </div>
                <p className="text-slate-400 text-sm">© 2026 Vizofin Indonesia.</p>
            </div>

            <div className="flex gap-6 text-sm text-slate-500 font-medium">
                <a href="#" className="hover:text-blue-600 transition">Tentang Kami</a>
                <a href="#" className="hover:text-blue-600 transition">Syarat & Ketentuan</a>
                <a href="#" className="hover:text-blue-600 transition">Kebijakan Privasi</a>
            </div>

            <div className="flex items-center gap-4">
                <a href="#" className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition"><Instagram size={20}/></a>
                <a href="#" className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition"><Twitter size={20}/></a>
                <a href="#" className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition"><Youtube size={20}/></a>
                <a href="#" className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition"><Facebook size={20}/></a>
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
                className="fixed bottom-8 right-8 z-40 bg-blue-900 text-white p-3 rounded-full shadow-lg hover:bg-blue-800 transition"
            >
                <ArrowUp size={24} />
            </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}