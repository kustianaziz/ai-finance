import React from 'react';

export default function ModalInfo({ isOpen, type, title, message, onClose, onConfirm, confirmText = "Oke" }) {
  if (!isOpen) return null;

  // Tentukan Warna & Icon berdasarkan Tipe
  let icon = "ℹ️";
  let colorClass = "bg-blue-500";
  let bgIconClass = "bg-blue-50 text-blue-500";
  
  if (type === 'success') {
    icon = "✅";
    colorClass = "bg-green-500";
    bgIconClass = "bg-green-50 text-green-600";
  } else if (type === 'error') {
    icon = "❌";
    colorClass = "bg-red-500";
    bgIconClass = "bg-red-50 text-red-500";
  } else if (type === 'loading') {
    icon = "⏳";
    colorClass = "bg-gray-500";
    bgIconClass = "bg-gray-50 text-gray-500";
  }

  return (
    // Backdrop Blur (Background Gelap)
    <div className="absolute inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in px-6">
      
      {/* Kartu Modal */}
      <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 flex flex-col items-center text-center animate-scale-up border border-gray-100">
        
        {/* Icon Besar */}
        <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl mb-4 ${bgIconClass}`}>
           {type === 'loading' ? (
             <div className="w-8 h-8 border-4 border-current border-t-transparent rounded-full animate-spin"></div>
           ) : icon}
        </div>

        {/* Judul */}
        <h3 className="text-xl font-bold text-gray-800 mb-2">
          {title}
        </h3>

        {/* Pesan (Bisa HTML) */}
        <div className="text-sm text-gray-500 mb-6 leading-relaxed" dangerouslySetInnerHTML={{ __html: message }}></div>

        {/* Tombol Action */}
        {type !== 'loading' && (
             <button 
               onClick={() => {
                   if (onConfirm) onConfirm();
                   onClose();
               }}
               className={`w-full py-3.5 rounded-xl font-bold text-white shadow-lg active:scale-95 transition ${colorClass}`}
             >
               {confirmText}
             </button>
        )}

      </div>
    </div>
  );
}