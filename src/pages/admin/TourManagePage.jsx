import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { ArrowLeft, Plus, Save, Trash2, GripVertical, Play, Edit, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TourManagePage() {
  const navigate = useNavigate();
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // State untuk Mode Edit
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState({ 
    step_order: 1, 
    target_id: '', 
    route_path: '', 
    title: '', 
    content: '', 
    video_url: '', 
    selected_audiences: ['ALL'], 
    pre_click_target: '',
    next_click_target: '',
    position: 'bottom'
  });

  useEffect(() => { fetchSteps(); }, []);

  const fetchSteps = async () => {
    setLoading(true);
    const { data } = await supabase.from('tour_steps').select('*').order('step_order', { ascending: true });
    setSteps(data || []);
    setLoading(false);
  };

  // --- PREPARE EDIT ---
  const handleEdit = (step) => {
      // Pindahkan data dari list ke form
      setFormData({
          step_order: step.step_order,
          target_id: step.target_id,
          route_path: step.route_path,
          title: step.title,
          content: step.content || '',
          video_url: step.video_url || '',
          // Pecah string "PERSONAL,PRO" jadi array ['PERSONAL', 'PRO']
          selected_audiences: (step.target_audience || 'ALL').split(','),
          pre_click_target: step.pre_click_target || '',
          next_click_target: step.next_trigger_target || '',
          position: step.position || 'bottom'
      });
      setIsEditing(true);
      setEditingId(step.id);
      
      // Scroll ke atas biar form kelihatan
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- CANCEL EDIT ---
  const handleCancelEdit = () => {
      setIsEditing(false);
      setEditingId(null);
      // Reset Form ke default baru (Hapus referensi ke variable 'step' yang error)
      setFormData({ 
        step_order: steps.length + 1, 
        target_id: '', 
        route_path: '', 
        title: '', 
        content: '', 
        video_url: '', 
        selected_audiences: ['ALL'], 
        pre_click_target: '',
        next_click_target: '', // Reset ke string kosong
        position: 'bottom'     // Reset ke default
      });
  };

  const handleSave = async () => {
      if(!formData.target_id || !formData.title) return alert("Target ID dan Judul wajib diisi!");
      if(formData.selected_audiences.length === 0) return alert("Pilih minimal satu target audience!");

      const payload = {
          step_order: formData.step_order,
          target_id: formData.target_id,
          route_path: formData.route_path,
          title: formData.title,
          content: formData.content,
          video_url: formData.video_url,
          target_audience: formData.selected_audiences.join(','),
          pre_click_target: formData.pre_click_target,
          next_trigger_target: formData.next_click_target,
          position: formData.position 
      };

      let error = null;

      if (isEditing) {
          // MODE UPDATE
          const { error: err } = await supabase
            .from('tour_steps')
            .update(payload)
            .eq('id', editingId);
          error = err;
      } else {
          // MODE INSERT BARU
          const { error: err } = await supabase
            .from('tour_steps')
            .insert(payload);
          error = err;
      }
      
      if(error) {
          alert(error.message);
      } else {
          handleCancelEdit(); // Reset form & mode
          fetchSteps();       // Refresh data dari server agar list sinkron
      }
  };

  const handleAudienceChange = (value) => {
      setFormData(prev => {
          let newSelection = [...prev.selected_audiences];
          
          if (value === 'ALL') {
              return { ...prev, selected_audiences: ['ALL'] };
          } else {
              newSelection = newSelection.filter(item => item !== 'ALL');
              
              if (newSelection.includes(value)) {
                  newSelection = newSelection.filter(item => item !== value);
              } else {
                  newSelection.push(value);
              }
              
              if (newSelection.length === 0) newSelection = ['ALL'];
              return { ...prev, selected_audiences: newSelection };
          }
      });
  };

  const handleDelete = async (id) => {
      if(confirm('Hapus langkah ini?')) {
          await supabase.from('tour_steps').delete().eq('id', id);
          fetchSteps();
      }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <div className="max-w-4xl mx-auto">
        {/* HEADER */}
        <div className="flex items-center gap-4 mb-8">
            <button onClick={() => navigate('/dashboard')} className="p-2 bg-white rounded-full shadow-sm hover:bg-slate-100"><ArrowLeft size={20}/></button>
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Manajemen Tour Guide</h1>
                <p className="text-slate-500 text-sm">Atur langkah onboarding user secara dinamis.</p>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* FORM INPUT */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-fit sticky top-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className={`font-bold text-base flex items-center gap-2 ${isEditing ? 'text-amber-600' : 'text-slate-800'}`}>
                        {isEditing ? <Edit size={18}/> : <Plus size={18}/>} 
                        {isEditing ? 'Edit Langkah' : 'Tambah Langkah'}
                    </h3>
                    {isEditing && (
                        <button onClick={handleCancelEdit} className="text-xs text-red-500 flex items-center gap-1 hover:underline">
                            <XCircle size={14}/> Batal
                        </button>
                    )}
                </div>

                <div className="space-y-3">
                    <div>
                        <label className="text-xs font-bold text-slate-500">Urutan (Order)</label>
                        <input type="number" value={formData.step_order} onChange={e=>setFormData({...formData, step_order: e.target.value})} className="w-full p-2 border rounded-lg text-sm"/>
                    </div>
                    {/* INPUT POSISI KARTU */}
                    <div>
                        <label className="text-xs font-bold text-slate-500">Posisi Kartu</label>
                        <select 
                            value={formData.position} 
                            onChange={e=>setFormData({...formData, position: e.target.value})} 
                            className="w-full p-2 border rounded-lg text-sm bg-white"
                        >
                            <option value="bottom">👇 Bawah (Default)</option>
                            <option value="top">👆 Atas</option>
                            <option value="left">👈 Kiri</option>
                            <option value="right">👉 Kanan</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500">Route / Halaman (URL)</label>
                        <input type="text" placeholder="/dashboard" value={formData.route_path} onChange={e=>setFormData({...formData, route_path: e.target.value})} className="w-full p-2 border rounded-lg text-sm font-mono"/>
                    </div>
                    
                    {/* AUTO CLICK */}
                    <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100">
                        <label className="text-xs font-bold text-yellow-700 flex items-center gap-1">
                            <Play size={12}/> Pemicu / Auto Click (Opsional)
                        </label>
                        <input 
                            type="text" 
                            placeholder="Contoh: Tambah Transaksi" 
                            value={formData.pre_click_target} 
                            onChange={e=>setFormData({...formData, pre_click_target: e.target.value})} 
                            className="w-full p-2 border border-yellow-200 rounded-lg text-sm mt-1 focus:ring-yellow-500"
                        />
                        <p className="text-[9px] text-yellow-600 mt-1">
                            Isi dengan ID atau Teks tombol yang harus <b>diklik otomatis</b>.
                        </p>
                    </div>

                    {/* INPUT BARU: WAIT FOR INTERACTION */}
                    <div className="bg-red-50 p-3 rounded-lg border border-red-100 mt-2">
                        <label className="text-xs font-bold text-red-700 flex items-center gap-1">
                            <span className="animate-pulse">👆</span> Tunggu Klik User (Trigger Lanjut)
                        </label>
                        <input 
                            type="text" 
                            placeholder="Contoh: btn-simpan-transaksi" 
                            value={formData.next_click_target} 
                            onChange={e=>setFormData({...formData, next_click_target: e.target.value})} 
                            className="w-full p-2 border border-red-200 rounded-lg text-sm mt-1 focus:ring-red-500"
                        />
                        <p className="text-[9px] text-red-600 mt-1">
                            Jika diisi, tombol "Lanjut" di Tour akan <b>HILANG</b>. Tour baru lanjut otomatis setelah user mengklik tombol ID ini (misal: tombol Simpan).
                        </p>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-500">Target Element ID</label>
                        <input type="text" placeholder="btn-pos-menu" value={formData.target_id} onChange={e=>setFormData({...formData, target_id: e.target.value})} className="w-full p-2 border rounded-lg text-sm font-mono text-blue-600"/>
                        <p className="text-[10px] text-slate-400 mt-1">*Pastikan ID ini ada di kodingan JSX (id="...")</p>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500">Judul</label>
                        <input type="text" placeholder="Selamat Datang!" value={formData.title} onChange={e=>setFormData({...formData, title: e.target.value})} className="w-full p-2 border rounded-lg text-sm font-bold"/>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500">Deskripsi</label>
                        <textarea rows={3} placeholder="Jelaskan fitur ini..." value={formData.content} onChange={e=>setFormData({...formData, content: e.target.value})} className="w-full p-2 border rounded-lg text-sm"/>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500">Video URL (Opsional)</label>
                        <input type="text" placeholder="https://..." value={formData.video_url} onChange={e=>setFormData({...formData, video_url: e.target.value})} className="w-full p-2 border rounded-lg text-sm"/>
                    </div>
                    
                    {/* AUDIENCE SELECTOR */}
                    <div>
                        <label className="text-xs font-bold text-slate-500 mb-2 block">Target Audience</label>
                        <div className="flex flex-wrap gap-2">
                            {['ALL', 'PERSONAL', 'PRO', 'BUSINESS'].map((type) => (
                                <button
                                    key={type}
                                    onClick={() => handleAudienceChange(type)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                                        formData.selected_audiences.includes(type)
                                            ? 'bg-blue-600 text-white border-blue-600'
                                            : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'
                                    }`}
                                >
                                    {type === 'ALL' ? 'Semua User' : type}
                                </button>
                            ))}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">
                            Terpilih: {formData.selected_audiences.join(', ')}
                        </p>
                    </div>
                    
                    <button 
                        onClick={handleSave} 
                        className={`w-full py-2.5 text-white rounded-xl font-bold shadow-lg transition flex justify-center items-center gap-2 ${isEditing ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'}`}
                    >
                        {isEditing ? <><Edit size={18}/> Update Step</> : <><Save size={18}/> Simpan Step</>}
                    </button>
                </div>
            </div>

            {/* LIST STEPS */}
            <div className="col-span-2 space-y-4 pb-20">
                {steps.map((step) => (
                    <div key={step.id} className={`bg-white p-4 rounded-xl border shadow-sm flex items-start gap-4 transition hover:shadow-md ${editingId === step.id ? 'border-amber-400 ring-2 ring-amber-100' : 'border-slate-100'}`}>
                        <div className="bg-slate-100 w-8 h-8 flex items-center justify-center rounded-lg font-bold text-slate-500 shrink-0">
                            {step.step_order}
                        </div>
                        <div className="flex-1">
                            <h4 className="font-bold text-slate-800">{step.title}</h4>
                            <p className="text-sm text-slate-600 mb-2">{step.content}</p>
                            <div className="flex flex-wrap gap-2 text-[10px] font-mono">
                                <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-100">Page: {step.route_path}</span>
                                <span className="bg-orange-50 text-orange-600 px-2 py-1 rounded border border-orange-100 uppercase">{step.target_audience}</span>
                                <span className="bg-purple-50 text-purple-600 px-2 py-1 rounded border border-purple-100">ID: {step.target_id}</span>
                                {step.pre_click_target && (
                                    <span className="bg-yellow-50 text-yellow-600 px-2 py-1 rounded border border-yellow-100 flex items-center gap-1"><Play size={8}/> Auto: {step.pre_click_target}</span>
                                )}
                            </div>
                        </div>
                        
                        {/* ACTION BUTTONS */}
                        <div className="flex flex-col gap-2">
                            <button onClick={() => handleEdit(step)} className="p-2 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition">
                                <Edit size={18}/>
                            </button>
                            <button onClick={() => handleDelete(step.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                                <Trash2 size={18}/>
                            </button>
                        </div>
                    </div>
                ))}
                
                {steps.length === 0 && (
                    <div className="text-center py-10 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                        Belum ada step tour. Tambahkan di samping.
                    </div>
                )}
            </div>

        </div>
      </div>
    </div>
  );
}