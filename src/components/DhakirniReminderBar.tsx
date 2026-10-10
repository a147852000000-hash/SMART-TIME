import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BellRing,
  CheckCircle2,
  Circle,
  Plus,
  ChevronLeft,
  ChevronRight,
  ListTodo,
  Clock,
  Sparkles,
  X,
  Trash2,
  ArrowRight,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { DailyTask, Language, TaskPriority, TaskCategory, Note } from '../types';

interface DhakirniReminderBarProps {
  language: Language;
  tasks: DailyTask[];
  notes?: Note[];
  onToggleTask: (id: string) => void;
  onAddTask: (task: Omit<DailyTask, 'id' | 'createdAt'>) => void;
  onDeleteTask: (id: string) => void;
  onNavigateToNotes?: () => void;
}

export const DhakirniReminderBar: React.FC<DhakirniReminderBarProps> = ({
  language,
  tasks,
  notes = [],
  onToggleTask,
  onAddTask,
  onDeleteTask,
  onNavigateToNotes,
}) => {
  const isAr = language === 'ar';

  // Modal states
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New task form state
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>('medium');
  const [newCategory, setNewCategory] = useState<TaskCategory>('work');
  const [newDueTime, setNewDueTime] = useState('');
  const [selectedNoteId, setSelectedNoteId] = useState<string>('');

  // Active task carousel index among pending tasks
  const pendingTasks = useMemo(() => tasks.filter((t) => !t.completed), [tasks]);
  const completedCount = useMemo(() => tasks.filter((t) => t.completed).length, [tasks]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Keep index within bounds
  useEffect(() => {
    if (currentIndex >= pendingTasks.length) {
      setCurrentIndex(Math.max(0, pendingTasks.length - 1));
    }
  }, [pendingTasks.length, currentIndex]);

  // Auto cycle between pending tasks every 7 seconds if not interacting
  useEffect(() => {
    if (pendingTasks.length <= 1 || isListModalOpen || isAddModalOpen) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % pendingTasks.length);
    }, 7000);
    return () => clearInterval(interval);
  }, [pendingTasks.length, isListModalOpen, isAddModalOpen]);

  const activeTask = pendingTasks[currentIndex] || null;

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pendingTasks.length <= 1) return;
    setCurrentIndex((prev) => (prev === 0 ? pendingTasks.length - 1 : prev - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pendingTasks.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % pendingTasks.length);
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    onAddTask({
      title: newTitle.trim(),
      completed: false,
      priority: newPriority,
      category: newCategory,
      dueTime: newDueTime || undefined,
      dueDate: new Date().toISOString().split('T')[0],
      noteId: selectedNoteId || undefined,
      reminderEnabled: true,
    });

    setNewTitle('');
    setNewDueTime('');
    setSelectedNoteId('');
    setIsAddModalOpen(false);
  };

  const getPriorityBadge = (p: TaskPriority) => {
    switch (p) {
      case 'high':
        return {
          label: isAr ? 'عاجل' : 'Urgent',
          bg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
        };
      case 'medium':
        return {
          label: isAr ? 'مهم' : 'Important',
          bg: 'bg-accent-500/10 text-accent-700 dark:text-accent-400 border-accent-500/20',
        };
      case 'low':
      default:
        return {
          label: isAr ? 'عادي' : 'Normal',
          bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
        };
    }
  };

  return (
    <>
      {/* شريط ذكرني بعرض الشاشة تحت شريط الأخبار وبارتفاع ضعف شريط الأخبار تقريباً (h-14 / ~56px) */}
      <div
        id="dhakirni-reminder-bar"
        className="w-full min-h-[54px] sm:min-h-[58px] bg-gradient-to-r from-accent-500/10 via-white to-accent-500/5 dark:from-accent-950/40 dark:via-slate-900/90 dark:to-slate-900 border-t border-b border-accent-500/25 dark:border-accent-500/20 px-2 sm:px-3 flex items-center justify-between gap-2 select-none shadow-xs transition-colors"
        dir={isAr ? 'rtl' : 'ltr'}
      >
        {/* 1. بادج وعنوان "ذكرني" (Dhakirni Badge) */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsListModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-accent-500 text-slate-950 hover:bg-accent-600 active:scale-95 transition-all shadow-xs group"
            title={isAr ? 'ذكرني — اضغط لعرض جميع المهام اليومية' : 'Dhakirni — Click to view all daily tasks'}
          >
            <BellRing className="w-3.5 h-3.5 animate-wiggle text-slate-950" />
            <span className="font-extrabold text-xs tracking-tight">
              {isAr ? 'ذكرني' : 'Remind Me'}
            </span>
            <span className="text-[10px] font-black bg-black/20 text-slate-950 px-1.5 py-0.5 rounded-md">
              {pendingTasks.length > 0 ? pendingTasks.length : '✓'}
            </span>
          </button>
        </div>

        {/* 2. مساحة المهمة اليومية النشطة (Active Task Carousel) */}
        <div className="flex-1 min-w-0 flex items-center justify-between gap-1.5 px-1">
          {activeTask ? (
            <div className="flex items-center gap-2 min-w-0 flex-1 group">
              {/* زر إتمام المهمة (Check/Uncheck) بنقرة سريعة */}
              <button
                type="button"
                onClick={() => onToggleTask(activeTask.id)}
                className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors shrink-0"
                title={isAr ? 'تحديد كمكتملة' : 'Mark completed'}
              >
                {activeTask.completed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 fill-emerald-500/20" />
                ) : (
                  <Circle className="w-4 h-4" />
                )}
              </button>

              {/* نص المهمة والبيانات المصاحبة */}
              <div
                className="min-w-0 flex-1 cursor-pointer"
                onClick={() => setIsListModalOpen(true)}
                title={activeTask.title}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate block">
                    {activeTask.title}
                  </span>
                  {activeTask.priority && (
                    <span
                      className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md border shrink-0 hidden sm:inline-block ${
                        getPriorityBadge(activeTask.priority).bg
                      }`}
                    >
                      {getPriorityBadge(activeTask.priority).label}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                  {activeTask.dueTime && (
                    <span className="flex items-center gap-1 font-mono text-accent-600 dark:text-accent-400 font-bold">
                      <Clock className="w-2.5 h-2.5" />
                      <span>{activeTask.dueTime}</span>
                    </span>
                  )}
                  {pendingTasks.length > 1 && (
                    <span className="text-[9px] text-slate-400 font-sans">
                      ({currentIndex + 1} {isAr ? 'من' : 'of'} {pendingTasks.length})
                    </span>
                  )}
                  {activeTask.noteId && (
                    <span className="hidden md:inline-flex items-center gap-0.5 text-slate-500 text-[9px]">
                      <span>📝</span>
                      <span>{isAr ? 'مرتبطة بملاحظة' : 'Linked Note'}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* أسهم التنقل بين المهام إذا كان هناك أكثر من مهمة */}
              {pendingTasks.length > 1 && (
                <div className="flex items-center gap-0.5 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500"
                    title={isAr ? 'المهمة السابقة' : 'Previous task'}
                  >
                    {isAr ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500"
                    title={isAr ? 'المهمة التالية' : 'Next task'}
                  >
                    {isAr ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* حالة عدم وجود مهام متبقية أو إنجاز الكل */
            <div
              className="flex items-center gap-2 cursor-pointer flex-1 min-w-0"
              onClick={() => setIsAddModalOpen(true)}
            >
              <div className="w-6 h-6 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <div className="leading-tight truncate">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 block truncate">
                  {tasks.length > 0
                    ? isAr
                      ? '🎉 رائع! تم إنجاز جميع مهام اليوم'
                      : '🎉 All tasks completed!'
                    : isAr
                    ? 'لا توجد مهمات مجدولة لليوم في ذكرني'
                    : 'No tasks scheduled today in Remind Me'}
                </span>
                <span className="text-[10px] text-slate-400 block truncate">
                  {isAr ? 'انقر هنا لإضافة مهمة وتذكير جديد سريعاً' : 'Click to add a quick reminder task'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 3. الإجراءات السريعة (إضافة مهمة + عرض كل المهام) */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-accent-500/15 hover:bg-accent-500/25 text-accent-800 dark:text-accent-300 flex items-center justify-center active:scale-95 transition-all border border-accent-500/25"
            title={isAr ? 'إضافة مهمة سريعة في ذكرني' : 'Add quick task'}
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsListModalOpen(true)}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 flex items-center justify-center active:scale-95 transition-all border border-slate-200/80 dark:border-slate-700/80"
            title={isAr ? 'عرض جدول مهمات اليوم وقسم الملاحظات' : 'View daily tasks & notes'}
          >
            <ListTodo className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* نافذة عرض وإدارة المهام اليومية في "ذكرني" (All Tasks Modal) */}
      {isListModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={() => setIsListModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl p-5 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 animate-scaleUp max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-accent-500 text-slate-950 flex items-center justify-center font-bold shadow-xs">
                  <BellRing className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>{isAr ? 'ذكرني — مهمات اليوم' : 'Remind Me — Daily Tasks'}</span>
                    <span className="text-[10px] bg-accent-500/20 text-accent-700 dark:text-accent-300 font-mono px-2 py-0.5 rounded-full">
                      {completedCount}/{tasks.length}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {isAr
                      ? 'جدول المهمات اليومية والتذكيرات المرتبطة بقسم الملاحظات'
                      : 'Daily tasks & reminders linked to Notes'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsListModalOpen(false)}
                className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content / Tasks List */}
            <div className="flex-1 overflow-y-auto space-y-2 py-1 pe-1">
              {tasks.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Sparkles className="w-8 h-8 mx-auto text-accent-400 mb-2" />
                  <p className="font-bold text-sm text-slate-600 dark:text-slate-300">
                    {isAr ? 'لا توجد مهمات مسجلة بعد' : 'No tasks added yet'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {isAr ? 'أضف مهمتك اليومية الأولى لتظهر في شريط ذكرني' : 'Add your first task to show on the bar'}
                  </p>
                </div>
              ) : (
                <AnimatePresence mode="popLayout" initial={false}>
                  {tasks.map((task) => {
                    const pBadge = getPriorityBadge(task.priority);
                    return (
                      <motion.div
                        key={task.id}
                        layout
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{
                          opacity: 0,
                          x: isAr ? 45 : -45,
                          scale: 0.92,
                          height: 0,
                          marginBottom: 0,
                          filter: 'blur(2px)',
                          transition: { duration: 0.22, ease: 'easeInOut' },
                        }}
                        transition={{ layout: { duration: 0.2 } }}
                        className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-2.5 ${
                          task.completed
                            ? 'bg-slate-50 dark:bg-slate-850/40 border-slate-200/60 dark:border-slate-800/60 opacity-75'
                            : 'bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-750 shadow-xs'
                        }`}
                      >
                        {/* Checkbox */}
                        <button
                          type="button"
                          onClick={() => onToggleTask(task.id)}
                          className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-emerald-500 active:scale-80 transition-transform shrink-0"
                        >
                          {task.completed ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-500/20" />
                          ) : (
                            <Circle className="w-5 h-5" />
                          )}
                        </button>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-xs font-bold transition-all ${
                                task.completed
                                  ? 'line-through text-slate-400 dark:text-slate-500'
                                  : 'text-slate-900 dark:text-white'
                              }`}
                            >
                              {task.title}
                            </span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${pBadge.bg}`}>
                              {pBadge.label}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                            {task.dueTime && (
                              <span className="flex items-center gap-1 font-mono text-accent-600 dark:text-accent-400 font-bold">
                                <Clock className="w-2.5 h-2.5" />
                                <span>{task.dueTime}</span>
                              </span>
                            )}
                            {task.noteId && (
                              <span className="flex items-center gap-0.5 text-slate-400">
                                <span>📝</span>
                                <span>{isAr ? 'مرتبطة بملاحظة' : 'Linked Note'}</span>
                              </span>
                            )}
                            {task.completed && task.completedAt && (
                              <span className="text-emerald-600 dark:text-emerald-400 text-[9px]">
                                {isAr ? 'تم الإنجاز بنجاح' : 'Done'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => onDeleteTask(task.id)}
                          className="p-1.5 rounded-xl hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 active:scale-85 transition-all shrink-0"
                          title={isAr ? 'حذف المهمة' : 'Delete task'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>

            {/* Footer buttons */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 mt-2 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsListModalOpen(false);
                    setIsAddModalOpen(true);
                  }}
                  className="px-3 py-2 rounded-xl bg-accent-500 hover:bg-accent-600 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 transition-all shadow-xs active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isAr ? 'إضافة مهمة جديدة' : 'Add New Task'}</span>
                </button>

                {onNavigateToNotes && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsListModalOpen(false);
                      onNavigateToNotes();
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-all"
                  >
                    <span>{isAr ? 'قسم الملاحظات' : 'Notes View'}</span>
                    <ArrowRight className={`w-3.5 h-3.5 ${isAr ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsListModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition-all"
              >
                {isAr ? 'رجوع' : 'Back'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة إضافة مهمة سريعة جديدة في "ذكرني" (Quick Add Task Modal) */}
      {isAddModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={() => setIsAddModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl p-5 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-accent-500 text-slate-950 flex items-center justify-center font-bold">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    {isAr ? 'إضافة مهمة جديدة لـ "ذكرني"' : 'Add Task to "Remind Me"'}
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    {isAr ? 'ستظهر مباشرة في شريط ذكرني وقسم الملاحظات' : 'Will sync to ticker & notes'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3">
              {/* Task Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? 'عنوان المهمة / التذكير *' : 'Task / Reminder Title *'}
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={
                    isAr
                      ? 'مثال: مراجعة خطة العمل، حجز موعد، سداد فاتورة...'
                      : 'e.g., Review plan, doctor appointment...'
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500/40"
                  autoFocus
                />
              </div>

              {/* Priority & Due Time */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    {isAr ? 'الأولوية' : 'Priority'}
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                    className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white"
                  >
                    <option value="high">{isAr ? '🔴 عاجل وقصوى' : 'High / Urgent'}</option>
                    <option value="medium">{isAr ? '🟡 مهم ومتوسط' : 'Medium'}</option>
                    <option value="low">{isAr ? '🔵 عادي' : 'Low'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    {isAr ? 'وقت التذكير (اختياري)' : 'Due Time (optional)'}
                  </label>
                  <input
                    type="time"
                    value={newDueTime}
                    onChange={(e) => setNewDueTime(e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white"
                  />
                </div>
              </div>

              {/* Category & Link to Note */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    {isAr ? 'التصنيف' : 'Category'}
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as TaskCategory)}
                    className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white"
                  >
                    <option value="work">{isAr ? '💼 العمل والمشاريع' : 'Work'}</option>
                    <option value="personal">{isAr ? '👤 شخصي ويومي' : 'Personal'}</option>
                    <option value="finance">{isAr ? '💰 مالي وميزانية' : 'Finance'}</option>
                    <option value="health">{isAr ? '🩺 صحة ورياضة' : 'Health'}</option>
                    <option value="education">{isAr ? '📚 تعليم ومذاكرة' : 'Education'}</option>
                    <option value="general">{isAr ? '📌 عام' : 'General'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    {isAr ? 'ربط بملاحظة (اختياري)' : 'Link to Note (opt)'}
                  </label>
                  <select
                    value={selectedNoteId}
                    onChange={(e) => setSelectedNoteId(e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white truncate"
                  >
                    <option value="">{isAr ? '-- بدون ربط --' : '-- None --'}</option>
                    {notes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-200"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-accent-500 hover:bg-accent-600 text-slate-950 font-extrabold text-xs shadow-xs active:scale-95 transition-all"
                >
                  {isAr ? 'إضافة لـ "ذكرني"' : 'Add to Remind Me'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
