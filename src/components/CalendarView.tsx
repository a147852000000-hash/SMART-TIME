import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin, Plus, Trash2, Bell, Repeat2 } from 'lucide-react';
import type { CalendarEvent, EventCategory, Language } from '../types';
import {
  createCanonicalEvent,
  deleteCanonicalEvent,
  fetchCanonicalEvents,
  updateCanonicalEvent,
} from '../services/aiService';

interface CalendarViewProps {
  language: Language;
  timezone?: string;
}

const categories: EventCategory[] = ['work', 'personal', 'finance', 'health', 'education', 'general'];

const labels = {
  ar: {
    title: 'التقويم الذكي',
    today: 'اليوم',
    add: 'إضافة موعد',
    empty: 'مفيش مواعيد في اليوم ده',
    noTitle: 'اكتب عنوان الموعد',
    start: 'البداية',
    end: 'النهاية',
    location: 'المكان',
    reminder: 'تذكير قبل',
    minutes: 'دقيقة',
    save: 'حفظ',
    cancel: 'إلغاء',
    delete: 'حذف',
    previous: 'السابق',
    next: 'التالي',
    category: 'التصنيف',
    allDay: 'طوال اليوم',
    repeat: 'تكرار',
    daily: 'يومي',
    weekly: 'أسبوعي',
    monthly: 'شهري',
    none: 'بدون',
    loading: 'جارٍ تحميل المواعيد…',
    error: 'تعذر تحميل التقويم. جرّب تاني.',
    confirmDelete: 'تحذف الموعد ده؟',
    reminderOff: 'بدون تذكير',
  },
  en: {
    title: 'Smart Calendar',
    today: 'Today',
    add: 'Add event',
    empty: 'No events for this day',
    noTitle: 'Enter event title',
    start: 'Start',
    end: 'End',
    location: 'Location',
    reminder: 'Reminder',
    minutes: 'minutes',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    previous: 'Previous',
    next: 'Next',
    category: 'Category',
    allDay: 'All day',
    repeat: 'Repeat',
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
    none: 'None',
    loading: 'Loading calendar…',
    error: 'Could not load calendar. Try again.',
    confirmDelete: 'Delete this event?',
    reminderOff: 'No reminder',
  },
} as const;

function localDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function monthEnd(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function isoLocalInput(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function categoryLabel(category: EventCategory, isAr: boolean) {
  if (!isAr) return category;
  return ({ work: 'شغل', personal: 'شخصي', finance: 'مالي', health: 'صحة', education: 'تعليم', general: 'عام' })[category];
}

export const CalendarView: React.FC<CalendarViewProps> = ({ language, timezone = Intl.DateTimeFormat().resolvedOptions().timeZone }) => {
  const isAr = language === 'ar';
  const t = labels[isAr ? 'ar' : 'en'];
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>(() => typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);

  const loadEvents = async (date: Date) => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchCanonicalEvents({
        from: monthStart(date).toISOString(),
        to: monthEnd(date).toISOString(),
      });
      setEvents(data);
    } catch {
      setError(t.error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedDate((current) => {
      if (current.getFullYear() === cursor.getFullYear() && current.getMonth() === cursor.getMonth()) return current;
      return new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    });
    void loadEvents(cursor);
  }, [cursor.getFullYear(), cursor.getMonth()]);

  const days = useMemo(() => {
    const first = monthStart(cursor);
    const startOffset = first.getDay();
    const count = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    return Array.from({ length: Math.ceil((startOffset + count) / 7) * 7 }, (_, i) => {
      const d = new Date(cursor.getFullYear(), cursor.getMonth(), 1 - startOffset + i);
      return d;
    });
  }, [cursor]);

  const selectedEvents = useMemo(() => {
    const key = localDateKey(selectedDate);
    return events
      .filter((event) => localDateKey(new Date(event.startAt)) === key)
      .sort((a, b) => a.startAt.localeCompare(b.startAt));
  }, [events, selectedDate]);

  const openNew = () => {
    const base = new Date(selectedDate);
    base.setHours(9, 0, 0, 0);
    const end = new Date(base.getTime() + 60 * 60 * 1000);
    setEditing({
      id: '',
      title: '',
      description: '',
      startAt: base.toISOString(),
      endAt: end.toISOString(),
      timezone,
      location: '',
      category: 'general',
      allDay: false,
      reminderEnabled: false,
      reminderMinutes: 15,
      createdAt: '',
      updatedAt: '',
    });
  };

  const save = async () => {
    if (!editing?.title.trim()) return;
    const normalized = { ...editing, title: editing.title.trim(), description: editing.description?.trim() || undefined, location: editing.location?.trim() || undefined };
    try {
      const saved = editing.id ? await updateCanonicalEvent(normalized) : await createCanonicalEvent(normalized);
      setEvents((current) => {
        const without = current.filter((item) => item.id !== saved.id);
        return [...without, saved].sort((a, b) => a.startAt.localeCompare(b.startAt));
      });
      setEditing(null);
    } catch {
      setError(t.error);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm(t.confirmDelete)) return;
    try {
      await deleteCanonicalEvent(id);
      setEvents((current) => current.filter((item) => item.id !== id));
    } catch {
      setError(t.error);
    }
  };

  const enableNotifications = async () => {
    if (typeof Notification === 'undefined') return;
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
  };

  const monthTitle = cursor.toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' });
  const dayNames = isAr ? ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <section className="space-y-3" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-accent-500" />
            <h1 className="text-lg font-black">{t.title}</h1>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">{timezone}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {notificationPermission !== 'granted' && notificationPermission !== 'unsupported' && (
            <button onClick={() => void enableNotifications()} className="rounded-xl border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-[10px] font-black hover:bg-slate-100 dark:hover:bg-slate-800">
              <Bell className="w-3.5 h-3.5 inline-block me-1 text-accent-500" />{isAr ? 'تفعيل التنبيهات' : 'Enable alerts'}
            </button>
          )}
          <button onClick={openNew} className="flex items-center gap-1.5 rounded-xl bg-accent-500 text-slate-950 px-3 py-2 text-xs font-black shadow-sm active:scale-95">
            <Plus className="w-4 h-4" /> {t.add}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-3 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800" title={t.previous}><ChevronRight className="w-4 h-4" /></button>
          <button onClick={() => { const now = new Date(); setCursor(now); setSelectedDate(now); }} className="text-sm font-black hover:text-accent-500">{monthTitle} · {t.today}</button>
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800" title={t.next}><ChevronLeft className="w-4 h-4" /></button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {dayNames.map((name) => <div key={name} className="text-center text-[9px] font-bold text-slate-400 py-1">{name}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const key = localDateKey(day);
            const inMonth = day.getMonth() === cursor.getMonth();
            const selected = key === localDateKey(selectedDate);
            const hasEvents = events.some((event) => localDateKey(new Date(event.startAt)) === key);
            return (
              <button key={key} onClick={() => { setSelectedDate(day); if (day.getMonth() !== cursor.getMonth()) setCursor(new Date(day.getFullYear(), day.getMonth(), 1)); }} className={`min-h-9 rounded-xl flex flex-col items-center justify-center text-[11px] font-bold ${selected ? 'bg-accent-500 text-slate-950' : inMonth ? 'text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800' : 'text-slate-300 dark:text-slate-700'}`}>
                <span>{day.getDate()}</span>
                {hasEvents && <span className={`w-1 h-1 rounded-full mt-0.5 ${selected ? 'bg-slate-950' : 'bg-accent-500'}`} />}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-xs text-slate-400">{t.loading}</div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 dark:bg-rose-950/20 p-4 text-xs text-rose-600">{error}</div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-black">{selectedDate.toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
            <button onClick={openNew} className="text-accent-600 text-[11px] font-black flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> {t.add}</button>
          </div>
          {selectedEvents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-xs text-slate-400">{t.empty}</div>
          ) : selectedEvents.map((event) => (
            <article key={event.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-black truncate">{event.title}</h3>
                  <span className="inline-flex mt-1 px-2 py-0.5 rounded-lg bg-accent-500/10 text-accent-700 dark:text-accent-400 text-[9px] font-bold">{categoryLabel(event.category, isAr)}</span>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setEditing(event)} className="px-2 py-1 rounded-lg text-[10px] font-bold hover:bg-slate-100 dark:hover:bg-slate-800">{isAr ? 'تعديل' : 'Edit'}</button>
                  <button onClick={() => void remove(event.id)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20" title={t.delete}><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div className="mt-2 space-y-1 text-[10px] text-slate-500">
                <div className="flex items-center gap-1.5"><Clock3 className="w-3.5 h-3.5" />{event.allDay ? t.allDay : new Date(event.startAt).toLocaleTimeString(isAr ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}{event.endAt ? ` → ${new Date(event.endAt).toLocaleTimeString(isAr ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}` : ''}</div>
                {event.location && <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{event.location}</div>}
                {event.reminderEnabled && <div className="flex items-center gap-1.5"><Bell className="w-3.5 h-3.5" />{event.reminderMinutes} {t.minutes}</div>}
                {event.recurrence && <div className="flex items-center gap-1.5"><Repeat2 className="w-3.5 h-3.5" />{event.recurrence.frequency}</div>}
              </div>
            </article>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-[80] bg-slate-950/60 p-4 flex items-end sm:items-center justify-center">
          <div className="w-full max-w-[430px] max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 p-4 shadow-2xl" dir={isAr ? 'rtl' : 'ltr'}>
            <h2 className="text-base font-black mb-3">{editing.id ? (isAr ? 'تعديل الموعد' : 'Edit event') : t.add}</h2>
            <div className="space-y-2.5">
              <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder={t.noTitle} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-accent-500" autoFocus />
              <textarea value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder={isAr ? 'ملاحظات (اختياري)' : 'Notes (optional)'} className="w-full min-h-20 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-accent-500" />
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[10px] font-bold text-slate-500">{t.start}<input type="datetime-local" value={isoLocalInput(editing.startAt)} onChange={(e) => setEditing({ ...editing, startAt: new Date(e.target.value).toISOString() })} className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-2 text-xs" /></label>
                <label className="text-[10px] font-bold text-slate-500">{t.end}<input type="datetime-local" value={isoLocalInput(editing.endAt)} onChange={(e) => setEditing({ ...editing, endAt: new Date(e.target.value).toISOString() })} className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-2 text-xs" /></label>
              </div>
              <input value={editing.location || ''} onChange={(e) => setEditing({ ...editing, location: e.target.value })} placeholder={t.location} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-accent-500" />
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[10px] font-bold text-slate-500">{t.category}<select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value as EventCategory })} className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-2 text-xs">{categories.map((c) => <option key={c} value={c}>{categoryLabel(c, isAr)}</option>)}</select></label>
                <label className="text-[10px] font-bold text-slate-500">{t.reminder}<select value={editing.reminderEnabled ? String(editing.reminderMinutes || 15) : '0'} onChange={(e) => { const n = Number(e.target.value); setEditing({ ...editing, reminderEnabled: n > 0, reminderMinutes: n || 15 }); }} className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-2 text-xs"><option value="0">{t.reminderOff}</option><option value="5">5 {t.minutes}</option><option value="10">10 {t.minutes}</option><option value="15">15 {t.minutes}</option><option value="30">30 {t.minutes}</option><option value="60">60 {t.minutes}</option></select></label>
              </div>
              <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={editing.allDay} onChange={(e) => setEditing({ ...editing, allDay: e.target.checked })} /> {t.allDay}</label>
              <label className="text-[10px] font-bold text-slate-500">{t.repeat}<select value={editing.recurrence?.frequency || ''} onChange={(e) => { const v = e.target.value as 'daily'|'weekly'|'monthly'|''; setEditing({ ...editing, recurrence: v ? { frequency: v, interval: 1 } : undefined }); }} className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-2 text-xs"><option value="">{t.none}</option><option value="daily">{t.daily}</option><option value="weekly">{t.weekly}</option><option value="monthly">{t.monthly}</option></select></label>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setEditing(null)} className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-xs font-black">{t.cancel}</button>
              <button onClick={() => void save()} disabled={!editing.title.trim()} className="flex-1 rounded-xl bg-accent-500 text-slate-950 px-3 py-2.5 text-xs font-black disabled:opacity-40">{t.save}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
