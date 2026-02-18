import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { ArrowLeft, Plus, Save, Trash2, GripVertical, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TourManagePage() {
  const navigate = useNavigate();
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ 
    step_order: 1, target_id: '', route_path: '', title: '', content: '', video_url: '', 
    selected_audiences: ['ALL']
});

  useEffect(() => { fetchSteps(); }, []);

  const fetchSteps = async () => {
    setLoading(true);
    const { data } = await supabase.from('tour_steps').select('*').order('step_order', { ascending: true });
    setSteps(data || []);
    setLoading(false);
  };

  const handleSave = async () => {
      if(!formData.target_id || !formData.title) return alert("Target ID dan Judul wajib diisi!");
      if(formData.selected_audiences.length === 0) return alert("Pilih minimal satu target audience!");

      const payload = {
          step_order: formData.step_order || (steps.length + 1),
          target_id: formData.target_id,
          route_path: formData.route_path,
          title: formData.title,
          content: formData.content,
          video_url: formData.video_url,
          // GABUNGKAN ARRAY JADI STRING: ['PERSONAL', 'PRO'] -> 'PERSONAL,PRO'
          target_audience: formData.selected_audiences.join(',') 
      };

      const { error } = await supabase.from('tour_steps').insert(payload);
      
      if(error) alert(error.message);
      else {
          // Reset Form
          setFormData({ 
              step_order: steps.length + 2, 
              target_id: '', route_path: '', title: '', content: '', video_url: '', 
              selected_audiences: ['ALL'] 
          });
          fetchSteps();
      }
  };

  const handleAudienceChange = (value) => {
      setFormData(prev => {
          let newSelection = [...prev.selected_audiences];
          
          if (value === 'ALL') {
              // Jika pilih ALL, reset yang lain
              return { ...prev, selected_audiences: ['ALL'] };
          } else {
              // Jika pilih selain ALL, hapus 'ALL' dulu
              newSelection = newSelection.filter(item => item !== 'ALL');
              
              if (newSelection.includes(value)) {
                  // Uncheck (Hapus)
                  newSelection = newSelection.filter(item => item !== value);
              } else {
                  // Check (Tambah)
                  newSelection.push(value);
              }
              
              // Jika kosong, balik ke ALL (opsional, biar ga null)
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
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-fit">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Plus size={18}/> Tambah Langkah</h3>
                <div className="space-y-3">
                    <div>
                        <label className="text-xs font-bold text-slate-500">Urutan (Order)</label>
                        <input type="number" value={formData.step_order} onChange={e=>setFormData({...formData, step_order: e.target.value})} className="w-full p-2 border rounded-lg text-sm"/>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500">Route / Halaman (URL)</label>
                        <input type="text" placeholder="/dashboard" value={formData.route_path} onChange={e=>setFormData({...formData, route_path: e.target.value})} className="w-full p-2 border rounded-lg text-sm font-mono"/>
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
                    {/* GANTI SELECT DENGAN CHECKBOX GROUP INI */}
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
                    <button onClick={handleSave} className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition flex justify-center items-center gap-2">
                        <Save size={18}/> Simpan Step
                    </button>
                </div>
            </div>

            {/* LIST STEPS */}
            <div className="col-span-2 space-y-4">
                {steps.map((step) => (
                    <div key={step.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-start gap-4 hover:shadow-md transition">
                        <div className="bg-slate-100 w-8 h-8 flex items-center justify-center rounded-lg font-bold text-slate-500 shrink-0">
                            {step.step_order}
                        </div>
                        <div className="flex-1">
                            <h4 className="font-bold text-slate-800">{step.title}</h4>
                            <p className="text-sm text-slate-600 mb-2">{step.content}</p>
                            {/* Di bagian List Steps, tambahkan badge audience */}
                            <div className="flex gap-2 text-[10px] font-mono">
                                <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-100">Page: {step.route_path}</span>
                                {/* 👇 Badge Baru */}
                                <span className="bg-orange-50 text-orange-600 px-2 py-1 rounded border border-orange-100 uppercase">{step.target_audience}</span>
                                <span className="bg-purple-50 text-purple-600 px-2 py-1 rounded border border-purple-100">ID: #{step.target_id}</span>
                            </div>
                        </div>
                        <button onClick={() => handleDelete(step.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"><Trash2 size={18}/></button>
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