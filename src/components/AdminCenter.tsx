import React, { useEffect, useState } from 'react';
import { ShieldCheck, Users, CheckCircle2, Ban, Trash2, RefreshCw, LogOut } from 'lucide-react';
import { apiUrl } from '../services/apiConfig';
import { authHeaders, logout, getStoredSession } from '../services/authService';

type AdminUser = {
  id:string; email:string; username?:string; name:string; activation_status:string; role:string; created_at:string;
};

export default function AdminCenter({ onLogout }: { onLogout: () => void }) {
  const [users,setUsers]=useState<AdminUser[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');

  const load=async()=>{
    setLoading(true); setError('');
    try{
      const r=await fetch(apiUrl('/api/admin/users'),{headers:authHeaders()});
      const d=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(d.error||'تعذر تحميل المستخدمين');
      setUsers(d.users||[]);
    }catch(e:any){setError(e.message||'تعذر تحميل لوحة الإدارة');}
    finally{setLoading(false);}
  };
  useEffect(()=>{void load();},[]);

  const update=async(id:string,patch:Record<string,string>)=>{
    setError('');
    try{
      const r=await fetch(apiUrl('/api/admin/users/'+encodeURIComponent(id)),{
        method:'PATCH',headers:{...authHeaders(),'Content-Type':'application/json'},body:JSON.stringify(patch)
      });
      const d=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(d.error||'تعذر تحديث الحساب');
      await load();
    }catch(e:any){setError(e.message||'تعذر تحديث الحساب');}
  };

  const remove=async(id:string)=>{
    if(!window.confirm('تأكيد حذف الحساب؟')) return;
    try{
      const r=await fetch(apiUrl('/api/admin/users/'+encodeURIComponent(id)),{method:'DELETE',headers:authHeaders()});
      const d=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(d.error||'تعذر حذف الحساب');
      await load();
    }catch(e:any){setError(e.message||'تعذر حذف الحساب');}
  };

  const role=getStoredSession()?.user.role;
  return <main dir="rtl" className="min-h-screen bg-slate-950 text-white p-4 sm:p-8">
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="rounded-3xl bg-white text-slate-950 p-5 shadow-2xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <img src="/logo.png" alt="SMART TIME" className="w-16 h-16 rounded-2xl object-contain border border-slate-100"/>
          <div><h1 className="text-2xl font-black">لوحة تحكم الإدارة</h1><p className="text-sm font-bold text-slate-500">eng/mamdouh saad · {role === 'owner' ? 'Owner / Super Admin' : 'Admin'}</p></div>
        </div>
        <div className="flex gap-2">
          <button onClick={()=>void load()} className="rounded-xl border px-3 py-2 font-black"><RefreshCw className="w-4 h-4"/></button>
          <button onClick={()=>{void logout();onLogout();}} className="rounded-xl bg-slate-950 text-white px-4 py-2 font-black flex items-center gap-2"><LogOut className="w-4 h-4"/>تسجيل الخروج</button>
        </div>
      </header>
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ['المستخدمون','users.read',Users],['التفعيل','users.activate',CheckCircle2],['الأمان','security.manage',ShieldCheck],['إدارة الخدمات','services.manage',RefreshCw]
        ].map(([label,perm,Icon]:any)=><div key={perm} className="rounded-2xl bg-slate-900 border border-slate-800 p-4"><Icon className="w-5 h-5 mb-2"/><div className="font-black">{label}</div><div className="text-[10px] text-slate-400 mt-1">{perm}</div></div>)}
      </section>
      {error&&<div className="rounded-2xl bg-red-950 border border-red-800 p-4 font-bold">{error}</div>}
      <section className="rounded-3xl bg-white text-slate-950 overflow-hidden">
        <div className="p-5 border-b font-black text-lg">إدارة الحسابات</div>
        {loading?<div className="p-6 font-bold">جارٍ التحميل…</div>:users.length===0?<div className="p-6 text-slate-500 font-bold">لا توجد حسابات أخرى.</div>:
          <div className="divide-y">{users.map(u=><div key={u.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div><div className="font-black">{u.name||u.username||'بدون اسم'}</div><div className="text-sm text-slate-500">{u.email}</div><div className="text-xs mt-1 font-bold">الدور: {u.role} · الحالة: {u.activation_status}</div></div>
            <div className="flex flex-wrap gap-2">
              <button onClick={()=>void update(u.id,{activationStatus:u.activation_status==='active'?'suspended':'active'})} className="rounded-xl border px-3 py-2 text-xs font-black flex items-center gap-1">{u.activation_status==='active'?<><Ban className="w-4 h-4"/>تعطيل</>:<><CheckCircle2 className="w-4 h-4"/>تفعيل</>}</button>
              <button onClick={()=>void update(u.id,{role:u.role==='admin'?'user':'admin'})} className="rounded-xl border px-3 py-2 text-xs font-black">تغيير الدور</button>
              <button onClick={()=>void remove(u.id)} className="rounded-xl bg-red-600 text-white px-3 py-2 text-xs font-black flex items-center gap-1"><Trash2 className="w-4 h-4"/>حذف</button>
            </div>
          </div>)}</div>}
      </section>
    </div>
  </main>;
}
