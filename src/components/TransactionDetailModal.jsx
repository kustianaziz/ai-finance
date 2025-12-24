export default function TransactionDetailModal({ transaction, items, onClose, loading }) {
  if (!transaction) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      {/* Kartu Modal */}
      <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-slide-up relative">
         
         {/* Tombol Close */}
         <button 
           onClick={onClose} 
           className="absolute top-4 right-4 bg-gray-100 text-gray-500 w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-100 hover:text-red-500 transition z-10"
         >
           ✕
         </button>

         {/* Header Struk */}
         <div className="bg-gray-50 p-6 text-center border-b border-gray-100 border-dashed">
            <div className={`w-12 h-12 rounded-2xl mx-auto flex items-center justify-center text-2xl mb-3 shadow-sm ${transaction.type === 'income' ? 'bg-green-100' : 'bg-red-100'}`}>
               {transaction.type === 'income' ? '💰' : '🛒'}
            </div>
            <h2 className="text-xl font-bold text-gray-800">{transaction.merchant || 'Tanpa Nama Toko'}</h2>
            <p className="text-xs text-gray-400 mt-1 uppercase tracking-wide">{transaction.category} • {new Date(transaction.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            
            <h1 className={`text-3xl font-bold mt-4 ${transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                 {transaction.type === 'income' ? '+' : '-'} Rp {transaction.total_amount.toLocaleString('id-ID')}
            </h1>
         </div>

         {/* Body: List Items */}
         <div className="p-6 bg-white relative">
            {/* Hiasan Bergerigi Struk (Opsional) */}
            <div className="absolute top-0 left-0 right-0 h-4 bg-gray-50" style={{clipPath: "polygon(0 0, 5% 100%, 10% 0, 15% 100%, 20% 0, 25% 100%, 30% 0, 35% 100%, 40% 0, 45% 100%, 50% 0, 55% 100%, 60% 0, 65% 100%, 70% 0, 75% 100%, 80% 0, 85% 100%, 90% 0, 95% 100%, 100% 0)"}}></div>

            <h4 className="text-xs font-bold text-gray-400 uppercase mb-4 mt-2">Rincian Belanja</h4>
            
            {loading ? (
               <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
               </div>
            ) : items.length === 0 ? (
               <div className="text-center py-6 bg-gray-50 rounded-xl border border-gray-100 border-dashed">
                  <p className="text-sm text-gray-400 italic">Tidak ada rincian item.</p>
                  <p className="text-[10px] text-gray-300 mt-1">(Transaksi manual / belum ada detail)</p>
               </div>
            ) : (
               <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1 custom-scrollbar">
                  {items.map((item, idx) => (
                     <div key={idx} className="flex justify-between items-start text-sm group">
                        <div className="flex items-start gap-3">
                           <span className="text-gray-300 font-bold text-xs mt-0.5">{idx + 1}.</span>
                           <div>
                              <p className="font-bold text-gray-700 leading-tight">{item.name}</p>
                              {item.qty > 1 && <p className="text-xs text-gray-400">x{item.qty}</p>}
                           </div>
                        </div>
                        <div className="text-right">
                           <p className="font-medium text-gray-800">Rp {item.price.toLocaleString()}</p>
                        </div>
                     </div>
                  ))}
                  
                  <div className="border-t border-gray-100 mt-4 pt-3 flex justify-between items-center">
                     <span className="font-bold text-gray-500 text-xs">Total Item</span>
                     <span className="font-bold text-gray-800 text-sm">{items.length} Barang</span>
                  </div>
               </div>
            )}
         </div>

         {/* Footer */}
         <div className="p-4 bg-gray-50 border-t border-gray-100">
            <button onClick={onClose} className="w-full py-3 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-100 transition shadow-sm">
               Tutup
            </button>
         </div>
      </div>
    </div>
  );
}