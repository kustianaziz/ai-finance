import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthProvider';
import ModalInfo from '../../components/ModalInfo';
import MoneyInput from '../../components/MoneyInput';
import { InvoicePrint } from './InvoicePrint'; 

import { 
  ArrowLeft, Plus, Search, User, X, Loader2, 
  Trash2, ShoppingBag, Receipt, Minus, Tag, Box,
  Calendar, Printer, Edit3, CheckCircle2, AlertCircle, FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const formatIDR = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

export default function InvoicePage() {
  const navigate = useNavigate();
  const { user, activeEmployee } = useAuth();
  const ownerId = user?.id || activeEmployee?.storeId;
  
  // --- STATE ---
  const [invoices, setInvoices] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDateStart, setFilterDateStart] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]); 
  const [filterDateEnd, setFilterDateEnd] = useState(new Date().toISOString().split('T')[0]); 

  // Modal State
  const [showForm, setShowForm] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Picker Internal
  const [searchProduct, setSearchProduct] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [manualItemMode, setManualItemMode] = useState(false);
  const [manualItemData, setManualItemData] = useState({ name: '', price: '', qty: 1 });
  
  // State Khusus Qty di Picker
  const [pickerQtys, setPickerQtys] = useState({});

  // Form Data
  const [formData, setFormData] = useState({
    id: null, invoice_number: '', customer_name: '', customer_phone: '', customer_email: '',
    issue_date: new Date().toISOString().split('T')[0], due_date: '',
    items: [], tax_percent: 0, 
    tax_type: 'exclude', // <--- TAMBAHAN BARU
    global_discount: 0, notes: ''
  });

  // --- STATE PEMBAYARAN (BARU) ---
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [payWalletId, setPayWalletId] = useState('');
  const [wallets, setWallets] = useState([]);

  const [notif, setNotif] = useState({ isOpen: false, type: 'info', title: '', message: '' });
  const showAlert = (type, title, message) => setNotif({ isOpen: true, type, title, message });

  // --- INIT ---
  useEffect(() => {
    if (ownerId) { fetchInvoices(); fetchProducts(); fetchWallets(); }
  }, [ownerId, filterDateStart, filterDateEnd]); 

  const fetchInvoices = async () => {
    setLoading(true);
    try {
        const { data, error } = await supabase.from('invoices').select('*').eq('user_id', ownerId)
            .gte('issue_date', filterDateStart).lte('issue_date', filterDateEnd).order('created_at', { ascending: false });
        if (error) throw error;
        setInvoices(data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const fetchProducts = async () => {
      const { data } = await supabase.from('products').select('*').eq('user_id', ownerId).order('name');
      if (data) setProducts(data);
  };

  const fetchWallets = async () => {
      const { data } = await supabase.from('wallets').select('id, name, initial_balance').eq('user_id', ownerId).eq('allocation_type', 'BUSINESS');
      setWallets(data || []);
  };

  // --- PRINT LOGIC (NATIVE) ---
  const handlePrintNative = () => {
      setTimeout(() => { window.print(); }, 300);
  };

  // --- LOGIC FORM ---
  const generateInvoiceNumber = () => {
      const dateStr = new Date().toISOString().slice(0,10).replace(/-/g, '');
      const randomNum = Math.floor(100 + Math.random() * 900);
      return `INV/${dateStr}/${randomNum}`;
  };

  const openCreateForm = () => {
      setFormData({
          id: null, invoice_number: generateInvoiceNumber(),
          items: [], tax_percent: 0, 
          tax_type: 'exclude',
          global_discount: 0, notes: ''
      });
      setIsEditMode(false); setShowForm(true);
  };

  const openEditForm = async (invoice) => {
      if (invoice.status === 'paid') return showAlert('error', 'Gagal', 'Invoice LUNAS tidak bisa diedit.');
      setProcessing(true);
      const { data: items } = await supabase.from('invoice_items').select('*').eq('invoice_id', invoice.id);
      const formattedItems = items.map(i => ({
          product_id: i.product_id, name: i.item_name, category: i.product_id ? 'Stok' : 'Manual',
          qty: i.quantity, price: i.price, 
          discount_type: i.discount_type || 'nominal', // <--- Ambil DB
          discount_value: i.discount_value || 0,       // <--- Ambil DB
          total: i.total
      }));
      setFormData({
          id: invoice.id, invoice_number: invoice.invoice_number,
          customer_name: invoice.customer_name, customer_phone: invoice.customer_phone || '',
          customer_email: invoice.customer_email || '', issue_date: invoice.issue_date, due_date: invoice.due_date,
          items: formattedItems, 
          tax_percent: invoice.tax_amount > 0 ? (invoice.tax_amount / (invoice.subtotal - invoice.discount_amount) * 100) : 0,
          tax_type: invoice.tax_type || 'exclude',
          global_discount: invoice.discount_amount, notes: invoice.notes
      });
      setIsEditMode(true); setShowDetail(null); setShowForm(true); setProcessing(false);
  };

  // --- ITEM LOGIC (FIXED VALIDATION) ---
  
  const addItemToForm = (newItem) => {
      setFormData(prev => {
          const existingIdx = prev.items.findIndex(i => i.product_id === newItem.product_id && i.product_id !== null);
          let newItems = [...prev.items];
          
          if (existingIdx >= 0) {
              const item = newItems[existingIdx];
              item.qty = parseInt(item.qty) + parseInt(newItem.qty);
              item.total = (item.price * item.qty) - (item.discount_value || 0);
          } else {
              newItems.push(newItem);
          }
          return { ...prev, items: newItems };
      });
  };

  const handleAddItemFromPicker = (product) => {
      // Ambil qty input, default 1
      const qtyInput = pickerQtys[product.id];
      const qtyToAdd = qtyInput ? parseInt(qtyInput) : 1;
      
      // 1. Cek sudah ada berapa di keranjang?
      const existingItem = formData.items.find(item => item.product_id === product.id);
      const currentQtyInCart = existingItem ? parseInt(existingItem.qty) : 0;

      // 2. Hitung total kumulatif
      const totalProposed = currentQtyInCart + qtyToAdd;

      // 3. Validasi Total vs Stok Database
      if (totalProposed > product.stock) {
          const sisaBoleh = product.stock - currentQtyInCart;
          return showAlert(
              'error', 
              'Stok Tidak Cukup', 
              `Stok: ${product.stock}. Di Keranjang: ${currentQtyInCart}. Sisa boleh ditambah: ${sisaBoleh < 0 ? 0 : sisaBoleh}`
          );
      }

      const newItem = {
          product_id: product.id, name: product.name, category: product.category || 'Umum',
          qty: qtyToAdd, price: product.price, discount_type: 'percent', discount_value: 0, total: product.price * qtyToAdd
      };

      addItemToForm(newItem);
      
      // Reset visual input qty jadi 1
      setPickerQtys(prev => ({ ...prev, [product.id]: 1 }));
  };

  // --- [BARU] HANDLER PICKER YANG LEBIH PINTAR & LIVE ---
  const handlePickerAction = (product, action) => {
      // 1. Cek apakah barang sudah ada di keranjang form utama?
      const existingIdx = formData.items.findIndex(i => i.product_id === product.id);
      const currentQty = existingIdx >= 0 ? parseInt(formData.items[existingIdx].qty) : 0;

      let newQty = 0;
      if (action === 'add') newQty = currentQty + 1;
      else if (action === 'reduce') newQty = currentQty - 1;
      else if (action === 'set') newQty = 1; // Saat pertama kali klik 'Ambil'

      // 2. Validasi Stok
      if (newQty > product.stock) {
          return showAlert('error', 'Stok Mentok', `Sisa stok hanya: ${product.stock}`);
      }

      // 3. Eksekusi Update ke Form Utama
      if (existingIdx >= 0) {
          if (newQty <= 0) {
              // Jika jadi 0, hapus item dari list
              removeItem(existingIdx);
          } else {
              // Update Qty
              updateItem(existingIdx, 'qty', newQty);
          }
      } else {
          // Belum ada, bikin baru
          if (newQty > 0) {
              const newItem = {
                  product_id: product.id, name: product.name, category: product.category || 'Umum',
                  qty: newQty, price: product.price, 
                  discount_type: 'nominal', discount_value: 0, 
                  total: product.price * newQty
              };
              // Kita push manual ke state biar rapi (bypass addItemToForm kumulatif)
              setFormData(prev => ({ ...prev, items: [...prev.items, newItem] }));
          }
      }
  };

  const saveManualItem = () => {
      if (!manualItemData.name || !manualItemData.price) return showAlert('error', 'Gagal', 'Isi nama & harga');
      const price = parseInt(manualItemData.price);
      const qty = parseInt(manualItemData.qty) || 1;
      const newItem = {
          product_id: null, name: manualItemData.name, category: 'Manual',
          qty: qty, price: price, discount_type: 'percent', discount_value: 0, total: price * qty
      };
      addItemToForm(newItem);
      setManualItemData({ name: '', price: '', qty: 1 });
      setManualItemMode(false); 
  };

  const updateItem = (index, field, value) => {
      const newItems = [...formData.items];
      const item = newItems[index];
      
      // Handle logic stok saat edit qty di form utama
      if (field === 'qty' && item.product_id) { // Hanya cek stok jika bukan manual item
          // Kita butuh data stok asli. Cari di array products.
          const originalProduct = products.find(p => p.id === item.product_id);
          if (originalProduct) {
              const newQty = parseInt(value) || 0;
              if (newQty > originalProduct.stock) {
                  showAlert('error', 'Stok Limit', `Maksimal stok tersedia: ${originalProduct.stock}`);
                  // Kembalikan ke qty sebelumnya atau set ke max stock
                  item.qty = originalProduct.stock;
                  // Recalc total based on max stock
                  const basePrice = item.price * item.qty;
                  let disc = 0;
                  const discVal = parseFloat(item.discount_value) || 0;
                  if (item.discount_type === 'percent') {
                      const safePercent = Math.min(discVal, 100);
                      disc = basePrice * (safePercent / 100);
                  } else { disc = Math.min(discVal, basePrice); }
                  item.total = basePrice - disc;
                  setFormData(prev => ({ ...prev, items: newItems }));
                  return; // Stop update
              }
          }
      }

      item[field] = value;
      
      const basePrice = item.price * item.qty;
      let disc = 0;
      const discVal = parseFloat(item.discount_value) || 0;
      if (item.discount_type === 'percent') {
          const safePercent = Math.min(discVal, 100);
          disc = basePrice * (safePercent / 100);
      } else { disc = Math.min(discVal, basePrice); }
      item.total = basePrice - disc;
      setFormData(prev => ({ ...prev, items: newItems }));
  };

  const removeItem = (index) => {
      const newItems = formData.items.filter((_, i) => i !== index);
      setFormData(prev => ({ ...prev, items: newItems }));
  };

  // --- CORE CALCULATION (NEW) ---
  const calc = useMemo(() => {
      let grossSubtotal = 0;     // Total Harga Asli (Qty x Harga)
      let totalItemDiscount = 0; // Total Diskon per Barang

      // 1. Hitung Total Item & Diskon Item
      formData.items.forEach(item => {
          const qty = parseInt(item.qty) || 0;
          const price = parseFloat(item.price) || 0;
          const gross = qty * price;
          
          let itemDisc = 0;
          const discVal = parseFloat(item.discount_value) || 0;
          if (item.discount_type === 'percent') {
              itemDisc = gross * (Math.min(discVal, 100) / 100);
          } else {
              itemDisc = Math.min(discVal, gross);
          }
          
          grossSubtotal += gross;
          totalItemDiscount += itemDisc;
      });

      // 2. Hitung Net Sales (DPP)
      const globalDisc = parseFloat(formData.global_discount) || 0;
      const totalDiscount = totalItemDiscount + globalDisc; 
      const netSales = Math.max(0, grossSubtotal - totalDiscount);
      
      // 3. Hitung Pajak (Include vs Exclude)
      const taxRate = parseFloat(formData.tax_percent) || 0;
      let taxAmount = 0;
      let grandTotal = 0;

      if (formData.tax_type === 'include') {
          // Pajak Include: Tax = Net - (Net / (1 + Rate))
          taxAmount = netSales - (netSales / (1 + (taxRate / 100)));
          grandTotal = netSales; // Total yang dibayar customer adalah Net Sales itu sendiri
      } else {
          // Pajak Exclude: Tax = Net * Rate
          taxAmount = netSales * (taxRate / 100);
          grandTotal = netSales + taxAmount;
      }

      return { grossSubtotal, totalItemDiscount, totalDiscount, netSales, taxAmount, grandTotal };
  }, [formData.items, formData.global_discount, formData.tax_percent, formData.tax_type]);

  // --- SAVE ---
  const isValidEmail = (email) => { if (!email) return true; return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); };

  const handleSaveInvoice = async () => {
      if (!formData.customer_name || formData.items.length === 0) return showAlert('error', 'Gagal', 'Lengkapi data pelanggan & barang.');
      if (formData.customer_email && !isValidEmail(formData.customer_email)) return showAlert('error', 'Email', 'Format email salah.');
      setProcessing(true);
      try {
          let invoiceId = formData.id; 
          if (isEditMode && invoiceId) {
              const { data: oldItems } = await supabase.from('invoice_items').select('*').eq('invoice_id', invoiceId);
              if (oldItems) { for (const item of oldItems) { if (item.product_id) await supabase.rpc('increment_stock', { row_id: item.product_id, quantity: item.quantity }); } }
              await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId);
              await supabase.from('debts').delete().like('description', `%${formData.invoice_number}%`).eq('user_id', ownerId);
          }
          // Pastikan globalDiscVal terkirim ke kolom discount_amount
          const payload = {
              user_id: ownerId, invoice_number: formData.invoice_number,
              customer_name: formData.customer_name, customer_phone: formData.customer_phone, customer_email: formData.customer_email,
              issue_date: formData.issue_date, due_date: formData.due_date || null,
              
              // PAKAI HASIL HITUNGAN BARU (Dibualatkan biar ga error bigint)
              subtotal: Math.round(calc.grossSubtotal),        
              discount_amount: Math.round(calc.totalDiscount), 
              tax_amount: Math.round(calc.taxAmount), 
              total_amount: Math.round(calc.grandTotal),
              tax_type: formData.tax_type, // Simpan tipe pajak
              
              status: 'unpaid', notes: formData.notes
          };

          if (isEditMode && invoiceId) { 
              await supabase.from('invoices').update(payload).eq('id', invoiceId); 
          } else {
              const { data, error } = await supabase.from('invoices').insert(payload).select().single();
              if (error) throw error; invoiceId = data.id;
          }

          const itemsPayload = formData.items.map(item => ({
              invoice_id: invoiceId, product_id: item.product_id, item_name: item.name,
              quantity: item.qty, price: item.price, 
              // Simpan detail diskon
              discount_type: item.discount_type, 
              discount_value: item.discount_value, 
              total: Math.round(item.total)
          }));
          await supabase.from('invoice_items').insert(itemsPayload);
          
          await supabase.from('debts').insert({
                user_id: ownerId, 
                type: 'receivable', 
                contact_name: formData.customer_name,
                
                // ✅ Fix BigInt Error (Bulatkan angka)
                amount: Math.round(calc.grandTotal), 
                remaining_amount: Math.round(calc.grandTotal),
                
                // ✅ Jangan lupa ini biar tanggal jatuh tempo tersimpan
                due_date: formData.due_date, 
                
                description: `Invoice #${formData.invoice_number}`, 
                status: 'unpaid'
            });

          for (const item of formData.items) { 
              if (item.product_id) await supabase.rpc('decrement_stock', { row_id: item.product_id, quantity: item.qty }); 
          }
          
          showAlert('success', 'Berhasil', 'Invoice tersimpan.'); setShowForm(false); fetchInvoices(); fetchProducts();
      } catch (e) { showAlert('error', 'Gagal', e.message); } finally { setProcessing(false); }
  };

  const handleDeleteInvoice = async (invoice) => {
      if (invoice.status === 'paid') return showAlert('error', 'Gagal', 'Invoice LUNAS tidak bisa dihapus.');
      if(!window.confirm("Hapus? Stok dikembalikan.")) return;
      setProcessing(true);
      try {
          const { data: items } = await supabase.from('invoice_items').select('*').eq('invoice_id', invoice.id);
          if (items) { for (const item of items) { if (item.product_id) await supabase.rpc('increment_stock', { row_id: item.product_id, quantity: item.quantity }); } }
          await supabase.from('invoices').delete().eq('id', invoice.id);
          await supabase.from('debts').delete().like('description', `%${invoice.invoice_number}%`).eq('user_id', ownerId);
          showAlert('success', 'Dihapus', 'Invoice dihapus.'); fetchInvoices(); setShowDetail(null); fetchProducts(); // Refresh stok
      } catch (e) { showAlert('error', 'Gagal', e.message); } finally { setProcessing(false); }
  };

  // --- PAYMENT HANDLERS (BARU) ---
  const handleOpenPayModal = (invoice) => {
      setSelectedInvoice(invoice);
      setPayWalletId(''); // Reset pilihan
      setShowPayModal(true);
  };

  const handleConfirmPayment = async () => {
      if (!payWalletId) return showAlert('error', 'Pilih Dompet', 'Harap pilih dompet tujuan dana masuk!');
      
      setProcessing(true);
      try {
          // Panggil RPC Sakti yang sudah kita buat di Database
          const { error } = await supabase.rpc('pay_invoice_transaction', {
              p_invoice_id: selectedInvoice.id,
              p_wallet_id: payWalletId,
              p_payment_date: new Date().toISOString()
          });

          if (error) throw error;

          showAlert('success', 'Lunas', 'Pembayaran berhasil dicatat ke Kas & Jurnal.');
          setShowPayModal(false);
          setShowDetail(null); // Tutup detail invoice
          fetchInvoices(); // Refresh list
          fetchWallets();  // Refresh saldo wallet
      } catch (e) {
          showAlert('error', 'Gagal Bayar', e.message);
      } finally {
          setProcessing(false);
      }
  };

  // --- STATS ---
  const filteredList = invoices.filter(inv => (inv.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) || inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase())));
  const stats = useMemo(() => {
      const totalInv = filteredList.length;
      const totalNominal = filteredList.reduce((acc, curr) => acc + curr.total_amount, 0);
      const unpaidList = filteredList.filter(i => i.status === 'unpaid');
      const unpaidNominal = unpaidList.reduce((acc, curr) => acc + curr.total_amount, 0);
      const paidNominal = totalNominal - unpaidNominal;
      const paidPercent = totalNominal > 0 ? Math.round((paidNominal / totalNominal) * 100) : 0;
      return { totalInv, totalNominal, unpaidCount: unpaidList.length, unpaidNominal, paidCount: totalInv - unpaidList.length, paidNominal, paidPercent };
  }, [filteredList]);

  const uniqueCategories = ['all', ...new Set(products.map(p => p.category || 'Umum'))];
  const pickerList = products.filter(p => p.name.toLowerCase().includes(searchProduct.toLowerCase()) && (filterCategory === 'all' || (p.category || 'Umum') === filterCategory));

  // --- CSS STYLE PRINT ---
  const printStyles = `
    @media print {
      body * { visibility: hidden; }
      #printable-area, #printable-area * { visibility: visible; }
      #printable-area { position: absolute; left: 0; top: 0; width: 100%; }
      .no-print { display: none !important; }
    }
  `;

  return (
    <div className="h-screen bg-slate-50 font-sans flex flex-col overflow-hidden">
      
      <style>{printStyles}</style>

      {/* HEADER */}
      <div className="shrink-0 bg-indigo-600 z-50 shadow-md">
          <div className="px-6 pt-6 pb-6">
              <div className="flex items-center gap-3 mb-4">
                  <button 
                    // Logic: Jika ada user (Owner) -> ke Dashboard Utama. Jika tidak -> ke Dashboard Karyawan.
                    onClick={() => navigate(user ? '/dashboard' : '/employee-dashboard')} 
                    className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition backdrop-blur-sm"
                >
                    <ArrowLeft size={20}/>
                </button>
                  <div className="flex-1"><h1 className="text-xl font-extrabold text-white">Invoice</h1><p className="text-xs text-white/80 font-medium">Tagihan & Penjualan</p></div>
                  <button onClick={openCreateForm} className="p-2 bg-white text-indigo-600 rounded-xl shadow-md hover:bg-indigo-50 transition active:scale-95"><Plus size={20}/></button>
              </div>
              <div className="bg-white/10 p-2 rounded-xl border border-white/20 flex items-center px-3 backdrop-blur-sm">
                  <Search size={18} className="text-white"/>
                  <input type="text" placeholder="Cari Pelanggan / No Invoice..." className="w-full bg-transparent p-1 text-sm text-white placeholder:text-white/70 outline-none font-medium" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                  {searchQuery && <button onClick={()=>setSearchQuery('')}><X size={16} className="text-white/70"/></button>}
              </div>
          </div>
      </div>

      {/* SUMMARY */}
      <div className="bg-white px-4 py-4 border-b border-slate-100 shadow-sm shrink-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full mb-4">
              <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100"><p className="text-[10px] font-bold text-indigo-400 uppercase">Total Tagihan</p><p className="text-base font-black text-indigo-700 truncate">{formatIDR(stats.totalNominal)}</p><p className="text-[10px] text-indigo-500">{stats.totalInv} Invoice</p></div>
              <div className="p-3 bg-orange-50 rounded-xl border border-orange-100"><p className="text-[10px] font-bold text-orange-400 uppercase">Belum Lunas</p><p className="text-base font-black text-orange-700 truncate">{formatIDR(stats.unpaidNominal)}</p><p className="text-[10px] text-orange-500">{stats.unpaidCount} Invoice</p></div>
              <div className="p-3 bg-green-50 rounded-xl border border-green-100"><p className="text-[10px] font-bold text-green-400 uppercase">Sudah Lunas</p><p className="text-base font-black text-green-700 truncate">{formatIDR(stats.paidNominal)}</p><p className="text-[10px] text-green-500">{stats.paidCount} Invoice</p></div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-center items-center"><p className="text-[10px] font-bold text-slate-400 uppercase">Terbayar</p><p className="text-xl font-black text-slate-700">{stats.paidPercent}%</p></div>
          </div>
          <div className="w-full flex gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-200"><Calendar size={16} className="text-slate-400 ml-1"/><div className="flex-1 flex gap-2 items-center"><input type="date" className="bg-transparent text-xs font-bold text-slate-600 outline-none w-full" value={filterDateStart} onChange={e=>setFilterDateStart(e.target.value)} /><span className="text-slate-300">-</span><input type="date" className="bg-transparent text-xs font-bold text-slate-600 outline-none w-full" value={filterDateEnd} onChange={e=>setFilterDateEnd(e.target.value)} /></div></div>
      </div>

      {/* LIST */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-slate-50 pb-20">
          {loading ? <div className="text-center py-10 text-slate-400 text-xs">Memuat data...</div> : 
           filteredList.length === 0 ? <div className="text-center py-20 text-slate-300"><FileText size={48} className="mx-auto mb-2 opacity-50"/><p className="text-sm font-medium">Tidak ada data invoice.</p></div> : 
           filteredList.map(inv => (
               <div key={inv.id} onClick={() => { const fetchDetail = async () => { const { data } = await supabase.from('invoice_items').select('*').eq('invoice_id', inv.id); setShowDetail({ ...inv, items: data || [] }); }; fetchDetail(); }} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm active:scale-98 transition cursor-pointer hover:border-indigo-300">
                   <div className="flex justify-between items-start mb-2"><div><h3 className="font-bold text-slate-800 text-sm">{inv.customer_name}</h3><p className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5"><Receipt size={10}/> {inv.invoice_number}</p></div><span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${inv.status === 'paid' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-red-50 text-red-600 border-red-100'}`}>{inv.status === 'paid' ? 'Lunas' : 'Belum Bayar'}</span></div>
                   <div className="flex justify-between items-end border-t border-dashed border-slate-100 pt-2 mt-2"><p className="text-[10px] text-slate-400">Tempo: {inv.due_date ? new Date(inv.due_date).toLocaleDateString('id-ID') : '-'}</p><p className="text-base font-extrabold text-indigo-600">{formatIDR(inv.total_amount)}</p></div>
               </div>
           ))
          }
      </div>

      {/* FORM MODAL */}
      <AnimatePresence>
          {showForm && (
              <div className="fixed inset-0 z-[60] bg-white flex flex-col h-full">
                  <div className="p-4 border-b flex justify-between items-center bg-white shadow-sm shrink-0"><div className="flex items-center gap-3"><button onClick={() => setShowForm(false)} className="p-2 rounded-full hover:bg-slate-100"><X size={20}/></button><h2 className="font-bold text-lg">{isEditMode ? 'Edit Invoice' : 'Buat Invoice'}</h2></div><button onClick={handleSaveInvoice} disabled={processing} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs shadow-md hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">{processing ? <Loader2 className="animate-spin" size={14}/> : 'Simpan'}</button></div>
                  <div className="flex-1 overflow-y-auto bg-slate-50 p-4 space-y-4 pb-32">
                      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-3"><h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><User size={12}/> Pelanggan</h3><div className="space-y-3"><div><label className="text-[10px] font-bold text-slate-500 mb-1 block">Nomor Invoice</label><input type="text" className="w-full p-2 bg-slate-100 rounded-lg outline-none border text-xs font-bold text-slate-700" value={formData.invoice_number} onChange={e=>setFormData({...formData, invoice_number: e.target.value})}/></div><div><label className="text-[10px] font-bold text-slate-500 mb-1 block">Nama Pelanggan</label><input type="text" className="w-full p-2 bg-slate-50 rounded-lg outline-none border focus:border-indigo-500 text-sm font-bold" value={formData.customer_name} onChange={e=>setFormData({...formData, customer_name: e.target.value})} placeholder="Wajib diisi"/></div><div className="grid grid-cols-2 gap-3"><div><label className="text-[10px] font-bold text-slate-500 mb-1 block">No. HP/WA</label><input type="tel" className="w-full p-2 bg-slate-50 rounded-lg outline-none border text-xs" value={formData.customer_phone} onChange={e=>setFormData({...formData, customer_phone: e.target.value})}/></div><div><label className="text-[10px] font-bold text-slate-500 mb-1 block">Email</label><input type="email" className="w-full p-2 bg-slate-50 rounded-lg outline-none border text-xs" value={formData.customer_email} onChange={e=>setFormData({...formData, customer_email: e.target.value})}/></div></div><div className="grid grid-cols-2 gap-3"><div><label className="text-[10px] font-bold text-slate-500 mb-1 block">Tgl Terbit</label><input type="date" className="w-full p-2 bg-slate-50 rounded-lg outline-none border text-xs" value={formData.issue_date} onChange={e=>setFormData({...formData, issue_date: e.target.value})}/></div><div><label className="text-[10px] font-bold text-slate-500 mb-1 block">Jatuh Tempo</label><input type="date" className="w-full p-2 bg-slate-50 rounded-lg outline-none border text-xs" value={formData.due_date} onChange={e=>setFormData({...formData, due_date: e.target.value})}/></div></div></div></div>
                      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden"><div className="p-3 border-b flex justify-between items-center bg-slate-50/50"><h3 className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><ShoppingBag size={12}/> Barang ({formData.items.length})</h3><button onClick={() => { setShowProductPicker(true); setManualItemMode(false); }} className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-indigo-100 border border-indigo-100"><Plus size={12}/> Tambah</button></div>
                          {formData.items.length === 0 ? (<div onClick={() => setShowProductPicker(true)} className="py-8 text-center cursor-pointer hover:bg-slate-50 transition"><Box className="mx-auto text-slate-300 mb-2" size={28}/><p className="text-xs text-slate-400">Belum ada barang.</p></div>) : (<div className="divide-y divide-slate-100">{formData.items.map((item, idx) => (<div key={idx} className="p-3 bg-white hover:bg-slate-50/50 transition"><div className="flex flex-col md:grid md:grid-cols-12 gap-2 items-center"><div className="w-full md:col-span-4 flex justify-between items-start gap-2"><div className="flex-1"><input type="text" className="w-full text-xs font-bold text-slate-800 outline-none bg-transparent" value={item.name} readOnly /><span className="text-[9px] text-slate-400 bg-slate-100 px-1.5 rounded inline-block">{item.category}</span></div><button onClick={() => removeItem(idx)} className="text-red-300 p-1 hover:text-red-500 md:hidden"><Trash2 size={14}/></button></div><div className="w-full md:col-span-3 flex items-center justify-between md:justify-end gap-2"><span className="text-[9px] text-slate-400 md:hidden">Harga:</span><div className="flex flex-col items-end"><MoneyInput className="text-xs font-medium text-right outline-none bg-transparent text-slate-600 w-24" value={item.price} onChange={val => updateItem(idx, 'price', val)} /><div className="flex items-center gap-1 mt-0.5 justify-end"><input type={item.discount_type === 'percent' ? 'number' : 'text'} className="w-12 text-[9px] text-right text-red-500 bg-transparent outline-none placeholder:text-slate-300 border-b border-red-100" placeholder="Disc" value={item.discount_value || ''} onChange={e => updateItem(idx, 'discount_value', e.target.value)} /><button onClick={() => updateItem(idx, 'discount_type', item.discount_type === 'percent' ? 'nominal' : 'percent')} className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1 rounded hover:bg-slate-200 w-6 flex justify-center">{item.discount_type === 'percent' ? '%' : 'Rp'}</button></div></div></div><div className="w-full md:col-span-2 flex items-center justify-between md:justify-center"><span className="text-[9px] text-slate-400 md:hidden">Qty:</span><div className="flex items-center border rounded h-7 bg-white"><button onClick={() => updateItem(idx, 'qty', Math.max(1, item.qty - 1))} className="w-7 flex justify-center text-slate-400 hover:text-indigo-600"><Minus size={10}/></button><input type="number" className="w-8 text-center text-xs font-bold outline-none bg-transparent" value={item.qty} readOnly /><button onClick={() => updateItem(idx, 'qty', item.qty + 1)} className="w-7 flex justify-center text-slate-400 hover:text-indigo-600"><Plus size={10}/></button></div></div><div className="w-full md:col-span-3 flex justify-between items-center md:justify-end"><span className="text-[9px] text-slate-400 md:hidden">Total:</span><div className="flex items-center gap-2"><p className="text-xs font-extrabold text-indigo-700">{formatIDR(item.total)}</p><button onClick={() => removeItem(idx)} className="text-red-300 hover:text-red-500 hidden md:block"><Trash2 size={14}/></button></div></div></div></div>))}</div>)}</div>
                      {/* --- [FIX] TOTAL & PAJAK UI --- */}
                      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-3 text-sm">
                          {/* Total Bruto */}
                          <div className="flex justify-between text-slate-500">
                              <span>Total Bruto</span>
                              <span className="font-bold text-slate-700">{formatIDR(calc.grossSubtotal)}</span>
                          </div>
                          
                          {/* Diskon (Item + Global) */}
                          <div className="flex justify-between items-center text-red-500">
                              <span className="flex items-center gap-1"><Tag size={12}/> Total Diskon</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400">({formatIDR(calc.totalItemDiscount)} + )</span>
                                <MoneyInput className="w-24 text-right border-b border-dashed border-red-300 outline-none font-bold text-red-500 py-1 bg-transparent" value={formData.global_discount} onChange={val => setFormData({...formData, global_discount: val})} placeholder="0"/>
                              </div>
                          </div>

                          {/* Net Sales */}
                          <div className="flex justify-between text-slate-500 text-xs pt-1">
                              <span>Net Sales (DPP)</span>
                              <span className="font-bold text-slate-700">{formatIDR(calc.netSales)}</span>
                          </div>
                          
                          {/* Pajak Toggle & Input */}
                          <div className="flex justify-between items-start pt-2 border-t border-dashed border-slate-100">
                              <div>
                                  <span className="text-slate-500 block text-xs mb-1">Pajak / PPN (%)</span>
                                  <div className="flex bg-slate-100 p-1 rounded-lg gap-1">
                                      {/* TOMBOL TOGGLE INCLUDE/EXCLUDE */}
                                      <button onClick={()=>setFormData({...formData, tax_type: 'exclude'})} className={`text-[10px] px-2 py-1 rounded font-bold transition ${formData.tax_type==='exclude'?'bg-white shadow text-indigo-600':'text-slate-400'}`}>+ Exclude</button>
                                      <button onClick={()=>setFormData({...formData, tax_type: 'include'})} className={`text-[10px] px-2 py-1 rounded font-bold transition ${formData.tax_type==='include'?'bg-white shadow text-indigo-600':'text-slate-400'}`}>Include</button>
                                  </div>
                              </div>
                              <div className="flex flex-col items-end">
                                  <input type="number" className="w-12 text-right border-b border-dashed border-slate-300 outline-none font-bold text-slate-700 py-1" value={formData.tax_percent} onChange={e => setFormData({...formData, tax_percent: parseFloat(e.target.value) || 0})} placeholder="0"/>
                                  <span className="text-[10px] text-slate-400 mt-1">{formatIDR(calc.taxAmount)}</span>
                              </div>
                          </div>

                          {/* Grand Total */}
                          <div className="border-t pt-3 flex justify-between items-center mt-2">
                              <span className="font-extrabold text-slate-800 text-base">Total Akhir</span>
                              <span className="font-black text-indigo-700 text-xl">{formatIDR(calc.grandTotal)}</span>
                          </div>
                      </div>
                  </div>
              </div>
          )}
      </AnimatePresence>

      {/* 5. MODAL PICKER */}
      <AnimatePresence>
          {showProductPicker && (
              <div className="fixed inset-0 z-[70] bg-white flex flex-col">
                  <div className="p-4 border-b flex items-center gap-3 bg-white shadow-sm shrink-0"><button onClick={() => { manualItemMode ? setManualItemMode(false) : setShowProductPicker(false) }}><ArrowLeft size={20}/></button>{manualItemMode ? <h2 className="font-bold text-lg text-slate-800 flex-1">Input Manual</h2> : <div className="flex-1 bg-slate-100 rounded-xl flex items-center px-3 py-2"><Search size={16} className="text-slate-400"/><input type="text" autoFocus placeholder="Cari barang..." className="w-full bg-transparent text-sm font-bold outline-none ml-2" value={searchProduct} onChange={e => setSearchProduct(e.target.value)} /></div>}</div>
                  {!manualItemMode ? (
                      <>
                        <div className="px-4 py-2 border-b flex gap-2 overflow-x-auto no-scrollbar bg-slate-50 shrink-0">{uniqueCategories.map(cat => <button key={cat} onClick={() => setFilterCategory(cat)} className={`px-3 py-1 rounded-full text-[10px] font-bold border transition whitespace-nowrap ${filterCategory === cat ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>{cat === 'all' ? 'Semua' : cat}</button>)}</div>
                        {/* --- [UPDATE] UI LIST BARANG YANG LIVE --- */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 pb-24">
                                {/* Tombol Manual Tetap Ada */}
                                <div onClick={() => setManualItemMode(true)} className="bg-white p-3 rounded-xl border border-indigo-200 border-dashed flex justify-between items-center cursor-pointer active:bg-indigo-50">
                                    <h4 className="font-bold text-indigo-600 text-sm flex items-center gap-2"><Plus size={14}/> Input Barang Manual</h4>
                                </div>

                                {pickerList.map(p => { 
                                    const isOut = p.stock <= 0; 
                                    
                                    // Cek Qty LANGSUNG dari FormData (Keranjang Utama), bukan state lokal picker
                                    const itemInCart = formData.items.find(i => i.product_id === p.id);
                                    const qtyInCart = itemInCart ? parseInt(itemInCart.qty) : 0;

                                    return (
                                        <div key={p.id} className={`bg-white p-3 rounded-xl border flex justify-between items-center transition-all ${qtyInCart > 0 ? 'border-indigo-500 ring-1 ring-indigo-500/20 bg-indigo-50/10' : 'border-slate-100'} ${isOut ? 'opacity-60 grayscale' : ''}`}>
                                            <div>
                                                <h4 className="font-bold text-sm text-slate-800">{p.name}</h4>
                                                <p className="text-xs text-indigo-600 font-bold">{formatIDR(p.price)}</p>
                                                <p className={`text-[10px] ${isOut ? 'text-red-500' : 'text-slate-400'}`}>Stok: {p.stock}</p>
                                            </div>

                                            {isOut ? (
                                                <span className="px-3 py-1.5 bg-slate-100 text-slate-400 rounded-lg text-[10px] font-bold">Habis</span>
                                            ) : (
                                                <div>
                                                    {qtyInCart === 0 ? (
                                                        // TOMBOL "AMBIL" (Jika belum ada di keranjang)
                                                        <button 
                                                            onClick={() => handlePickerAction(p, 'set')} 
                                                            className="bg-white border border-indigo-200 text-indigo-600 px-4 py-1.5 rounded-lg text-xs font-bold shadow-sm hover:bg-indigo-50 active:scale-95 transition"
                                                        >
                                                            + Ambil
                                                        </button>
                                                    ) : (
                                                        // STEPPER CONTROL (Jika sudah ada, langsung edit qty real-time)
                                                        <div className="flex items-center bg-indigo-600 rounded-lg shadow-md overflow-hidden">
                                                            <button 
                                                                onClick={() => handlePickerAction(p, 'reduce')} 
                                                                className="w-8 h-8 flex items-center justify-center text-white hover:bg-indigo-700 active:bg-indigo-800 transition"
                                                            >
                                                                <Minus size={14}/>
                                                            </button>
                                                            <div className="w-8 h-8 flex items-center justify-center bg-white text-indigo-700 text-xs font-bold border-x border-indigo-700/20">
                                                                {qtyInCart}
                                                            </div>
                                                            <button 
                                                                onClick={() => handlePickerAction(p, 'add')} 
                                                                className="w-8 h-8 flex items-center justify-center text-white hover:bg-indigo-700 active:bg-indigo-800 transition"
                                                            >
                                                                <Plus size={14}/>
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ) 
                                })}
                            </div>
                        <div className="p-4 bg-white border-t shadow-lg z-20"><button onClick={() => setShowProductPicker(false)} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-sm flex justify-between px-6"><span>Selesai</span><span className="bg-white/20 px-2 py-0.5 rounded text-xs">{formData.items.length} Item</span></button></div>
                      </>
                  ) : (<div className="flex-1 p-6 bg-slate-50"><div className="bg-white p-5 rounded-2xl shadow-sm space-y-4"><div><label className="text-xs font-bold text-slate-500 mb-1 block">Nama Barang</label><input type="text" autoFocus className="w-full p-3 bg-slate-50 rounded-xl outline-none border focus:border-indigo-500 text-sm font-bold" value={manualItemData.name} onChange={e => setManualItemData({...manualItemData, name: e.target.value})} /></div><div><label className="text-xs font-bold text-slate-500 mb-1 block">Harga</label><MoneyInput className="w-full p-3 bg-slate-50 rounded-xl outline-none border focus:border-indigo-500 text-lg font-bold" value={manualItemData.price} onChange={val => setManualItemData({...manualItemData, price: val})} /></div><div><label className="text-xs font-bold text-slate-500 mb-1 block">Qty</label><div className="flex items-center gap-3"><button onClick={() => setManualItemData({...manualItemData, qty: Math.max(1, manualItemData.qty - 1)})} className="w-12 h-12 bg-slate-100 rounded-xl font-bold text-xl">-</button><input type="number" className="flex-1 p-3 bg-slate-50 rounded-xl outline-none border text-center font-bold text-lg" value={manualItemData.qty} onChange={e => setManualItemData({...manualItemData, qty: parseInt(e.target.value)||1})}/><button onClick={() => setManualItemData({...manualItemData, qty: manualItemData.qty + 1})} className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center font-bold text-xl">+</button></div></div></div><button onClick={saveManualItem} className="w-full py-4 mt-6 bg-indigo-600 text-white rounded-xl font-bold shadow-lg">Simpan</button></div>)}
              </div>
          )}
      </AnimatePresence>

      {/* 6. DETAIL (PREVIEW & PRINT) */}
      <AnimatePresence>
          {showDetail && (
              <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowDetail(null)}>
                  <motion.div initial={{scale:0.9}} animate={{scale:1}} className="bg-white w-full max-w-lg h-[90vh] rounded-2xl flex flex-col overflow-hidden relative" onClick={e => e.stopPropagation()}>
                      <div className="p-4 border-b flex justify-between items-center bg-slate-50 shrink-0"><h3 className="font-bold text-slate-800">Detail Invoice</h3><div className="flex gap-2">{showDetail.status !== 'paid' && <button onClick={() => openEditForm(showDetail)} className="p-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200"><Edit3 size={18}/></button>}<button onClick={() => handleDeleteInvoice(showDetail)} className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"><Trash2 size={18}/></button><button onClick={handlePrintNative} className="p-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200"><Printer size={18}/></button><button onClick={() => setShowDetail(null)} className="p-2 bg-slate-200 rounded-lg"><X size={18}/></button></div></div>
                      
                      {/* WRAPPER ID "printable-area" UNTUK CSS PRINT */}
                      <div id="printable-area" className="flex-1 overflow-y-auto p-6 bg-white text-slate-800">
                          {showDetail.items ? (<InvoicePrint invoice={showDetail} storeProfile={{ storeName: activeEmployee?.storeName || user?.user_metadata?.full_name || 'Toko Anda' }} />) : (<div className="flex justify-center items-center h-full"><Loader2 className="animate-spin text-indigo-600"/></div>)}
                      </div>
                      
                      {showDetail.status === 'unpaid' && (<div className="p-4 bg-white border-t no-print shrink-0">
                        <button onClick={() => handleOpenPayModal(showDetail)} className="w-full py-3 bg-green-600 text-white rounded-xl font-bold shadow-lg hover:bg-green-700 transition flex items-center justify-center gap-2">
                            <CheckCircle2 size={18}/> Terima Pembayaran
                        </button></div>)}
                  </motion.div>
              </div>
          )}
      </AnimatePresence>

      {/* 7. MODAL PILIH WALLET (PAYMENT) */}
      <AnimatePresence>
          {showPayModal && (
              <div className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowPayModal(false)}>
                  <motion.div initial={{scale:0.9, opacity:0}} animate={{scale:1, opacity:1}} exit={{scale:0.9, opacity:0}} className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                      <div className="text-center mb-6">
                          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 text-green-600">
                              <CheckCircle2 size={24} />
                          </div>
                          <h3 className="font-bold text-lg text-slate-800">Terima Pembayaran</h3>
                          <p className="text-xs text-slate-500 mt-1">
                              Invoice <span className="font-mono font-bold text-slate-700">{selectedInvoice?.invoice_number}</span>
                          </p>
                          <p className="text-2xl font-black text-indigo-600 mt-2">
                              {formatIDR(selectedInvoice?.total_amount)}
                          </p>
                      </div>

                      <div className="space-y-4">
                          <div>
                              <label className="text-xs font-bold text-slate-500 mb-2 block">Masuk ke Dompet Mana?</label>
                              <div className="relative">
                                  <select 
                                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-500 appearance-none"
                                      value={payWalletId}
                                      onChange={e => setPayWalletId(e.target.value)}
                                  >
                                      <option value="">-- Pilih Sumber Dana --</option>
                                      {wallets.map(w => (
                                          <option key={w.id} value={w.id}>
                                              {w.name} (Saldo: {formatIDR(w.initial_balance)})
                                          </option>
                                      ))}
                                  </select>
                                  <div className="absolute right-3 top-3.5 pointer-events-none text-slate-400">
                                      <ShoppingBag size={16}/>
                                  </div>
                              </div>
                          </div>

                          <button 
                              onClick={handleConfirmPayment} 
                              disabled={processing}
                              className="w-full py-3 bg-green-600 text-white rounded-xl font-bold shadow-lg hover:bg-green-700 active:scale-95 transition flex justify-center items-center gap-2"
                          >
                              {processing ? <Loader2 className="animate-spin" size={18}/> : "Konfirmasi Pembayaran"}
                          </button>
                      </div>
                  </motion.div>
              </div>
          )}
      </AnimatePresence>

      <ModalInfo isOpen={notif.isOpen} type={notif.type} title={notif.title} message={notif.message} onClose={() => setNotif(prev => ({...prev, isOpen: false}))} />
    </div>
  );
}