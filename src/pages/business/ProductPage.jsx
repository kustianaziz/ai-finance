import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthProvider';
import ModalInfo from '../../components/ModalInfo';
import MoneyInput from '../../components/MoneyInput';
import { 
  ArrowLeft, Plus, Search, Package, Loader2, 
  X, Utensils, Trash2, Camera, Edit2, Briefcase, Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ProductPage() {
  const navigate = useNavigate();
  const { user, activeEmployee } = useAuth();
  const ownerId = user?.id || activeEmployee?.storeId;

  // --- STATE DATA ---
  const [products, setProducts] = useState([]);
  const [ingredients, setIngredients] = useState([]); 
  const [warehouses, setWarehouses] = useState([]);   
  const [categories, setCategories] = useState([]);   // List Kategori Unik
  
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, retail: 0, manufacture: 0, service: 0 });

  // --- FILTER ---
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all'); // State Filter Kategori

  // --- MODAL & FORM ---
  const [showModal, setShowModal] = useState(false);
  const [formTab, setFormTab] = useState('info'); 
  const [processing, setProcessing] = useState(false);
  
  // Gambar
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  // Resep Selector
  const [showIngredientModal, setShowIngredientModal] = useState(false);
  const [ingSearch, setIngSearch] = useState('');
  const [ingFilterWh, setIngFilterWh] = useState('all');
  const [ingFilterType, setIngFilterType] = useState('all');
  const [selectedIngId, setSelectedIngId] = useState(null); 
  const [ingQtyInput, setIngQtyInput] = useState(''); 

  // Notif & Confirm
  const [notif, setNotif] = useState({ isOpen: false, type: 'info', title: '', message: '', onConfirm: null });
  const showAlert = (type, title, message) => setNotif({ isOpen: true, type, title, message, onConfirm: null });
  const showConfirm = (title, message, onConfirmAction) => setNotif({ isOpen: true, type: 'error', title, message, onConfirm: onConfirmAction, confirmText: 'Ya, Hapus' });

  // --- FORM DATA ---
  const [formData, setFormData] = useState({
      id: null, name: '', sku: '', category: '', 
      price: 0, compare_at_price: 0, cost_price: 0, stock: 0, 
      product_type: 'retail', recipe_yield: 1,
      image_url: null,
      recipes: [] 
  });

  useEffect(() => { if (ownerId) fetchData(); }, [ownerId]);

  // --- FETCHING ---
  const fetchData = async () => {
      try {
          setLoading(true);
          const { data: prodData } = await supabase.from('products').select('*').eq('user_id', ownerId).order('name');
          setProducts(prodData || []);

          if (prodData) {
              // Ambil kategori unik & urutkan
              const uniqueCats = [...new Set(prodData.map(p => p.category).filter(Boolean))].sort();
              setCategories(uniqueCats);
              
              setStats({
                  total: prodData.length,
                  retail: prodData.filter(p=>p.product_type==='retail').length,
                  manufacture: prodData.filter(p=>p.product_type==='manufacture').length,
                  service: prodData.filter(p=>p.product_type==='service').length
              });
          }

          const { data: invData } = await supabase.from('inventory_items').select('id, name, unit, cost_per_unit, current_stock, type, warehouses(id, name)').eq('user_id', ownerId).order('name');
          setIngredients(invData || []);

          const { data: whData } = await supabase.from('warehouses').select('id, name').eq('user_id', ownerId);
          setWarehouses(whData || []);

      } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  // --- ACTIONS ---
  const handleOpenAdd = () => {
      setFormData({ 
          id: null, name: '', sku: '', category: '', 
          price: 0, compare_at_price: 0, cost_price: 0, stock: 0, 
          product_type: 'retail', recipe_yield: 1, image_url: null,
          recipes: [] 
      });
      setImageFile(null);
      setImagePreview(null);
      setFormTab('info');
      setShowModal(true);
  };

  const handleOpenEdit = async (prod) => {
      setProcessing(true);
      try {
          let currentRecipes = [];
          if (prod.product_type === 'manufacture') {
              const { data: recipeData } = await supabase
                  .from('product_recipes')
                  .select('inventory_item_id, amount_needed, inventory_items(name, unit, cost_per_unit)')
                  .eq('product_id', prod.id);
              
              if (recipeData) {
                  currentRecipes = recipeData.map(r => ({
                      item_id: r.inventory_item_id,
                      name: r.inventory_items?.name,
                      unit: r.inventory_items?.unit,
                      cost: r.inventory_items?.cost_per_unit,
                      amount: r.amount_needed
                  }));
              }
          }

          setFormData({ ...prod, recipe_yield: prod.recipe_yield || 1, recipes: currentRecipes });
          setImagePreview(prod.image_url);
          setImageFile(null);
          setFormTab('info');
          setShowModal(true);
      } catch (e) {
          showAlert('error', 'Gagal Load', e.message);
      } finally {
          setProcessing(false);
      }
  };

  const handleDelete = (prod) => {
      showConfirm('Hapus Produk?', `Yakin ingin menghapus "${prod.name}"?`, async () => {
          setNotif(prev => ({...prev, type: 'loading', title: 'Memproses...', message: ''}));
          try {
              const { data, error } = await supabase.rpc('delete_product_check', { p_product_id: prod.id });
              
              if (error) throw error;
              if (!data.success) throw new Error(data.message);

              fetchData();
              setNotif({ isOpen: false }); 
          } catch (e) {
              showAlert('error', 'Gagal Hapus', e.message);
          }
      });
  };

  // --- LOGIC ---
  const handleImageChange = (e) => {
      const file = e.target.files[0];
      if (file) { setImageFile(file); setImagePreview(URL.createObjectURL(file)); }
  };

  // --- MISSING FUNCTION ADDED HERE ---
  const openIngredientSelector = () => {
      setIngSearch('');
      setIngFilterWh('all');
      setIngFilterType('all');
      setSelectedIngId(null);
      setIngQtyInput('');
      setShowIngredientModal(true);
  };

  const confirmAddIngredient = () => {
      if (!selectedIngId || !ingQtyInput) return;
      const qty = parseFloat(ingQtyInput);
      if (qty <= 0) return alert("Jumlah harus lebih dari 0");

      const ing = ingredients.find(i => i.id === selectedIngId);
      const exists = formData.recipes.find(r => r.item_id === ing.id);
      if (exists) { alert("Bahan sudah ada."); return; }

      const newRecipesList = [...formData.recipes, { item_id: ing.id, name: ing.name, unit: ing.unit, cost: ing.cost_per_unit, amount: qty }];
      const rawCost = newRecipesList.reduce((acc, curr) => acc + (curr.amount * (curr.cost || 0)), 0);
      const finalHPP = rawCost / (formData.recipe_yield || 1);

      setFormData(prev => ({ ...prev, recipes: newRecipesList, cost_price: Math.round(finalHPP) }));
      setShowIngredientModal(false);
  };

  const removeIngredient = (idx) => {
      const newRecipes = [...formData.recipes];
      newRecipes.splice(idx, 1);
      const rawCost = newRecipes.reduce((acc, curr) => acc + (curr.amount * (curr.cost || 0)), 0);
      const finalHPP = rawCost / (formData.recipe_yield || 1);
      setFormData(prev => ({ ...prev, recipes: newRecipes, cost_price: Math.round(finalHPP) }));
  };

  const handleYieldChange = (val) => {
      const yieldVal = parseFloat(val) || 1;
      const rawCost = formData.recipes.reduce((acc, curr) => acc + (curr.amount * (curr.cost || 0)), 0);
      const finalHPP = rawCost / yieldVal;
      setFormData(prev => ({ ...prev, recipe_yield: yieldVal, cost_price: Math.round(finalHPP) }));
  };

  // --- SUBMIT ---
  const handleSubmit = async () => {
      if (!formData.name || formData.price <= 0) return showAlert('error', 'Gagal', 'Nama dan Harga Jual wajib diisi.');
      
      setProcessing(true);
      try {
          let finalImageUrl = formData.image_url;
          if (imageFile) {
              const fileExt = imageFile.name.split('.').pop();
              const fileName = `${Date.now()}.${fileExt}`;
              const { error: uploadError } = await supabase.storage.from('product-images').upload(fileName, imageFile);
              if (uploadError) throw uploadError;
              const { data: publicUrl } = supabase.storage.from('product-images').getPublicUrl(fileName);
              finalImageUrl = publicUrl.publicUrl;
          }

          const recipesJson = formData.recipes.map(r => ({ item_id: r.item_id, amount: r.amount }));

          const payloadRPC = {
              p_user_id: ownerId, p_name: formData.name, p_sku: formData.sku,
              p_category: formData.category || 'Umum', p_price: parseInt(formData.price) || 0,
              p_compare_at_price: parseInt(formData.compare_at_price) || 0,
              p_cost_price: parseInt(formData.cost_price) || 0,
              // Jasa & Racikan stoknya 0 di master produk (karena tidak dilacak atau dilacak via bahan)
              p_stock: formData.product_type === 'retail' ? (parseFloat(formData.stock) || 0) : 0,
              p_product_type: formData.product_type,
              p_recipe_yield: parseFloat(formData.recipe_yield) || 1,
              p_image_url: finalImageUrl, p_recipes: recipesJson,
              p_product_id: formData.id || null, p_emp_id: activeEmployee?.id || null, p_pin: activeEmployee?.pin || null
          };

          const { error: errRPC } = await supabase.rpc('upsert_product', payloadRPC);
          if (errRPC) throw errRPC;

          setShowModal(false);
          fetchData();
          showAlert('success', 'Berhasil', 'Produk tersimpan.');
      } catch (e) {
          showAlert('error', 'Gagal Simpan', e.message);
      } finally {
          setProcessing(false);
      }
  };

  const formatIDR = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  
  // LOGIC FILTER UTAMA
  const filteredProducts = products.filter(p => {
      const matchName = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchType = filterType === 'all' || p.product_type === filterType;
      const matchCategory = filterCategory === 'all' || p.category === filterCategory;
      return matchName && matchType && matchCategory;
  });

  const filteredIngredients = ingredients.filter(ing => ing.name.toLowerCase().includes(ingSearch.toLowerCase()) && (ingFilterWh === 'all' || ing.warehouses?.id === ingFilterWh) && (ingFilterType === 'all' || ing.type === ingFilterType));

  return (
    <div className="h-screen bg-slate-50 font-sans flex flex-col overflow-hidden">
        
        {/* HEADER FIXED */}
        <div className="shrink-0 bg-slate-50 z-50">
            <div className="bg-orange-600 px-6 pt-6 pb-6 rounded-b-[2rem] shadow-lg relative z-10">
                <div className="flex items-center gap-3 mb-4">
                    <button onClick={() => navigate(activeEmployee ? '/employee-dashboard' : '/dashboard')} className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition backdrop-blur-sm"><ArrowLeft size={20}/></button>
                    <div className="flex-1"><h1 className="text-xl font-extrabold text-white">Produk & Menu</h1><p className="text-xs text-orange-100 font-medium">Katalog Penjualan</p></div>
                    <button onClick={handleOpenAdd} className="p-2 bg-white text-orange-600 rounded-xl shadow-md hover:bg-orange-50 transition active:scale-95"><Plus size={20}/></button>
                </div>
                <div className="bg-white/10 p-2 rounded-xl border border-white/20 flex items-center px-3 backdrop-blur-sm">
                    <Search size={18} className="text-orange-100"/>
                    <input type="text" placeholder="Cari menu..." className="w-full bg-transparent p-1 text-sm text-white placeholder:text-orange-100/70 outline-none font-medium" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
            </div>

            {/* FILTER BAR CONTAINER */}
            <div className="px-4 -mt-4 relative z-20 mb-2 space-y-2">
                
                {/* 1. Filter Tipe (Retail/Jasa/Resep) */}
                <div className="bg-white rounded-xl p-2 shadow-md border border-slate-100 flex gap-2 overflow-x-auto no-scrollbar">
                    {[
                        {id: 'all', label: `Semua (${stats.total})`},
                        {id: 'retail', label: `Jual Langsung (${stats.retail})`},
                        {id: 'manufacture', label: `Racikan (${stats.manufacture})`},
                        {id: 'service', label: `Jasa (${stats.service})`},
                    ].map(t => (
                        <button key={t.id} onClick={()=>setFilterType(t.id)} className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition ${filterType===t.id?'bg-orange-100 text-orange-700':'text-slate-500'}`}>
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* 2. Filter Kategori (Makanan/Minuman/dll) */}
                {categories.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 pl-1">
                        <button onClick={()=>setFilterCategory('all')} className={`px-3 py-1.5 rounded-full border text-[10px] font-bold whitespace-nowrap transition ${filterCategory==='all' ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-500 border-slate-200'}`}>
                            Semua Kategori
                        </button>
                        {categories.map(cat => (
                            <button key={cat} onClick={()=>setFilterCategory(cat)} className={`px-3 py-1.5 rounded-full border text-[10px] font-bold whitespace-nowrap transition ${filterCategory===cat ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-500 border-slate-200'}`}>
                                {cat}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>

        {/* LIST CONTENT */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3 pb-24 bg-slate-50">
            {loading ? <div className="text-center py-10 text-slate-400 text-xs">Memuat menu...</div> :
             filteredProducts.length === 0 ? <div className="text-center py-10 text-slate-400 text-xs">Belum ada produk.</div> :
             filteredProducts.map(prod => (
                 <motion.div key={prod.id} initial={{opacity:0}} animate={{opacity:1}} className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 group hover:shadow-md transition">
                     <div className="flex gap-3 items-center">
                         <div className="w-14 h-14 bg-slate-100 rounded-xl overflow-hidden shrink-0 border border-slate-200 relative">
                             {prod.image_url ? <img src={prod.image_url} className="w-full h-full object-cover"/> : 
                             <div className={`w-full h-full flex items-center justify-center ${prod.product_type==='manufacture'?'text-purple-400': prod.product_type==='service'?'text-blue-400':'text-orange-400'}`}>
                                 {prod.product_type==='manufacture' ? <Utensils size={20}/> : prod.product_type==='service' ? <Briefcase size={20}/> : <Package size={20}/>}
                             </div>}
                         </div>
                         <div className="flex-1 min-w-0">
                             <h3 className="font-bold text-slate-800 text-sm truncate">{prod.name}</h3>
                             <div className="flex items-center gap-2 mt-0.5">
                                 <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{prod.category || 'Umum'}</span>
                                 {prod.product_type === 'service' && <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-bold">Jasa</span>}
                                 {prod.compare_at_price > 0 && <span className="text-[10px] text-slate-400 line-through decoration-red-400">{formatIDR(prod.compare_at_price)}</span>}
                             </div>
                         </div>
                         <div className="text-right">
                             <p className="font-extrabold text-slate-800 text-sm">{formatIDR(prod.price)}</p>
                             <p className="text-[10px] text-slate-400">
                                 {prod.product_type==='manufacture' ? 'Auto Stok' : prod.product_type==='service' ? 'Tanpa Stok' : `Stok: ${prod.stock}`}
                             </p>
                         </div>
                     </div>
                     <div className="flex justify-end gap-2 mt-3 pt-2 border-t border-slate-50">
                         <button onClick={() => handleOpenEdit(prod)} className="px-3 py-1.5 rounded-lg bg-slate-50 text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition text-xs font-bold flex items-center gap-1">
                             <Edit2 size={12}/> Edit
                         </button>
                         <button onClick={() => handleDelete(prod)} className="px-3 py-1.5 rounded-lg bg-slate-50 text-slate-500 hover:text-red-600 hover:bg-red-50 transition text-xs font-bold flex items-center gap-1">
                             <Trash2 size={12}/> Hapus
                         </button>
                     </div>
                 </motion.div>
             ))
            }
        </div>

        {/* MODAL FORM */}
        <AnimatePresence>
            {showModal && (
                <div className="fixed inset-0 z-[60] bg-slate-50 flex flex-col animate-in slide-in-from-bottom duration-300">
                    <div className="bg-white px-5 py-4 border-b flex justify-between items-center shadow-sm shrink-0">
                        <button onClick={() => setShowModal(false)} className="p-2 -ml-2 rounded-full hover:bg-slate-100"><X size={20}/></button>
                        <h3 className="font-bold text-lg text-slate-800">{formData.id ? 'Edit Menu' : 'Menu Baru'}</h3>
                        <button onClick={handleSubmit} disabled={processing} className="text-sm font-bold text-orange-600 bg-orange-50 px-4 py-2 rounded-lg hover:bg-orange-100 transition">
                            {processing ? <Loader2 className="animate-spin" size={16}/> : 'Simpan'}
                        </button>
                    </div>

                    <div className="flex p-2 bg-white border-b shrink-0">
                        <button onClick={()=>setFormTab('info')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${formTab==='info'?'bg-slate-800 text-white':'text-slate-500 hover:bg-slate-50'}`}>Info Produk</button>
                        {formData.product_type === 'manufacture' && (
                            <button onClick={()=>setFormTab('recipe')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${formTab==='recipe'?'bg-purple-600 text-white':'text-slate-500 hover:bg-slate-50'}`}>Resep & HPP</button>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 space-y-6">
                        {formTab === 'info' ? (
                            <div className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <label htmlFor="img-upload" className="w-20 h-20 bg-slate-100 rounded-2xl flex flex-col items-center justify-center text-slate-400 cursor-pointer border-2 border-dashed border-slate-200 hover:border-orange-400 hover:text-orange-500 transition overflow-hidden">
                                        {imagePreview ? <img src={imagePreview} className="w-full h-full object-cover"/> : <Camera size={24}/>}
                                        <input id="img-upload" type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                                    </label>
                                    <div className="flex-1">
                                        <p className="text-xs font-bold text-slate-700">Foto Produk</p>
                                        <p className="text-[10px] text-slate-400 leading-tight mt-1">Format JPG/PNG. Maks 2MB.</p>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-500 mb-2 block">Nama Menu</label>
                                    <input type="text" placeholder="Contoh: Kopi Susu" className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold outline-none focus:border-orange-500" value={formData.name} onChange={e=>setFormData({...formData, name:e.target.value})}/>
                                </div>
                                
                                <div className="flex gap-3">
                                    <div className="flex-1">
                                        <label className="text-xs font-bold text-slate-500 mb-2 block">Kategori (Pilih/Ketik)</label>
                                        <input list="cat-options" type="text" placeholder="Pilih / Ketik Baru" className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm outline-none" value={formData.category} onChange={e=>setFormData({...formData, category:e.target.value})}/>
                                        <datalist id="cat-options">{categories.map((c,i)=><option key={i} value={c}/>)}</datalist>
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-xs font-bold text-slate-500 mb-2 block">Tipe Produk</label>
                                        <select className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm outline-none font-medium" value={formData.product_type} onChange={e=>setFormData({...formData, product_type:e.target.value})}>
                                            <option value="retail">Jual Langsung</option>
                                            <option value="manufacture">Racikan (Resep)</option>
                                            <option value="service">Jasa / Layanan</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 mb-2 block">Harga Jual</label>
                                        <MoneyInput className="w-full p-3 bg-white border border-slate-200 rounded-xl font-extrabold text-lg text-orange-600 outline-none" placeholder="0" value={formData.price} onChange={val=>setFormData({...formData, price:val})}/>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 mb-2 block">Harga Coret (Diskon Tampilan)</label>
                                        <MoneyInput className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-400 outline-none decoration-line-through" placeholder="Opsional" value={formData.compare_at_price} onChange={val=>setFormData({...formData, compare_at_price:val})}/>
                                    </div>
                                </div>

                                {/* LOGIC TAMPILAN SESUAI TIPE */}
                                {formData.product_type === 'retail' && (
                                    <div className="flex gap-3">
                                        <div className="flex-1">
                                            <label className="text-xs font-bold text-slate-500 mb-2 block">Stok Awal</label>
                                            <input type="number" className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold outline-none" value={formData.stock} onChange={e=>setFormData({...formData, stock:e.target.value})}/>
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-xs font-bold text-slate-500 mb-2 block">Modal (HPP)</label>
                                            <MoneyInput className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold outline-none" value={formData.cost_price} onChange={val=>setFormData({...formData, cost_price:val})}/>
                                        </div>
                                    </div>
                                )}

                                {formData.product_type === 'service' && (
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 mb-2 block">Estimasi Modal Jasa (Opsional)</label>
                                        <MoneyInput className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold outline-none" placeholder="Biaya Tenaga/Listrik" value={formData.cost_price} onChange={val=>setFormData({...formData, cost_price:val})}/>
                                        <p className="text-[10px] text-slate-400 mt-1 italic">*Jasa tidak memiliki stok fisik.</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                    <label className="text-xs font-bold text-blue-700 mb-2 block">Hasil Produksi (Yield)</label>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-blue-600">Resep ini untuk membuat:</span>
                                        <input type="number" className="w-20 p-2 text-center font-bold rounded-lg border border-blue-200 outline-none text-blue-800" value={formData.recipe_yield} onChange={e=>handleYieldChange(e.target.value)}/>
                                        <span className="text-xs font-bold text-blue-800">Porsi / Pcs</span>
                                    </div>
                                </div>
                                <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 flex justify-between items-center">
                                    <div>
                                        <p className="text-xs text-purple-600 font-bold uppercase">HPP / Porsi</p>
                                        <p className="text-2xl font-extrabold text-slate-800">{formatIDR(formData.cost_price)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-slate-400 font-bold uppercase">Margin</p>
                                        <p className="text-sm font-bold text-green-600">{formData.price > 0 ? Math.round(((formData.price - formData.cost_price)/formData.price)*100) : 0}%</p>
                                    </div>
                                </div>
                                <button onClick={openIngredientSelector} className="w-full py-3 border-2 border-dashed border-purple-300 text-purple-600 rounded-xl font-bold text-sm hover:bg-purple-50 transition flex items-center justify-center gap-2"><Plus size={18}/> Tambah Bahan Baku</button>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 block">Komposisi Resep:</label>
                                    {formData.recipes.length === 0 ? <div className="text-center py-4 text-slate-400 text-xs">Belum ada bahan.</div> : formData.recipes.map((recipe, idx) => (
                                        <div key={idx} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                            <div className="flex-1"><p className="font-bold text-sm text-slate-800">{recipe.name}</p><p className="text-[10px] text-slate-400">@ {formatIDR(recipe.cost)} / {recipe.unit}</p></div>
                                            <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-1"><span className="text-xs font-bold pl-2">{recipe.amount}</span><span className="text-[10px] text-slate-500 pr-2">{recipe.unit}</span></div>
                                            <button onClick={() => removeIngredient(idx)} className="p-2 text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </AnimatePresence>

        {/* MODAL INGREDIENT SELECTOR */}
        <AnimatePresence>
            {showIngredientModal && (
                <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
                    <motion.div initial={{y:"100%"}} animate={{y:0}} exit={{y:"100%"}} className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]" onClick={e=>e.stopPropagation()}>
                        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-800">Pilih Bahan Baku</h3>
                            <button onClick={()=>setShowIngredientModal(false)}><X size={20} className="text-slate-400"/></button>
                        </div>
                        <div className="p-4 space-y-2 border-b">
                            <div className="bg-slate-100 p-2 rounded-xl flex items-center px-3">
                                <Search size={16} className="text-slate-400"/>
                                <input type="text" autoFocus placeholder="Cari bahan..." className="w-full bg-transparent p-1 text-sm outline-none" value={ingSearch} onChange={e=>setIngSearch(e.target.value)} />
                            </div>
                            <div className="flex gap-2">
                                <select className="bg-white border rounded-lg text-xs p-2 flex-1 outline-none" value={ingFilterWh} onChange={e=>setIngFilterWh(e.target.value)}><option value="all">Semua Gudang</option>{warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select>
                                <select className="bg-white border rounded-lg text-xs p-2 flex-1 outline-none" value={ingFilterType} onChange={e=>setIngFilterType(e.target.value)}><option value="all">Semua Jenis</option><option value="ingredient">Bahan</option><option value="tool">Alat</option></select>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2">
                            {filteredIngredients.map(ing => (
                                <div key={ing.id} onClick={()=>setSelectedIngId(ing.id)} className={`p-3 rounded-xl border mb-2 cursor-pointer transition flex justify-between items-center ${selectedIngId===ing.id ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500' : 'border-slate-100 hover:bg-slate-50'}`}>
                                    <div><p className="font-bold text-sm text-slate-800">{ing.name}</p><p className="text-[10px] text-slate-500">{ing.warehouses?.name} • Stok: <b className="text-slate-700">{ing.current_stock}</b> {ing.unit}</p></div>
                                    {selectedIngId===ing.id && <div className="text-orange-600 font-bold text-xs">Dipilih</div>}
                                </div>
                            ))}
                        </div>
                        <div className="p-4 border-t bg-slate-50">
                            <div className="flex gap-3 items-center mb-3">
                                <label className="text-xs font-bold text-slate-500">Butuh Berapa?</label>
                                <input type="number" placeholder="0.0" className="flex-1 p-2 border rounded-lg text-center font-bold text-lg outline-none focus:border-orange-500" value={ingQtyInput} onChange={e=>setIngQtyInput(e.target.value)} />
                                <span className="text-xs font-bold text-slate-400">{selectedIngId ? ingredients.find(i=>i.id===selectedIngId)?.unit : 'Unit'}</span>
                            </div>
                            <button onClick={confirmAddIngredient} disabled={!selectedIngId || !ingQtyInput} className="w-full py-3 bg-orange-600 text-white rounded-xl font-bold disabled:opacity-50">Tambahkan ke Resep</button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>

        <ModalInfo isOpen={notif.isOpen} type={notif.type} title={notif.title} message={notif.message} onClose={()=>setNotif({...notif, isOpen:false})} />
    </div>
  );
}