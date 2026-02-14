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
    target_audience: 'ALL'
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
      
      const payload = { ...formData };
      if(!payload.step_order) payload.step_order = steps.length + 1;

      const { error } = await supabase.from('tour_steps').insert(payload);
      if(error) alert(error.message);
      else {
          setFormData({ step_order: steps.length + 2, target_id: '', route_path: '', title: '', content: '', video_url: '' });
          fetchSteps();
      }
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
                    <div>
                        <label className="text-xs font-bold text-slate-500">Target Audience</label>
                        <select 
                            value={formData.target_audience} 
                            onChange={e=>setFormData({...formData, target_audience: e.target.value})} 
                            className="w-full p-2 border rounded-lg text-sm bg-white"
                        >
                            <option value="ALL">Semua User (ALL)</option>
                            <option value="PERSONAL">Hanya Personal Gratis</option>
                            <option value="PRO">Hanya Personal Pro</option>
                            <option value="BUSINESS">Hanya Akun Bisnis/Karyawan</option>
                        </select>
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