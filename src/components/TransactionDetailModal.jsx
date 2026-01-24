import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { X, Edit2, Save, Trash2, Plus, ArrowDownLeft, ArrowUpRight, Wallet, CheckCircle2, AlertCircle } from 'lucide-react';

// Helper Input Format Ribuan
const NumberInput = ({ value, onChange, placeholder, className }) => {
    const format = (val) => {
        if (!val && val !== 0) return '';
        return new Intl.NumberFormat('id-ID').format(val);
    };
    const handleChange = (e) => {
        const raw = e.target.value.replace(/\D/g, ''); 
        onChange(raw);
    };
    return <input type="text" value={format(value)} onChange={handleChange} placeholder={placeholder} className={className} />;
};

export default function TransactionDetailModal({ transaction, items, onClose, loading, onUpdate, onDelete }) {
  const [isEditing, setIsEditing] = useState(false);
  
  // State Form
  const [formData, setFormData] = useState({ 
      merchant: '', total_amount: 0, date: '', category: '', items: [] 
  });
  
  const [saving, setSaving] = useState(false);

  // Init Data saat modal dibuka
  useEffect(() => {
      if (transaction) {
          setFormData({
              merchant: transaction.merchant,
              total_amount: transaction.total_amount,
              date: transaction.date.split('T')[0],
              category: transaction.category,
              items: items ? JSON.parse(JSON.stringify(items)) : [] 
          });
      }
  }, [transaction, items]);

  if (!transaction) return null;

  // --- LOGIC EDIT ---
  const handleItemChange = (idx, field, val) => {
      const newItems = [...formData.items];
      newItems[idx][field] = val;
      setFormData({ ...formData, items: newItems });
  };

  const handleAddItem = () => {
      setFormData({ 
          ...formData, 
          items: [...formData.items, { id: null, name: '', qty: 1, price: 0 }] 
      });
  };

  const handleRemoveItem = (idx) => {
      const newItems = formData.items.filter((_, i) => i !== idx);
      setFormData({ ...formData, items: newItems });
  };

  // Auto Hitung Total
  useEffect(() => {
      if (isEditing && formData.items.length > 0) {
          const total = formData.items.reduce((acc, item) => acc + (Number(item.price) * Number(item.qty)), 0);
          setFormData(prev => ({ ...prev, total_amount: total }));
      }
  }, [formData.items, isEditing]);

  const handleSave = async () => {
      setSaving(true);
      try {
          // 1. Update Header
          const { error: headerErr } = await supabase
            .from('transaction_headers')
            .update({
                merchant: formData.merchant,
                total_amount: formData.total_amount,
                date: formData.date,
                category: formData.category
            })
            .eq('id', transaction.id);
          
          if (headerErr) throw headerErr;

          // 2. Update Items (Hapus Lama -> Insert Baru)
          
          // A. Hapus item lama
          const { error: deleteErr } = await supabase.from('transaction_items').delete().eq('header_id', transaction.id);
          if (deleteErr) throw deleteErr;

          // B. Masukkan item baru
          if (formData.items.length > 0) {
              const newItemsPayload = formData.items.map(item => ({
                  header_id: transaction.id,
                  // HAPUS user_id DISINI AGAR TIDAK ERROR SCHEMA
                  name: item.name || 'Item Tanpa Nama',
                  qty: Number(item.qty) || 1,
                  price: Number(item.price) || 0
              }));

              const { error: insertErr } = await supabase.from('transaction_items').insert(newItemsPayload);
              if (insertErr) throw insertErr;
          }

          setIsEditing(false);
          if (onUpdate) onUpdate(); 

      } catch (e) {
          console.error(e);
          alert('Gagal update: ' + e.message);
      } finally {
          setSaving(false);
      }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-slide-up relative flex flex-col max-h-[90vh]">
         
         {/* HEADER MODAL */}
         <div className="bg-gray-50 p-4 border-b border-gray-100 flex justify-between items-center sticky top-0 z-10">
            <h3 className="font-bold text-gray-700">{isEditing ? 'Edit Transaksi' : 'Detail Transaksi'}</h3>
            <div className="flex gap-2">
                {!isEditing ? (
                    <>
                        <button onClick={() => setIsEditing(true)} className="p-2 bg-white border border-gray-200 rounded-full text-indigo-600 hover:bg-indigo-50 transition shadow-sm" title="Edit Transaksi">
                            <Edit2 size={16}/>
                        </button>
                        <button onClick={onDelete} className="p-2 bg-white border border-gray-200 rounded-full text-red-500 hover:bg-red-50 transition shadow-sm" title="Hapus Transaksi">
                            <Trash2 size={16}/>
                        </button>
                    </>
                ) : (
                    <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded-full text-xs font-bold shadow-lg hover:bg-indigo-700 flex items-center gap-2 transition disabled:opacity-70">
                        {saving ? '...' : <><Save size={14}/> Simpan</>}
                    </button>
                )}
                <button onClick={onClose} className="p-2 bg-white border border-gray-200 rounded-full text-gray-400 hover:text-slate-600 hover:bg-slate-100 transition shadow-sm">
                    <X size={16}/>
                </button>
            </div>
         </div>

         {/* BODY SCROLLABLE */}
         <div className="flex-1 overflow-y-auto p-6 bg-white custom-scrollbar">
            
            {/* 1. INFORMASI UTAMA (HEADER) */}
            <div className="text-center mb-6">
                <div className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-2xl mb-4 shadow-sm ${transaction.type === 'income' ? 'bg-green-100' : 'bg-red-100'}`}>
                    {transaction.type === 'income' ? <ArrowDownLeft className="text-green-600" size={28}/> : <ArrowUpRight className="text-red-600" size={28}/>}
                </div>
                
                {isEditing ? (
                    <div className="space-y-4">
                        {/* Edit Merchant */}
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Nama Transaksi</label>
                            <input type="text" value={formData.merchant} onChange={e => setFormData({...formData, merchant: e.target.value})} className="w-full text-center font-bold text-lg border-b-2 border-indigo-100 focus:border-indigo-500 outline-none pb-2 text-slate-800 bg-transparent transition" placeholder="Contoh: Makan Siang"/>
                        </div>

                        {/* Edit Nominal */}
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Total Nominal</label>
                            <div className="flex justify-center items-center gap-2">
                                <span className="font-bold text-slate-400 text-xl">Rp</span>
                                <NumberInput value={formData.total_amount} onChange={val => setFormData({...formData, total_amount: val})} className="w-40 text-center font-black text-3xl border-b-2 border-indigo-100 focus:border-indigo-500 outline-none pb-2 text-slate-800 bg-transparent transition" placeholder="0"/>
                            </div>
                        </div>

                        {/* Edit Tgl & Kategori */}
                        <div className="flex gap-2 justify-center">
                            <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-600 outline-indigo-500"/>
                            <input type="text" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg p-2 w-28 text-center text-slate-600 outline-indigo-500" placeholder="Kategori"/>
                        </div>
                    </div>
                ) : (
                    <>
                        <h2 className="text-2xl font-extrabold text-slate-800 leading-tight mb-1">{transaction.merchant || 'Tanpa Nama'}</h2>
                        <div className="flex items-center justify-center gap-2 mb-3">
                            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">{transaction.category}</span>
                            <span className="text-[10px] text-slate-400 font-medium">• {new Date(transaction.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                        </div>
                        
                        <h1 className={`text-4xl font-black tracking-tight ${transaction.type === 'income' ? 'text-green-600' : 'text-slate-900'}`}>
                            {transaction.type === 'income' ? '+' : '-'} {new Intl.NumberFormat('id-ID').format(transaction.total_amount)}
                        </h1>
                        
                        {/* INFO WALLET */}
                        <div className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-2xl">
                            <Wallet size={14} className="text-indigo-500"/>
                            <span className="text-xs font-bold text-indigo-700">Dompet: {transaction.wallets?.name || 'Terhapus'}</span>
                        </div>
                    </>
                )}
            </div>

            {/* 2. RINCIAN ITEM */}
            <div className="border-t border-dashed border-gray-200 pt-6 mt-2">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <CheckCircle2 size={12}/> Rincian Item
                    </h4>
                    {isEditing && (
                        <button onClick={handleAddItem} className="text-[10px] bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 hover:bg-indigo-100 transition">
                            <Plus size={12}/> Tambah
                        </button>
                    )}
                </div>

                <div className="space-y-3">
                    {loading ? (
                        <div className="text-center py-6 text-slate-400 text-xs animate-pulse">Memuat detail...</div>
                    ) : (isEditing ? formData.items : items).length === 0 ? (
                        <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-100 border-dashed flex flex-col items-center justify-center">
                            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mb-2 text-slate-300">
                                <Plus size={20}/>
                            </div>
                            <p className="text-xs font-bold text-slate-400">Tidak ada rincian item.</p>
                            {isEditing && <p className="text-[10px] text-slate-400">Klik 'Tambah' untuk mengisi detail.</p>}
                        </div>
                    ) : (
                        (isEditing ? formData.items : items).map((item, idx) => (
                            <div key={idx} className="flex gap-3 items-center text-sm bg-white animate-fade-in-up">
                                {isEditing ? (
                                    <>
                                        <div className="flex-1 flex gap-2">
                                            <input type="text" value={item.name} onChange={e => handleItemChange(idx, 'name', e.target.value)} className="flex-1 border-b border-slate-200 pb-1 outline-none text-slate-700 font-bold text-xs focus:border-indigo-500 transition" placeholder="Nama Item"/>
                                            <input type="number" value={item.qty} onChange={e => handleItemChange(idx, 'qty', e.target.value)} className="w-12 text-center border-b border-slate-200 pb-1 outline-none text-slate-500 text-xs focus:border-indigo-500 transition" placeholder="Qty"/>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <NumberInput value={item.price} onChange={val => handleItemChange(idx, 'price', val)} className="w-20 text-right border-b border-slate-200 pb-1 outline-none text-slate-700 font-bold text-xs focus:border-indigo-500 transition" placeholder="Harga"/>
                                            <button onClick={() => handleRemoveItem(idx)} className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition"><Trash2 size={12}/></button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex-1">
                                            <p className="font-bold text-slate-700">{item.name}</p>
                                            {item.qty > 1 && <p className="text-[10px] text-slate-400">x{item.qty} @ {new Intl.NumberFormat('id-ID').format(item.price)}</p>}
                                        </div>
                                        <p className="font-bold text-slate-800">Rp {new Intl.NumberFormat('id-ID').format(item.price * item.qty)}</p>
                                    </>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

         </div>
      </div>
    </div>
  );
}