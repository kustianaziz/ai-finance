import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthProvider';
import { processVoiceInput } from '../utils/aiLogic';
import { checkUsageLimit } from '../utils/subscriptionLogic';
import { findMatchingBill, markBillAsPaid } from '../utils/billMatcher';
import { 
  ArrowLeft, Mic, Square, X, User, Building2, Link, 
  Wallet, ArrowRight, PlusCircle, CheckCircle2, ArrowDownLeft, Landmark, Sparkles 
} from 'lucide-react'; 

// --- KOMPONEN DROPDOWN ULTRA COMPACT (PRECISION FIX) ---
const WalletSelect = ({ wallets, value, onChange, isNew, newName, placeholder, type, label }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef(null);

    const selectedWallet = isNew 
        ? { id: 'NEW', name: newName, isNew: true } 
        : wallets.find(w => w.id === value);

    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    return (
        <div className={`relative w-full font-sans ${isOpen ? 'z-[100]' : 'z-10'}`} ref={wrapperRef}>
            
            {/* LABEL DI ATAS GARIS (PRECISION POSITIONING) */}
            <div className="absolute -top-[7px] left-2.5 z-20 px-1 bg-white leading-none">
                <span className={`text-[8px] font-extrabold uppercase tracking-widest ${type === 'income' ? 'text-green-600' : type === 'transfer' ? 'text-blue-500' : 'text-slate-400'}`}>
                    {label}
                </span>
            </div>

            {/* TRIGGER TOMBOL */}
            <div 
                onClick={() => setIsOpen(!isOpen)}
                className={`relative flex items-center justify-between w-full px-2 rounded-lg border cursor-pointer transition-all bg-white h-9 ${isOpen ? 'border-indigo-500 ring-1 ring-indigo-100' : 'border-slate-300 hover:border-indigo-400'}`}
            >
                <div className="flex items-center gap-2 overflow-hidden w-full">
                    <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${type === 'income' ? 'bg-green-50 text-green-600' : 'bg-slate-50 text-slate-500'}`}>
                         {type === 'income' ? <ArrowDownLeft size={12}/> : 
                         (selectedWallet?.name?.toLowerCase().includes('bca') ? <Landmark size={12}/> : <Wallet size={12}/>)}
                    </div>

                    <div className="flex items-center justify-between w-full min-w-0 pr-6">
                        <span className={`text-[11px] truncate font-bold ${selectedWallet ? 'text-slate-700' : 'text-slate-400'}`}>
                            {selectedWallet ? (isNew ? `✨ ${selectedWallet.name}` : selectedWallet.name) : placeholder}
                        </span>
                        {!isNew && selectedWallet && (
                            <span className="text-[9px] text-slate-400 font-mono shrink-0 ml-1">
                                {new Intl.NumberFormat('id-ID', { compactDisplay: "short", notation: "compact", style: 'currency', currency: 'IDR' }).format(selectedWallet.initial_balance || 0)}
                            </span>
                        )}
                    </div>
                </div>

                {/* BADGE AUTO (DI DALAM KOTAK) */}
                {isNew && (
                    <div className="absolute right-7 pointer-events-none">
                        <span className="text-[7px] font-bold text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded border border-indigo-100 animate-pulse">
                            AUTO
                        </span>
                    </div>
                )}

                <div className={`text-slate-300 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </div>
            </div>

            {/* LIST DROPDOWN */}
            {isOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-48 overflow-y-auto animate-in fade-in zoom-in-95 duration-100 scrollbar-hide p-1 z-[9999]">
                    {wallets.map((w) => (
                        <div 
                            key={w.id} 
                            onClick={() => { onChange(w.id); setIsOpen(false); }}
                            className={`p-2 rounded-lg hover:bg-slate-50 cursor-pointer flex justify-between items-center mb-0.5 ${value === w.id ? 'bg-slate-100' : ''}`}
                        >
                            <div className="flex items-center gap-2 overflow-hidden">
                                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${value === w.id ? 'bg-indigo-500' : 'bg-slate-300'}`}></div>
                                <span className={`text-[11px] truncate ${value === w.id ? 'font-bold text-indigo-900' : 'font-medium text-slate-700'}`}>{w.name}</span>
                            </div>
                            <span className="text-[9px] text-slate-400 font-mono">
                                {new Intl.NumberFormat('id-ID', { compactDisplay: "short", notation: "compact", style: 'currency', currency: 'IDR' }).format(w.initial_balance || 0)}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default function VoiceSim() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // STATE UTAMA
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState(''); 
  const [status, setStatus] = useState('idle'); 
  const [aiResult, setAiResult] = useState(null); 
  const [saving, setSaving] = useState(false);

  // STATE DETEKSI TAGIHAN
  const [matchedBill, setMatchedBill] = useState(null); 
  const [linkToBill, setLinkToBill] = useState(true);

  // STATE MODE & AKUN
  const [activeMode, setActiveMode] = useState('PERSONAL'); 
  const [userAccountType, setUserAccountType] = useState('personal'); 
  
  // STATE WALLET
  const [userWallets, setUserWallets] = useState([]);

  // KATEGORI DINAMIS
  const DEFAULT_CATEGORIES = [
      'Makanan', 'Transport', 'Belanja', 'Tagihan', 'Hiburan', 'Kesehatan', 'Lainnya',
      'Gaji', 'Bonus', 'Hadiah', 'Penjualan', 'Investasi', 'Saldo Awal'
  ];
  const [categoryList, setCategoryList] = useState(DEFAULT_CATEGORIES);

  const recognitionRef = useRef(null);

  useEffect(() => {
    if (user) {
        fetchUserModeAndProfile();
        fetchUserBudgets();
        fetchWallets(); 
    }
  }, [user]);

  const fetchUserModeAndProfile = async () => {
    const { data } = await supabase.from('profiles').select('account_type').eq('id', user.id).single();
    if (data) {
        setUserAccountType(data.account_type); 
        const savedMode = localStorage.getItem('app_mode') || 'PERSONAL'; 
        setActiveMode(savedMode);
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
      } catch (error) { console.error("Gagal load budget", error); }
  };

  const fetchWallets = async () => {
      try {
        const { data } = await supabase.from('wallets').select('id, name, initial_balance').eq('user_id', user.id).eq('allocation_type', activeMode);
        setUserWallets(data || []);
      } catch (error) { console.error("Error fetching wallets", error); }
  };

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

      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = async () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
    } else {
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
      setMatchedBill(null); 
      setStatus('listening');
      if (recognitionRef.current) recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleProcessAI = async () => {
    if (!transcript.trim()) { alert("Belum ada suara masuk!"); return; }
    if (isListening) { if (recognitionRef.current) recognitionRef.current.stop(); setIsListening(false); }

    setStatus('processing');
    setMatchedBill(null); 

    try {
      const aiResponseArray = await processVoiceInput(transcript, categoryList);
      const enrichedResult = aiResponseArray.map(aiItem => {
          
          const resolveWallet = (nameFromAI, transactionType, isSource) => {
              if (nameFromAI) {
                  const found = userWallets.find(w => w.name.toLowerCase().includes(nameFromAI.toLowerCase()));
                  if (found) return { ...found, isNew: false };
                  const properName = nameFromAI.charAt(0).toUpperCase() + nameFromAI.slice(1);
                  return { id: null, name: properName, isNew: true };
              }
              if (!nameFromAI && isSource && transactionType === 'expense') {
                  const cashWallet = userWallets.find(w => ['tunai', 'cash', 'dompet'].includes(w.name.toLowerCase()));
                  if (cashWallet) return { ...cashWallet, isNew: false };
                  if (userWallets.length > 0) return { ...userWallets[0], isNew: false };
                  return { id: null, name: 'Tunai', isNew: true };
              }
              return null;
          };

          const type = aiItem.type || 'expense';
          let finalSource = resolveWallet(aiItem.source_wallet, type, true);
          let finalDest = resolveWallet(aiItem.destination_wallet, type, false);

          if (type === 'income' && !finalSource && finalDest) {
              finalSource = finalDest;
              finalDest = null;
          }

          return {
              ...aiItem,
              merchant: aiItem.merchant || (type === 'income' ? 'Pemasukan' : 'Transaksi'),
              date: aiItem.date || new Date().toISOString().split('T')[0],
              type: type,
              category: aiItem.category || 'Lainnya',
              total_amount: aiItem.total_amount || 0,
              allocation_type: (activeMode === 'BUSINESS' || activeMode === 'ORGANIZATION') ? 'BUSINESS' : 'PERSONAL',
              sourceWallet: finalSource,
              destWallet: finalDest
          };
      });

      setAiResult(enrichedResult);
      setStatus('success');

      if (enrichedResult.length > 0) {
          const bill = await findMatchingBill(user.id, enrichedResult[0]);
          if (bill) { setMatchedBill(bill); setLinkToBill(true); }
      }
    } catch (error) {
      alert("Gagal memproses AI");
      setStatus('idle');
    }
  };

  const changeWallet = (idx, field, walletId) => {
      const updatedList = [...aiResult];
      if (walletId === 'NEW_AI_WALLET') return; 
      const selectedWallet = userWallets.find(w => w.id === walletId);
      if (selectedWallet) {
          updatedList[idx][field] = { ...selectedWallet, isNew: false };
          setAiResult(updatedList);
      }
  };

  const updateTransaction = (idx, field, val) => {
      const updatedList = [...aiResult];
      updatedList[idx][field] = val;
      setAiResult(updatedList);
  };

  const handleSave = async () => {
    if (!user || !aiResult) return;
    setSaving(true);
    let walletCache = {}; 
    userWallets.forEach(w => { walletCache[w.name.toLowerCase()] = w.id; });

    try {
      const getOrCreateWalletId = async (wObj) => {
          if (!wObj) return null;
          const key = wObj.name.toLowerCase();
          if (walletCache[key]) return walletCache[key];

          let detectedType = 'ewallet';
          if (['bca', 'mandiri', 'bri', 'bjb', 'bank'].some(k => key.includes(k))) detectedType = 'bank';

          const { data, error } = await supabase.from('wallets').insert({
              user_id: user.id, name: wObj.name, type: detectedType, 
              initial_balance: 0, allocation_type: activeMode
          }).select().single();
          
          if (error) throw error;
          walletCache[key] = data.id; 
          return data.id;
      };

      for (const txn of aiResult) {
          const sourceId = await getOrCreateWalletId(txn.sourceWallet);

          // --- LOGIC BARU: PECAH TRANSFER JADI 2 TRANSAKSI ---
          if (txn.type === 'transfer') {
              const destId = await getOrCreateWalletId(txn.destWallet);

              // 1. CATAT PENGELUARAN DI SUMBER (Keluar Duit)
              const { error: errOut } = await supabase.from('transaction_headers').insert([{
                  user_id: user.id,
                  merchant: `Transfer ke ${txn.destWallet?.name || 'Rekening'}`, 
                  total_amount: txn.total_amount,
                  type: 'expense', // Tipe jadi EXPENSE
                  allocation_type: txn.allocation_type,
                  category: 'Mutasi Saldo', // Kategori Khusus
                  date: txn.date,
                  wallet_id: sourceId, // Dompet Sumber
                  receipt_url: "Voice Input (Mutasi Out)",
                  is_ai_generated: true,
                  is_journalized: false
              }]);

              if (errOut) throw errOut;

              // 2. CATAT PEMASUKAN DI TUJUAN (Terima Duit)
              const { error: errIn } = await supabase.from('transaction_headers').insert([{
                  user_id: user.id,
                  merchant: `Terima dari ${txn.sourceWallet?.name || 'Rekening'}`, 
                  total_amount: txn.total_amount,
                  type: 'income', // Tipe jadi INCOME
                  allocation_type: txn.allocation_type,
                  category: 'Mutasi Saldo', // Kategori Khusus
                  date: txn.date,
                  wallet_id: destId, // Dompet Tujuan
                  receipt_url: "Voice Input (Mutasi In)",
                  is_ai_generated: true,
                  is_journalized: false
              }]);

              if (errIn) throw errIn;

          } else {
              // --- TRANSAKSI BIASA (INCOME / EXPENSE) ---
              const { data: headerData, error: headerError } = await supabase
                .from('transaction_headers')
                .insert([{
                  user_id: user.id,
                  merchant: txn.merchant,
                  total_amount: txn.total_amount,
                  type: txn.type,
                  allocation_type: txn.allocation_type,
                  category: txn.category, 
                  date: txn.date, 
                  wallet_id: sourceId, 
                  // Hapus destination_wallet_id
                  receipt_url: "Voice V6 (Smart Sequential)", 
                  is_ai_generated: true, 
                  is_journalized: false
                }]).select().single();

              if (headerError) throw headerError;
              
              await supabase.from('transaction_items').insert([{
                 header_id: headerData.id, name: txn.merchant, price: txn.total_amount, qty: 1
              }]);
          }
      }

      if (matchedBill && linkToBill) await markBillAsPaid(matchedBill.id);
      navigate('/dashboard');
    } catch (error) {
      alert('Gagal simpan: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 relative font-sans overflow-x-hidden">
      <div className="p-4 flex items-center justify-between bg-white shadow-sm z-10 border-b border-slate-100">
        <button onClick={() => navigate('/dashboard')} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200"><X size={20}/></button>
        <div className="flex flex-col items-center">
            <h1 className="font-bold text-lg text-slate-800">Voice Input AI</h1>
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${activeMode === 'PERSONAL' ? 'bg-pink-50 border-pink-200 text-pink-600' : 'bg-blue-50 border-blue-200 text-blue-600'}`}>
                {activeMode === 'PERSONAL' ? <User size={10} /> : <Building2 size={10} />}
                <span>Mode {activeMode === 'PERSONAL' ? 'Pribadi' : 'Bisnis'}</span>
            </div>
        </div>
        <div className="w-9"></div> 
      </div>

      <div className="flex-1 p-6 flex flex-col items-center overflow-y-auto pb-32">
        {status !== 'success' && (
            <>
                <div className="relative mb-8 mt-8">
                  {isListening && (<span className={`absolute inset-0 rounded-full animate-ping opacity-75 ${activeMode === 'PERSONAL' ? 'bg-pink-200' : 'bg-blue-200'}`}></span>)}
                  <button onClick={toggleListening} className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center shadow-xl transition-all active:scale-95 ${isListening ? 'bg-red-500 text-white scale-110 shadow-red-200' : activeMode === 'PERSONAL' ? 'bg-pink-600 text-white hover:bg-pink-700 shadow-pink-200' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'}`}>{isListening ? <Square size={32} fill="currentColor"/> : <Mic size={36}/>}</button>
                </div>
                <p className="text-slate-500 text-sm mb-6 font-medium text-center max-w-[250px]">{isListening ? 'Sedang mendengarkan...' : 'Klik mic dan bicara transaksi Anda.'}</p>
                
                <div className="w-full bg-white p-5 rounded-3xl border border-slate-200 shadow-sm mb-6 flex-1 min-h-[180px] flex flex-col relative focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                    <textarea className="w-full h-full bg-transparent outline-none text-slate-700 text-lg resize-none placeholder-slate-300 font-medium leading-relaxed" placeholder='Hasil suara muncul di sini...' value={transcript} onChange={(e) => setTranscript(e.target.value)}></textarea>
                    {transcript && (<button onClick={() => setTranscript('')} className="absolute top-2 right-2 p-1.5 bg-slate-100 rounded-full text-slate-400 hover:text-slate-600"><X size={14}/></button>)}
                </div>
                
                {transcript.length > 3 && status !== 'processing' && (<button onClick={handleProcessAI} className={`w-full py-4 text-white rounded-2xl font-bold text-lg shadow-lg hover:brightness-110 active:scale-95 flex items-center justify-center gap-2 animate-slide-up ${activeMode === 'PERSONAL' ? 'bg-pink-600 shadow-pink-200' : 'bg-blue-600 shadow-blue-200'}`}>Proses Sekarang <ArrowLeft className="rotate-180" size={20}/></button>)}
                
                {status === 'processing' && (<div className="text-center animate-pulse mt-4 flex flex-col items-center gap-2"><div className={`w-8 h-8 border-4 border-t-transparent rounded-full animate-spin ${activeMode === 'PERSONAL' ? 'border-pink-500' : 'border-blue-500'}`}></div><p className="text-slate-500 font-bold text-sm">AI sedang mencatat...</p></div>)}
            </>
        )}
      </div>

      {status === 'success' && aiResult && (
        <div className="absolute inset-0 bg-slate-50 z-20 flex flex-col animate-slide-up overflow-hidden">
           <div className="p-6 border-b shadow-sm z-10 flex justify-between items-center bg-white">
               <div><h2 className="font-extrabold text-xl text-slate-800">Konfirmasi ({aiResult.length})</h2><p className="text-xs text-slate-500">Koreksi jika ada yang kurang pas.</p></div>
               <div className="p-2 rounded-full bg-slate-100 text-indigo-600"><Sparkles size={20}/></div>
           </div>
           
           <div className="p-4 flex-1 overflow-y-auto space-y-4 pb-36">
              {matchedBill && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex items-start gap-3 mb-4 animate-fade-in-up">
                      <div className="p-2 bg-white rounded-full text-indigo-600 shadow-smshrink-0"><Link size={20}/></div>
                      <div className="flex-1">
                          <h4 className="font-bold text-indigo-900 text-sm">Tagihan Terdeteksi!</h4>
                          <p className="text-xs text-indigo-600 mt-0.5">Tandai lunas untuk <b>{matchedBill.name}</b>?</p>
                      </div>
                      <div className="flex items-center h-full"><input type="checkbox" checked={linkToBill} onChange={(e) => setLinkToBill(e.target.checked)} className="w-5 h-5 text-indigo-600 rounded"/></div>
                  </div>
              )}

              {aiResult.map((txn, idx) => (
                  <div key={idx} className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 relative overflow-visible group">
                      <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl ${txn.type === 'income' ? 'bg-green-500' : txn.type === 'transfer' ? 'bg-blue-500' : 'bg-red-500'}`}></div>
                      
                      <div className="flex justify-between items-start mb-2 pl-3">
                          <div className="flex flex-col">
                              <span className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${txn.type === 'income' ? 'text-green-500' : txn.type === 'transfer' ? 'text-blue-500' : 'text-red-500'}`}>
                                  {txn.type === 'transfer' ? 'MUTASI' : txn.type === 'income' ? 'PEMASUKAN' : 'PENGELUARAN'}
                              </span>
                              <div className="flex items-center font-bold text-xl text-slate-800">
                                  <span>Rp</span>
                                  <input type="number" value={txn.total_amount} onChange={(e) => updateTransaction(idx, 'total_amount', e.target.value)} className="bg-transparent outline-none w-32 ml-1"/>
                              </div>
                          </div>
                          <input type="date" value={txn.date} onChange={(e) => updateTransaction(idx, 'date', e.target.value)} className="text-[10px] text-slate-400 bg-transparent outline-none text-right font-medium"/>
                      </div>

                      <div className="pl-3 mb-3">
                          <input type="text" value={txn.merchant} onChange={(e) => updateTransaction(idx, 'merchant', e.target.value)} className="w-full text-sm font-medium text-slate-700 bg-slate-50 p-2 rounded-lg border-none focus:ring-1 focus:ring-blue-200" placeholder="Keterangan..."/>
                      </div>

                      <div className="pl-3 flex flex-col gap-3 mt-4 relative">
                          <WalletSelect 
                              label={txn.type === 'income' ? 'Masuk Ke' : 'Sumber'}
                              wallets={userWallets}
                              value={txn.sourceWallet?.id}
                              isNew={txn.sourceWallet?.isNew}
                              newName={txn.sourceWallet?.name}
                              placeholder="Pilih Sumber..."
                              type={txn.type}
                              onChange={(val) => changeWallet(idx, 'sourceWallet', val)}
                          />

                          {txn.type === 'transfer' && (
                              <WalletSelect 
                                  label="Tujuan"
                                  wallets={userWallets.filter(w => w.id !== txn.sourceWallet?.id)}
                                  value={txn.destWallet?.id}
                                  isNew={txn.destWallet?.isNew}
                                  newName={txn.destWallet?.name}
                                  placeholder="Pilih Tujuan..."
                                  type="transfer"
                                  onChange={(val) => changeWallet(idx, 'destWallet', val)}
                              />
                          )}
                      </div>

                      <div className="pl-3 mt-3">
                           <select value={txn.category} onChange={(e) => updateTransaction(idx, 'category', e.target.value)} className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-500 outline-none">
                              {categoryList.map(cat => (<option key={cat} value={cat}>{cat}</option>))}
                              <option value="Mutasi Saldo">Mutasi Saldo</option>
                          </select>
                      </div>
                  </div>
              ))}
           </div>

           <div className="p-5 border-t border-slate-200 bg-white sticky bottom-0 z-20 shadow-[0_-4px_10px_-1px_rgba(0,0,0,0.05)]">
               <div className="flex gap-3">
                   <button onClick={() => { setStatus('idle'); setTranscript(''); setAiResult(null); }} className="flex-1 py-3.5 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50">Ulang</button>
                   <button onClick={handleSave} disabled={saving} className={`flex-[2] py-3.5 text-white rounded-xl font-bold shadow-lg hover:brightness-110 transition flex justify-center items-center gap-2 ${activeMode === 'PERSONAL' ? 'bg-pink-600' : 'bg-blue-600'} disabled:opacity-70`}>
                       {saving ? 'Menyimpan...' : (<>Simpan Semua <CheckCircle2 size={18}/></>)}
                   </button>
               </div>
           </div>
        </div>
      )}
    </div>
  );
}