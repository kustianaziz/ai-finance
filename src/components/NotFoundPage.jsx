import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Construction } from 'lucide-react';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 max-w-sm">
        <div className="w-20 h-20 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <Construction size={40} />
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900 mb-2">Fitur Belum Tersedia</h2>
        <p className="text-slate-500 mb-8">
          Sabar ya Juragan! Fitur ini sedang dikerjakan oleh developer ganteng kami. 👨‍💻
        </p>
        <button 
          onClick={() => navigate(-1)} // Balik ke halaman sebelumnya
          className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition"
        >
          <ArrowLeft size={20}/> Kembali
        </button>
      </div>
    </div>
  );
}