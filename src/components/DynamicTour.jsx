import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, PlayCircle, MousePointerClick } from 'lucide-react';
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
  
  const lastStepIndex = useRef(0);
  const searchInterval = useRef(null);
  const [windowSize, setWindowSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  // 1. FETCH STEPS
  useEffect(() => {
    if (!user && !activeEmployee) return; 
    fetchSteps();
  }, [user, activeEmployee]);

  const fetchSteps = async () => {
    const hasSeenTour = localStorage.getItem('has_seen_tour_v1');
    if (hasSeenTour) return;

    let currentUserType = 'PERSONAL'; 
    if (activeEmployee) currentUserType = 'BUSINESS';
    else {
        const cachedProfile = localStorage.getItem('user_profile_cache');
        if (cachedProfile) {
            const p = JSON.parse(cachedProfile);
            if (['business', 'organization'].includes(p.account_type)) currentUserType = 'BUSINESS';
            else if (p.account_type === 'personal_pro') currentUserType = 'PRO';
        }
    }

    const { data } = await supabase
      .from('tour_steps')
      .select('*')
      .eq('is_active', true)
      .order('step_order', { ascending: true });

    if (data && data.length > 0) {
      const filteredSteps = data.filter(step => {
          const targets = (step.target_audience || 'ALL').split(',');
          return targets.includes('ALL') || targets.includes(currentUserType);
      });

      if (filteredSteps.length > 0) {
          setSteps(filteredSteps);
          setIsVisible(true);
      }
    }
  };

  // 3. LOGIC NAVIGASI UTAMA (ANTI LOMPAT & AUTO CLICK)
  useEffect(() => {
    if (!isVisible || steps.length === 0) return;

    const currentStep = steps[currentStepIndex];
    const nextStep = steps[currentStepIndex + 1];
    const prevStep = steps[currentStepIndex - 1]; // Ambil langkah sebelumnya

    // Deteksi Arah Mundur
    const isMovingBack = currentStepIndex < lastStepIndex.current;
    lastStepIndex.current = currentStepIndex;

    // Reset Target
    setTargetRect(null); 
    if (searchInterval.current) clearInterval(searchInterval.current);

    // --- LOGIC ANTI-LOMPAT ---
    // Cek apakah browser "masih nyangkut" di halaman step sebelumnya?
    // Jika YA, berarti kita sedang proses loading pindah halaman. JANGAN Auto-Advance.
    const isLaggingBehind = prevStep && 
                            location.pathname === prevStep.route_path && 
                            location.pathname !== currentStep.route_path;

    // --- AUTO ADVANCE (DIPERKETAT) ---
    // Hanya boleh maju otomatis jika:
    // 1. Tidak sedang mundur.
    // 2. Tidak sedang "nyangkut" di halaman lama (!isLaggingBehind).
    // 3. Posisi sekarang BENAR-BENAR ada di halaman Step Berikutnya.
    // 4. Halaman Step Berikutnya ITU BEDA dengan halaman Step Saat Ini (biar gak loop).
    if (
        !isMovingBack && 
        !isLaggingBehind && 
        nextStep && 
        location.pathname === nextStep.route_path && 
        location.pathname !== currentStep.route_path
    ) {
        setCurrentStepIndex(prev => prev + 1);
        setIsVideoPlaying(false);
        return; 
    }

    // --- EKSEKUSI STEP ---
    const executeStep = () => {
        // Mode Auto Clicker (Buka Modal)
        if (currentStep.pre_click_target && !isMovingBack) {
            runAutoClicker(currentStep.pre_click_target, () => {
                startRadar(currentStep.target_id);
            });
        } else {
            // Mode Normal
            startRadar(currentStep.target_id);
        }
    };

    // Navigasi Halaman (Jika Salah Tempat)
    if (location.pathname !== currentStep.route_path) {
      navigate(currentStep.route_path);
      // Tunggu agak lama (800ms) biar halaman kelar render sebelum cari target
      setTimeout(executeStep, 800);
    } else {
      // Sudah di tempat yang benar, langsung eksekusi
      executeStep();
    }

    return () => {
        if (searchInterval.current) clearInterval(searchInterval.current);
    };
  }, [currentStepIndex, isVisible, steps, location.pathname]);


  // --- 4. LOGIC WAIT FOR USER CLICK (INTERACTION TRIGGER) ---
  useEffect(() => {
      if (!isVisible || !steps[currentStepIndex]) return;
      
      const step = steps[currentStepIndex];
      
      // Jika step ini mengharuskan user klik sesuatu
      if (step.next_trigger_target) {
          let triggerEl = null;

          const handleUserInteraction = (e) => {
              // Lanjut ke step berikutnya
              setTimeout(() => {
                 handleNext();
              }, 500); 
          };

          const findTriggerInterval = setInterval(() => {
              triggerEl = findElementByTextOrId(step.next_trigger_target);
              if (triggerEl) {
                  clearInterval(findTriggerInterval);
                  // Pasang listener sekali jalan
                  triggerEl.addEventListener('click', handleUserInteraction, { once: true }); 
              }
          }, 500);

          return () => {
              clearInterval(findTriggerInterval);
              if (triggerEl) triggerEl.removeEventListener('click', handleUserInteraction);
          };
      }
  }, [currentStepIndex, isVisible, steps]);


  // 5. HELPER FUNCTIONS
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
                  if (rect.width === 0 || rect.height === 0) return; 
                  const step = steps[currentStepIndex];
                  calculateLayout(rect, step.position || 'bottom');
                  setTargetRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom });
              }, 200);
          } else {
              if (attempts >= maxAttempts) clearInterval(searchInterval.current);
          }
      };
      scan();
      if (!runOnce) searchInterval.current = setInterval(scan, 100);
  };

  const runAutoClicker = (triggerId, onSuccess) => {
      let attempts = 0;
      const clickInterval = setInterval(() => {
          attempts++;
          const triggerEl = findElementByTextOrId(triggerId);
          if (triggerEl) {
              clearInterval(clickInterval);
              triggerEl.click(); 
              setTimeout(onSuccess, 600); 
          } 
          if (attempts > 30) clearInterval(clickInterval);
      }, 100);
  };

  const findElementByTextOrId = (identifier) => {
      let el = null;
      if (identifier.startsWith('.') || identifier.includes('[') || identifier.startsWith('#')) {
          try {
              const rawEl = document.querySelector(identifier);
              if (rawEl) el = rawEl.closest('button') || rawEl.closest('.menu-card') || rawEl.closest('[onClick]') || rawEl;
          } catch (e) {}
      }
      if (!el) el = document.getElementById(identifier);
      if (!el) {
          const candidates = Array.from(document.querySelectorAll('button, a, h1, h2, h3, h4, span, p, div[role="button"]'));
          const found = candidates.find(candidate => candidate.innerText?.trim().toLowerCase() === identifier.toLowerCase());
          if (found) el = found.closest('button') || found.closest('a') || found.closest('[onClick]') || found; 
      }
      return el;
  };

  const calculateLayout = (rect, pos) => {
      const GAP = 15; const CARD_W = 300; let top = 0, left = 0;
      if (pos === 'top') { top = rect.top - GAP - 10; left = rect.left + (rect.width / 2) - (CARD_W / 2); } 
      else if (pos === 'bottom') { top = rect.bottom + GAP; left = rect.left + (rect.width / 2) - (CARD_W / 2); } 
      else if (pos === 'left') { top = rect.top + (rect.height/2) - 100; left = rect.left - CARD_W - GAP; } 
      else if (pos === 'right') { top = rect.top + (rect.height/2) - 100; left = rect.right + GAP; }
      
      if (left < 10) left = 10;
      if (left + CARD_W > window.innerWidth) left = window.innerWidth - CARD_W - 10;
      if (top + 250 > window.innerHeight && pos === 'bottom') top = rect.top - GAP - 200; 
      if (top < 10) top = 10;

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
    if (currentStepIndex > 0) { setCurrentStepIndex(prev => prev - 1); setIsVideoPlaying(false); }
  };

  const handleFinish = () => {
    setIsVisible(false);
    localStorage.setItem('has_seen_tour_v1', 'true');
  };

  if (!isVisible || steps.length === 0 || !targetRect) return null; 

  const step = steps[currentStepIndex];
  const svgPath = `M0,0 H${windowSize.w} V${windowSize.h} H0 Z M${targetRect.left},${targetRect.top} V${targetRect.bottom} H${targetRect.right} V${targetRect.top} Z`;

  // --- LOGIC KLIK TEMBUS ---
  // Jika sedang menunggu user klik (Trigger Mode), matikan pointer-events di overlay
  // supaya user bisa klik tombol apapun di aplikasi (termasuk Simpan).
  const overlayClass = step.next_trigger_target ? 'pointer-events-none' : 'pointer-events-auto';

  return (
    <AnimatePresence>
      {isVisible && targetRect && (
        // 1. PEMBUNGKUS UTAMA: pointer-events-none (WAJIB) biar klik tembus ke layer bawah
        <div className="fixed inset-0 z-[99999] isolate font-sans pointer-events-none">
          
          {/* 2. OVERLAY HITAM: 
                 - Mode Normal: pointer-events-auto (Blokir klik)
                 - Mode Trigger: pointer-events-none (Bebaskan klik)
          */}
          <svg className={`absolute inset-0 w-full h-full ${overlayClass}`} style={{mixBlendMode: 'hard-light'}}>
             <path d={svgPath} fill="rgba(0, 0, 0, 0.7)" fillRule="evenodd" />
          </svg>

          {/* 3. HIGHLIGHT BORDER */}
          <motion.div initial={{ opacity: 0, scale: 1.1 }} animate={{ opacity: 1, scale: 1 }} layoutId="highlight-border" className="absolute border-2 border-yellow-400 rounded-lg shadow-[0_0_20px_rgba(250,204,21,0.8)]" style={{ top: targetRect.top - 4, left: targetRect.left - 4, width: targetRect.width + 8, height: targetRect.height + 8 }}>
            <span className="absolute inline-flex h-full w-full rounded-lg bg-yellow-400 opacity-20 animate-ping"></span>
          </motion.div>

          {/* 4. CARD TOUR: Harus pointer-events-auto biar tombol di dalamnya bisa diklik */}
          <motion.div drag dragMomentum={false} initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} key={currentStepIndex} className="bg-white w-[300px] rounded-xl shadow-2xl absolute flex flex-col overflow-hidden ring-1 ring-slate-900/5 pointer-events-auto" style={popoverStyle}>
            <div className="absolute w-3 h-3 bg-white border-l border-t border-slate-100 z-10 shadow-sm" style={arrowStyle} />

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
                        
                        {!step.next_trigger_target ? (
                            <button onClick={handleNext} className="py-1.5 px-3 bg-blue-600 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 hover:bg-blue-700 transition shadow-lg shadow-blue-200">
                                {currentStepIndex === steps.length - 1 ? 'Selesai' : 'Lanjut'} <ChevronRight size={14}/>
                            </button>
                        ) : (
                            <div className="flex items-center gap-1 text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded border border-blue-100 animate-pulse">
                                <MousePointerClick size={12}/> Klik target untuk lanjut
                            </div>
                        )}
                    </div>
                </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}