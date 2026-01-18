import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthProvider';
import { processVoiceInput } from '../utils/aiLogic'; 
import { findMatchingBill, markBillAsPaid } from '../utils/billMatcher'; // <-- USE THE NEW MATCHER
import { ArrowLeft, Keyboard, X, User, Building2, Send, Pencil, List, Link } from 'lucide-react'; // ADDED LINK ICON

export default function ManualInputPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // STATE
  const [inputText, setInputText] = useState('');
  const [status, setStatus] = useState('idle'); 
  const [aiResult, setAiResult] = useState(null);
  const [saving, setSaving] = useState(false);

  // STATE DETEKSI TAGIHAN (NEW)
  const [matchedBill, setMatchedBill] = useState(null); 
  const [linkToBill, setLinkToBill] = useState(true);

  // STATE MODE GLOBAL
  const [activeMode, setActiveMode] = useState('PERSONAL');

  // 1. Kategori Baku (Default)
  const DEFAULT_CATEGORIES = [
      'Makanan', 'Transport', 'Belanja', 'Tagihan', 'Hiburan', 'Kesehatan', 'Lainnya'
  ];
  // 2. State untuk menampung gabungan (Default + Budget User)
  const [categoryList, setCategoryList] = useState(DEFAULT_CATEGORIES);

  useEffect(() => {
    if (user) {
        fetchUserMode();
        fetchUserBudgets(); 
    }
  }, [user]);

  const fetchUserMode = async () => {
    const savedMode = localStorage.getItem('app_mode'); 
    if (savedMode) {
        setActiveMode(savedMode);
    } else {
        const { data } = await supabase.from('profiles').select('account_type').eq('id', user.id).single();
        if (data) {
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

  // --- PROSES AI ---
  const handleProcess = async () => {
    if (!inputText.trim()) {
      alert("Ketik dulu transaksinya, Juragan!");
      return;
    }

    setStatus('processing');
    setMatchedBill(null); // Reset deteksi sebelumnya

    try {
      const result = await processVoiceInput(inputText, categoryList);
      
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

      // --- DETEKSI TAGIHAN (REVISI: CEK SEMUA ITEM) ---
      // Loop semua hasil transaksi untuk mencari kecocokan tagihan
      for (const txn of enrichedResult) {
          const bill = await findMatchingBill(user.id, txn);
          if (bill) {
              setMatchedBill(bill);
              setLinkToBill(true);
              break; // Berhenti jika sudah ketemu satu (agar UI tidak bingung)
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

  // --- SIMPAN KE DB (OPTIMIZED) ---
  const handleSave = async () => {
    if (!user || !aiResult) return;
    setSaving(true);
    
    try {
      const savePromises = aiResult.map(async (txn) => {
          
          // 1. Simpan Header
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
              receipt_url: "Manual Text V2 (Fast Mode)", 
              is_ai_generated: true,
              is_journalized: false
            }])
            .select()
            .single();

          if (headerError) throw headerError;

          // 2. Simpan Items
          if (txn.items && txn.items.length > 0) {
            const itemsToInsert = txn.items.map(item => ({
              header_id: headerData.id,
              name: item.name,
              price: item.price,
              qty: 1
            }));
            await supabase.from('transaction_items').insert(itemsToInsert);
          }
      });

      await Promise.all(savePromises);

      // --- UPDATE TAGIHAN JIKA DICENTANG (NEW) ---
      if (matchedBill && linkToBill) {
          await markBillAsPaid(matchedBill.id);
          // Optional alert
          // alert(`Tagihan ${matchedBill.name} berhasil dilunasi!`);
      }

      navigate('/dashboard');

    } catch (error) {
      console.error(error);
      alert('Gagal simpan: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // TEMA WARNA DINAMIS
  const themeColor = activeMode === 'PERSONAL' ? 'pink' : 'blue';
  const btnColor = activeMode === 'PERSONAL' ? 'bg-pink-600' : 'bg-blue-600';
  const lightBg = activeMode === 'PERSONAL' ? 'bg-pink-50' : 'bg-blue-50';
  const borderColor = activeMode === 'PERSONAL' ? 'border-pink-200' : 'border-blue-200';
  const textColor = activeMode === 'PERSONAL' ? 'text-pink-600' : 'text-blue-600';

  return (
    <div className="flex flex-col h-screen bg-slate-50 relative font-sans">
      
      {/* HEADER */}
      <div className="p-4 flex items-center justify-between bg-white shadow-sm z-10 border-b border-slate-100">
        <button onClick={() => navigate('/dashboard')} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 transition">
            <X size={20}/>
        </button>
        <div className="flex flex-col items-center">
            <h1 className="font-bold text-lg text-slate-800">Input Teks AI</h1>
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${lightBg} ${borderColor} ${textColor}`}>
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
                <div className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl shadow-xl mb-6 mt-8 ${btnColor} text-white shadow-${themeColor}-200`}>
                    <Keyboard size={36}/>
                </div>

                <p className="text-slate-500 text-sm mb-6 font-medium text-center max-w-[280px]">
                  Ketik transaksi secara natural (termasuk tanggal), AI akan merapikannya untukmu.
                </p>

                {/* TEXT AREA INPUT */}
                <div className="w-full bg-white p-5 rounded-3xl border border-slate-200 shadow-sm mb-6 flex-1 min-h-[200px] flex flex-col relative focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                    <textarea 
                        className="w-full h-full bg-transparent outline-none text-slate-700 text-lg resize-none placeholder-slate-300 font-medium leading-relaxed"
                        placeholder='Contoh: "Kemarin beli token listrik 50rb dan martabak 25rb"'
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                    ></textarea>
                    {inputText && (
                        <button onClick={() => setInputText('')} className="absolute top-2 right-2 p-1.5 bg-slate-100 rounded-full text-slate-400 hover:text-slate-600">
                            <X size={14}/>
                        </button>
                    )}
                </div>

                {/* TOMBOL PROSES */}
                <button 
                    onClick={handleProcess}
                    disabled={!inputText.trim() || status === 'processing'}
                    className={`w-full py-4 text-white rounded-2xl font-bold text-lg shadow-lg hover:brightness-110 transition active:scale-95 flex items-center justify-center gap-2 ${btnColor} disabled:bg-slate-300 disabled:cursor-not-allowed`}
                >
                    {status === 'processing' ? 'Memproses...' : 'Proses Tulisan'} 
                    {status !== 'processing' && <Send size={20}/>}
                </button>

                {/* LOADING INDICATOR */}
                {status === 'processing' && (
                    <div className="text-center animate-pulse mt-4 flex flex-col items-center gap-2">
                        <div className={`w-8 h-8 border-4 border-t-transparent rounded-full animate-spin border-${themeColor}-500`}></div>
                        <p className="text-slate-500 font-bold text-sm">AI sedang membaca tulisanmu...</p>
                    </div>
                )}
            </>
        )}
      </div>

      {/* --- HASIL AI (CARD LIST EDITABLE) --- */}
      {status === 'success' && aiResult && (
        <div className="absolute inset-0 bg-slate-50 z-20 flex flex-col animate-slide-up overflow-hidden">
           
           {/* HEADER HASIL */}
           <div className={`p-6 border-b shadow-sm z-10 flex justify-between items-center ${lightBg} ${borderColor}`}>
               <div>
                   <h2 className={`font-bold text-lg flex items-center gap-2 ${activeMode === 'PERSONAL' ? 'text-pink-800' : 'text-blue-800'}`}>
                       ✅ Hasil Deteksi ({aiResult.length})
                   </h2>
                   <p className="text-xs text-slate-500">Silakan koreksi jika ada yang salah.</p>
               </div>
               <div className={`p-2 rounded-full ${activeMode === 'PERSONAL' ? 'bg-pink-100 text-pink-600' : 'bg-blue-100 text-blue-600'}`}>
                   {activeMode === 'PERSONAL' ? <User size={20}/> : <Building2 size={20}/>}
               </div>
           </div>
           
           {/* LIST TRANSAKSI */}
           <div className="p-4 flex-1 overflow-y-auto space-y-4 pb-36">
              
              {/* CARD KONFIRMASI TAGIHAN (NEW FITUR) */}
              {matchedBill && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex items-start gap-3 animate-fade-in-up mb-4">
                      <div className="p-2 bg-white rounded-full text-indigo-600 shadow-sm shrink-0"><Link size={20}/></div>
                      <div className="flex-1">
                          <h4 className="font-bold text-indigo-900 text-sm">Terdeteksi Tagihan!</h4>
                          <p className="text-xs text-indigo-600 mt-0.5 leading-relaxed">
                              Transaksi ini mirip dengan tagihan <b>{matchedBill.name}</b>. Mau tandai sebagai lunas sekalian?
                          </p>
                      </div>
                      <div className="flex items-center h-full">
                          <input type="checkbox" checked={linkToBill} onChange={(e) => setLinkToBill(e.target.checked)} className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"/>
                      </div>
                  </div>
              )}

              {aiResult.map((txn, idx) => (
                  <div key={idx} className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5 transition-all focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-300">
                      
                      {/* BARIS 1: MERCHANT, DATE & AMOUNT */}
                      <div className="flex justify-between items-start mb-4">
                          <div className="w-[60%]">
                              <input 
                                type="text" 
                                value={txn.merchant}
                                onChange={(e) => updateTransaction(idx, 'merchant', e.target.value)}
                                className="font-bold text-slate-800 text-lg border-b border-transparent focus:border-blue-500 outline-none w-full bg-transparent"
                                placeholder="Nama Item/Toko"
                              />
                              <input 
                                  type="date" 
                                  value={txn.date}
                                  onChange={(e) => updateTransaction(idx, 'date', e.target.value)}
                                  className="text-xs text-slate-400 mt-1 bg-transparent outline-none font-medium"
                              />
                          </div>
                          <p className="font-bold text-xl text-slate-800">
                              Rp {txn.total_amount.toLocaleString()}
                          </p>
                      </div>

                      {/* BARIS 2: TIPE, KATEGORI & ALOKASI */}
                      <div className="flex flex-col gap-3 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                          
                          <div className="flex justify-between items-center mb-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                                  Kategori {txn.isManualCategory ? '(Manual)' : '(Otomatis)'}
                              </label>
                              
                              <button 
                                  onClick={() => toggleCategoryMode(idx)}
                                  className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-indigo-600 transition shadow-sm"
                                  title={txn.isManualCategory ? "Ganti ke Pilihan" : "Ketik Manual"}
                              >
                                  {txn.isManualCategory ? <List size={12}/> : <Pencil size={12}/>}
                              </button>
                          </div>

                          {txn.isManualCategory ? (
                              <input 
                                  type="text"
                                  value={txn.category}
                                  onChange={(e) => updateTransaction(idx, 'category', e.target.value)}
                                  className="w-full p-2 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-700 font-bold text-sm outline-none placeholder-indigo-300"
                                  placeholder="Ketik kategori..."
                              />
                          ) : (
                              <select 
                                  value={txn.category} 
                                  onChange={(e) => updateTransaction(idx, 'category', e.target.value)}
                                  className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-700 font-bold text-sm outline-none"
                              >
                                  {categoryList.map(cat => (
                                      <option key={cat} value={cat}>{cat}</option>
                                  ))}
                              </select>
                          )}

                          {/* SWITCH TYPE & ALOKASI */}
                          <div className="flex gap-2 bg-white p-1 rounded-lg border border-slate-100 mt-2">
                              <button onClick={() => updateTransaction(idx, 'type', 'expense')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${txn.type === 'expense' ? 'bg-red-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Keluar</button>
                              <button onClick={() => updateTransaction(idx, 'type', 'income')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${txn.type === 'income' ? 'bg-green-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Masuk</button>
                          </div>

                          <div className="relative mt-1">
                              <select 
                                value={txn.allocation_type}
                                onChange={(e) => updateTransaction(idx, 'allocation_type', e.target.value)}
                                className={`w-full p-2.5 pl-3 rounded-lg border font-bold text-sm outline-none appearance-none ${
                                    txn.allocation_type === 'BUSINESS' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                    txn.allocation_type === 'PERSONAL' ? 'bg-pink-50 text-pink-700 border-pink-200' :
                                    'bg-orange-50 text-orange-700 border-orange-200'
                                }`}
                              >
                                 {activeMode === 'BUSINESS' ? (
                                     <>
                                         <option value="BUSINESS">🏢 Operasional Toko</option>
                                         <option value="SALARY">💰 Ambil Gaji Owner</option>
                                     </>
                                 ) : (
                                     <>
                                         <option value="PERSONAL">🏠 Belanja Pribadi</option>
                                         <option value="PRIVE">💸 Prive (Ambil Kas Toko)</option>
                                     </>
                                 )}
                              </select>
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">▼</div>
                          </div>
                      </div>
                  </div>
              ))}
           </div>

           {/* FOOTER */}
           <div className="p-5 border-t border-slate-200 bg-white sticky bottom-0 shadow-[0_-4px_10px_-1px_rgba(0,0,0,0.05)] z-20">
               <div className="flex gap-3">
                   <button onClick={() => { setStatus('idle'); setAiResult(null); }} className="flex-1 py-3.5 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition">Ulang</button>
                   <button onClick={handleSave} disabled={saving} className={`flex-[2] py-3.5 text-white rounded-xl font-bold shadow-lg hover:brightness-110 transition flex justify-center items-center gap-2 ${btnColor}`}>
                       {saving ? 'Menyimpan...' : 'Simpan Semua'}
                   </button>
               </div>
           </div>
        </div>
      )}
    </div>
  );
}