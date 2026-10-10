import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, CheckCircle2, Clock3, History, RefreshCw, Search, ShieldCheck, Users, WalletCards, XCircle } from 'lucide-react';
import { WalletService } from '../services/walletService';

interface PendingTopup {
  id: string; user_id: string; email: string; display_name: string; phone: string;
  amount: number; method: string; note: string; status: string; created_at: string;
  reviewed_at?: string; review_note?: string;
}
interface Summary { pending:{count:number;amount:number}; approved:{count:number;amount:number}; rejected:{count:number;amount:number}; users:{count:number;balances:number}; tripUsage:{count:number;amount:number}; tripCost:number; topupMin:number; topupMax:number; }
interface WalletUser { id:string; email:string; display_name:string; phone?:string; wallet_balance:number; created_at:string; }
interface AuditAction { id:string; topup_id?:string; user_id?:string; action:string; amount?:number; note?:string; actor_email?:string; created_at:string; }

const methodLabel: Record<string,string> = { vodafone_cash:'فودافون كاش', instapay:'إنستاباي', etisalat_cash:'اتصالات كاش', other:'أخرى' };
const money=(n:number)=>`${Number(n||0).toFixed(2)} ج.م`;
const date=(v:string)=>new Date(v).toLocaleString('ar-EG',{dateStyle:'short',timeStyle:'short'});

export default function AdminWalletPanel(){
  const [tab,setTab]=useState<'pending'|'history'|'users'|'audit'>('pending');
  const [status,setStatus]=useState<'pending'|'approved'|'rejected'>('pending');
  const [requests,setRequests]=useState<PendingTopup[]>([]);
  const [summary,setSummary]=useState<Summary|null>(null);
  const [users,setUsers]=useState<WalletUser[]>([]);
  const [audit,setAudit]=useState<AuditAction[]>([]);
  const [q,setQ]=useState(''); const [loading,setLoading]=useState(false); const [error,setError]=useState('');
  const [busyId,setBusyId]=useState(''); const [review,setReview]=useState<{id:string;action:'approve'|'reject'}|null>(null); const [reviewNote,setReviewNote]=useState('');

  const load=async()=>{ setLoading(true); setError(''); try{
    const s=await WalletService.getAdminSummary(); setSummary(s);
    if(tab==='pending'||tab==='history') { const r=await WalletService.getAdminTopups(status,q); setRequests(r.requests||[]); }
    if(tab==='users'){ const u=await WalletService.getAdminUsers(q); setUsers(u.users||[]); }
    if(tab==='audit'){ const a=await WalletService.getAdminAudit(); setAudit(a.actions||[]); }
  }catch(e:any){setError(e?.message||'تعذر تحميل لوحة المحفظة');}finally{setLoading(false);} };
  useEffect(()=>{load();},[tab,status]);
  const filtered=useMemo(()=>requests,[requests]);
  const confirmReview=async()=>{ if(!review)return; setBusyId(review.id); try{
    if(review.action==='approve') await WalletService.approveTopup(review.id,reviewNote); else await WalletService.rejectTopup(review.id,reviewNote);
    setReview(null);setReviewNote('');await load();
  }catch(e:any){setError(e?.message||'تعذر تنفيذ العملية');}finally{setBusyId('');} };

  return <div dir="rtl" className="max-w-5xl mx-auto p-3 md:p-5 space-y-4">
    <div className="flex items-center justify-between gap-3">
      <div><h2 className="text-xl font-extrabold flex items-center gap-2"><ShieldCheck size={20}/> لوحة المحفظة</h2><p className="text-xs text-slate-500 mt-1">مراجعة الشحنات، متابعة الأرصدة، وسجل العمليات</p></div>
      <button onClick={load} disabled={loading} className="p-2 rounded-xl border border-slate-200 dark:border-slate-700"><RefreshCw size={17} className={loading?'animate-spin':''}/></button>
    </div>
    {summary&&<div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
      <Stat icon={<Clock3 size={16}/>} label="قيد المراجعة" value={money(summary.pending.amount)} sub={`${summary.pending.count} طلب`} />
      <Stat icon={<ArrowUpCircle size={16}/>} label="المعتمد" value={money(summary.approved.amount)} sub={`${summary.approved.count} طلب`} />
      <Stat icon={<XCircle size={16}/>} label="المرفوض" value={money(summary.rejected.amount)} sub={`${summary.rejected.count} طلب`} />
      <Stat icon={<Users size={16}/>} label="المستخدمون" value={String(summary.users.count)} sub={`أرصدة ${money(summary.users.balances)}`} />
      <Stat icon={<ArrowDownCircle size={16}/>} label="استهلاك الرحلات" value={money(summary.tripUsage.amount)} sub={`${summary.tripUsage.count} مقارنة`} />
    </div>}
    <div className="flex gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 overflow-x-auto">
      {([['pending','المعلّقة'],['history','السجل'],['users','المستخدمون'],['audit','سجل الإدارة']] as const).map(([id,label])=><button key={id} onClick={()=>setTab(id)} className={`px-3 py-2 rounded-xl text-sm font-bold whitespace-nowrap ${tab===id?'bg-white dark:bg-slate-950 shadow-sm text-cyan-700 dark:text-cyan-300':''}`}>{label}</button>)}
    </div>
    {error&&<div className="rounded-xl border border-red-200 bg-red-50 text-red-700 p-3 text-sm">{error}</div>}

    {(tab==='pending'||tab==='history')&&<>
      <div className="flex flex-col sm:flex-row gap-2">
        {tab==='history'&&<select value={status} onChange={e=>setStatus(e.target.value as any)} className="p-2.5 rounded-xl border bg-transparent"><option value="approved">الموافق عليها</option><option value="rejected">المرفوضة</option><option value="pending">المعلّقة</option></select>}
        <div className="flex-1 relative"><Search size={16} className="absolute right-3 top-3 text-slate-400"/><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&load()} placeholder="بحث بالاسم أو البريد أو الهاتف أو رقم الطلب" className="w-full p-2.5 pr-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent"/></div>
        <button onClick={load} className="px-4 py-2.5 rounded-xl bg-cyan-600 text-white font-bold">بحث</button>
      </div>
      <div className="space-y-2">
        {!loading&&filtered.length===0&&<div className="text-center p-8 text-slate-500">لا توجد نتائج</div>}
        {filtered.map(r=><div key={r.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-sm">
          <div className="flex items-start justify-between gap-3"><div><div className="font-extrabold">{r.display_name||r.email}</div><div className="text-xs text-slate-500 mt-0.5">{r.email}{r.phone?` • ${r.phone}`:''}</div></div><div className="font-extrabold text-cyan-700 dark:text-cyan-300">{money(r.amount)}</div></div>
          <div className="text-xs text-slate-500 mt-2">{methodLabel[r.method]||r.method} • {date(r.created_at)} {r.note&&` • ${r.note}`}</div>
          {r.review_note&&<div className="mt-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 p-2">ملاحظة المراجعة: {r.review_note}</div>}
          {r.status==='pending'?<div className="grid grid-cols-2 gap-2 mt-3"><button disabled={!!busyId} onClick={()=>{setReview({id:r.id,action:'approve'});setReviewNote('')}} className="py-2 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center gap-1.5"><CheckCircle2 size={16}/> اعتماد</button><button disabled={!!busyId} onClick={()=>{setReview({id:r.id,action:'reject'});setReviewNote('')}} className="py-2 rounded-xl bg-red-600 text-white font-bold flex items-center justify-center gap-1.5"><XCircle size={16}/> رفض</button></div>:<div className="mt-2 text-xs font-bold">{r.status==='approved'?'✓ تمت الموافقة':'✕ مرفوض'} {r.reviewed_at&&` • ${date(r.reviewed_at)}`}</div>}
        </div>)}
      </div>
    </>}

    {tab==='users'&&<><div className="flex gap-2"><div className="flex-1 relative"><Search size={16} className="absolute right-3 top-3 text-slate-400"/><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&load()} placeholder="ابحث عن مستخدم" className="w-full p-2.5 pr-9 rounded-xl border bg-transparent"/></div><button onClick={load} className="px-4 rounded-xl bg-cyan-600 text-white font-bold">بحث</button></div><div className="grid gap-2">{users.map(u=><div key={u.id} className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3"><div><div className="font-bold">{u.display_name||u.email}</div><div className="text-xs text-slate-500">{u.email}{u.phone?` • ${u.phone}`:''}</div></div><div className="text-left"><div className="font-extrabold text-cyan-700 dark:text-cyan-300">{money(u.wallet_balance)}</div><div className="text-[11px] text-slate-500">الرصيد</div></div></div>)}</div></>}

    {tab==='audit'&&<div className="space-y-2">{audit.length===0?<div className="text-center p-8 text-slate-500">لا يوجد سجل بعد</div>:audit.map(a=><div key={a.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-sm"><div className="flex justify-between gap-3"><strong>{a.action==='approve'?'اعتماد طلب شحن':'رفض طلب شحن'}</strong><span className="text-xs text-slate-500">{date(a.created_at)}</span></div><div className="text-xs text-slate-500 mt-1">المبلغ: {money(Number(a.amount||0))} • المنفذ: {a.actor_email||'صاحب البرنامج'}</div>{a.note&&<div className="text-xs mt-1">الملاحظة: {a.note}</div>}</div>)}</div>}

    {summary&&<div className="text-xs text-slate-500 flex flex-wrap gap-3"><span>تكلفة المقارنة: {money(summary.tripCost)}</span><span>حد الشحن: {money(summary.topupMin)} — {money(summary.topupMax)}</span></div>}

    {review&&<div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"><div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-xl"><h3 className="font-extrabold">{review.action==='approve'?'تأكيد اعتماد الشحنة':'تأكيد رفض الشحنة'}</h3><p className="text-xs text-slate-500 mt-1">يمكنك إضافة ملاحظة تظهر في سجل الطلب.</p><textarea value={reviewNote} onChange={e=>setReviewNote(e.target.value.slice(0,300))} placeholder={review.action==='approve'?'مثال: تم التحقق من التحويل':'سبب الرفض (مستحسن)'} className="w-full mt-3 p-3 rounded-xl border bg-transparent min-h-24"/><div className="grid grid-cols-2 gap-2 mt-3"><button onClick={()=>setReview(null)} className="py-2 rounded-xl border font-bold">إلغاء</button><button onClick={confirmReview} disabled={!!busyId} className={`py-2 rounded-xl text-white font-bold ${review.action==='approve'?'bg-emerald-600':'bg-red-600'}`}>{busyId?'جاري التنفيذ...':'تأكيد'}</button></div></div></div>}
  </div>
}
function Stat({icon,label,value,sub}:{icon:React.ReactNode;label:string;value:string;sub:string}){return <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3"><div className="flex items-center gap-1.5 text-xs text-slate-500">{icon}{label}</div><div className="font-extrabold mt-1">{value}</div><div className="text-[11px] text-slate-400 mt-0.5">{sub}</div></div>}
