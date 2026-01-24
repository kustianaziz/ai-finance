import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthProvider';
import { processImageInput } from '../utils/aiLogic';
import { checkUsageLimit } from '../utils/subscriptionLogic';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { 
  ArrowLeft, Repeat, Check, X, Building2, User, Link, 
  PlusCircle, CheckCircle2, Wallet, ArrowRight, Landmark, ArrowDownLeft 
} from 'lucide-react';
import { findMatchingBill, markBillAsPaid } from '../utils/billMatcher';

// --- KOMPONEN DROPDOWN COMPACT (SAMA DENGAN MANUAL INPUT) ---
const WalletSelect = ({ wallets, value, onChange, isNew, newName, placeholder, type, label }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef(null);
    const selectedWallet = isNew ? { id: 'NEW', name: newName, isNew: true } : wallets.find(w => w.id === value);

    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setIsOpen(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    return (
        <div className={`relative w-full font-sans ${isOpen ? 'z-[100]' : 'z-10'}`} ref={wrapperRef}>
            <div className="absolute -top-[7px] left-2.5 z-20 px-1 bg-white leading-none">
                <span className={`text-[8px] font-extrabold uppercase tracking-widest ${type === 'income' ? 'text-green-600' : type === 'transfer' ? 'text-blue-500' : 'text-slate-400'}`}>
                    {label}
                </span>
            </div>
            <div onClick={() => setIsOpen(!isOpen)} className={`relative flex items-center justify-between w-full px-2 rounded-lg border cursor-pointer transition-all bg-white h-9 ${isOpen ? 'border-indigo-500 ring-1 ring-indigo-100' : 'border-slate-300 hover:border-indigo-400'}`}>
                <div className="flex items-center gap-2 overflow-hidden w-full">
                    <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${type === 'income' ? 'bg-green-50 text-green-600' : 'bg-slate-50 text-slate-500'}`}>
                         {type === 'income' ? <ArrowDownLeft size={12}/> : (selectedWallet?.name?.toLowerCase().includes('bca') ? <Landmark size={12}/> : <Wallet size={12}/>)}
                    </div>
                    <div className="flex items-center justify-between w-full min-w-0 pr-6">
                        <span className={`text-[11px] truncate font-bold ${selectedWallet ? 'text-slate-700' : 'text-slate-400'}`}>{selectedWallet ? (isNew ? `✨ ${selectedWallet.name}` : selectedWallet.name) : placeholder}</span>
                        {!isNew && selectedWallet && <span className="text-[9px] text-slate-400 font-mono shrink-0 ml-1">{new Intl.NumberFormat('id-ID', { compactDisplay: "short", notation: "compact", style: 'currency', currency: 'IDR' }).format(selectedWallet.initial_balance || 0)}</span>}
                    </div>
                </div>
                {isNew && <div className="absolute right-7 pointer-events-none"><span className="text-[7px] font-bold text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded border border-indigo-100 animate-pulse">AUTO</span></div>}
                <div className={`text-slate-300 ml-1 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m6 9 6 6 6-6"/></svg></div>
            </div>
            {isOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-48 overflow-y-auto animate-in fade-in zoom-in-95 duration-100 p-1 z-[9999]">
                    {wallets.map((w) => (
                        <div key={w.id} onClick={() => { onChange(w.id); setIsOpen(false); }} className={`p-2 rounded-lg hover:bg-slate-50 cursor-pointer flex justify-between items-center mb-0.5 ${value === w.id ? 'bg-slate-100' : ''}`}>
                            <div className="flex items-center gap-2 overflow-hidden"><div className={`w-1.5 h-1.5 rounded-full shrink-0 ${value === w.id ? 'bg-indigo-500' : 'bg-slate-300'}`}></div><span className={`text-[11px] truncate ${value === w.id ? 'font-bold text-indigo-900' : 'font-medium text-slate-700'}`}>{w.name}</span></div>
                            <span className="text-[9px] text-slate-400 font-mono">{new Intl.NumberFormat('id-ID', { compactDisplay: "short", notation: "compact", style: 'currency', currency: 'IDR' }).format(w.initial_balance || 0)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default function ScanSim() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [status, setStatus] = useState('idle'); 
  const [imagePreview, setImagePreview] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [matchedBill, setMatchedBill] = useState(null); 
  const [linkToBill, setLinkToBill] = useState(true);
  const [activeMode, setActiveMode] = useState('PERSONAL'); 
  const [userAccountType, setUserAccountType] = useState('personal'); 
  const [userWallets, setUserWallets] = useState([]); 
  const [categoryList, setCategoryList] = useState(['Makanan', 'Transport', 'Belanja', 'Tagihan', 'Hiburan', 'Kesehatan', 'Lainnya', 'Gaji', 'Bonus', 'Saldo Awal']);

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
        setActiveMode(localStorage.getItem('app_mode') || 'PERSONAL');
    }
  };

  const fetchUserBudgets = async () => {
      try {
          const { data } = await supabase.from('budgets').select('category').eq('user_id', user.id);
          if (data && data.length > 0) {
              const merged = [...new Set([...categoryList, ...data.map(b => b.category)])].map(s => s.charAt(0).toUpperCase() + s.slice(1));
              setCategoryList(merged);
          }
      } catch (error) { console.error(error); }
  };

  const fetchWallets = async () => {
      try {
        const { data } = await supabase.from('wallets').select('id, name, initial_balance').eq('user_id', user.id).eq('allocation_type', activeMode);
        setUserWallets(data || []);
      } catch (error) { console.error(error); }
  };

  const handleNativeCamera = async (sourceMode) => {
    const isVip = ['business', 'organization', 'personal_pro'].includes(userAccountType);
    if (!isVip) {
        const limitCheck = await checkUsageLimit(user.id, 'SCAN');
        if (!limitCheck.allowed) { if (window.confirm(limitCheck.message + "\nMau upgrade?")) navigate('/upgrade'); return; }
    }
    try {
      const image = await Camera.getPhoto({ quality: 50, resultType: CameraResultType.Base64, width: 800, source: sourceMode === 'camera' ? CameraSource.Camera : CameraSource.Photos });
      setImageBase64(image.base64String);
      setImagePreview(`data:image/jpeg;base64,${image.base64String}`);
      setStatus('preview');
    } catch (e) { console.log(e); }
  };

  const handleAnalyze = async () => {
    if (!imageBase64) return;
    setStatus('processing');
    try {
      const result = await processImageInput(imageBase64, 'image/jpeg', categoryList);
      
      // --- SMART WALLET MATCHER (FIXED) ---
      const resolveWallet = (nameFromAI) => {
          if (!nameFromAI) return null;
          
          // 1. Fungsi Bersih-bersih Nama
          // Hapus kata 'bank', 'pt', spasi, dan ubah ke lowercase
          const cleanName = (str) => str.toLowerCase().replace(/\b(bank|pt|tbk)\b/g, '').trim();
          
          const aiClean = cleanName(nameFromAI);

          // 2. Cari yang COCOK
          const found = userWallets.find(w => {
              const wClean = cleanName(w.name);
              // Cek apakah 'bjb' ada di 'bjb' (Exact) ATAU saling mengandung
              return wClean === aiClean || wClean.includes(aiClean) || aiClean.includes(wClean);
          });

          // 3. Jika ketemu, pakai yang ada. Jika tidak, buat baru dengan nama rapi.
          if (found) return { ...found, isNew: false };
          
          // Format nama baru (Capitalize)
          const properName = nameFromAI.charAt(0).toUpperCase() + nameFromAI.slice(1);
          return { id: null, name: properName, isNew: true };
      };

      let finalSource = resolveWallet(result.source_wallet);
      let finalDest = resolveWallet(result.destination_wallet);
      let finalType = result.type || 'expense';

      // --- SMART LOGIC ABANG ---
      // Jika AI bilang transfer, tapi rekening tujuan TIDAK ada di data kita, jadikan EXPENSE
      if (finalType === 'transfer' && finalDest && finalDest.isNew) {
          finalType = 'expense';
          finalDest = null;
      }

      setAiResult({
          ...result,
          type: finalType,
          sourceWallet: finalSource,
          destWallet: finalDest,
          allocation_type: activeMode === 'BUSINESS' ? 'BUSINESS' : 'PERSONAL'
      });
      setStatus('success');

      const bill = await findMatchingBill(user.id, result);
      if (bill) { setMatchedBill(bill); setLinkToBill(true); }
    } catch (e) { alert(e.message); setStatus('preview'); }
  };

  const changeWallet = (field, walletId) => {
      if (walletId === 'NEW_AI_WALLET') return;
      const selected = userWallets.find(w => w.id === walletId);
      if (selected) setAiResult(prev => ({ ...prev, [field]: { ...selected, isNew: false } }));
  };

  const handleSave = async () => {
    if (!user || !aiResult) return;
    setSaving(true);
    let walletCache = {}; 
    userWallets.forEach(w => { walletCache[w.name.toLowerCase()] = w.id; });

    try {
      // 1. GET / CREATE WALLET ID
      const getOrCreateWalletId = async (wObj) => {
          if (!wObj) return null;
          const key = wObj.name.toLowerCase();
          if (walletCache[key]) return walletCache[key];
          let detectedType = 'ewallet';
          if (['bca', 'mandiri', 'bri', 'bjb', 'bank'].some(k => key.includes(k))) detectedType = 'bank';
          const { data, error } = await supabase.from('wallets').insert({ user_id: user.id, name: wObj.name, type: detectedType, initial_balance: 0, allocation_type: activeMode }).select().single();
          if (error) throw error;
          walletCache[key] = data.id; 
          return data.id;
      };

      const sourceId = await getOrCreateWalletId(aiResult.sourceWallet);

      // --- LOGIC BARU: PECAH TRANSFER JADI 2 TRANSAKSI (DOUBLE ENTRY) ---
      if (aiResult.type === 'transfer') {
          const destId = await getOrCreateWalletId(aiResult.destWallet);

          // A. CATAT PENGELUARAN DI SUMBER (Keluar Duit)
          const { error: errOut } = await supabase.from('transaction_headers').insert([{
              user_id: user.id,
              merchant: `Transfer ke ${aiResult.destWallet?.name || 'Rekening'}`, 
              total_amount: aiResult.amount,
              type: 'expense', // Tipe jadi EXPENSE agar trigger jalan (Potong Saldo)
              allocation_type: aiResult.allocation_type,
              category: 'Mutasi Saldo', // Kategori Khusus
              date: aiResult.date || new Date().toISOString(),
              wallet_id: sourceId, // Dompet Sumber
              receipt_url: "Scan Input (Mutasi Out)",
              is_ai_generated: true,
              is_journalized: false
          }]);

          if (errOut) throw errOut;

          // B. CATAT PEMASUKAN DI TUJUAN (Terima Duit)
          const { error: errIn } = await supabase.from('transaction_headers').insert([{
              user_id: user.id,
              merchant: `Terima dari ${aiResult.sourceWallet?.name || 'Rekening'}`, 
              total_amount: aiResult.amount,
              type: 'income', // Tipe jadi INCOME agar trigger jalan (Tambah Saldo)
              allocation_type: aiResult.allocation_type,
              category: 'Mutasi Saldo', 
              date: aiResult.date || new Date().toISOString(),
              wallet_id: destId, // Dompet Tujuan
              receipt_url: "Scan Input (Mutasi In)",
              is_ai_generated: true,
              is_journalized: false
          }]);

          if (errIn) throw errIn;

      } else {
          // --- TRANSAKSI BIASA (INCOME / EXPENSE) ---
          const { data: headerData, error: headerError } = await supabase.from('transaction_headers').insert([{
            user_id: user.id, 
            merchant: aiResult.merchant, 
            total_amount: aiResult.amount,
            type: aiResult.type, 
            allocation_type: aiResult.allocation_type, 
            category: aiResult.category, 
            date: aiResult.date || new Date().toISOString(), 
            wallet_id: sourceId, 
            // Hapus destination_wallet_id
            receipt_url: "Scan V13 (Smart Logic)", 
            is_ai_generated: true, 
            is_journalized: false
          }]).select().single();

          if (headerError) throw headerError;

          // Simpan Detail Item (Hanya jika bukan transfer/mutasi)
          if (aiResult.items && aiResult.items.length > 0) {
            await supabase.from('transaction_items').insert(aiResult.items.map(i => ({ header_id: headerData.id, name: i.name, price: i.price, qty: 1 })));
          }
      }

      if (matchedBill && linkToBill) await markBillAsPaid(matchedBill.id);
      navigate('/dashboard');
    } catch (e) { 
        console.error(e);
        alert('Gagal simpan: ' + e.message); 
    } finally { 
        setSaving(false); 
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white relative font-sans overflow-x-hidden">
      {/* HEADER */}
      <div className="p-4 flex items-center justify-between bg-slate-900/90 backdrop-blur-md z-20 border-b border-white/10">
        <button onClick={() => navigate('/dashboard')} className="p-2 bg-slate-800 rounded-full text-slate-300 hover:text-white transition"><X size={20} /></button>
        <div className="flex flex-col items-center">
            <h1 className="font-bold text-lg">Scan Smart AI 📸</h1>
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${activeMode === 'PERSONAL' ? 'bg-pink-500/20 border-pink-500/50 text-pink-300' : 'bg-blue-500/20 border-blue-500/50 text-blue-300'}`}>
                {activeMode === 'PERSONAL' ? <User size={10} /> : <Building2 size={10} />}
                <span>Mode {activeMode === 'PERSONAL' ? 'Pribadi' : 'Bisnis'}</span>
            </div>
        </div>
        <div className="w-9"></div> 
      </div>

      {/* CAMERA UI */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        <div className={`relative w-full aspect-[3/4] max-h-[60vh] rounded-3xl overflow-hidden border-2 flex flex-col items-center justify-center transition-all shadow-2xl ${activeMode === 'PERSONAL' ? 'bg-slate-800 border-pink-500/30' : 'bg-slate-800 border-blue-500/30'}`}>
          {status === 'idle' && (
            <div className="flex flex-col gap-4 w-full px-8 animate-fade-in-up">
               <button onClick={() => handleNativeCamera('camera')} className={`w-full py-5 rounded-2xl flex flex-col items-center justify-center gap-2 ${activeMode === 'PERSONAL' ? 'bg-pink-600' : 'bg-blue-600'}`}><span className="text-3xl">📸</span><span className="font-bold text-white text-lg">Ambil Foto</span></button>
               <button onClick={() => handleNativeCamera('photos')} className="w-full py-4 bg-slate-700/50 border border-slate-600 rounded-2xl flex items-center justify-center gap-2 transition active:scale-95"><span className="text-xl">🖼️</span><span className="font-bold text-slate-300">Pilih Galeri</span></button>
            </div>
          )}
          {(status === 'preview' || status === 'processing' || status === 'success') && imagePreview && (<img src={imagePreview} className="w-full h-full object-contain bg-black" alt="Struk Preview" />)}
          {status === 'processing' && (<div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-20"><div className={`w-14 h-14 border-4 border-t-transparent rounded-full animate-spin mb-4 ${activeMode === 'PERSONAL' ? 'border-pink-500' : 'border-blue-500'}`}></div><p className="font-bold text-white animate-pulse">AI Sedang Membaca...</p></div>)}
        </div>
        {status === 'preview' && (<div className="flex gap-3 w-full mt-6 max-w-sm animate-slide-up"><button onClick={() => setStatus('idle')} className="flex-1 py-3.5 bg-slate-800 text-slate-300 border border-slate-700 rounded-2xl font-bold flex items-center justify-center gap-2"><Repeat size={18}/> Ulang</button><button onClick={handleAnalyze} className={`flex-[2] py-3.5 text-white rounded-2xl font-bold shadow-lg flex items-center justify-center gap-2 ${activeMode === 'PERSONAL' ? 'bg-pink-600' : 'bg-blue-600'}`}>Analisa Struk</button></div>)}
      </div>

      {/* RESULT MODAL (GEN Z CARD) */}
      {status === 'success' && aiResult && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-slate-50 w-full max-w-md h-[85vh] rounded-t-[2.5rem] flex flex-col shadow-2xl overflow-hidden animate-slide-up text-slate-900">
                <div className="w-full flex justify-center pt-3 pb-1 cursor-grab"><div className="w-12 h-1.5 bg-slate-200 rounded-full"></div></div>
                <div className="px-6 pb-4 border-b border-slate-100 bg-white shadow-sm">
                    <div className="flex justify-between items-start mb-2"><div><span className={`text-[10px] font-bold uppercase tracking-wider ${aiResult.type === 'transfer' ? 'text-blue-500' : 'text-red-500'}`}>{aiResult.type === 'transfer' ? 'MUTASI' : 'PENGELUARAN'}</span><h2 className="text-xl font-extrabold truncate max-w-[200px]">{aiResult.merchant}</h2></div><div className={`px-2 py-1 rounded-lg text-xs font-bold uppercase ${activeMode === 'PERSONAL' ? 'bg-pink-50 text-pink-600' : 'bg-blue-50 text-blue-600'}`}>Mode {activeMode === 'PERSONAL' ? 'Pribadi' : 'Bisnis'}</div></div>
                    <div className="flex items-baseline gap-1"><span className="text-sm font-bold text-slate-400">Rp</span><span className="text-3xl font-extrabold">{aiResult.amount?.toLocaleString()}</span></div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {matchedBill && (
                        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-3 flex items-center gap-3"><div className="p-2 bg-white rounded-full text-indigo-600"><Link size={18}/></div><div className="flex-1 text-xs text-indigo-800 font-medium">Tandai lunas untuk <b>{matchedBill.name}</b>?</div><input type="checkbox" checked={linkToBill} onChange={(e) => setLinkToBill(e.target.checked)} className="w-5 h-5 text-indigo-600 rounded"/></div>
                    )}

                    {/* CARD TRANSAKSI (SAMA DENGAN VOICE/MANUAL) */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 overflow-visible relative">
                        <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl ${aiResult.type === 'transfer' ? 'bg-blue-500' : 'bg-red-500'}`}></div>
                        <div className="flex flex-col gap-3 relative">
                            <WalletSelect 
                                label={aiResult.type === 'income' ? 'Masuk Ke' : 'Sumber'}
                                wallets={userWallets}
                                value={aiResult.sourceWallet?.id}
                                isNew={aiResult.sourceWallet?.isNew}
                                newName={aiResult.sourceWallet?.name}
                                placeholder="Pilih Sumber..."
                                type={aiResult.type}
                                onChange={(val) => changeWallet('sourceWallet', val)}
                            />
                            {aiResult.type === 'transfer' && (
                                <WalletSelect 
                                    label="Tujuan"
                                    wallets={userWallets.filter(w => w.id !== aiResult.sourceWallet?.id)}
                                    value={aiResult.destWallet?.id}
                                    isNew={aiResult.destWallet?.isNew}
                                    newName={aiResult.destWallet?.name}
                                    placeholder="Pilih Tujuan..."
                                    type="transfer"
                                    onChange={(val) => changeWallet('destWallet', val)}
                                />
                            )}
                            <select value={aiResult.category} onChange={(e) => setAiResult(prev => ({...prev, category: e.target.value}))} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-500 outline-none">
                                {categoryList.map(cat => (<option key={cat} value={cat}>{cat}</option>))}
                            </select>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-200"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Detail Belanja</p>{aiResult.items?.map((item, idx) => (<div key={idx} className="flex justify-between py-1 border-b border-slate-50 text-xs"><span className="text-slate-600">{item.name}</span><span className="font-bold">Rp {item.price?.toLocaleString()}</span></div>))}{(!aiResult.items || aiResult.items.length === 0) && (<p className="text-center text-xs text-slate-400 py-2">Tidak ada detail.</p>)}</div>
                </div>

                <div className="p-4 bg-white border-t border-slate-100 flex gap-3"><button onClick={() => { setStatus('idle'); setAiResult(null); }} className="flex-1 py-3.5 border border-slate-200 text-slate-600 rounded-xl font-bold">Ulang</button><button onClick={handleSave} disabled={saving} className={`flex-[2] py-3.5 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition active:scale-95 ${activeMode === 'PERSONAL' ? 'bg-pink-600' : 'bg-slate-900'}`}>{saving ? 'Menyimpan...' : (<>Simpan Transaksi <CheckCircle2 size={18}/></>)}</button></div>
            </div>
        </div>
      )}
    </div>
  );
}