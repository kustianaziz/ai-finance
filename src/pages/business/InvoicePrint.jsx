import React from 'react';

const formatIDR = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

// HAPUS forwardRef. Jadi komponen biasa saja.
export const InvoicePrint = ({ invoice, storeProfile }) => {
  // Jika data belum ada, jangan render apa-apa (biar wrapper di parent yang handle)
  if (!invoice) return null;

  return (
    <div className="bg-white text-slate-900 font-sans p-8 w-full max-w-[210mm] mx-auto min-h-[297mm]">
      
      {/* HEADER */}
      <div className="flex justify-between items-start mb-8 border-b-2 border-slate-800 pb-6">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 uppercase">INVOICE</h1>
          <p className="text-sm font-bold text-slate-500 mt-2">#{invoice.invoice_number}</p>
          <div className={`mt-2 inline-block px-3 py-1 rounded border text-xs font-bold uppercase ${invoice.status === 'paid' ? 'border-green-600 text-green-700' : 'border-red-600 text-red-700'}`}>
             {invoice.status === 'paid' ? 'LUNAS' : 'BELUM LUNAS'}
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-xl font-bold">{storeProfile?.storeName || 'Toko Anda'}</h2>
          <div className="text-sm text-slate-500 mt-1 space-y-1">
             <p>{storeProfile?.address || ''}</p>
             <p>{storeProfile?.phone || ''}</p>
          </div>
        </div>
      </div>

      {/* INFO PELANGGAN */}
      <div className="flex justify-between mb-8">
        <div className="w-1/2">
          <p className="text-xs font-bold text-slate-400 uppercase mb-1">Kepada Yth:</p>
          <p className="text-lg font-bold">{invoice.customer_name}</p>
          {invoice.customer_phone && <p className="text-sm text-slate-600 mt-1">{invoice.customer_phone}</p>}
          {invoice.customer_email && <p className="text-sm text-slate-600">{invoice.customer_email}</p>}
        </div>
        <div className="w-1/2 text-right space-y-2">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Tanggal</p>
            <p className="font-medium">{invoice.issue_date ? new Date(invoice.issue_date).toLocaleDateString('id-ID', { dateStyle: 'long' }) : '-'}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Jatuh Tempo</p>
            <p className="font-medium text-red-600">{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('id-ID', { dateStyle: 'long' }) : '-'}</p>
          </div>
        </div>
      </div>

      {/* TABEL BARANG */}
      <table className="w-full mb-8 border-collapse">
        <thead>
          <tr className="border-b-2 border-slate-200 text-left">
            <th className="py-2 text-xs font-bold text-slate-500 uppercase w-[40%]">Deskripsi</th>
            <th className="py-2 text-xs font-bold text-slate-500 uppercase text-center w-[15%]">Qty</th>
            <th className="py-2 text-xs font-bold text-slate-500 uppercase text-right w-[20%]">Harga</th>
            <th className="py-2 text-xs font-bold text-slate-500 uppercase text-right w-[25%]">Total</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items?.map((item, idx) => (
            <tr key={idx} className="border-b border-slate-100">
              <td className="py-3 pr-2">
                <p className="font-bold text-sm text-slate-800">{item.item_name}</p>
                {(item.category === 'Manual' || item.product_id === null) && <span className="text-[10px] text-slate-400 italic">(Custom Item)</span>}
              </td>
              <td className="py-3 text-center text-sm">{item.quantity}</td>
              <td className="py-3 text-right text-sm text-slate-600">{formatIDR(item.price)}</td>
              <td className="py-3 text-right text-sm font-bold">{formatIDR(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* TOTAL SUMMARY */}
      <div className="flex justify-end mb-12">
        <div className="w-1/2 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Subtotal</span>
            <span className="font-bold">{formatIDR(invoice.subtotal)}</span>
          </div>
          {(invoice.discount_amount > 0) && (
             <div className="flex justify-between text-sm text-red-600">
               <span>Diskon (-)</span>
               <span>{formatIDR(invoice.discount_amount)}</span>
             </div>
          )}
          {(invoice.tax_amount > 0) && (
             <div className="flex justify-between text-sm text-slate-600">
               <span>Pajak (+)</span>
               <span>{formatIDR(invoice.tax_amount)}</span>
             </div>
          )}
          <div className="flex justify-between text-xl font-extrabold border-t-2 border-slate-800 pt-3 mt-2">
            <span>TOTAL TAGIHAN</span>
            <span>{formatIDR(invoice.total_amount)}</span>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="grid grid-cols-2 gap-8 mt-auto pt-8 border-t border-dashed border-slate-200">
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase mb-2">Catatan:</p>
          <p className="text-sm text-slate-600 italic">
            {invoice.notes || 'Terima kasih atas kepercayaan Anda.'}
          </p>
        </div>
        <div className="text-center mt-4">
          <p className="text-sm font-bold mb-20">Hormat Kami,</p>
          <p className="text-sm font-bold border-t border-slate-300 inline-block px-8 pt-1">
            {storeProfile?.storeName || 'Management'}
          </p>
        </div>
      </div>
    </div>
  );
};