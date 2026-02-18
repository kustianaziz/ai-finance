import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, PlayCircle } from 'lucide-react';
import { useAuth } from '../context/AuthProvider';

export default function DynamicTour() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, activeEmployee } = useAuth();
  
  const [steps, setSteps] = useState([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [targetRect, setTargetRect] = useState(null);
  const [popoverStyle, setPopoverStyle] = useState({});
  const [arrowStyle, setArrowStyle] = useState({});
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  
  // REF BARU: Untuk melacak apakah kita sedang mundur atau maju
  const lastStepIndex = useRef(0);
  const searchInterval = useRef(null);

  const [windowSize, setWindowSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  // 1. FETCH STEPS
  useEffect(() => {
    // 🛑 GUARD: JANGAN JALAN KALAU BELUM LOGIN
    if (!user && !activeEmployee) return; 

    fetchSteps();
  }, [user, activeEmployee]);

  const fetchSteps = async () => {
    // Cek apakah user sudah pernah melihat tour
    const hasSeenTour = localStorage.getItem('has_seen_tour_v1');
    if (hasSeenTour) return;

    // 1. Tentukan Tipe User Saat Ini
    let currentUserType = 'PERSONAL'; // Default (Gratis)
    
    if (activeEmployee) {
        currentUserType = 'BUSINESS';
    } else {
        // Cek profile cache atau ambil dari user object jika ada metadata
        // (Asumsi Abang menyimpan profile di localStorage saat login)
        const cachedProfile = localStorage.getItem('user_profile_cache');
        if (cachedProfile) {
            const p = JSON.parse(cachedProfile);
            if (['business', 'organization'].includes(p.account_type)) currentUserType = 'BUSINESS';
            else if (p.account_type === 'personal_pro') currentUserType = 'PRO';
        }
    }

    // 2. Fetch Data Tour
    const { data } = await supabase
      .from('tour_steps')
      .select('*')
      .eq('is_active', true)
      .order('step_order', { ascending: true });

    if (data && data.length > 0) {
      // 3. FILTER MANUAL DI CLIENT (Karena logika 'IN' database terbatas untuk multi-value string)
      // Kita cari step yang target_audience-nya MENGANDUNG tipe user saat ini ATAU 'ALL'
      const filteredSteps = data.filter(step => {
          const targets = (step.target_audience || 'ALL').split(','); // Pisahkan string 'PERSONAL,PRO'
          return targets.includes('ALL') || targets.includes(currentUserType);
      });

      if (filteredSteps.length > 0) {
          setSteps(filteredSteps);
          setIsVisible(true);
      }
    }
  };

  // 2. LISTENER RESIZE & SCROLL
  useEffect(() => {
    const handleResize = () => {
        setWindowSize({ w: window.innerWidth, h: window.innerHeight });
        if(steps[currentStepIndex] && targetRect) {
             startRadar(steps[currentStepIndex].target_id, true);
        }
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);
    return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', handleResize, true);
    };
  }, [currentStepIndex, steps, targetRect]);

  // 3. LOGIC NAVIGASI UTAMA (FIXED BACK BUTTON)
  useEffect(() => {
    if (!isVisible || steps.length === 0) return;

    const currentStep = steps[currentStepIndex];
    const nextStep = steps[currentStepIndex + 1];

    // Deteksi Arah: Apakah kita mundur?
    // Jika index sekarang < index sebelumnya, berarti mundur.
    const isMovingBack = currentStepIndex < lastStepIndex.current;
    
    // Update ref untuk render berikutnya
    lastStepIndex.current = currentStepIndex;

    // Bersihkan radar sebelumnya
    if (searchInterval.current) clearInterval(searchInterval.current);
    setTargetRect(null); 

    // --- LOGIC AUTO ADVANCE (DIPERBAIKI) ---
    // Hanya majukan otomatis jika:
    // 1. Kita TIDAK sedang mundur (!isMovingBack)
    // 2. Kita berada di halaman langkah BERIKUTNYA
    // 3. Halaman langkah berikutnya ITU BEDA dengan halaman sekarang (mencegah skip langkah di halaman yg sama)
    if (
        !isMovingBack &&
        nextStep && 
        location.pathname === nextStep.route_path &&
        location.pathname !== currentStep.route_path
    ) {
        setCurrentStepIndex(prev => prev + 1);
        setIsVideoPlaying(false);
        return; 
    }

    // --- LOGIC NAVIGASI HALAMAN ---
    if (location.pathname !== currentStep.route_path) {
      navigate(currentStep.route_path);
      // Delay radar sedikit saat pindah halaman
      setTimeout(() => startRadar(currentStep.target_id), 800);
    } else {
      // Langsung radar jika halaman sudah benar
      startRadar(currentStep.target_id);
    }

    return () => {
        if (searchInterval.current) clearInterval(searchInterval.current);
    };
  }, [currentStepIndex, isVisible, steps, location.pathname]);


  // 4. RADAR PENCARI ELEMEN
  const startRadar = (identifier, runOnce = false) => {
      let attempts = 0;
      const maxAttempts = runOnce ? 1 : 50; 

      if (searchInterval.current) clearInterval(searchInterval.current);

      const scan = () => {
          attempts++;
          const foundElement = findElementByTextOrId(identifier);

          if (foundElement) {
              clearInterval(searchInterval.current);
              foundElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
              
              setTimeout(() => {
                  const rect = foundElement.getBoundingClientRect();
                  const step = steps[currentStepIndex];
                  calculateLayout(rect, step.position || 'bottom');
                  
                  setTargetRect({
                      top: rect.top, left: rect.left, width: rect.width, height: rect.height,
                      right: rect.right, bottom: rect.bottom
                  });
              }, 300);
          } else {
              if (attempts >= maxAttempts) {
                  clearInterval(searchInterval.current);
                  setTargetRect(null);
                  setPopoverStyle({ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', position: 'fixed' });
                  setArrowStyle({ display: 'none' });
              }
          }
      };
      scan();
      if (!runOnce) searchInterval.current = setInterval(scan, 100);
  };

  // --- FUNGSI PENCARI ELEMEN (SUPER SMART - FIXED) ---
  const findElementByTextOrId = (identifier) => {
      // 1. Cek apakah inputan adalah CSS Selector (Class/Complex Selector)
      // Ciri-cirinya: diawali titik (.) untuk class, atau mengandung tanda kurung []
      if (identifier.startsWith('.') || identifier.includes('[') || identifier.includes('>')) {
          try {
              // Cari SEMUA elemen yang cocok
              const elements = document.querySelectorAll(identifier);
              // Cari yang paling VISIBLE (bukan hidden, punya dimensi)
              for (let el of elements) {
                  const rect = el.getBoundingClientRect();
                  if (rect.width > 0 && rect.height > 0) {
                      // KETEMU! Jika ini icon di dalam button, ambil buttonnya
                      return el.closest('button') || el.closest('a') || el.closest('[onClick]') || el;
                  }
              }
          } catch (e) {
              // Kalau syntax error, abaikan dan lanjut ke bawah
          }
      }

      // 2. Cek ID Polos (Cara Lama: 'btn-menu')
      let el = document.getElementById(identifier);
      
      // 3. Kalau ID gak ada, Cari Berdasarkan Teks (Cara Text)
      if (!el) {
          // Cari elemen yang mungkin berisi teks
          const candidates = Array.from(document.querySelectorAll('button, a, h1, h2, h3, h4, span, p, div[role="button"], div[className*="button"]'));
          
          const found = candidates.find(candidate => {
              const text = candidate.innerText?.trim().toLowerCase();
              return text === identifier.toLowerCase();
          });

          if (found) {
              // Ambil parent yang bisa diklik
              el = found.closest('button') || 
                   found.closest('a') || 
                   found.closest('[onClick]') || 
                   found; 
          }
      }
      return el;
  };

  const calculateLayout = (rect, pos) => {
      const GAP = 15; 
      const CARD_W = 300; 

      let top = 0, left = 0;
      
      if (pos === 'top') {
          top = rect.top - GAP - 10; 
          left = rect.left + (rect.width / 2) - (CARD_W / 2);
      } else if (pos === 'bottom') {
          top = rect.bottom + GAP;
          left = rect.left + (rect.width / 2) - (CARD_W / 2);
      } else if (pos === 'left') {
          top = rect.top + (rect.height/2) - 100; 
          left = rect.left - CARD_W - GAP;
      } else if (pos === 'right') {
          top = rect.top + (rect.height/2) - 100;
          left = rect.right + GAP;
      }

      if (left < 10) left = 10;
      if (left + CARD_W > window.innerWidth) left = window.innerWidth - CARD_W - 10;
      if (top < 10) top = 10;
      if (top + 200 > window.innerHeight) top = window.innerHeight - 250; 

      let arrowPos = {};
      if (pos === 'bottom') arrowPos = { top: -6, left: '50%', marginLeft: '-6px', transform: 'rotate(45deg)' };
      else if (pos === 'top') arrowPos = { bottom: -6, left: '50%', marginLeft: '-6px', transform: 'rotate(225deg)' };
      else if (pos === 'right') arrowPos = { left: -6, top: '50%', marginTop: '-6px', transform: 'rotate(135deg)' };
      else if (pos === 'left') arrowPos = { right: -6, top: '50%', marginTop: '-6px', transform: 'rotate(-45deg)' };

      setPopoverStyle({ top, left, position: 'fixed', zIndex: 10002 });
      setArrowStyle(arrowPos);
  };

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
      setIsVideoPlaying(false);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
        setCurrentStepIndex(prev => prev - 1);
        setIsVideoPlaying(false);
    }
  };

  const handleFinish = () => {
    setIsVisible(false);
    localStorage.setItem('has_seen_tour_v1', 'true');
  };

  if (!isVisible || steps.length === 0) return null;
  const step = steps[currentStepIndex];

  // SVG PATH GENERATOR
  const svgPath = targetRect 
    ? `M0,0 H${windowSize.w} V${windowSize.h} H0 Z M${targetRect.left},${targetRect.top} V${targetRect.bottom} H${targetRect.right} V${targetRect.top} Z`
    : `M0,0 H${windowSize.w} V${windowSize.h} H0 Z`; 

  return (
    <AnimatePresence>
      {isVisible && (
        <div className="fixed inset-0 z-[99999] isolate font-sans">
          
          <svg className="absolute inset-0 w-full h-full pointer-events-auto" style={{mixBlendMode: 'hard-light'}}>
             <path d={svgPath} fill="rgba(0, 0, 0, 0.7)" fillRule="evenodd" />
          </svg>

          {targetRect && (
             <motion.div 
                initial={{ opacity: 0, scale: 1.1 }}
                animate={{ opacity: 1, scale: 1 }}
                layoutId="highlight-border"
                className="absolute border-2 border-yellow-400 rounded-lg pointer-events-none shadow-[0_0_20px_rgba(250,204,21,0.8)]"
                style={{
                    top: targetRect.top - 4,
                    left: targetRect.left - 4,
                    width: targetRect.width + 8,
                    height: targetRect.height + 8,
                }}
             >
                <span className="absolute inline-flex h-full w-full rounded-lg bg-yellow-400 opacity-20 animate-ping"></span>
             </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            key={currentStepIndex}
            className="bg-white w-[300px] rounded-xl shadow-2xl absolute flex flex-col overflow-hidden ring-1 ring-slate-900/5"
            style={popoverStyle}
          >
            {targetRect && (
                <div className="absolute w-3 h-3 bg-white border-l border-t border-slate-100 z-10 shadow-sm" style={arrowStyle} />
            )}

            {step.video_url && (
                <div className="w-full h-40 bg-slate-900 relative flex items-center justify-center shrink-0">
                    {isVideoPlaying ? (
                        <video src={step.video_url} controls autoPlay className="w-full h-full object-cover" />
                    ) : (
                        <>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10"/>
                            <button onClick={() => setIsVideoPlaying(true)} className="relative z-20 flex flex-col items-center gap-2 text-white hover:scale-110 transition">
                                <PlayCircle size={36} fill="rgba(255,255,255,0.2)"/>
                                <span className="text-[10px] font-bold tracking-wider">PUTAR VIDEO</span>
                            </button>
                        </>
                    )}
                </div>
            )}

            <div className="p-4 relative z-20 bg-white">
                <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-base text-slate-800 leading-tight">{step.title}</h3>
                    <button onClick={handleFinish} className="text-slate-400 hover:text-red-500 transition"><X size={16}/></button>
                </div>
                
                <p className="text-xs text-slate-600 mb-4 leading-relaxed">{step.content}</p>

                <div className="flex justify-between items-center pt-3 border-t border-slate-50">
                    <span className="text-[10px] font-bold text-slate-400">
                        {currentStepIndex + 1} / {steps.length}
                    </span>
                    
                    <div className="flex gap-2">
                        {currentStepIndex > 0 && (
                            <button onClick={handlePrev} className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"><ChevronLeft size={16}/></button>
                        )}
                        <button onClick={handleNext} className="py-1.5 px-3 bg-blue-600 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 hover:bg-blue-700 transition shadow-lg shadow-blue-200">
                            {currentStepIndex === steps.length - 1 ? 'Selesai' : 'Lanjut'} <ChevronRight size={14}/>
                        </button>
                    </div>
                </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}