import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { Store, User, ArrowRight, Lock, Loader2, Search, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function StorePortal() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState(null);
  const [employees, setEmployees] = useState([]); 
  const [filteredEmployees, setFilteredEmployees] = useState([]); 
  
  // UI State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loginProcess, setLoginProcess] = useState(false);

  useEffect(() => {
    fetchStoreData();
  }, [slug]);

  // Logic Pencarian
  useEffect(() => {
      if (!searchTerm || searchTerm.length < 3) {
          setFilteredEmployees([]); 
      } else {
          const lower = searchTerm.toLowerCase();
          const results = employees.filter(emp => emp.full_name.toLowerCase().includes(lower));
          setFilteredEmployees(results);
      }
  }, [searchTerm, employees]);

  const fetchStoreData = async () => {
    try {
        setLoading(true);
        // 1. Cari Toko
        const { data: storeData, error: storeError } = await supabase
            .from('profiles')
            .select('id, entity_name, full_name')
            .eq('store_slug', slug)
            .single();

        if (storeError || !storeData) throw new Error("Toko tidak ditemukan.");
        setStore(storeData);

        // 2. Ambil Karyawan BESERTA PERMISSIONS-NYA (PENTING!)
        // Perhatikan bagian business_roles(name, permissions)
        const { data: empData } = await supabase
            .from('business_employees')
            .select('id, full_name, role_id, business_roles(name, permissions)') // <--- UPDATE DISINI
            .eq('business_id', storeData.id)
            .eq('is_active', true);

        setEmployees(empData || []);

    } catch (error) {
        console.error("Gagal memuat toko:", error.message);
    } finally {
        setLoading(false);
    }
  };

  const handleLogin = async () => {
      setLoginProcess(true);
      setError('');
      
      try {
          // Data Sesi Karyawan
          const sessionData = {
              storeId: store.id,
              storeSlug: slug, 
              storeName: store.entity_name || store.full_name,
              id: selectedEmp.id, 
              name: selectedEmp.full_name, 
              role: selectedEmp.business_roles?.name,
              // PERBAIKAN DISINI: AMBIL PERMISSION DARI DATABASE
              permissions: selectedEmp.business_roles?.permissions || [], 
              pin: pin 
          };

          // Simpan Session
          localStorage.setItem('active_employee_session', JSON.stringify(sessionData));
          localStorage.setItem('last_store_slug', slug); 
          
          await new Promise(r => setTimeout(r, 800));
          
          // Hard Reload agar AuthProvider membaca permission baru
          window.location.href = '/employee-dashboard'; 

      } catch (e) {
          setError("Gagal masuk sistem");
      } finally {
          setLoginProcess(false);
      }
  };

  const handleNum = (num) => { if (pin.length < 6) setPin(p => p + num); setError(''); };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-600"/></div>;

  return (
    <div className="min-h-screen bg-slate-100 font-sans flex items-center justify-center p-4">
        
        {/* CARD UTAMA */}
        <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden min-h-[550px] flex flex-col relative">
            
            {/* HEADER TOKO */}
            <div className="bg-blue-600 p-8 pb-12 text-center relative overflow-hidden shrink-0">
                <div className="relative z-10">
                    <div className="w-20 h-20 bg-white rounded-full mx-auto flex items-center justify-center shadow-lg mb-3">
                        <Store size={40} className="text-blue-600"/>
                    </div>
                    <h1 className="text-xl font-extrabold text-white leading-tight">{store?.entity_name || store?.full_name}</h1>
                    <p className="text-blue-100 text-xs mt-1 opacity-80">Portal Akses Karyawan</p>
                </div>
                <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
            </div>

            {/* CONTENT AREA */}
            <div className="flex-1 bg-white relative -mt-8 rounded-t-3xl p-6 flex flex-col">
                
                <AnimatePresence mode="wait">
                    {!selectedEmp ? (
                        // --- SCREEN 1: PENCARIAN KARYAWAN ---
                        <motion.div 
                            key="search"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="flex-1 flex flex-col"
                        >
                            <div className="text-center mb-6">
                                <p className="text-sm text-slate-500 font-medium">Halo! Siapa yang bertugas?</p>
                            </div>

                            {/* SEARCH BOX */}
                            <div className="relative mb-4">
                                <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/>
                                <input 
                                    type="text" 
                                    placeholder="Ketik 3 huruf nama kamu..." 
                                    className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-slate-800 font-bold transition text-sm"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            {/* HASIL PENCARIAN */}
                            <div className="flex-1 overflow-y-auto pr-1">
                                {searchTerm.length < 3 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2 pb-10 opacity-60">
                                        <Search size={48}/>
                                        <p className="text-xs">Cari nama kamu untuk absen</p>
                                    </div>
                                ) : filteredEmployees.length === 0 ? (
                                    <div className="text-center py-8 text-slate-400 text-sm">
                                        Nama tidak ditemukan 😔
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {filteredEmployees.map(emp => (
                                            <div 
                                                key={emp.id} 
                                                onClick={() => { setSelectedEmp(emp); setPin(''); setError(''); }}
                                                className="group flex items-center gap-4 p-3 rounded-2xl border border-slate-100 hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-all active:scale-95 shadow-sm"
                                            >
                                                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0">
                                                    {emp.full_name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-bold text-slate-800 group-hover:text-blue-700 truncate">{emp.full_name}</h3>
                                                    <p className="text-[10px] text-slate-400 group-hover:text-blue-500 uppercase font-bold tracking-wider">{emp.business_roles?.name || 'Staff'}</p>
                                                </div>
                                                <ArrowRight size={18} className="text-slate-300 group-hover:text-blue-500"/>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ) : (
                        // --- SCREEN 2: INPUT PIN ---
                        <motion.div 
                            key="pin"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            className="flex flex-col h-full items-center"
                        >
                            <button onClick={() => setSelectedEmp(null)} className="self-start text-xs text-slate-400 hover:text-slate-600 mb-2 flex items-center gap-1 font-bold uppercase tracking-wider">
                                <ArrowRight size={12} className="rotate-180"/> Kembali
                            </button>

                            <div className="text-center mb-6">
                                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 mx-auto flex items-center justify-center text-white font-bold text-2xl mb-3 shadow-lg ring-4 ring-blue-50">
                                    {selectedEmp.full_name.charAt(0)}
                                </div>
                                <h3 className="font-bold text-lg text-slate-800">Hai, {selectedEmp.full_name}!</h3>
                                <p className="text-xs text-slate-400">Masukkan 6 Digit PIN Akses</p>
                            </div>

                            {/* PIN DOTS */}
                            <div className="flex gap-3 mb-6">
                                {[...Array(6)].map((_, i) => (
                                    <div key={i} className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${i < pin.length ? 'bg-blue-600 scale-110 shadow-sm' : 'bg-slate-100 border border-slate-200'}`}></div>
                                ))}
                            </div>

                            {error && <div className="text-red-500 text-xs font-bold mb-4 bg-red-50 px-3 py-1 rounded-full animate-pulse flex items-center gap-1"><AlertCircle size={12}/> {error}</div>}

                            {/* NUMPAD */}
                            <div className="grid grid-cols-3 gap-3 w-full max-w-[260px] mb-6">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                                    <button key={num} onClick={() => handleNum(num.toString())} className="h-14 w-full rounded-2xl bg-slate-50 text-xl font-bold text-slate-700 hover:bg-slate-100 active:scale-95 transition shadow-sm border-b-2 border-slate-200 active:border-b-0 active:translate-y-0.5">
                                        {num}
                                    </button>
                                ))}
                                <div/>
                                <button onClick={() => handleNum('0')} className="h-14 w-full rounded-2xl bg-slate-50 text-xl font-bold text-slate-700 hover:bg-slate-100 active:scale-95 transition shadow-sm border-b-2 border-slate-200 active:border-b-0 active:translate-y-0.5">0</button>
                                <button onClick={() => { setPin(p => p.slice(0,-1)); setError(''); }} className="h-14 w-full flex items-center justify-center text-slate-400 hover:text-red-500 active:scale-90 hover:bg-red-50 rounded-2xl transition"><DeleteIcon/></button>
                            </div>

                            <button 
                                onClick={handleLogin}
                                disabled={pin.length < 6 || loginProcess}
                                className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 disabled:opacity-50 disabled:scale-100 transition flex items-center justify-center gap-2"
                            >
                                {loginProcess ? <Loader2 className="animate-spin"/> : <span className="flex items-center gap-2"><Lock size={18}/> BUKA DASHBOARD</span>}
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

            </div>
        </div>
        
        {/* FOOTER */}
        <div className="fixed bottom-4 text-center w-full pointer-events-none">
            <p className="text-[10px] text-slate-400">Powered by Vizofin POS</p>
        </div>
    </div>
  );
}

const DeleteIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"></path><line x1="18" y1="9" x2="12" y2="15"></line><line x1="12" y1="9" x2="18" y2="15"></line></svg>
);