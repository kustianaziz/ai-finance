import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthProvider';
import { processVoiceInput } from '../utils/aiLogic';

export default function VoiceSim() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [status, setStatus] = useState('idle'); // idle | listening | processing | success
  const [saving, setSaving] = useState(false);
  
  const [transcript, setTranscript] = useState('');
  const [aiResults, setAiResults] = useState([]); // Perhatikan: Array (Plural)

  const recognitionRef = useRef(null);

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Browser tidak support Voice. Coba Chrome/Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'id-ID';
    recognition.continuous = false;
    
    recognition.onstart = () => {
      setStatus('listening');
      setTranscript('');
    };

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      handleProcessAI(text);
    };

    recognition.onerror = (event) => {
      console.error("Error Voice:", event.error);
      setStatus('idle');
      alert("Gagal mendengar. Coba lagi.");
    };

    recognition.start();
    recognitionRef.current = recognition;
  };

  const handleProcessAI = async (textInput) => {
    setStatus('processing');
    try {
      // Panggil AI (Sekarang balikan-nya Array)
      const results = await processVoiceInput(textInput);
      setAiResults(results);
      setStatus('success');
    } catch (error) {
      alert("AI Pusing: " + error.message);
      setStatus('idle');
    }
  };

  const handleSaveAll = async () => {
    if (!user || aiResults.length === 0) return;
    setSaving(true);
    
    try {
      // Loop semua hasil deteksi AI
      for (const txn of aiResults) {
        
        // 1. Simpan Header
        const { data: headerData, error: headerError } = await supabase
          .from('transaction_headers')
          .insert([
            {
              user_id: user.id,
              merchant: txn.merchant,
              total_amount: txn.total_amount,
              type: txn.type,
              category: txn.category,
              receipt_url: `Voice: "${transcript}"`,
              is_ai_generated: true
            }
          ])
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

      navigate('/dashboard');

    } catch (error) {
      alert('Gagal simpan: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setStatus('idle');
    setAiResults([]);
    setTranscript('');
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      
      {/* HEADER */}
      <div className="w-full px-6 py-6 flex items-center">
        <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-gray-600 font-bold hover:text-brand-600 transition">
          <div className="w-8 h-8 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm">←</div>
          <span>Kembali</span>
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
        
        {/* IDLE & LISTENING & PROCESSING (Sama kayak dulu) */}
        {status === 'idle' && (
          <>
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold text-gray-800">Voice Input V2</h2>
              <p className="text-gray-500 mt-2">Bisa multi-transaksi sekaligus!</p>
              <p className="text-xs text-brand-500 mt-4 bg-brand-50 px-3 py-1 rounded-full inline-block mx-auto max-w-[250px]">
                "Isi bensin 20 ribu di SPBU <br/> terus makan nasi goreng 15 ribu"
              </p>
            </div>
            <button onClick={startListening} className="w-24 h-24 bg-brand-500 rounded-full shadow-xl flex items-center justify-center animate-bounce cursor-pointer hover:bg-brand-600 transition ring-4 ring-brand-100">
              <span className="text-4xl">🎙️</span>
            </button>
          </>
        )}

        {status === 'listening' && (
          <div className="text-center">
            <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center animate-pulse mx-auto mb-6 border-2 border-red-100"><span className="text-4xl">👂</span></div>
            <p className="text-lg font-bold text-red-500">Mendengarkan...</p>
          </div>
        )}

        {status === 'processing' && (
          <div className="text-center">
            <div className="w-20 h-20 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
            <p className="text-brand-600 font-bold">AI sedang memilah transaksi...</p>
            <p className="text-xs text-gray-400 mt-2 italic line-clamp-2">"{transcript}"</p>
          </div>
        )}

        {/* HASIL DETEKSI (Bisa Banyak Kartu) */}
        {status === 'success' && (
          <div className="w-full max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-700">Terdeteksi: {aiResults.length} Transaksi</h3>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-bold">Gemini 1.5</span>
            </div>

            <div className="space-y-4 mb-6">
              {aiResults.map((txn, idx) => (
                <div key={idx} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-brand-500"></div>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-bold text-gray-800">{txn.merchant}</h4>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{txn.category}</span>
                    </div>
                    <span className={`font-bold ${txn.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                      {txn.type === 'income' ? '+' : '-'} Rp {txn.total_amount.toLocaleString()}
                    </span>
                  </div>
                  {/* List Item Kecil */}
                  <div className="bg-gray-50 p-2 rounded text-xs space-y-1">
                    {txn.items.map((item, i) => (
                      <div key={i} className="flex justify-between text-gray-600">
                        <span>{item.name}</span>
                        <span>{item.price.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 sticky bottom-0 bg-gray-50 pt-2">
              <button onClick={reset} disabled={saving} className="flex-1 py-3 border border-gray-300 rounded-xl text-gray-600 font-bold hover:bg-gray-100">
                Ulangi
              </button>
              <button onClick={handleSaveAll} disabled={saving} className="flex-1 py-3 bg-brand-500 text-white rounded-xl font-bold shadow-lg hover:bg-brand-600">
                {saving ? 'Menyimpan...' : `Simpan Semua (${aiResults.length})`}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}