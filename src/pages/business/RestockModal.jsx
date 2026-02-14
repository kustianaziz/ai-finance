import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { X, Loader2, PackagePlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MoneyInput from "../../components/MoneyInput"; // Pastikan path import ini sesuai

const formatIDR = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

export default function RestockModal({ isOpen, onClose, product, ownerId, wallets, onSuccess, showNotif }) {
    const [form, setForm] = useState({ qty: '', cost: 0, wallet_id: '', supplier: '' });
    const [processing, setProcessing] = useState(false);

    // Reset form saat modal dibuka/produk berubah
    useEffect(() => {
        if (isOpen && product) {
            setForm({
                qty: '',
                cost: product.cost_price || 0, // Default harga beli terakhir
                wallet_id: '',
                supplier: ''
            });
        }
    }, [isOpen, product]);

    const handleSubmit = async () => {
        if (!form.qty || !form.wallet_id || parseFloat(form.qty) <= 0) {
            return showNotif('error', 'Data Kurang', 'Jumlah stok dan Sumber Dana wajib diisi.');
        }

        setProcessing(true);
        try {
            const qty = parseFloat(form.qty);
            const cost = parseInt(form.cost);
            const totalCost = qty * cost;

            // 1. Catat Pengeluaran (Expense Header)
            const { data: trxData, error: trxError } = await supabase.from('transaction_headers').insert({
                user_id: ownerId,
                wallet_id: form.wallet_id,
                total_amount: totalCost,
                type: 'expense',
                category: 'Pembelian Stok Retail',
                description: `Restock: ${product.name} (+${qty})`,
                allocation_type: 'BUSINESS',
                receipt_url: 'RESTOCK-RETAIL',
                payment_status: 'paid',
                merchant: form.supplier || 'Supplier Umum'
            }).select().single();

            if (trxError) throw trxError;

            // 2. Catat Detail Barang
            const { error: itemError } = await supabase.from('transaction_items').insert({
                header_id: trxData.id,
                product_id: product.id,
                name: product.name,
                qty: qty,
                price: cost,
                cost_at_sale: 0
            });

            if (itemError) throw itemError;

            // 3. Update Stok Produk & Catat Log (Via RPC Updated)
            const { error: rpcError } = await supabase.rpc('increment_product_stock', {
                p_product_id: product.id,
                p_qty: qty,
                p_new_cost: cost,
                p_ref_id: trxData.id, // <--- Kirim ID Transaksi Header sebagai referensi
                p_notes: 'Restock via Menu Produk'
            });

            if (rpcError) throw rpcError;

            showNotif('success', 'Restock Berhasil', `Stok ${product.name} bertambah.`);
            onSuccess(); // Refresh data di parent
            onClose();   // Tutup modal

        } catch (e) {
            console.error(e);
            showNotif('error', 'Gagal Restock', e.message);
        } finally {
            setProcessing(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && product && (
                <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl">
                        <div className="p-4 border-b bg-teal-600 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-lg text-white">Belanja Stok</h3>
                                <p className="text-xs text-teal-100">{product.name}</p>
                            </div>
                            <button onClick={onClose} className="p-1 bg-white/20 rounded-full text-white hover:bg-white/30"><X size={20} /></button>
                        </div>

                        <div className="p-5 space-y-4">
                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="text-xs font-bold text-slate-500 mb-1 block">Tambah Stok</label>
                                    <input type="number" autoFocus className="w-full p-2.5 border rounded-xl font-bold text-center outline-none focus:border-teal-500" placeholder="0" value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} />
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs font-bold text-slate-500 mb-1 block">Harga Beli / Unit</label>
                                    <MoneyInput className="w-full p-2.5 border rounded-xl font-bold text-center outline-none focus:border-teal-500" value={form.cost} onChange={val => setForm({ ...form, cost: val })} />
                                </div>
                            </div>

                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-500">Total Belanja</span>
                                <span className="text-lg font-black text-teal-700">
                                    {formatIDR((parseFloat(form.qty) || 0) * (parseInt(form.cost) || 0))}
                                </span>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 mb-1 block">Sumber Dana (Wajib)</label>
                                <select className="w-full p-3 bg-white border rounded-xl text-sm font-bold outline-none focus:border-teal-500" value={form.wallet_id} onChange={e => setForm({ ...form, wallet_id: e.target.value })}>
                                    <option value="">-- Pilih Dompet --</option>
                                    {wallets.map(w => <option key={w.id} value={w.id}>{w.name} (Sisa: {formatIDR(w.initial_balance)})</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 mb-1 block">Supplier (Opsional)</label>
                                <input type="text" placeholder="Nama Toko / Supplier" className="w-full p-3 border rounded-xl text-sm outline-none" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} />
                            </div>

                            <button onClick={handleSubmit} disabled={processing} className="w-full py-3 bg-teal-600 text-white rounded-xl font-bold hover:bg-teal-700 transition flex justify-center items-center gap-2">
                                {processing ? <Loader2 className="animate-spin" size={18} /> : <><PackagePlus size={18} /> Proses Restock</>}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}