import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import ModalInfo from '../../components/ModalInfo';
import { 
  Search, ShoppingCart, Trash2, Plus, Minus, 
  ArrowLeft, User, Grid, X, Loader2, 
  CheckCircle2, Printer, Edit3, Utensils, Coffee, Package, Briefcase, Tag, ChevronDown, Wallet, Receipt, Clock, QrCode, CreditCard, Banknote, Calendar, AlertTriangle, History
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const formatIDR = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

export default function POSPage() {
  const navigate = useNavigate();
  
  // --- STATE ---
  const [session, setSession] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [wallets, setWallets] = useState([]); 
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Transaksi
  const [activeBillId, setActiveBillId] = useState(null); 
  const [customerName, setCustomerName] = useState('');

  // UI
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('Semua');
  const [activeType, setActiveType] = useState('all'); 
  const [showCartMobile, setShowCartMobile] = useState(false);
  
  // Modals
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showOpenBillsModal, setShowOpenBillsModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false); 
  
  const [openBills, setOpenBills] = useState([]);
  const [historyTrx, setHistoryTrx] = useState([]); 
  const [openBillSearch, setOpenBillSearch] = useState(''); 
  
  // Payment Logic
  const [paymentStep, setPaymentStep] = useState('METHOD'); 
  const [selectedMethod, setSelectedMethod] = useState(''); 
  const [selectedWallet, setSelectedWallet] = useState('');
  
  const [processing, setProcessing] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [editingItem, setEditingItem] = useState(null);

  // Notif
  const [notif, setNotif] = useState({ isOpen: false, type: 'info', title: '', message: '' });
  const showAlert = (type, title, message) => setNotif({ isOpen: true, type, title, message });

  // 1. INIT
  useEffect(() => {
    const init = async () => {
        const savedSession = localStorage.getItem('active_employee_session');
        const userSession = await supabase.auth.getUser();
        let currentStoreId = null;

        if (userSession?.data?.user) {
            currentStoreId = userSession.data.user.id;
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', currentStoreId).single();
            setSession({
                id: currentStoreId, name: profile?.full_name || 'Owner', role: 'Pemilik',
                storeId: currentStoreId, storeName: profile?.business_name || 'Toko Saya'
            });
        } else if (savedSession) {
            const parsed = JSON.parse(savedSession);
            currentStoreId = parsed.storeId;
            setSession(parsed);
        } else {
            navigate('/login');
            return;
        }

        if (currentStoreId) {
            fetchProducts(currentStoreId);
            fetchWallets(currentStoreId);
        }
    };
    init();
  }, []);

  const fetchProducts = async (storeId) => {
      setLoading(true);
      const { data } = await supabase.from('products').select('*').eq('user_id', storeId).order('name');
      if (data) {
          setProducts(data);
          const cats = ['Semua', ...new Set(data.map(p => p.category).filter(Boolean))].sort();
          setCategories(cats);
      }
      setLoading(false);
  };

  const fetchWallets = async (storeId) => {
      const { data } = await supabase.from('wallets').select('id, name, type').eq('user_id', storeId);
      if (data) {
          const mapped = data.map(w => ({ ...w, type: (w.type || 'cash').toLowerCase() }));
          setWallets(mapped);
      }
  };

  // --- FETCH DATA ---
  const fetchOpenBills = async () => {
      if (!session) return;
      setProcessing(true);
      try {
          const { data, error } = await supabase.rpc('get_open_bills', { p_store_id: session.storeId });
          if (error) throw error;
          setOpenBills(data || []);
          setOpenBillSearch(''); 
          setShowOpenBillsModal(true);
      } catch (e) {
          showAlert('error', 'Gagal', e.message);
      } finally {
          setProcessing(false);
      }
  };

  const fetchHistory = async () => {
      if (!session) return;
      setProcessing(true);
      try {
          const { data, error } = await supabase
              .from('transaction_headers')
              .select(`id, total_amount, payment_method, merchant, created_at, tax_amount, employee_id, transaction_items ( id, name, qty, price )`)
              .eq('user_id', session.storeId)
              .eq('type', 'income')
              .order('created_at', { ascending: false })
              .limit(20);

          if (error) throw error;
          setHistoryTrx(data || []);
          setShowHistoryModal(true);
      } catch (e) {
          showAlert('error', 'Gagal Load History', e.message);
      } finally {
          setProcessing(false);
      }
  };

  // --- HELPER FUNCTIONS ---
  const resetState = () => {
      setCart([]); setCustomerName(''); setActiveBillId(null);
      setShowCartMobile(false); setShowPaymentModal(false);
  };

  const buildItemsPayload = () => {
      return cart.map(item => ({
          product_id: item.id, 
          name: item.notes ? `${item.name} (${item.notes})` : item.name, 
          price: Math.floor(Number(item.price) || 0), 
          cost: Math.floor(Number(item.cost_price) || 0), 
          qty: Number(item.qty) || 1, 
          type: item.product_type || 'retail', 
          notes: item.notes ? String(item.notes) : ''
      }));
  };

  // --- LOGIC ---
  const handleRecallBill = (bill) => {
      const recalledCart = bill.items.map(item => ({
          id: item.product_id, name: item.name, price: Number(item.price), cost_price: Number(item.cost), qty: Number(item.qty), product_type: item.type, image_url: item.image_url, notes: item.notes || '' 
      }));
      setCart(recalledCart);
      setCustomerName(bill.customer === 'Pelanggan Umum' ? '' : bill.customer);
      setActiveBillId(bill.id); 
      setShowOpenBillsModal(false);
      setShowCartMobile(true); 
  };

  const handleReprint = (trx) => {
      setSuccessData({
          id: trx.id, total: trx.total_amount, tax: trx.tax_amount || 0, items: trx.transaction_items || [], status: 'paid',
          date: new Date(trx.created_at), storeName: session.storeName, cashier: session.name, method: trx.payment_method
      });
      // UPDATE: Tutup modal history agar langsung fokus ke struk
      setShowHistoryModal(false);
  };

  const addToCart = (product) => {
      setCart(prev => {
          const existIdx = prev.findIndex(item => item.id === product.id && !item.notes);
          if (existIdx >= 0) {
              const newCart = [...prev]; newCart[existIdx].qty += 1; return newCart;
          }
          return [...prev, { ...product, qty: 1, notes: '' }];
      });
  };

  const updateCartItem = (idx, updates) => setCart(prev => prev.map((item, i) => i === idx ? { ...item, ...updates } : item));
  const removeCartItem = (idx) => setCart(prev => prev.filter((_, i) => i !== idx));
  const calculateTotal = () => cart.reduce((acc, item) => acc + (item.price * item.qty), 0);

  // --- CHECKOUT ---
  const openPaymentModal = () => {
      setPaymentStep('METHOD');
      setSelectedWallet('');
      setShowPaymentModal(true);
  };

  const handleSelectMethod = (method) => {
      setSelectedMethod(method);
      if (method === 'CASH') {
          const cashWallet = wallets.find(w => w.type === 'cash');
          if (cashWallet) {
              setSelectedWallet(cashWallet.id);
              handleProcessTransaction('paid', 'CASH', cashWallet.id);
          } else {
              setPaymentStep('WALLET');
          }
      } else {
          setPaymentStep('WALLET');
      }
  };

  const getFilteredWallets = () => {
      if (!selectedMethod) return [];
      if (selectedMethod === 'CASH') return wallets.filter(w => w.type === 'cash');
      return wallets.filter(w => w.type === 'bank' || w.type === 'ewallet');
  };

  // --- DIRECT INSERT (LOGIKA SUKSES) ---
  const handleSaveOpenBill = async () => {
      setProcessing(true);
      try {
          if (!session?.storeId) throw new Error("Sesi toko hilang.");
          if (activeBillId) await supabase.from('open_bills').delete().eq('id', activeBillId);

          const { data: billData, error: billError } = await supabase.from('open_bills').insert({
              user_id: session.storeId, customer_name: customerName || 'Pelanggan Umum', total_amount: Math.round(calculateTotal())
          }).select().single();

          if (billError) throw billError;

          const itemsToInsert = cart.map(item => ({
              bill_id: billData.id, product_id: item.id, product_name: item.name, price: Math.floor(Number(item.price)),
              cost: Math.floor(Number(item.cost_price) || 0), qty: Number(item.qty), product_type: item.product_type || 'retail', notes: item.notes || ''
          }));

          const { error: itemsError } = await supabase.from('open_bill_items').insert(itemsToInsert);
          if (itemsError) throw itemsError;

          for (const item of cart) {
              if (item.product_type === 'retail') await supabase.rpc('decrement_stock', { row_id: item.id, quantity: item.qty });
          }

          showAlert('success', 'Tersimpan', 'Pesanan masuk daftar Open Bill');
          resetState();
      } catch (e) {
          showAlert('error', 'Gagal Simpan', e.message);
      } finally {
          setProcessing(false);
      }
  };

  const handleProcessTransaction = async (status, method, walletId) => {
      setProcessing(true);
      try {
          if (!session?.storeId) throw new Error("Sesi toko hilang.");
          if (status === 'paid' && !walletId && method !== 'CASH') throw new Error("Pilih Wallet dulu.");
          if (activeBillId) await supabase.from('open_bills').delete().eq('id', activeBillId);

          const { data: trxData, error: trxError } = await supabase.from('transaction_headers').insert({
              user_id: session.storeId, wallet_id: walletId || null, merchant: customerName || 'Pelanggan Umum',
              total_amount: Math.round(calculateTotal()), tax_amount: 0, type: 'income', category: 'Penjualan',
              allocation_type: 'BUSINESS', description: 'Transaksi POS', payment_method: method,
              payment_status: 'paid', employee_id: session.role === 'Pemilik' ? null : session.id
          }).select().single();

          if (trxError) throw trxError;

          const itemsToInsert = cart.map(item => ({
              header_id: trxData.id, product_id: item.id, name: item.notes ? `${item.name} (${item.notes})` : item.name,
              price: Math.floor(Number(item.price)), qty: Number(item.qty), cost_at_sale: Math.floor(Number(item.cost_price) || 0),
              assigned_employee_id: session.role === 'Pemilik' ? null : session.id
          }));

          const { error: itemsError } = await supabase.from('transaction_items').insert(itemsToInsert);
          if (itemsError) throw itemsError;

          if (!activeBillId) { 
              for (const item of cart) {
                  if (item.product_type === 'retail') await supabase.rpc('decrement_stock', { row_id: item.id, quantity: item.qty });
              }
          }

          if (status === 'paid' && walletId) {
              await supabase.rpc('increment_wallet_balance', { p_wallet_id: walletId, p_amount: Math.round(calculateTotal()) });
          }

          setSuccessData({
              id: trxData.id, total: calculateTotal(), items: cart, status: 'paid',
              date: new Date(), storeName: session.storeName, cashier: session.name, method: method
          });
          resetState();
      } catch (e) {
          console.error("Payment Error:", e);
          showAlert('error', 'Gagal Bayar', e.message);
      } finally {
          setProcessing(false);
      }
  };

  // --- RENDER ---
  const renderProductIcon = (prod) => {
      if (prod.image_url) return <img src={prod.image_url} className="w-full h-full object-cover"/>;
      if (prod.product_type === 'service') return <Briefcase className="text-blue-400" size={24}/>;
      if (prod.category?.toLowerCase().includes('minum')) return <Coffee className="text-orange-400" size={24}/>;
      return <Utensils className="text-orange-400" size={24}/>;
  };

  const filteredProducts = products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = activeCategory === 'Semua' || p.category === activeCategory;
      const matchType = activeType === 'all' || p.product_type === activeType;
      return matchSearch && matchCat && matchType;
  });

  const filteredBills = openBills.filter(bill => bill.customer.toLowerCase().includes(openBillSearch.toLowerCase()));

  if (!session) return null;

  return (
    <div className="h-screen bg-slate-50 font-sans flex flex-col md:flex-row overflow-hidden pos-container">
      
      {/* CSS PRINT (STRUK FIX) */}
      <style>{`
        .print-area-wrapper { display: none; }
        @media print {
          body * { visibility: hidden; height: 0; overflow: hidden; }
          body, html { margin: 0; padding: 0; height: 100%; width: 100%; }
          .print-area-wrapper, .print-area-wrapper * { visibility: visible !important; display: block !important; height: auto !important; overflow: visible !important; }
          .print-area-wrapper { position: absolute; left: 0; top: 0; width: 58mm; padding: 0 5px; background: white; z-index: 9999; }
          .modal-overlay { display: none !important; }
        }
      `}</style>

      {/* KIRI: KATALOG */}
      <div className="flex-1 flex flex-col h-full relative border-r border-slate-200">
          <div className="bg-white p-4 pb-0 flex flex-col gap-3 z-10 shrink-0 shadow-sm">
              <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                      <button onClick={() => navigate(session.role==='Pemilik'?'/dashboard':'/employee-dashboard')} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition"><ArrowLeft size={20}/></button>
                      <div><h1 className="font-extrabold text-base md:text-lg text-slate-800 leading-none truncate max-w-[150px]">{session.storeName}</h1><p className="text-[10px] text-slate-400 mt-0.5">{session.name}</p></div>
                  </div>
                  <div className="hidden md:flex bg-slate-100 rounded-xl px-3 py-2.5 items-center gap-2 w-72"><Search size={18} className="text-slate-400"/><input type="text" placeholder="Cari menu..." className="bg-transparent outline-none text-sm w-full font-medium" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
              </div>
              <div className="w-full overflow-x-auto no-scrollbar pb-3">
                  <div className="flex gap-2 min-w-max px-1">
                      <select className="bg-slate-100 text-[10px] font-bold text-slate-600 rounded-xl px-3 py-2 outline-none border-r border-slate-200 shrink-0" value={activeType} onChange={e=>setActiveType(e.target.value)}><option value="all">Semua Tipe</option><option value="retail">Jual Langsung</option><option value="manufacture">Racikan</option><option value="service">Jasa</option></select>
                      {categories.map(cat => (<button key={cat} onClick={() => setActiveCategory(cat)} className={`px-4 py-2 rounded-xl text-[10px] font-bold whitespace-nowrap transition border shrink-0 ${activeCategory === cat ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>{cat}</button>))}
                  </div>
              </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50 pb-36 md:pb-4">
              {loading ? <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-slate-400"/></div> : 
               filteredProducts.length === 0 ? <div className="h-full flex items-center justify-center text-slate-400 text-sm font-bold">Produk tidak ditemukan</div> :
               <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                  {filteredProducts.map(product => (
                      <div key={product.id} onClick={() => addToCart(product)} className="bg-white rounded-2xl p-2 md:p-3 shadow-sm hover:shadow-lg border border-slate-200 cursor-pointer active:scale-95 transition flex flex-col h-full group relative overflow-hidden">
                          <div className="absolute top-2 right-2 z-10"><span className={`px-1.5 py-0.5 rounded-md text-[8px] font-bold shadow-sm backdrop-blur-sm ${product.product_type==='service'?'bg-blue-100 text-blue-700':product.product_type==='manufacture'?'bg-purple-100 text-purple-700':'bg-white/90 text-slate-600'}`}>{product.product_type==='manufacture'?'Auto':product.product_type==='service'?'Jasa':product.stock}</span></div>
                          <div className="aspect-square bg-slate-50 rounded-xl mb-2 flex items-center justify-center overflow-hidden relative">{renderProductIcon(product)}</div>
                          <h3 className="font-bold text-slate-800 text-xs md:text-sm leading-tight mb-1 line-clamp-2">{product.name}</h3>
                          <div className="mt-auto flex justify-between items-end">
                              <div>{product.compare_at_price > 0 && <p className="text-[8px] text-slate-400 line-through decoration-red-400">{formatIDR(product.compare_at_price)}</p>}<p className="text-indigo-600 font-extrabold text-xs md:text-sm">{formatIDR(product.price)}</p></div>
                              <div className="w-6 h-6 md:w-8 md:h-8 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600"><Plus size={14}/></div>
                          </div>
                      </div>
                  ))}
               </div>
              }
          </div>
          <div className="md:hidden absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-slate-100 via-slate-100 to-transparent z-40"><button onClick={() => setShowCartMobile(true)} className="w-full bg-slate-900 text-white p-4 rounded-2xl font-bold flex justify-between items-center shadow-xl shadow-slate-400/20 active:scale-95 transition"><div className="flex items-center gap-3"><div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-sm font-bold">{cart.reduce((a,b)=>a+b.qty,0)}</div><span className="text-sm">Keranjang</span></div><span className="text-lg font-extrabold">{formatIDR(calculateTotal())}</span></button></div>
      </div>

      {/* KANAN */}
      <div className="hidden md:flex w-96 bg-white flex-col h-full shadow-2xl z-20 border-l border-slate-100">
          <CartSection cart={cart} updateCartItem={updateCartItem} removeCartItem={removeCartItem} total={calculateTotal()} onCheckout={openPaymentModal} processing={processing} onEditItem={setEditingItem} customerName={customerName} setCustomerName={setCustomerName} onOpenBills={fetchOpenBills} onHistory={fetchHistory} />
      </div>

      {/* MOBILE CART */}
      <AnimatePresence>
          {showCartMobile && (
              <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="md:hidden fixed inset-0 z-50 bg-white flex flex-col h-full">
                  <div className="p-4 border-b flex justify-between items-center shadow-sm shrink-0"><h2 className="font-extrabold text-xl text-slate-800">Pesanan</h2><button onClick={()=>setShowCartMobile(false)} className="p-2 bg-slate-100 rounded-full"><ChevronDown size={24}/></button></div>
                  <div className="flex-1 overflow-hidden"><CartSection cart={cart} updateCartItem={updateCartItem} removeCartItem={removeCartItem} total={calculateTotal()} onCheckout={openPaymentModal} processing={processing} onEditItem={setEditingItem} customerName={customerName} setCustomerName={setCustomerName} onOpenBills={fetchOpenBills} onHistory={fetchHistory}/></div>
              </motion.div>
          )}
      </AnimatePresence>

      {/* MODAL OPEN BILL (TAMPILAN DIKEMBALIKAN KE VERSI DETAIL) */}
      <AnimatePresence>
          {showOpenBillsModal && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-0 z-[80] bg-slate-50 flex flex-col h-screen w-screen">
                  <div className="p-4 border-b flex justify-between items-center bg-white shadow-sm shrink-0"><div className="flex items-center gap-3"><button onClick={()=>setShowOpenBillsModal(false)} className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-600"><ArrowLeft size={24}/></button><h3 className="font-extrabold text-xl text-slate-800">Daftar Open Bill</h3></div><div className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">{filteredBills.length} Pesanan</div></div>
                  <div className="p-4 bg-white border-b shrink-0"><div className="bg-slate-100 rounded-xl px-4 py-3 flex items-center gap-2 border border-transparent focus-within:border-indigo-500 focus-within:bg-white transition"><Search size={20} className="text-slate-400"/><input type="text" autoFocus placeholder="Cari nama..." className="bg-transparent outline-none text-base w-full font-medium text-slate-700" value={openBillSearch} onChange={e => setOpenBillSearch(e.target.value)} /></div></div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">{filteredBills.length === 0 ? <div className="flex flex-col items-center justify-center h-64 text-slate-400"><Receipt size={48} className="mb-2 opacity-30"/><p className="font-medium">Tidak ada open bill.</p></div> : filteredBills.map(bill => (<div key={bill.id} onClick={() => handleRecallBill(bill)} className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm hover:border-indigo-500 cursor-pointer transition group active:scale-98"><div className="flex justify-between items-start mb-3"><div className="flex items-center gap-2"><div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600"><Clock size={20}/></div><div><span className="font-bold text-slate-800 block text-lg leading-tight">{bill.customer || 'Pelanggan Umum'}</span><span className="text-xs text-slate-400 flex items-center gap-1"><Calendar size={10}/> {new Date(bill.date).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span></div></div><span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded-lg font-bold group-hover:bg-indigo-600 group-hover:text-white transition">Recall</span></div><div className="space-y-1 mb-3 pl-12 border-l-2 border-slate-100">{bill.items.slice(0, 2).map((item, idx) => <div key={idx} className="flex justify-between text-sm text-slate-600"><span>{item.qty}x {item.name}</span></div>)}{bill.items.length > 2 && <span className="text-xs text-slate-400 italic">+ {bill.items.length - 2} item lainnya...</span>}</div><div className="flex justify-between items-center border-t border-dashed pt-3 mt-2"><span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total</span><span className="font-extrabold text-xl text-indigo-600">{formatIDR(bill.total)}</span></div></div>))}</div>
              </motion.div>
          )}
      </AnimatePresence>

      {/* MODAL HISTORY (TAMPILAN DIKEMBALIKAN KE VERSI DETAIL) */}
      <AnimatePresence>
          {showHistoryModal && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-0 z-[80] bg-slate-50 flex flex-col h-screen w-screen">
                  <div className="p-4 border-b flex justify-between items-center bg-white shadow-sm shrink-0"><div className="flex items-center gap-3"><button onClick={()=>setShowHistoryModal(false)} className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-600"><ArrowLeft size={24}/></button><h3 className="font-extrabold text-xl text-slate-800">Riwayat Transaksi</h3></div></div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">{historyTrx.length === 0 ? <div className="flex flex-col items-center justify-center h-64 text-slate-400"><History size={48} className="mb-2 opacity-30"/><p className="font-medium">Belum ada transaksi.</p></div> : historyTrx.map(trx => (<div key={trx.id} onClick={() => handleReprint(trx)} className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm hover:border-green-500 cursor-pointer transition group active:scale-98"><div className="flex justify-between items-start mb-2"><div className="flex items-center gap-2"><div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600"><CheckCircle2 size={20}/></div><div><span className="font-bold text-slate-800 block">{trx.merchant || 'Umum'}</span><span className="text-[10px] text-slate-400">{new Date(trx.created_at).toLocaleString()}</span></div></div><span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-lg">{trx.payment_method}</span></div><div className="flex justify-between items-center border-t border-dashed pt-3 mt-2"><span className="text-xs text-slate-500 flex items-center gap-1"><Printer size={12}/> Cetak Struk</span><span className="font-extrabold text-lg text-slate-900">{formatIDR(trx.total_amount)}</span></div></div>))}</div>
              </motion.div>
          )}
      </AnimatePresence>

      {/* MODAL PAYMENT */}
      <AnimatePresence>
          {showPaymentModal && (
              <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 modal-overlay">
                  <motion.div initial={{y:"100%"}} animate={{y:0}} exit={{y:"100%"}} className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 flex flex-col max-h-[90vh]">
                      <div className="flex justify-between items-center mb-4"><h3 className="font-extrabold text-xl text-slate-800">Metode Pembayaran</h3><button onClick={() => setShowPaymentModal(false)} className="p-1 rounded-full bg-slate-100"><X size={20}/></button></div>
                      {paymentStep === 'METHOD' ? (
                          <div className="space-y-3">
                              <div className="grid grid-cols-3 gap-3 mb-6"><button onClick={() => handleSelectMethod('CASH')} className="flex flex-col items-center justify-center p-4 bg-green-50 border border-green-100 rounded-2xl gap-2 hover:bg-green-100 transition"><Banknote size={24} className="text-green-600"/> <span className="text-xs font-bold text-green-800">TUNAI</span></button><button onClick={() => handleSelectMethod('TRANSFER')} className="flex flex-col items-center justify-center p-4 bg-blue-50 border border-blue-100 rounded-2xl gap-2 hover:bg-blue-100 transition"><CreditCard size={24} className="text-blue-600"/> <span className="text-xs font-bold text-blue-800">TRANSFER</span></button><button onClick={() => handleSelectMethod('QRIS')} className="flex flex-col items-center justify-center p-4 bg-purple-50 border border-purple-100 rounded-2xl gap-2 hover:bg-purple-100 transition"><QrCode size={24} className="text-purple-600"/> <span className="text-xs font-bold text-purple-800">QRIS</span></button></div>
                              <div className="border-t border-slate-100 pt-4"><button onClick={handleSaveOpenBill} disabled={processing} className="w-full py-3 bg-white border-2 border-orange-200 text-orange-600 rounded-xl font-bold hover:bg-orange-50 active:scale-95 transition flex justify-center items-center gap-2">{processing ? <Loader2 className="animate-spin"/> : <><Clock size={18}/> Simpan (Open Bill)</>}</button></div>
                          </div>
                      ) : (
                          <div className="space-y-4">
                              <p className="text-sm text-slate-500">Pilih akun penerima untuk {selectedMethod}:</p>
                              {getFilteredWallets().length === 0 ? <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200"><AlertTriangle className="mx-auto text-orange-400 mb-2"/><p className="text-xs font-bold text-slate-500">Belum ada wallet Bank/E-Wallet.</p></div> : <div className="space-y-2 max-h-60 overflow-y-auto">{getFilteredWallets().map(w => (<button key={w.id} onClick={() => handleProcessTransaction('paid', selectedMethod, w.id)} className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3 hover:border-indigo-500 hover:bg-indigo-50 transition"><Wallet size={18} className="text-slate-400"/><span className="font-bold text-slate-700">{w.name}</span></button>))}</div>}
                              <button onClick={() => setPaymentStep('METHOD')} className="text-xs text-slate-400 font-bold underline w-full text-center">Kembali</button>
                          </div>
                      )}
                  </motion.div>
              </div>
          )}
      </AnimatePresence>

      {/* MODAL EDIT ITEM */}
      <AnimatePresence>
          {editingItem !== null && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 modal-overlay">
                  <motion.div initial={{scale:0.9}} animate={{scale:1}} className="bg-white w-full max-w-xs rounded-2xl p-5 shadow-2xl">
                      <h3 className="font-bold text-lg mb-4 text-slate-800">Edit Pesanan</h3>
                      <div className="space-y-4"><input type="text" placeholder="Catatan..." className="w-full p-3 bg-slate-50 rounded-xl border outline-none" value={cart[editingItem]?.notes || ''} onChange={(e) => updateCartItem(editingItem, { notes: e.target.value })}/><div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border"><button onClick={() => updateCartItem(editingItem, { qty: Math.max(1, cart[editingItem].qty - 1) })} className="w-8 h-8 bg-white border rounded flex items-center justify-center"><Minus size={16}/></button><span className="font-bold">{cart[editingItem]?.qty}</span><button onClick={() => updateCartItem(editingItem, { qty: cart[editingItem].qty + 1 })} className="w-8 h-8 bg-white border rounded flex items-center justify-center"><Plus size={16}/></button></div></div>
                      <button onClick={() => setEditingItem(null)} className="w-full mt-5 py-3 bg-indigo-600 text-white rounded-xl font-bold">Selesai</button>
                  </motion.div>
              </div>
          )}
      </AnimatePresence>

      <ModalInfo isOpen={notif.isOpen} type={notif.type} title={notif.title} message={notif.message} onClose={() => setNotif(prev => ({...prev, isOpen: false}))} onConfirm={notif.onConfirm} confirmText={notif.confirmText} />
      
      {/* SUCCESS & PRINT */}
      <AnimatePresence>
          {successData && (
              <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 modal-overlay">
                  <motion.div initial={{scale:0.8}} animate={{scale:1}} className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl text-center">
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600"><CheckCircle2 size={32}/></div>
                      <h2 className="text-xl font-extrabold text-slate-800 mb-1">Berhasil!</h2>
                      <p className="text-slate-500 text-xs mb-6">{successData.status === 'paid' ? 'Pembayaran diterima.' : 'Pesanan disimpan.'}</p>
                      <div className="grid grid-cols-2 gap-3"><button onClick={() => window.print()} className="py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-2"><Printer size={16}/> Struk</button><button onClick={() => setSuccessData(null)} className="py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs">Baru</button></div>
                  </motion.div>
              </div>
          )}
      </AnimatePresence>

      {/* --- AREA CETAK STRUK (TERSEMBUNYI TAPI SIAP CETAK) --- */}
      {successData && (
          <div className="print-area-wrapper">
              <div className="w-[58mm] mx-auto text-black font-mono text-[10px] leading-tight text-center">
                  <div className="font-bold text-sm mb-1">{successData.storeName}</div>
                  <div className="mb-2">{new Date(successData.date).toLocaleString()}</div>
                  <div className="mb-2">Kasir: {successData.cashier}</div>
                  <div className="border-b border-black border-dashed my-1"></div>
                  {successData.items.map((i,idx) => (
                      <div key={idx} className="flex justify-between text-left mb-1"><div className="w-[60%]">{i.qty}x {i.name.substring(0, 20)}</div><div className="w-[40%] text-right">{formatIDR(i.price * i.qty)}</div></div>
                  ))}
                  <div className="border-b border-black border-dashed my-1"></div>
                  <div className="flex justify-between font-bold text-sm mt-1"><span>TOTAL</span><span>{formatIDR(successData.total)}</span></div>
                  <div className="mt-2 text-center font-bold">{successData.status === 'paid' ? 'LUNAS' : 'OPEN BILL'} ({successData.method})</div>
                  <div className="mt-4 text-center">Terima Kasih</div>
              </div>
          </div>
      )}
    </div>
  );
}

const CartSection = ({ cart, updateCartItem, removeCartItem, total, onCheckout, processing, onEditItem, customerName, setCustomerName, onOpenBills, onHistory }) => (
    <div className="flex flex-col h-full bg-slate-50">
        <div className="p-4 bg-white border-b flex justify-between items-center shadow-sm shrink-0">
            <input type="text" placeholder="Nama Pelanggan" className="bg-slate-100 px-3 py-2 rounded-lg text-xs w-2/5 outline-none border border-transparent focus:border-indigo-500 focus:bg-white transition" value={customerName} onChange={e=>setCustomerName(e.target.value)}/>
            <div className="flex gap-2"><button onClick={onHistory} className="text-slate-500 text-xs font-bold flex items-center gap-1 hover:bg-slate-100 p-2 rounded-lg transition"><History size={14}/> Riwayat</button><button onClick={onOpenBills} className="text-orange-600 text-xs font-bold flex items-center gap-1 hover:bg-orange-50 p-2 rounded-lg transition"><Receipt size={14}/> Open Bill</button></div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-6">
            {cart.length === 0 ? <div className="flex flex-col items-center justify-center h-full text-slate-400 select-none"><ShoppingCart size={48} className="mb-2 opacity-20"/><p className="text-sm font-medium opacity-50">Kosong</p></div> : cart.map((item, idx) => (<div key={idx} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex gap-3 group relative items-start"><div className="flex-1 min-w-0 cursor-pointer pr-6" onClick={() => onEditItem(idx)}><h4 className="font-bold text-slate-800 text-sm truncate">{item.name}</h4><div className="flex justify-between items-center"><span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-bold">x{item.qty}</span><p className="text-xs font-bold text-indigo-600">{formatIDR(item.price * item.qty)}</p></div>{item.notes && <p className="text-[10px] text-orange-500 italic mt-1 truncate"><Edit3 size={8}/> {item.notes}</p>}</div><button onClick={(e) => {e.stopPropagation(); removeCartItem(idx);}} className="absolute top-2 right-2 p-1.5 text-slate-300 hover:text-red-500"><X size={14}/></button></div>))}
        </div>
        <div className="p-5 bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-20 shrink-0 pb-8 md:pb-5">
            <div className="flex justify-between items-end mb-4"><span className="text-slate-500 text-xs font-bold uppercase">Total</span><span className="text-2xl font-extrabold text-slate-900">{formatIDR(total)}</span></div>
            <button onClick={onCheckout} disabled={cart.length === 0 || processing} className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold shadow-lg hover:bg-slate-800 disabled:opacity-50 active:scale-95 transition flex justify-center items-center gap-2">{processing ? <Loader2 className="animate-spin" size={20}/> : "Proses Pembayaran"}</button>
        </div>
    </div>
);