import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthProvider';
import { processVoiceInput } from '../utils/aiLogic';
import { checkUsageLimit } from '../utils/subscriptionLogic';
import { findMatchingBill, markBillAsPaid } from '../utils/billMatcher'; // <-- IMPORT BARU
import { ArrowLeft, Mic, Square, X, User, Building2, Pencil, List, Link } from 'lucide-react'; 

export default function VoiceSim() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // STATE UTAMA
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState(''); 
  const [status, setStatus] = useState('idle'); 
  const [aiResult, setAiResult] = useState(null); 
  const [saving, setSaving] = useState(false);

  // STATE DETEKSI TAGIHAN (NEW)
  const [matchedBill, setMatchedBill] = useState(null); 
  const [linkToBill, setLinkToBill] = useState(true);

  // STATE MODE & AKUN
  const [activeMode, setActiveMode] = useState('PERSONAL'); 
  const [userAccountType, setUserAccountType] = useState('personal'); 

  // KATEGORI DINAMIS
  const DEFAULT_CATEGORIES = [
      'Makanan', 'Transport', 'Belanja', 'Tagihan', 'Hiburan', 'Kesehatan', 'Lainnya'
  ];
  const [categoryList, setCategoryList] = useState(DEFAULT_CATEGORIES);

  // Ref Speech
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (user) {
        fetchUserModeAndProfile();
        fetchUserBudgets(); 
    }
  }, [user]);

  const fetchUserModeAndProfile = async () => {
    const { data } = await supabase.from('profiles').select('account_type').eq('id', user.id).single();
    if (data) {
        setUserAccountType(data.account_type); 
        const savedMode = localStorage.getItem('app_mode'); 
        if (savedMode) setActiveMode(savedMode);
        else {
            const defaultMode = data.account_type === 'business' ? 'BUSINESS' : 
                                data.account_type === 'organization' ? 'ORGANIZATION' : 'PERSONAL';
            setActiveMode(defaultMode);
        }
    }
  };

  const fetchUserBudgets = async () => {
      try {
          const { data } = await supabase.from('budgets').select('category').eq('user_id', user.id);
          if (data && data.length > 0) {
              const userCustomCats = data.map(b => b.category);
              const merged = [...new Set([...DEFAULT_CATEGORIES, ...userCustomCats])].map(
                  s => s.charAt(0).toUpperCase() + s.slice(1)
              );
              setCategoryList(merged);
          }
      } catch (error) {
          console.error("Gagal load kategori budget", error);
      }
  };

  // SETUP SPEECH RECOGNITION
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.lang = 'id-ID'; 
      recognition.continuous = true; 
      recognition.interimResults = false; 

      recognition.onresult = (event) => {
        const lastResultIndex = event.results.length - 1;
        const transcriptChunk = event.results[lastResultIndex][0].transcript.trim();
        if (transcriptChunk) {
            setTranscript(prevText => prevText ? `${prevText} ${transcriptChunk}` : transcriptChunk);
        }
      };

      recognition.onerror = (event) => {
        if (event.error === 'no-speech') return; 
        setIsListening(false);
      };

      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    } else {
      alert("Browser/HP ini gak support fitur suara.");
    }
  }, []);

  const toggleListening = async () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
    } else {
      // Logic Limit Akun (Tetap Aman)
      const isVip = ['business', 'organization', 'personal_pro'].includes(userAccountType);
      if (!isVip) {
          const limitCheck = await checkUsageLimit(user.id, 'VOICE');
          if (!limitCheck.allowed) {
            if(window.confirm(limitCheck.message + "\nMau upgrade sekarang?")) navigate('/upgrade');
            return;
          }
      }

      setTranscript(''); 
      setAiResult(null); 
      setMatchedBill(null); // Reset deteksi tagihan
      setStatus('listening');
      if (recognitionRef.current) recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleProcessAI = async () => {
    if (!transcript.trim()) { alert("Belum ada suara yang masuk, Gan!"); return; }
    if (isListening) { if (recognitionRef.current) recognitionRef.current.stop(); setIsListening(false); }

    setStatus('processing');
    setMatchedBill(null); // Reset

    try {
      const result = await processVoiceInput(transcript, categoryList);
      
      const enrichedResult = result.map(txn => {
          let cat = txn.category || 'Lainnya';
          cat = cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();
          const isStandard = categoryList.includes(cat);

          return {
              ...txn,
              category: isStandard ? cat : 'Lainnya',
              isManualCategory: !isStandard, 
              type: txn.type || 'expense', 
              allocation_type: (activeMode === 'BUSINESS' || activeMode === 'ORGANIZATION') ? 'BUSINESS' : 'PERSONAL',
              date: txn.date || new Date().toISOString().split('T')[0]
          };
      });

      setAiResult(enrichedResult);
      setStatus('success');

      // --- DETEKSI TAGIHAN (LOOP SEMUA ITEM) ---
      for (const txn of enrichedResult) {
          const bill = await findMatchingBill(user.id, txn);
          if (bill) {
              setMatchedBill(bill);
              setLinkToBill(true);
              break; // Ketemu satu, stop (biar ga numpuk notif)
          }
      }

    } catch (error) {
      alert("Gagal memproses: " + error.message);
      setStatus('idle');
    }
  };

  const updateTransaction = (index, field, value) => {
      const updatedList = [...aiResult];
      updatedList[index][field] = value;
      setAiResult(updatedList);
  };

  const toggleCategoryMode = (index) => {
      const updatedList = [...aiResult];
      const item = updatedList[index];
      item.isManualCategory = !item.isManualCategory;
      if (!item.isManualCategory && !categoryList.includes(item.category)) {
          item.category = 'Lainnya';
      }
      setAiResult(updatedList);
  };

  // --- SIMPAN KE DB (OPTIMIZED: PARALLEL) ---
  const handleSave = async () => {
    if (!user || !aiResult) return;
    setSaving(true);
    
    try {
      // Gunakan Promise.all agar cepat
      const savePromises = aiResult.map(async (txn) => {
          const { data: headerData, error: headerError } = await supabase
            .from('transaction_headers')
            .insert([{
              user_id: user.id, merchant: txn.merchant, total_amount: txn.total_amount, 
              type: txn.type, allocation_type: txn.allocation_type, category: txn.category, 
              date: txn.date, receipt_url: "Voice V5 (Fast Mode & Bill Sync)", 
              is_ai_generated: true, is_journalized: false
            }])
            .select().single();

          if (headerError) throw headerError;

          if (txn.items && txn.items.length > 0) {
            const itemsToInsert = txn.items.map(item => ({
              header_id: headerData.id, name: item.name, price: item.price, qty: 1
            }));
            await supabase.from('transaction_items').insert(itemsToInsert);
          }
      });

      await Promise.all(savePromises);

      // --- UPDATE STATUS TAGIHAN JIKA DICENTANG ---
      if (matchedBill && linkToBill) {
          await markBillAsPaid(matchedBill.id);
      }

      navigate('/dashboard');

    } catch (error) {
      console.error(error);
      alert('Gagal simpan: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 relative font-sans">
      {/* HEADER */}
      <div className="p-4 flex items-center justify-between bg-white shadow-sm z-10 border-b border-slate-100">
        <button onClick={() => navigate('/dashboard')} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 transition"><X size={20}/></button>
        <div className="flex flex-col items-center">
            <h1 className="font-bold text-lg text-slate-800">Voice Input</h1>
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${activeMode === 'PERSONAL' ? 'bg-pink-50 border-pink-200 text-pink-600' : 'bg-blue-50 border-blue-200 text-blue-600'}`}>
                {activeMode === 'PERSONAL' ? <User size={10} /> : <Building2 size={10} />}
                <span>Mode {activeMode === 'PERSONAL' ? 'Pribadi' : activeMode === 'BUSINESS' ? 'Bisnis' : 'Organisasi'}</span>
            </div>
        </div>
        <div className="w-9"></div> 
      </div>

      {/* CONTENT AREA */}
      <div className="flex-1 p-6 flex flex-col items-center overflow-y-auto pb-32">
        {status !== 'success' && (
            <>
                <div className="relative mb-8 mt-8">
                  {isListening && (<span className={`absolute inset-0 rounded-full animate-ping opacity-75 ${activeMode === 'PERSONAL' ? 'bg-pink-200' : 'bg-blue-200'}`}></span>)}
                  <button onClick={toggleListening} className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center shadow-xl transition-all active:scale-95 ${isListening ? 'bg-red-500 text-white scale-110 shadow-red-200' : activeMode === 'PERSONAL' ? 'bg-pink-600 text-white hover:bg-pink-700 shadow-pink-200' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'}`}>{isListening ? <Square size={32} fill="currentColor"/> : <Mic size={36}/>}</button>
                </div>
                <p className="text-slate-500 text-sm mb-6 font-medium text-center max-w-[250px]">{isListening ? 'Sedang mendengarkan...' : `Klik mic dan sebutkan pengeluaran ${activeMode === 'PERSONAL' ? 'pribadi' : 'bisnis'} Anda.`}</p>
                <div className="w-full bg-white p-5 rounded-3xl border border-slate-200 shadow-sm mb-6 flex-1 min-h-[180px] flex flex-col relative overflow-hidden focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                    <textarea className="w-full h-full bg-transparent outline-none text-slate-700 text-lg resize-none placeholder-slate-300 font-medium leading-relaxed" placeholder='Contoh: "Kemarin beli bensin 20 ribu"' value={transcript} onChange={(e) => setTranscript(e.target.value)}></textarea>
                    {transcript && (<button onClick={() => setTranscript('')} className="absolute top-2 right-2 p-1.5 bg-slate-100 rounded-full text-slate-400 hover:text-slate-600"><X size={14}/></button>)}
                </div>
                {transcript.length > 3 && status !== 'processing' && (<button onClick={handleProcessAI} className={`w-full py-4 text-white rounded-2xl font-bold text-lg shadow-lg hover:brightness-110 transition active:scale-95 flex items-center justify-center gap-2 animate-slide-up ${activeMode === 'PERSONAL' ? 'bg-pink-600 shadow-pink-200' : 'bg-blue-600 shadow-blue-200'}`}>Proses Sekarang <ArrowLeft className="rotate-180" size={20}/></button>)}
                {status === 'processing' && (<div className="text-center animate-pulse mt-4 flex flex-col items-center gap-2"><div className={`w-8 h-8 border-4 border-t-transparent rounded-full animate-spin ${activeMode === 'PERSONAL' ? 'border-pink-500' : 'border-blue-500'}`}></div><p className="text-slate-500 font-bold text-sm">AI sedang mencatat...</p></div>)}
            </>
        )}
      </div>

      {/* --- HASIL AI --- */}
      {status === 'success' && aiResult && (
        <div className="absolute inset-0 bg-slate-50 z-20 flex flex-col animate-slide-up overflow-hidden">
           <div className={`p-6 border-b shadow-sm z-10 flex justify-between items-center ${activeMode === 'PERSONAL' ? 'bg-pink-50 border-pink-100' : 'bg-blue-50 border-blue-100'}`}>
               <div><h2 className={`font-bold text-lg flex items-center gap-2 ${activeMode === 'PERSONAL' ? 'text-pink-800' : 'text-blue-800'}`}>✅ Hasil Catatan ({aiResult.length})</h2><p className="text-xs text-slate-500">Cek kembali sebelum disimpan.</p></div>
               <div className={`p-2 rounded-full ${activeMode === 'PERSONAL' ? 'bg-pink-100 text-pink-600' : 'bg-blue-100 text-blue-600'}`}>{activeMode === 'PERSONAL' ? <User size={20}/> : <Building2 size={20}/>}</div>
           </div>
           
           <div className="p-4 flex-1 overflow-y-auto space-y-4 pb-36">
              
              {/* CARD KONFIRMASI TAGIHAN (NEW FITUR) */}
              {matchedBill && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex items-start gap-3 animate-fade-in-up mb-4">
                      <div className="p-2 bg-white rounded-full text-indigo-600 shadow-sm shrink-0"><Link size={20}/></div>
                      <div className="flex-1">
                          <h4 className="font-bold text-indigo-900 text-sm">Terdeteksi Tagihan!</h4>
                          <p className="text-xs text-indigo-600 mt-0.5 leading-relaxed">Transaksi ini mirip dengan tagihan <b>{matchedBill.name}</b>. Mau tandai sebagai lunas sekalian?</p>
                      </div>
                      <div className="flex items-center h-full"><input type="checkbox" checked={linkToBill} onChange={(e) => setLinkToBill(e.target.checked)} className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"/></div>
                  </div>
              )}

              {aiResult.map((txn, idx) => (
                  <div key={idx} className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5 transition-all focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-300">
                      <div className="flex justify-between items-start mb-4">
                          <div className="w-[60%]">
                              <input type="text" value={txn.merchant} onChange={(e) => updateTransaction(idx, 'merchant', e.target.value)} className="font-bold text-slate-800 text-lg border-b border-transparent focus:border-blue-500 outline-none w-full bg-transparent" placeholder="Nama Item"/>
                              <input type="date" value={txn.date} onChange={(e) => updateTransaction(idx, 'date', e.target.value)} className="text-xs text-slate-400 mt-1 bg-transparent outline-none font-medium"/>
                          </div>
                          <p className="font-bold text-xl text-slate-800">Rp {txn.total_amount.toLocaleString()}</p>
                      </div>
                      <div className="flex flex-col gap-3 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <div className="flex justify-between items-center mb-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Kategori {txn.isManualCategory ? '(Manual)' : '(Otomatis)'}</label>
                              <button onClick={() => toggleCategoryMode(idx)} className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-indigo-600 transition shadow-sm">{txn.isManualCategory ? <List size={12}/> : <Pencil size={12}/>}</button>
                          </div>
                          {txn.isManualCategory ? (
                              <input type="text" value={txn.category} onChange={(e) => updateTransaction(idx, 'category', e.target.value)} className="w-full p-2 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-700 font-bold text-sm outline-none placeholder-indigo-300" placeholder="Ketik kategori..."/>
                          ) : (
                              <select value={txn.category} onChange={(e) => updateTransaction(idx, 'category', e.target.value)} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-700 font-bold text-sm outline-none">
                                  {categoryList.map(cat => (<option key={cat} value={cat}>{cat}</option>))}
                              </select>
                          )}
                          <div className="flex gap-2 bg-white p-1 rounded-lg border border-slate-100 mt-2">
                              <button onClick={() => updateTransaction(idx, 'type', 'expense')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${txn.type === 'expense' ? 'bg-red-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Keluar</button>
                              <button onClick={() => updateTransaction(idx, 'type', 'income')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${txn.type === 'income' ? 'bg-green-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Masuk</button>
                          </div>
                          <div className="relative mt-1">
                              <select value={txn.allocation_type} onChange={(e) => updateTransaction(idx, 'allocation_type', e.target.value)} className={`w-full p-2.5 pl-3 rounded-lg border font-bold text-sm outline-none appearance-none ${txn.allocation_type === 'BUSINESS' ? 'bg-blue-50 text-blue-700 border-blue-200' : txn.allocation_type === 'PERSONAL' ? 'bg-pink-50 text-pink-700 border-pink-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                                 {activeMode === 'BUSINESS' ? (<><option value="BUSINESS">🏢 Operasional Toko</option><option value="SALARY">💰 Ambil Gaji Owner</option></>) : (<><option value="PERSONAL">🏠 Belanja Pribadi</option><option value="PRIVE">💸 Prive (Ambil Kas Toko)</option></>)}
                              </select>
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">▼</div>
                          </div>
                      </div>
                  </div>
              ))}
           </div>

           <div className="p-5 border-t border-slate-200 bg-white sticky bottom-0 shadow-[0_-4px_10px_-1px_rgba(0,0,0,0.05)] z-20">
               <div className="flex gap-3">
                   <button onClick={() => { setStatus('idle'); setTranscript(''); setAiResult(null); }} className="flex-1 py-3.5 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition">Ulang</button>
                   <button onClick={handleSave} disabled={saving} className={`flex-[2] py-3.5 text-white rounded-xl font-bold shadow-lg hover:brightness-110 transition flex justify-center items-center gap-2 ${activeMode === 'PERSONAL' ? 'bg-pink-600 shadow-pink-200' : 'bg-blue-600 shadow-blue-200'}`}>
                       {saving ? 'Menyimpan...' : 'Simpan Semua'}
                   </button>
               </div>
           </div>
        </div>
      )}
    </div>
  );
}