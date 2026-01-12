import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthProvider';
import { processVoiceInput } from '../utils/aiLogic';
import { checkUsageLimit } from '../utils/subscriptionLogic';

export default function VoiceSim() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // State
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState(''); // Teks hasil ucapan
  const [status, setStatus] = useState('idle'); // idle, listening, processing, success
  const [aiResult, setAiResult] = useState(null);
  const [saving, setSaving] = useState(false);

  // Ref untuk Speech Recognition
  const recognitionRef = useRef(null);

  useEffect(() => {
    // Inisialisasi Speech API saat komponen dimuat
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.lang = 'id-ID'; // Bahasa Indonesia
      recognition.continuous = true; // PENTING: Mic tetap nyala sampai tombol stop ditekan
      
      // --- PERUBAHAN PENTING DI SINI ---
      // Matikan interimResults biar Android gak bingung dan bikin teks double
      recognition.interimResults = false; 

      recognition.onresult = (event) => {
        // Ambil potongan teks TERAKHIR yang baru saja selesai diucapkan
        const lastResultIndex = event.results.length - 1;
        const transcriptChunk = event.results[lastResultIndex][0].transcript.trim();

        // Gabungkan ke teks yang sudah ada di layar (Append)
        if (transcriptChunk) {
            setTranscript(prevText => {
                // Kalau sebelumnya kosong, langsung isi. Kalau ada isinya, tambah spasi dulu.
                return prevText ? `${prevText} ${transcriptChunk}` : transcriptChunk;
            });
        }
      };

      recognition.onerror = (event) => {
        console.error('Speech Error:', event.error);
        if (event.error === 'no-speech') {
            return; // Abaikan error kalau cuma diam
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        // Kalau mati sendiri, update status UI
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } else {
      alert("Browser/HP ini gak support fitur suara.");
    }
  }, []);

  // --- 1. TOGGLE MIC (ON/OFF) ---
  const toggleListening = async () => {
    if (isListening) {
      // STOP DENGAR
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
    } else {
      // START DENGAR
      // Cek Kuota Dulu
      const limitCheck = await checkUsageLimit(user.id, 'VOICE');
      if (!limitCheck.allowed) {
        if(window.confirm(limitCheck.message + "\nMau upgrade sekarang?")) {
            navigate('/upgrade');
        }
        return;
      }

      setTranscript(''); // Reset teks lama kalau mulai baru
      setAiResult(null); // Reset hasil AI lama
      setStatus('listening');
      if (recognitionRef.current) recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // --- 2. PROSES KE AI (MANUAL TRIGGER) ---
  const handleProcessAI = async () => {
    if (!transcript.trim()) {
      alert("Belum ada suara yang masuk, Gan!");
      return;
    }

    // Stop mic kalau masih nyala
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
    }

    setStatus('processing');

    try {
      const result = await processVoiceInput(transcript);
      setAiResult(result);
      setStatus('success');
    } catch (error) {
      alert("Gagal memproses: " + error.message);
      setStatus('idle');
    }
  };

  // --- 3. SIMPAN KE DATABASE ---
  const handleSave = async () => {
    if (!user || !aiResult) return;
    setSaving(true);
    
    try {
      // Loop karena AI bisa balikin banyak transaksi sekaligus
      for (const txn of aiResult) {
        // 1. Simpan Header
        const { data: headerData, error: headerError } = await supabase
          .from('transaction_headers')
          .insert([{
            user_id: user.id,
            merchant: txn.merchant,
            total_amount: txn.total_amount,
            type: txn.type,
            category: txn.category,
            receipt_url: "Voice Input V3",
            is_ai_generated: true
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

          const { error: itemsError } = await supabase
            .from('transaction_items')
            .insert(itemsToInsert);
          
          if (itemsError) throw itemsError;
        }
      }

      alert("Data berhasil disimpan! 🎉");
      navigate('/dashboard');

    } catch (error) {
      console.error(error);
      alert('Gagal simpan: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white relative">
      
      {/* HEADER */}
      <div className="p-6 flex items-center justify-between bg-white shadow-sm z-10">
        <button onClick={() => navigate('/dashboard')} className="p-2 bg-gray-100 rounded-full text-gray-600">
          ✕
        </button>
        <h1 className="font-bold text-gray-800">Voice Input</h1>
        <div className="w-8"></div>
      </div>

      {/* CONTENT AREA */}
      <div className="flex-1 p-6 flex flex-col items-center">
        
        {/* VISUALISASI MIC */}
        <div className="relative mb-8 mt-10">
          {isListening && (
            <div className="absolute inset-0 bg-brand-200 rounded-full animate-ping opacity-75"></div>
          )}
          <button 
            onClick={toggleListening}
            className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center text-4xl shadow-xl transition-all ${
              isListening ? 'bg-red-500 text-white scale-110' : 'bg-brand-600 text-white hover:scale-105'
            }`}
          >
            {isListening ? '⏹' : '🎙️'}
          </button>
        </div>

        <p className="text-gray-500 text-sm mb-4 font-medium text-center">
          {isListening ? 'Sedang mendengarkan... (Klik tombol merah untuk stop)' : 'Klik mic dan mulai bicara santai'}
        </p>

        {/* AREA TEKS (EDITABLE) */}
        <div className="w-full bg-gray-50 p-4 rounded-2xl border border-gray-200 mb-6 flex-1 max-h-[200px] overflow-hidden flex flex-col">
            <textarea 
                className="w-full h-full bg-transparent outline-none text-gray-700 text-lg resize-none placeholder-gray-300"
                placeholder='Contoh: "Beli nasi goreng 15 ribu sama es teh 5 ribu di warung pak kumis"'
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)} // User bisa edit manual
            ></textarea>
        </div>

        {/* TOMBOL PROSES (Hanya muncul kalau ada teks) */}
        {transcript.length > 5 && status !== 'processing' && status !== 'success' && (
            <button 
                onClick={handleProcessAI}
                className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold text-lg shadow-lg hover:bg-black transition animate-fade-in-up"
            >
                ⚡ Proses Sekarang
            </button>
        )}

        {/* LOADING STATE */}
        {status === 'processing' && (
             <div className="text-center animate-pulse">
                <p className="text-brand-600 font-bold text-lg">🤖 AI sedang berpikir...</p>
                <p className="text-gray-400 text-xs">Menganalisa konteks & kategori</p>
             </div>
        )}
      </div>

      {/* HASIL AI & TOMBOL SIMPAN (Overlay Slide Up) */}
      {status === 'success' && aiResult && (
        <div className="absolute inset-0 bg-white z-20 flex flex-col animate-slide-up overflow-y-auto">
           <div className="p-6 bg-brand-50 border-b border-brand-100">
               <h2 className="font-bold text-brand-800 text-lg flex items-center gap-2">
                   ✅ Hasil Deteksi
               </h2>
               <p className="text-xs text-brand-600">Cek dulu sebelum disimpan ya.</p>
           </div>
           
           <div className="p-6 flex-1 space-y-4">
              {aiResult.map((txn, idx) => (
                  <div key={idx} className="bg-white border border-gray-200 shadow-sm rounded-xl p-4">
                      <div className="flex justify-between items-start mb-2">
                          <div>
                              <p className="font-bold text-gray-800 text-lg">{txn.merchant || 'Tanpa Nama'}</p>
                              <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${txn.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                  {txn.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                              </span>
                          </div>
                          <p className="font-bold text-xl text-brand-600">Rp {txn.total_amount.toLocaleString()}</p>
                      </div>
                      
                      <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                          {txn.items.map((item, i) => (
                              <div key={i} className="flex justify-between text-sm text-gray-600">
                                  <span>{item.name}</span>
                                  <span>{item.price.toLocaleString()}</span>
                              </div>
                          ))}
                      </div>
                  </div>
              ))}
           </div>

           <div className="p-6 border-t border-gray-100 bg-white sticky bottom-0">
               <div className="flex gap-3">
                   <button 
                     onClick={() => { setStatus('idle'); setTranscript(''); setAiResult(null); }}
                     className="flex-1 py-3 border border-gray-300 text-gray-600 rounded-xl font-bold hover:bg-gray-50"
                   >
                     Ulang
                   </button>
                   <button 
                     onClick={handleSave}
                     disabled={saving}
                     className="flex-[2] py-3 bg-brand-600 text-white rounded-xl font-bold shadow-lg hover:bg-brand-700"
                   >
                     {saving ? 'Menyimpan...' : 'Simpan Data ✅'}
                   </button>
               </div>
           </div>
        </div>
      )}
    </div>
  );
}