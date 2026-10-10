import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import {
  FileText,
  Calculator,
  Plus,
  Search,
  Folder,
  Tag,
  Star,
  Archive,
  Trash2,
  Edit,
  Save,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Image as ImageIcon,
  Table as TableIcon,
  RotateCcw,
  RotateCw,
  Copy,
  Check,
  Sparkles,
  History,
  CornerDownLeft,
  Percent,
  X,
  Palette,
  Highlighter,
  BellRing,
  CheckCircle2,
  Circle,
  Calendar,
  Clock,
  CheckSquare,
  ArrowUpRight,
  Filter,
  GripVertical,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  SlidersHorizontal,
  ArrowDown,
  ArrowUp,
} from 'lucide-react';
import {
  Note,
  NoteFolder,
  NoteTag,
  CalculatorHistoryItem,
  CalculatorMode,
  Language,
  DailyTask,
  TaskPriority,
  TaskCategory,
} from '../types';
import { translations } from '../services/i18n';
import { NotesRepository } from '../services';

interface NotesAndAccountingProps {
  language: Language;
  notes: Note[];
  folders: NoteFolder[];
  tags: NoteTag[];
  onUpdateNotes: (notes: Note[]) => void;
  dailyTasks?: DailyTask[];
  initialTab?: 'notes' | 'tasks' | 'calculator';
  onUpdateDailyTasks?: (tasks: DailyTask[]) => void;
  onToggleDailyTask?: (id: string) => void;
  onAddDailyTask?: (task: Omit<DailyTask, 'id' | 'createdAt'>) => void;
  onDeleteDailyTask?: (id: string) => void;
}

export const NotesAndAccountingView: React.FC<NotesAndAccountingProps> = ({
  language,
  notes,
  folders,
  tags,
  onUpdateNotes,
  dailyTasks = [],
  initialTab = 'notes',
  onUpdateDailyTasks,
  onToggleDailyTask,
  onAddDailyTask,
  onDeleteDailyTask,
}) => {
  const t = translations[language];
  const isAr = language === 'ar';
  const [activeTab, setActiveTab] = useState<'notes' | 'tasks' | 'calculator'>(initialTab);

  // --- Daily Tasks (ذكرني) State ---
  const [taskStatusFilter, setTaskStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState<'all' | TaskPriority>('all');
  const [taskCategoryFilter, setTaskCategoryFilter] = useState<'all' | TaskCategory>('all');
  const [taskSearchQuery, setTaskSearchQuery] = useState('');

  // Drag-and-drop & manual prioritization state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | null>(null);
  const [showSortTools, setShowSortTools] = useState(false);

  // Task creation form in Notes tab
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('medium');
  const [newTaskCategory, setNewTaskCategory] = useState<TaskCategory>('work');
  const [newTaskDueTime, setNewDueTime] = useState('');
  const [newTaskNoteId, setNewTaskNoteId] = useState('');

  // --- Notes State ---
  const [selectedNote, setSelectedNote] = useState<Note | null>(notes[0] || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [filterView, setFilterView] = useState<'all' | 'favorites' | 'archived'>('all');
  const [isEditing, setIsEditing] = useState(false);

  // Editor states
  const [editorTitle, setEditorTitle] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [editorFolder, setEditorFolder] = useState('');
  const [editorTags, setEditorTags] = useState<string[]>([]);
  const [editorColor, setEditorColor] = useState('#ffffff');
  const editorRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // --- Calculator State ---
  const [calcMode, setCalcMode] = useState<CalculatorMode>('scientific');
  const [calcDisplay, setCalcDisplay] = useState<string>('0');
  const [calcEquation, setCalcEquation] = useState<string>('');
  const [calcHistory, setCalcHistory] = useState<CalculatorHistoryItem[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Engineering Conversion state
  const [engCategory, setEngCategory] = useState<'length' | 'weight' | 'temp' | 'data'>('length');
  const [engInputVal, setEngInputVal] = useState<number>(1);
  const [engFromUnit, setEngFromUnit] = useState<string>('m');
  const [engToUnit, setEngToUnit] = useState<string>('km');

  useEffect(() => {
    setCalcHistory(NotesRepository.getCalculatorHistory());
  }, []);

  // --- Daily Tasks Drag & Drop / Reordering Logic ---
  const handleSaveReorderedTasks = (reordered: DailyTask[]) => {
    if (onUpdateDailyTasks) {
      onUpdateDailyTasks(reordered);
    } else {
      NotesRepository.saveDailyTasks(reordered);
    }
  };

  const handleMoveTaskDelta = (taskId: string, direction: 'up' | 'down') => {
    const currentIndex = dailyTasks.findIndex((t) => t.id === taskId);
    if (currentIndex === -1) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= dailyTasks.length) return;

    const reordered = [...dailyTasks];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    handleSaveReorderedTasks(reordered);
  };

  const handleTaskDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleTaskDragOver = (e: React.DragEvent, targetTaskId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!draggedTaskId || draggedTaskId === targetTaskId) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? 'before' : 'after';

    if (dragOverTaskId !== targetTaskId || dropPosition !== position) {
      setDragOverTaskId(targetTaskId);
      setDropPosition(position);
    }
  };

  const handleTaskDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      const taskIdAttr = e.currentTarget.getAttribute('data-task-id');
      if (dragOverTaskId === taskIdAttr) {
        setDragOverTaskId(null);
        setDropPosition(null);
      }
    }
  };

  const handleTaskDrop = (e: React.DragEvent, targetTaskId: string) => {
    e.preventDefault();
    if (!draggedTaskId || draggedTaskId === targetTaskId) {
      setDraggedTaskId(null);
      setDragOverTaskId(null);
      setDropPosition(null);
      return;
    }

    const fromIndex = dailyTasks.findIndex((t) => t.id === draggedTaskId);
    const toIndex = dailyTasks.findIndex((t) => t.id === targetTaskId);

    if (fromIndex !== -1 && toIndex !== -1) {
      const reordered = [...dailyTasks];
      const [moved] = reordered.splice(fromIndex, 1);

      let insertionIndex = toIndex;
      if (fromIndex < toIndex) {
        insertionIndex = dropPosition === 'after' ? toIndex : toIndex - 1;
      } else {
        insertionIndex = dropPosition === 'after' ? toIndex + 1 : toIndex;
      }

      insertionIndex = Math.max(0, Math.min(reordered.length, insertionIndex));
      reordered.splice(insertionIndex, 0, moved);
      handleSaveReorderedTasks(reordered);
    }

    setDraggedTaskId(null);
    setDragOverTaskId(null);
    setDropPosition(null);
  };

  const handleTaskDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverTaskId(null);
    setDropPosition(null);
  };

  // Quick auto-sort helpers
  const handleSortTasksByPriority = () => {
    const priorityWeights: Record<TaskPriority, number> = { high: 1, medium: 2, low: 3 };
    const sorted = [...dailyTasks].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return (priorityWeights[a.priority] || 2) - (priorityWeights[b.priority] || 2);
    });
    handleSaveReorderedTasks(sorted);
  };

  const handleSortTasksByDueTime = () => {
    const sorted = [...dailyTasks].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (!a.dueTime) return 1;
      if (!b.dueTime) return -1;
      return a.dueTime.localeCompare(b.dueTime);
    });
    handleSaveReorderedTasks(sorted);
  };

  const handleSortTasksByPendingFirst = () => {
    const sorted = [...dailyTasks].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return 0;
    });
    handleSaveReorderedTasks(sorted);
  };

  const handleToggleTaskWithFeedback = (taskId: string) => {
    const target = dailyTasks.find((t) => t.id === taskId);
    if (target && !target.completed) {
      try {
        confetti({
          particleCount: 30,
          spread: 55,
          origin: { y: 0.72 },
          colors: ['#06b6d4', '#10b981', '#f59e0b', '#6366f1'],
          ticks: 200,
        });
      } catch {
        // Safe fallback
      }
    }
    onToggleDailyTask?.(taskId);
  };

  // When selected note changes, populate editor
  useEffect(() => {
    if (selectedNote) {
      setEditorTitle(selectedNote.title);
      setEditorContent(selectedNote.content);
      setEditorFolder(selectedNote.folderId || '');
      setEditorTags(selectedNote.tags || []);
      setEditorColor(selectedNote.color || '#ffffff');
    }
  }, [selectedNote]);

  // Execute rich text formatting
  const applyFormat = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      setEditorContent(editorRef.current.innerHTML);
    }
  };

  const handleSaveNote = () => {
    const content = editorRef.current ? editorRef.current.innerHTML : editorContent;
    if (!editorTitle.trim() && !content.trim()) return;

    if (selectedNote && selectedNote.id) {
      // Update existing
      const updated = notes.map((n) =>
        n.id === selectedNote.id
          ? {
              ...n,
              title: editorTitle || (language === 'ar' ? 'ملاحظة بدون عنوان' : 'Untitled Note'),
              content,
              folderId: editorFolder,
              tags: editorTags,
              color: editorColor,
              updatedAt: new Date().toISOString(),
            }
          : n
      );
      onUpdateNotes(updated);
      NotesRepository.saveNotes(updated);
      setSelectedNote(updated.find((n) => n.id === selectedNote.id) || null);
    } else {
      // Create new
      const newNote: Note = {
        id: 'note_' + Date.now(),
        title: editorTitle || (language === 'ar' ? 'ملاحظة جديدة' : 'New Note'),
        content,
        folderId: editorFolder,
        tags: editorTags,
        color: editorColor,
        isFavorite: false,
        isArchived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const updated = [newNote, ...notes];
      onUpdateNotes(updated);
      NotesRepository.saveNotes(updated);
      setSelectedNote(newNote);
    }
    setIsEditing(false);
  };

  const handleCreateNewNote = () => {
    const newNote: Note = {
      id: 'note_' + Date.now(),
      title: language === 'ar' ? 'ملاحظة جديدة' : 'New Note',
      content: '<p>' + (language === 'ar' ? 'اكتب تفاصيل ملاحظتك هنا...' : 'Start typing your note here...') + '</p>',
      folderId: folders[0]?.id || '',
      tags: [],
      color: '#ffffff',
      isFavorite: false,
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [newNote, ...notes];
    onUpdateNotes(updated);
    NotesRepository.saveNotes(updated);
    setSelectedNote(newNote);
    setIsEditing(true);
  };

  const handleDeleteNote = (id: string) => {
    const updated = notes.filter((n) => n.id !== id);
    onUpdateNotes(updated);
    NotesRepository.saveNotes(updated);
    if (selectedNote?.id === id) {
      setSelectedNote(updated[0] || null);
    }
  };

  const toggleFavorite = (id: string) => {
    const updated = notes.map((n) => (n.id === id ? { ...n, isFavorite: !n.isFavorite } : n));
    onUpdateNotes(updated);
    NotesRepository.saveNotes(updated);
    if (selectedNote?.id === id) {
      setSelectedNote({ ...selectedNote, isFavorite: !selectedNote.isFavorite });
    }
  };

  const toggleArchive = (id: string) => {
    const updated = notes.map((n) => (n.id === id ? { ...n, isArchived: !n.isArchived } : n));
    onUpdateNotes(updated);
    NotesRepository.saveNotes(updated);
    if (selectedNote?.id === id) {
      setSelectedNote({ ...selectedNote, isArchived: !selectedNote.isArchived });
    }
  };

  // --- Calculator Logic ---
  const handleCalcInput = (val: string) => {
    if (calcDisplay === '0' && !isNaN(Number(val))) {
      setCalcDisplay(val);
    } else {
      setCalcDisplay((prev) => prev + val);
    }
  };

  const handleCalcClear = () => {
    setCalcDisplay('0');
    setCalcEquation('');
  };

  const handleCalcDelete = () => {
    if (calcDisplay.length <= 1) {
      setCalcDisplay('0');
    } else {
      setCalcDisplay(calcDisplay.slice(0, -1));
    }
  };

  const handleCalcMathFunc = (func: string) => {
    try {
      const num = parseFloat(calcDisplay);
      let res = 0;
      switch (func) {
        case 'sin':
          res = Math.sin((num * Math.PI) / 180);
          break;
        case 'cos':
          res = Math.cos((num * Math.PI) / 180);
          break;
        case 'tan':
          res = Math.tan((num * Math.PI) / 180);
          break;
        case 'log':
          res = Math.log10(num);
          break;
        case 'ln':
          res = Math.log(num);
          break;
        case 'sqrt':
          res = Math.sqrt(num);
          break;
        case 'sqr':
          res = Math.pow(num, 2);
          break;
        case 'cube':
          res = Math.pow(num, 3);
          break;
        case 'percent':
          res = num / 100;
          break;
        case 'pi':
          res = Math.PI;
          break;
        case 'e':
          res = Math.E;
          break;
        default:
          return;
      }
      const formattedRes = Number(res.toFixed(8)).toString();
      const expression = `${func}(${calcDisplay})`;
      setCalcEquation(expression + ' =');
      setCalcDisplay(formattedRes);
      NotesRepository.addCalculatorHistory({
        expression,
        result: formattedRes,
        mode: calcMode,
      });
      setCalcHistory(NotesRepository.getCalculatorHistory());
    } catch (e) {
      setCalcDisplay('Error');
    }
  };

  const handleCalcEquals = () => {
    try {
      // Safe sanitized arithmetic evaluator
      let expr = calcDisplay
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/π/g, Math.PI.toString())
        .replace(/e/g, Math.E.toString())
        .replace(/\^/g, '**');

      // Only allow safe math tokens
      if (!/^[0-9+\-*/(). eEMathPIsqrt]+$/.test(expr)) {
        throw new Error('Invalid tokens');
      }

      // Safe evaluation with Function constructor
      // eslint-disable-next-line no-new-func
      const evalResult = Function(`"use strict"; return (${expr})`)();
      const formattedRes = Number(Number(evalResult).toFixed(8)).toString();

      setCalcEquation(calcDisplay + ' =');
      setCalcDisplay(formattedRes);

      NotesRepository.addCalculatorHistory({
        expression: calcDisplay,
        result: formattedRes,
        mode: calcMode,
      });
      setCalcHistory(NotesRepository.getCalculatorHistory());
    } catch (e) {
      setCalcDisplay('Error');
    }
  };

  // Unit conversion helper
  const calculateConversion = () => {
    const val = engInputVal;
    if (isNaN(val)) return '0';
    if (engCategory === 'length') {
      // Meters as base
      let inMeters = val;
      if (engFromUnit === 'km') inMeters = val * 1000;
      if (engFromUnit === 'cm') inMeters = val / 100;
      if (engFromUnit === 'mile') inMeters = val * 1609.34;
      if (engFromUnit === 'foot') inMeters = val * 0.3048;

      if (engToUnit === 'm') return inMeters.toFixed(4);
      if (engToUnit === 'km') return (inMeters / 1000).toFixed(4);
      if (engToUnit === 'cm') return (inMeters * 100).toFixed(2);
      if (engToUnit === 'mile') return (inMeters / 1609.34).toFixed(4);
      if (engToUnit === 'foot') return (inMeters / 0.3048).toFixed(2);
    }
    if (engCategory === 'weight') {
      // Grams base
      let inGrams = val;
      if (engFromUnit === 'kg') inGrams = val * 1000;
      if (engFromUnit === 'lb') inGrams = val * 453.592;
      if (engFromUnit === 'oz') inGrams = val * 28.3495;

      if (engToUnit === 'g') return inGrams.toFixed(2);
      if (engToUnit === 'kg') return (inGrams / 1000).toFixed(4);
      if (engToUnit === 'lb') return (inGrams / 453.592).toFixed(4);
      if (engToUnit === 'oz') return (inGrams / 28.3495).toFixed(2);
    }
    if (engCategory === 'temp') {
      if (engFromUnit === 'C' && engToUnit === 'F') return ((val * 9) / 5 + 32).toFixed(2);
      if (engFromUnit === 'F' && engToUnit === 'C') return (((val - 32) * 5) / 9).toFixed(2);
      if (engFromUnit === 'C' && engToUnit === 'K') return (val + 273.15).toFixed(2);
      return val.toString();
    }
    if (engCategory === 'data') {
      let inMB = val;
      if (engFromUnit === 'KB') inMB = val / 1024;
      if (engFromUnit === 'GB') inMB = val * 1024;
      if (engFromUnit === 'TB') inMB = val * 1024 * 1024;

      if (engToUnit === 'MB') return inMB.toFixed(2);
      if (engToUnit === 'GB') return (inMB / 1024).toFixed(4);
      if (engToUnit === 'KB') return (inMB * 1024).toFixed(0);
      if (engToUnit === 'TB') return (inMB / (1024 * 1024)).toFixed(6);
    }
    return '0';
  };

  // Filtered Notes
  const filteredNotes = notes.filter((note) => {
    if (filterView === 'favorites' && !note.isFavorite) return false;
    if (filterView === 'archived' && !note.isArchived) return false;
    if (filterView === 'all' && note.isArchived) return false;

    if (selectedFolder !== 'all' && note.folderId !== selectedFolder) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = note.title.toLowerCase().includes(q);
      const matchContent = note.content.toLowerCase().includes(q);
      return matchTitle || matchContent;
    }
    return true;
  });

  return (
    <div className="space-y-6" id="notes-accounting-module">
      {/* Top Section Header & Sub-Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-850 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-accent-500 text-white shadow-md shadow-accent-500/20">
              <FileText className="w-5 h-5" />
            </span>
            {t.notesAndAccounting}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {language === 'ar'
              ? 'محرر الملاحظات المتقدم + الحاسبة العلمية والهندسية المتطورة'
              : 'Advanced Rich Notes Editor + Scientific & Engineering Calculator'}
          </p>
        </div>

        {/* Sub-Tabs: Notes vs Tasks vs Calculator */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 self-start sm:self-auto overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab('notes')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === 'notes'
                ? 'bg-white dark:bg-slate-900 text-accent-600 dark:text-accent-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
            id="subtab-notes-btn"
          >
            <FileText className="w-4 h-4" />
            <span>{t.notes}</span>
            <span className="text-xs px-1.5 py-0.2 rounded-full bg-accent-100 text-accent-800 dark:bg-accent-950/80 dark:text-accent-300">
              {notes.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === 'tasks'
                ? 'bg-white dark:bg-slate-900 text-accent-600 dark:text-accent-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
            id="subtab-tasks-btn"
          >
            <BellRing className="w-4 h-4 text-accent-500" />
            <span>{isAr ? 'ذكرني (المهمات)' : 'Reminders'}</span>
            <span className="text-xs px-1.5 py-0.2 rounded-full bg-accent-500 text-slate-950 font-bold">
              {dailyTasks.filter((t) => !t.completed).length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('calculator')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === 'calculator'
                ? 'bg-white dark:bg-slate-900 text-accent-600 dark:text-accent-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
            id="subtab-calculator-btn"
          >
            <Calculator className="w-4 h-4" />
            <span>{t.calculator}</span>
            <span className="text-xs px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono">
              100+
            </span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 1. NOTES TAB CONTENT */}
      {/* ========================================================= */}
      {activeTab === 'notes' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Notes Sidebar / List (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            {/* Action Bar */}
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={handleCreateNewNote}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-accent-500 to-accent-600 hover:from-accent-600 hover:to-accent-700 text-white font-bold text-sm shadow-md shadow-accent-500/20 active:scale-98 transition-all"
                id="create-note-btn"
              >
                <Plus className="w-4 h-4" />
                <span>{t.addNote}</span>
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-white dark:bg-slate-850 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold">
              <button
                onClick={() => setFilterView('all')}
                className={`flex-1 py-1.5 rounded-lg text-center transition-colors ${
                  filterView === 'all'
                    ? 'bg-accent-500 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {t.all}
              </button>
              <button
                onClick={() => setFilterView('favorites')}
                className={`flex-1 py-1.5 rounded-lg text-center transition-colors ${
                  filterView === 'favorites'
                    ? 'bg-accent-500 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {t.favorites}
              </button>
              <button
                onClick={() => setFilterView('archived')}
                className={`flex-1 py-1.5 rounded-lg text-center transition-colors ${
                  filterView === 'archived'
                    ? 'bg-accent-500 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {t.archive}
              </button>
            </div>

            {/* Search Notes */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={language === 'ar' ? 'بحث في الملاحظات...' : 'Search notes...'}
                className="w-full ps-9 pe-4 py-2 text-xs rounded-xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
              />
            </div>

            {/* Folder Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <button
                onClick={() => setSelectedFolder('all')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold shrink-0 transition-colors ${
                  selectedFolder === 'all'
                    ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900'
                    : 'bg-white dark:bg-slate-850 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                }`}
              >
                {t.all}
              </button>
              {folders.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelectedFolder(f.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold shrink-0 transition-colors flex items-center gap-1.5 ${
                    selectedFolder === f.id
                      ? 'bg-accent-500 text-white'
                      : 'bg-white dark:bg-slate-850 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: f.color }} />
                  <span>{f.name}</span>
                </button>
              ))}
            </div>

            {/* Notes List */}
            <div className="space-y-2.5 max-h-[520px] overflow-y-auto pe-1">
              {filteredNotes.length === 0 ? (
                <div className="text-center py-10 bg-white dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                  <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {language === 'ar' ? 'لا توجد ملاحظات مطابقة' : 'No notes found'}
                  </p>
                </div>
              ) : (
                filteredNotes.map((note) => {
                  const isSelected = selectedNote?.id === note.id;
                  const folder = folders.find((f) => f.id === note.folderId);
                  return (
                    <div
                      key={note.id}
                      onClick={() => {
                        setSelectedNote(note);
                        setIsEditing(false);
                      }}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer text-start ${
                        isSelected
                          ? 'bg-accent-50/70 dark:bg-accent-950/30 border-accent-400 dark:border-accent-500/60 shadow-sm'
                          : 'bg-white dark:bg-slate-850 border-slate-200/80 dark:border-slate-800 hover:border-accent-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">
                          {note.title}
                        </h4>
                        <div className="flex items-center gap-1 shrink-0">
                          {note.isFavorite && <Star className="w-3.5 h-3.5 text-accent-500 fill-accent-500" />}
                          {note.isArchived && <Archive className="w-3.5 h-3.5 text-slate-400" />}
                        </div>
                      </div>

                      <div
                        className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2"
                        dangerouslySetInnerHTML={{ __html: note.content.replace(/<[^>]*>?/gm, ' ') }}
                      />

                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[10px] text-slate-400">
                        <span>{new Date(note.updatedAt).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}</span>
                        {folder && (
                          <span
                            className="px-2 py-0.5 rounded font-medium"
                            style={{ backgroundColor: `${folder.color}15`, color: folder.color }}
                          >
                            {folder.name}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Note Editor / Reader (8 cols) */}
          <div className="lg:col-span-8 bg-white dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm flex flex-col justify-between min-h-[580px]">
            {selectedNote ? (
              <div className="space-y-4 flex-1 flex flex-col">
                {/* Note Header & Action Tools */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editorTitle}
                      onChange={(e) => {
                        setEditorTitle(e.target.value);
                        setIsEditing(true);
                      }}
                      placeholder={language === 'ar' ? 'عنوان الملاحظة...' : 'Note Title...'}
                      className="text-lg sm:text-xl font-black bg-transparent text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-accent-500 rounded px-1"
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => toggleFavorite(selectedNote.id)}
                      className={`p-2 rounded-xl border transition-colors ${
                        selectedNote.isFavorite
                          ? 'bg-accent-50 dark:bg-accent-950 text-accent-500 border-accent-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:text-accent-500'
                      }`}
                      title={t.favorites}
                    >
                      <Star className={`w-4 h-4 ${selectedNote.isFavorite ? 'fill-accent-500' : ''}`} />
                    </button>

                    <button
                      onClick={() => toggleArchive(selectedNote.id)}
                      className={`p-2 rounded-xl border transition-colors ${
                        selectedNote.isArchived
                          ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-500 border-indigo-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:text-indigo-500'
                      }`}
                      title={t.archive}
                    >
                      <Archive className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(editorTitle + '\n\n' + editorContent.replace(/<[^>]*>?/gm, ''));
                        setCopiedId(selectedNote.id);
                        setTimeout(() => setCopiedId(null), 2000);
                      }}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                      title={language === 'ar' ? 'نسخ الملاحظة' : 'Copy Note'}
                    >
                      {copiedId === selectedNote.id ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>

                    <button
                      onClick={() => handleDeleteNote(selectedNote.id)}
                      className="p-2 rounded-xl border border-rose-200 dark:border-rose-900/50 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      title={t.delete}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={handleSaveNote}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent-500 hover:bg-accent-600 text-white font-bold text-xs shadow-sm shadow-accent-500/20 active:scale-95"
                    >
                      <Save className="w-4 h-4" />
                      <span>{t.save}</span>
                    </button>
                  </div>
                </div>

                {/* Rich Text Editor Toolbar */}
                <div className="flex flex-wrap items-center gap-1 p-2 bg-slate-50 dark:bg-slate-900/70 rounded-xl border border-slate-200 dark:border-slate-800">
                  <button
                    onClick={() => applyFormat('bold')}
                    className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                    title="Bold (Ctrl+B)"
                  >
                    <Bold className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => applyFormat('italic')}
                    className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                    title="Italic (Ctrl+I)"
                  >
                    <Italic className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => applyFormat('underline')}
                    className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                    title="Underline (Ctrl+U)"
                  >
                    <Underline className="w-4 h-4" />
                  </button>

                  <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />

                  <button
                    onClick={() => applyFormat('justifyLeft')}
                    className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                  >
                    <AlignLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => applyFormat('justifyCenter')}
                    className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                  >
                    <AlignCenter className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => applyFormat('justifyRight')}
                    className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                  >
                    <AlignRight className="w-4 h-4" />
                  </button>

                  <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />

                  <button
                    onClick={() => applyFormat('insertUnorderedList')}
                    className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => applyFormat('insertOrderedList')}
                    className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                  >
                    <ListOrdered className="w-4 h-4" />
                  </button>

                  <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />

                  {/* Heading select */}
                  <select
                    onChange={(e) => applyFormat('formatBlock', e.target.value)}
                    className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-slate-700 dark:text-slate-300"
                  >
                    <option value="p">Paragraph</option>
                    <option value="h2">Heading 2</option>
                    <option value="h3">Heading 3</option>
                    <option value="blockquote">Quote</option>
                  </select>

                  <button
                    onClick={() => applyFormat('hiliteColor', '#fef08a')}
                    className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-accent-500"
                    title="Highlight Yellow"
                  >
                    <Highlighter className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => applyFormat('undo')}
                    className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500"
                    title="Undo"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => applyFormat('redo')}
                    className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500"
                    title="Redo"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>
                </div>

                {/* Rich Content Area */}
                <div
                  ref={editorRef}
                  contentEditable
                  onInput={() => setIsEditing(true)}
                  dangerouslySetInnerHTML={{ __html: editorContent }}
                  className="flex-1 min-h-[300px] p-4 bg-slate-50/50 dark:bg-slate-900/40 rounded-xl border border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-accent-500 prose dark:prose-invert max-w-none overflow-y-auto"
                />

                {/* Note Meta / Folder Selection */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <Folder className="w-3.5 h-3.5 text-slate-400" />
                    <select
                      value={editorFolder}
                      onChange={(e) => {
                        setEditorFolder(e.target.value);
                        setIsEditing(true);
                      }}
                      className="bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-300"
                    >
                      <option value="">{language === 'ar' ? 'بدون مجلد' : 'No Folder'}</option>
                      {folders.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <span>
                    {language === 'ar' ? 'آخر تعديل:' : 'Last updated:'}{' '}
                    {new Date(selectedNote.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-24">
                <FileText className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">
                  {language === 'ar' ? 'اختر ملاحظة أو أنشئ ملاحظة جديدة' : 'Select a note or create a new one'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. DHAKIRNI (ذكرني - المهمات اليومية) TAB CONTENT */}
      {/* ========================================================= */}
      {activeTab === 'tasks' && (
        <div className="space-y-6" id="dhakirni-tasks-container">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="bg-white dark:bg-slate-850 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">
                {isAr ? 'إجمالي المهمات' : 'Total Tasks'}
              </span>
              <div className="flex items-center justify-between mt-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
                  {dailyTasks.length}
                </span>
                <span className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  <CheckSquare className="w-5 h-5" />
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-850 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs text-accent-600 dark:text-accent-400 block font-medium">
                {isAr ? 'قيد التنفيذ' : 'Pending'}
              </span>
              <div className="flex items-center justify-between mt-2">
                <span className="text-2xl font-bold text-accent-600 dark:text-accent-400 font-mono">
                  {dailyTasks.filter((t) => !t.completed).length}
                </span>
                <span className="p-2 rounded-xl bg-accent-50 dark:bg-accent-950/50 text-accent-600 dark:text-accent-400">
                  <Clock className="w-5 h-5" />
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-850 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs text-emerald-600 dark:text-emerald-400 block font-medium">
                {isAr ? 'تم الإنجاز' : 'Completed'}
              </span>
              <div className="flex items-center justify-between mt-2">
                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                  {dailyTasks.filter((t) => t.completed).length}
                </span>
                <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-850 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs text-indigo-600 dark:text-indigo-400 block font-medium">
                {isAr ? 'نسبة الإنجاز' : 'Progress'}
              </span>
              <div className="mt-2">
                <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                  {dailyTasks.length > 0
                    ? Math.round((dailyTasks.filter((t) => t.completed).length / dailyTasks.length) * 100)
                    : 0}
                  %
                </span>
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                    style={{
                      width: `${
                        dailyTasks.length > 0
                          ? Math.round((dailyTasks.filter((t) => t.completed).length / dailyTasks.length) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Quick Add Task Form */}
          <div className="bg-white dark:bg-slate-850 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4 text-accent-500" />
              <span>{isAr ? 'إضافة مهمة جديدة في ذكرني' : 'Add New Daily Task'}</span>
            </h3>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newTaskTitle.trim()) return;
                onAddDailyTask?.({
                  title: newTaskTitle.trim(),
                  priority: newTaskPriority,
                  category: newTaskCategory,
                  completed: false,
                  dueTime: newTaskDueTime || undefined,
                  noteId: newTaskNoteId || undefined,
                });
                setNewTaskTitle('');
                setNewDueTime('');
                setNewTaskNoteId('');
              }}
              className="space-y-3"
            >
              <div className="flex flex-col sm:flex-row items-center gap-2.5">
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder={isAr ? 'اكتب نص المهمة اليومية...' : 'Enter task title...'}
                  className="flex-1 w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
                  id="task-input-title"
                />
                <button
                  type="submit"
                  disabled={!newTaskTitle.trim()}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-slate-950 font-bold text-sm transition-all flex items-center justify-center gap-1.5 shadow-md shadow-accent-500/20 whitespace-nowrap"
                  id="submit-new-task-btn"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isAr ? 'إضافة المهمة' : 'Add Task'}</span>
                </button>
              </div>

              {/* Task Options: Priority, Category, Due Time, Linked Note */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                {/* Priority */}
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">
                    {isAr ? 'الأولوية' : 'Priority'}
                  </label>
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value as TaskPriority)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 focus:outline-none"
                  >
                    <option value="high">{isAr ? '🔴 عاجل' : 'High'}</option>
                    <option value="medium">{isAr ? '🟡 مهم' : 'Medium'}</option>
                    <option value="low">{isAr ? '🟢 عادي' : 'Low'}</option>
                  </select>
                </div>

                {/* Category */}
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">
                    {isAr ? 'التصنيف' : 'Category'}
                  </label>
                  <select
                    value={newTaskCategory}
                    onChange={(e) => setNewTaskCategory(e.target.value as TaskCategory)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 focus:outline-none"
                  >
                    <option value="work">{isAr ? '💼 عمل' : 'Work'}</option>
                    <option value="personal">{isAr ? '👤 شخصي' : 'Personal'}</option>
                    <option value="finance">{isAr ? '💰 مالي' : 'Finance'}</option>
                    <option value="health">{isAr ? '🏥 صحة' : 'Health'}</option>
                    <option value="education">{isAr ? '🎓 تعليم' : 'Education'}</option>
                    <option value="general">{isAr ? '📌 عام' : 'General'}</option>
                  </select>
                </div>

                {/* Due Time */}
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">
                    {isAr ? 'الوقت المحدد' : 'Due Time'}
                  </label>
                  <input
                    type="time"
                    value={newTaskDueTime}
                    onChange={(e) => setNewDueTime(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 focus:outline-none"
                  />
                </div>

                {/* Link to Note */}
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">
                    {isAr ? 'ربط بملاحظة' : 'Link Note'}
                  </label>
                  <select
                    value={newTaskNoteId}
                    onChange={(e) => setNewTaskNoteId(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 focus:outline-none"
                  >
                    <option value="">{isAr ? '— بدون ربط —' : 'None'}</option>
                    {notes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.title.length > 20 ? n.title.slice(0, 20) + '...' : n.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </form>
          </div>

          {/* Filters, Search & Priority Sorting Toolbar */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-850 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={taskSearchQuery}
                  onChange={(e) => setTaskSearchQuery(e.target.value)}
                  placeholder={isAr ? 'بحث في المهمات...' : 'Search tasks...'}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl ps-9 pe-4 py-2 text-xs focus:outline-none"
                />
              </div>

              {/* Status Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                <button
                  onClick={() => setTaskStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    taskStatusFilter === 'all'
                      ? 'bg-white dark:bg-slate-850 text-accent-600 dark:text-accent-400 shadow-sm'
                      : 'text-slate-500'
                  }`}
                >
                  {isAr ? 'الكل' : 'All'}
                </button>
                <button
                  onClick={() => setTaskStatusFilter('pending')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    taskStatusFilter === 'pending'
                      ? 'bg-white dark:bg-slate-850 text-accent-600 dark:text-accent-400 shadow-sm'
                      : 'text-slate-500'
                  }`}
                >
                  {isAr ? 'قيد التنفيذ' : 'Pending'}
                </button>
                <button
                  onClick={() => setTaskStatusFilter('completed')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    taskStatusFilter === 'completed'
                      ? 'bg-white dark:bg-slate-850 text-accent-600 dark:text-accent-400 shadow-sm'
                      : 'text-slate-500'
                  }`}
                >
                  {isAr ? 'المكتملة' : 'Completed'}
                </button>
              </div>

              {/* Toggle Quick Sort Tools Button */}
              <button
                type="button"
                onClick={() => setShowSortTools(!showSortTools)}
                className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  showSortTools
                    ? 'bg-accent-500 text-slate-950 border-accent-600 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title={isAr ? 'أدوات الترتيب الذكي' : 'Sort & Prioritize Tools'}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isAr ? 'ترتيب سريع' : 'Quick Sort'}</span>
              </button>
            </div>

            {/* Reorder helper cue & Quick Sort Action Bar */}
            <div className="bg-slate-50 dark:bg-slate-900/60 px-3.5 py-2 rounded-xl border border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <GripVertical className="w-3.5 h-3.5 text-accent-500 animate-pulse" />
                <span>
                  {isAr
                    ? 'اسحب المهمة من المقبض ⠿ لإعادة ترتيب الأولويات يدوياً، أو استخدم أزرار الأسهم ↑ ↓'
                    : 'Drag tasks by the handle ⠿ to manually prioritize, or use ↑ ↓ buttons'}
                </span>
              </div>

              {/* Quick Auto-Sort Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={handleSortTasksByPriority}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-accent-50 dark:hover:bg-accent-950/40 text-slate-700 dark:text-slate-200 hover:text-accent-600 dark:hover:text-accent-400 border border-slate-200 dark:border-slate-700 text-[11px] font-bold flex items-center gap-1 transition-colors"
                  title={isAr ? 'ترتيب: عاجل ➔ مهم ➔ عادي' : 'Sort: High ➔ Medium ➔ Low'}
                >
                  <ArrowUpDown className="w-3 h-3 text-rose-500" />
                  <span>{isAr ? 'الأولوية (عاجل أولاً)' : 'By Priority'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSortTasksByDueTime}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-accent-50 dark:hover:bg-accent-950/40 text-slate-700 dark:text-slate-200 hover:text-accent-600 dark:hover:text-accent-400 border border-slate-200 dark:border-slate-700 text-[11px] font-bold flex items-center gap-1 transition-colors"
                  title={isAr ? 'ترتيب حسب الوقت الزمني' : 'Sort by Due Time'}
                >
                  <Clock className="w-3 h-3 text-accent-500" />
                  <span>{isAr ? 'الوقت الزمني' : 'By Time'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSortTasksByPendingFirst}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-accent-50 dark:hover:bg-accent-950/40 text-slate-700 dark:text-slate-200 hover:text-accent-600 dark:hover:text-accent-400 border border-slate-200 dark:border-slate-700 text-[11px] font-bold flex items-center gap-1 transition-colors"
                  title={isAr ? 'غير المكتمل في البداية' : 'Pending First'}
                >
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  <span>{isAr ? 'غير المكتمل أولاً' : 'Pending First'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Task Items List with Drag-and-Drop & Smooth Animations */}
          <div className="space-y-2.5" id="daily-tasks-dnd-container">
            <AnimatePresence mode="popLayout" initial={false}>
              {dailyTasks
                .filter((task) => {
                  if (taskStatusFilter === 'pending' && task.completed) return false;
                  if (taskStatusFilter === 'completed' && !task.completed) return false;
                  if (taskSearchQuery.trim()) {
                    return task.title.toLowerCase().includes(taskSearchQuery.toLowerCase());
                  }
                  return true;
                })
                .map((task) => {
                  const fullIndex = dailyTasks.findIndex((t) => t.id === task.id);
                  const isFirst = fullIndex === 0;
                  const isLast = fullIndex === dailyTasks.length - 1;
                  const linkedNote = task.noteId ? notes.find((n) => n.id === task.noteId) : null;
                  const isDragging = draggedTaskId === task.id;
                  const isTarget = dragOverTaskId === task.id && !isDragging;

                  const priorityStyles =
                    task.priority === 'high'
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-900'
                      : task.priority === 'medium'
                      ? 'bg-accent-100 text-accent-700 dark:bg-accent-950/60 dark:text-accent-300 border-accent-200 dark:border-accent-900'
                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900';

                  return (
                    <motion.div
                      key={task.id}
                      layout
                      initial={{ opacity: 0, y: -10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{
                        opacity: 0,
                        x: isAr ? 75 : -75,
                        scale: 0.9,
                        height: 0,
                        marginBottom: 0,
                        filter: 'blur(4px)',
                        transition: { duration: 0.28, ease: [0.32, 0.72, 0, 1] },
                      }}
                      transition={{
                        layout: { duration: 0.25, ease: 'easeOut' },
                        opacity: { duration: 0.2 },
                      }}
                      className="relative group/task"
                      data-task-id={task.id}
                    >
                      {/* Top Drop Indicator Line */}
                      {isTarget && dropPosition === 'before' && (
                        <div className="h-1 bg-accent-500 rounded-full shadow-lg shadow-accent-500/60 mb-2 animate-pulse" />
                      )}

                      <div
                        draggable={true}
                        onDragStart={(e) => handleTaskDragStart(e, task.id)}
                        onDragOver={(e) => handleTaskDragOver(e, task.id)}
                        onDragLeave={handleTaskDragLeave}
                        onDrop={(e) => handleTaskDrop(e, task.id)}
                        onDragEnd={handleTaskDragEnd}
                        className={`flex items-center justify-between p-3 sm:p-3.5 rounded-2xl border transition-all duration-200 ${
                          isDragging
                            ? 'opacity-40 scale-[0.98] border-dashed border-accent-500 bg-accent-500/10 shadow-inner'
                            : task.completed
                            ? 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800/60 opacity-75'
                            : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 hover:border-accent-400 hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          {/* 1. Drag Handle + Priority Sequence Index */}
                          <div className="flex items-center gap-1 shrink-0">
                            <div
                              className="cursor-grab active:cursor-grabbing p-1.5 text-slate-400 hover:text-accent-600 dark:hover:text-accent-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                              title={isAr ? 'اسحب لإعادة الترتيب' : 'Drag to reorder'}
                            >
                              <GripVertical className="w-4 h-4" />
                            </div>

                            <span
                              className={`text-[11px] font-mono font-bold w-6 h-6 flex items-center justify-center rounded-lg border ${
                                fullIndex === 0
                                  ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                              }`}
                              title={isAr ? `الأولوية رقم #${fullIndex + 1}` : `Priority #${fullIndex + 1}`}
                            >
                              {fullIndex + 1}
                            </span>
                          </div>

                          {/* 2. Completion Checkbox with spring pop effect */}
                          <button
                            type="button"
                            onClick={() => handleToggleTaskWithFeedback(task.id)}
                            className="flex-shrink-0 transition-transform active:scale-80 hover:scale-110 duration-150"
                            title={task.completed ? (isAr ? 'إلغاء الإكمال' : 'Mark Incomplete') : (isAr ? 'إكمال المهمة' : 'Mark Complete')}
                          >
                            {task.completed ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-500/20" />
                            ) : (
                              <Circle className="w-5 h-5 text-slate-300 hover:text-accent-500 transition-colors" />
                            )}
                          </button>

                          {/* 3. Task Details */}
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm font-semibold truncate transition-all duration-300 ${
                                task.completed
                                  ? 'line-through text-slate-400 dark:text-slate-500'
                                  : 'text-slate-900 dark:text-white'
                              }`}
                            >
                              {task.title}
                            </p>

                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              {/* Priority badge */}
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${priorityStyles}`}>
                                {task.priority === 'high'
                                  ? isAr
                                    ? 'عاجل'
                                    : 'High'
                                  : task.priority === 'medium'
                                  ? isAr
                                    ? 'مهم'
                                    : 'Medium'
                                  : isAr
                                  ? 'عادي'
                                  : 'Low'}
                              </span>

                              {/* Category badge */}
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-medium">
                                {task.category === 'work'
                                  ? isAr ? '💼 عمل' : 'Work'
                                  : task.category === 'personal'
                                  ? isAr ? '👤 شخصي' : 'Personal'
                                  : task.category === 'finance'
                                  ? isAr ? '💰 مالي' : 'Finance'
                                  : task.category === 'health'
                                  ? isAr ? '🏥 صحة' : 'Health'
                                  : task.category === 'education'
                                  ? isAr ? '🎓 تعليم' : 'Education'
                                  : isAr ? '📌 عام' : 'General'}
                              </span>

                              {/* Time */}
                              {task.dueTime && (
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-accent-500" />
                                  <span className="font-mono">{task.dueTime}</span>
                                </span>
                              )}

                              {/* Linked Note Button */}
                              {linkedNote && (
                                <button
                                  onClick={() => {
                                    setSelectedNote(linkedNote);
                                    setActiveTab('notes');
                                  }}
                                  className="text-[10px] bg-accent-50 dark:bg-accent-950/40 text-accent-700 dark:text-accent-300 hover:bg-accent-100 dark:hover:bg-accent-900/50 px-2 py-0.5 rounded-md flex items-center gap-1 border border-accent-200 dark:border-accent-800 transition-colors"
                                  title={isAr ? 'عرض الملاحظة المرتبطة' : 'View Linked Note'}
                                >
                                  <FileText className="w-2.5 h-2.5" />
                                  <span>{linkedNote.title.slice(0, 16)}</span>
                                  <ArrowUpRight className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 4. Action Controls: Quick Step Up/Down & Delete */}
                        <div className="flex items-center gap-1 shrink-0 ms-2">
                          {/* Quick Up / Down Reorder buttons */}
                          <div className="flex flex-col sm:flex-row items-center gap-0.5 bg-slate-50 dark:bg-slate-900/80 p-0.5 rounded-lg border border-slate-200/80 dark:border-slate-800">
                            <button
                              type="button"
                              disabled={isFirst}
                              onClick={() => handleMoveTaskDelta(task.id, 'up')}
                              className="p-1 text-slate-400 hover:text-accent-600 dark:hover:text-accent-400 disabled:opacity-20 disabled:hover:text-slate-400 rounded transition-colors"
                              title={isAr ? 'رفع الأولوية للأعلى' : 'Move Up'}
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={isLast}
                              onClick={() => handleMoveTaskDelta(task.id, 'down')}
                              className="p-1 text-slate-400 hover:text-accent-600 dark:hover:text-accent-400 disabled:opacity-20 disabled:hover:text-slate-400 rounded transition-colors"
                              title={isAr ? 'خفض الأولوية للأسفل' : 'Move Down'}
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Delete Button with animated hover effect */}
                          <button
                            type="button"
                            onClick={() => onDeleteDailyTask?.(task.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 active:scale-90 transition-all"
                            title={isAr ? 'حذف المهمة' : 'Delete Task'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Bottom Drop Indicator Line */}
                      {isTarget && dropPosition === 'after' && (
                        <div className="h-1 bg-accent-500 rounded-full shadow-lg shadow-accent-500/60 mt-2 animate-pulse" />
                      )}
                    </motion.div>
                  );
                })}
            </AnimatePresence>

            {dailyTasks.length === 0 && (
              <div className="text-center py-16 bg-white dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800">
                <BellRing className="w-10 h-10 text-accent-400 mx-auto mb-2 opacity-80" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  {isAr ? 'لا توجد مهمات حالياً' : 'No tasks available'}
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  {isAr ? 'أضف مهمتك اليومية الأولى من النموذج أعلاه' : 'Add your first task using the form above'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. CALCULATOR TAB CONTENT (Section 7 Specification) */}
      {/* ========================================================= */}
      {activeTab === 'calculator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Calculator Engine (7 cols) */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-850 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xl flex flex-col justify-between">
            {/* Mode Switcher */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  onClick={() => setCalcMode('basic')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    calcMode === 'basic' ? 'bg-accent-500 text-white' : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {language === 'ar' ? 'حاسبة عادية' : 'Basic'}
                </button>
                <button
                  onClick={() => setCalcMode('scientific')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    calcMode === 'scientific' ? 'bg-accent-500 text-white' : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {language === 'ar' ? 'علمية (Scientific)' : 'Scientific'}
                </button>
                <button
                  onClick={() => setCalcMode('engineering')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    calcMode === 'engineering' ? 'bg-accent-500 text-white' : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {language === 'ar' ? 'هندسية وتحويلات' : 'Engineering'}
                </button>
              </div>

              <button
                onClick={() => setShowHistoryModal(!showHistoryModal)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <History className="w-3.5 h-3.5 text-accent-500" />
                <span>{t.history} ({calcHistory.length})</span>
              </button>
            </div>

            {/* Display Screen */}
            <div className="my-5 p-5 bg-slate-900 rounded-2xl border border-slate-800 text-end font-mono-num shadow-inner">
              <div className="text-slate-400 text-sm min-h-[20px] font-medium overflow-x-auto">
                {calcEquation}
              </div>
              <div className="text-3xl sm:text-4xl font-extrabold text-accent-400 tracking-wider truncate mt-1">
                {calcDisplay}
              </div>
            </div>

            {/* Calculator Keypad */}
            {calcMode !== 'engineering' ? (
              <div className="space-y-2">
                {/* Scientific Function Row (if scientific) */}
                {calcMode === 'scientific' && (
                  <div className="grid grid-cols-5 gap-2 pb-2">
                    <button
                      onClick={() => handleCalcMathFunc('sin')}
                      className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-accent-100 dark:hover:bg-accent-950/60 font-bold text-xs text-slate-800 dark:text-slate-200"
                    >
                      sin
                    </button>
                    <button
                      onClick={() => handleCalcMathFunc('cos')}
                      className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-accent-100 dark:hover:bg-accent-950/60 font-bold text-xs text-slate-800 dark:text-slate-200"
                    >
                      cos
                    </button>
                    <button
                      onClick={() => handleCalcMathFunc('tan')}
                      className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-accent-100 dark:hover:bg-accent-950/60 font-bold text-xs text-slate-800 dark:text-slate-200"
                    >
                      tan
                    </button>
                    <button
                      onClick={() => handleCalcMathFunc('log')}
                      className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-accent-100 dark:hover:bg-accent-950/60 font-bold text-xs text-slate-800 dark:text-slate-200"
                    >
                      log
                    </button>
                    <button
                      onClick={() => handleCalcMathFunc('ln')}
                      className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-accent-100 dark:hover:bg-accent-950/60 font-bold text-xs text-slate-800 dark:text-slate-200"
                    >
                      ln
                    </button>

                    <button
                      onClick={() => handleCalcMathFunc('sqrt')}
                      className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-accent-100 dark:hover:bg-accent-950/60 font-bold text-xs text-slate-800 dark:text-slate-200"
                    >
                      √
                    </button>
                    <button
                      onClick={() => handleCalcMathFunc('sqr')}
                      className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-accent-100 dark:hover:bg-accent-950/60 font-bold text-xs text-slate-800 dark:text-slate-200"
                    >
                      x²
                    </button>
                    <button
                      onClick={() => handleCalcInput('^')}
                      className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-accent-100 dark:hover:bg-accent-950/60 font-bold text-xs text-slate-800 dark:text-slate-200"
                    >
                      xʸ
                    </button>
                    <button
                      onClick={() => handleCalcMathFunc('pi')}
                      className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-accent-100 dark:hover:bg-accent-950/60 font-bold text-xs text-slate-800 dark:text-slate-200"
                    >
                      π
                    </button>
                    <button
                      onClick={() => handleCalcMathFunc('e')}
                      className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-accent-100 dark:hover:bg-accent-950/60 font-bold text-xs text-slate-800 dark:text-slate-200"
                    >
                      e
                    </button>
                  </div>
                )}

                {/* Primary Number Pad */}
                <div className="grid grid-cols-4 gap-2.5 font-mono-num">
                  <button
                    onClick={handleCalcClear}
                    className="p-3.5 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-base shadow-sm"
                  >
                    AC
                  </button>
                  <button
                    onClick={handleCalcDelete}
                    className="p-3.5 rounded-2xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold text-base"
                  >
                    DEL
                  </button>
                  <button
                    onClick={() => handleCalcMathFunc('percent')}
                    className="p-3.5 rounded-2xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold text-base"
                  >
                    %
                  </button>
                  <button
                    onClick={() => handleCalcInput('÷')}
                    className="p-3.5 rounded-2xl bg-accent-500 hover:bg-accent-600 text-white font-bold text-xl shadow-sm shadow-accent-500/20"
                  >
                    ÷
                  </button>

                  <button
                    onClick={() => handleCalcInput('7')}
                    className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-lg"
                  >
                    7
                  </button>
                  <button
                    onClick={() => handleCalcInput('8')}
                    className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-lg"
                  >
                    8
                  </button>
                  <button
                    onClick={() => handleCalcInput('9')}
                    className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-lg"
                  >
                    9
                  </button>
                  <button
                    onClick={() => handleCalcInput('×')}
                    className="p-3.5 rounded-2xl bg-accent-500 hover:bg-accent-600 text-white font-bold text-xl shadow-sm shadow-accent-500/20"
                  >
                    ×
                  </button>

                  <button
                    onClick={() => handleCalcInput('4')}
                    className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-lg"
                  >
                    4
                  </button>
                  <button
                    onClick={() => handleCalcInput('5')}
                    className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-lg"
                  >
                    5
                  </button>
                  <button
                    onClick={() => handleCalcInput('6')}
                    className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-lg"
                  >
                    6
                  </button>
                  <button
                    onClick={() => handleCalcInput('-')}
                    className="p-3.5 rounded-2xl bg-accent-500 hover:bg-accent-600 text-white font-bold text-xl shadow-sm shadow-accent-500/20"
                  >
                    -
                  </button>

                  <button
                    onClick={() => handleCalcInput('1')}
                    className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-lg"
                  >
                    1
                  </button>
                  <button
                    onClick={() => handleCalcInput('2')}
                    className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-lg"
                  >
                    2
                  </button>
                  <button
                    onClick={() => handleCalcInput('3')}
                    className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-lg"
                  >
                    3
                  </button>
                  <button
                    onClick={() => handleCalcInput('+')}
                    className="p-3.5 rounded-2xl bg-accent-500 hover:bg-accent-600 text-white font-bold text-xl shadow-sm shadow-accent-500/20"
                  >
                    +
                  </button>

                  <button
                    onClick={() => handleCalcInput('0')}
                    className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-lg"
                  >
                    0
                  </button>
                  <button
                    onClick={() => handleCalcInput('.')}
                    className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-lg"
                  >
                    .
                  </button>
                  <button
                    onClick={() => handleCalcInput('(')}
                    className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-lg"
                  >
                    (
                  </button>
                  <button
                    onClick={handleCalcEquals}
                    className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-2xl shadow-md shadow-emerald-500/20"
                  >
                    =
                  </button>
                </div>
              </div>
            ) : (
              /* Engineering Converter Panel */
              <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <button
                    onClick={() => {
                      setEngCategory('length');
                      setEngFromUnit('m');
                      setEngToUnit('km');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                      engCategory === 'length' ? 'bg-accent-500 text-white' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {language === 'ar' ? 'الطول والمسافات' : 'Length'}
                  </button>
                  <button
                    onClick={() => {
                      setEngCategory('weight');
                      setEngFromUnit('kg');
                      setEngToUnit('lb');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                      engCategory === 'weight' ? 'bg-accent-500 text-white' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {language === 'ar' ? 'الوزن والكتلة' : 'Weight'}
                  </button>
                  <button
                    onClick={() => {
                      setEngCategory('temp');
                      setEngFromUnit('C');
                      setEngToUnit('F');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                      engCategory === 'temp' ? 'bg-accent-500 text-white' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {language === 'ar' ? 'الحرارة' : 'Temperature'}
                  </button>
                  <button
                    onClick={() => {
                      setEngCategory('data');
                      setEngFromUnit('GB');
                      setEngToUnit('MB');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                      engCategory === 'data' ? 'bg-accent-500 text-white' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {language === 'ar' ? 'البيانات الرقمية' : 'Digital Data'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      {language === 'ar' ? 'من:' : 'From:'}
                    </label>
                    <input
                      type="number"
                      value={engInputVal}
                      onChange={(e) => setEngInputVal(parseFloat(e.target.value) || 0)}
                      className="w-full p-3 rounded-xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 font-mono-num text-lg font-bold"
                    />
                    <select
                      value={engFromUnit}
                      onChange={(e) => setEngFromUnit(e.target.value)}
                      className="w-full mt-2 p-2 rounded-xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                    >
                      {engCategory === 'length' && (
                        <>
                          <option value="m">متر (Meters)</option>
                          <option value="km">كيلومتر (Kilometers)</option>
                          <option value="cm">سنتيمتر (Centimeters)</option>
                          <option value="mile">ميل (Miles)</option>
                          <option value="foot">قدم (Feet)</option>
                        </>
                      )}
                      {engCategory === 'weight' && (
                        <>
                          <option value="kg">كيلوجرام (kg)</option>
                          <option value="g">جرام (g)</option>
                          <option value="lb">رطل (Pound - lb)</option>
                          <option value="oz">أونصة (Ounce - oz)</option>
                        </>
                      )}
                      {engCategory === 'temp' && (
                        <>
                          <option value="C">درجة مئوية (°C)</option>
                          <option value="F">فهرنهايت (°F)</option>
                          <option value="K">كلفن (K)</option>
                        </>
                      )}
                      {engCategory === 'data' && (
                        <>
                          <option value="GB">جيجابايت (GB)</option>
                          <option value="MB">ميجابايت (MB)</option>
                          <option value="KB">كيلوبايت (KB)</option>
                          <option value="TB">تيرابايت (TB)</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      {language === 'ar' ? 'النتيجة (إلى):' : 'Result (To):'}
                    </label>
                    <div className="p-3 rounded-xl bg-accent-500/10 border border-accent-500/30 text-accent-600 dark:text-accent-400 font-mono-num text-lg font-black truncate">
                      {calculateConversion()}
                    </div>
                    <select
                      value={engToUnit}
                      onChange={(e) => setEngToUnit(e.target.value)}
                      className="w-full mt-2 p-2 rounded-xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                    >
                      {engCategory === 'length' && (
                        <>
                          <option value="km">كيلومتر (Kilometers)</option>
                          <option value="m">متر (Meters)</option>
                          <option value="cm">سنتيمتر (Centimeters)</option>
                          <option value="mile">ميل (Miles)</option>
                          <option value="foot">قدم (Feet)</option>
                        </>
                      )}
                      {engCategory === 'weight' && (
                        <>
                          <option value="lb">رطل (Pound - lb)</option>
                          <option value="kg">كيلوجرام (kg)</option>
                          <option value="g">جرام (g)</option>
                          <option value="oz">أونصة (Ounce - oz)</option>
                        </>
                      )}
                      {engCategory === 'temp' && (
                        <>
                          <option value="F">فهرنهايت (°F)</option>
                          <option value="C">درجة مئوية (°C)</option>
                          <option value="K">كلفن (K)</option>
                        </>
                      )}
                      {engCategory === 'data' && (
                        <>
                          <option value="MB">ميجابايت (MB)</option>
                          <option value="GB">جيجابايت (GB)</option>
                          <option value="KB">كيلوبايت (KB)</option>
                          <option value="TB">تيرابايت (TB)</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* History Ledger (5 cols) - Saves last 100 calculations */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-850 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-accent-500" />
                  <span>{language === 'ar' ? 'سجل العمليات الحسابية (آخر 100)' : 'Calculation History (100 Max)'}</span>
                </h3>
                {calcHistory.length > 0 && (
                  <button
                    onClick={() => {
                      NotesRepository.clearCalculatorHistory();
                      setCalcHistory([]);
                    }}
                    className="text-xs text-rose-500 hover:underline font-semibold"
                  >
                    {t.clear}
                  </button>
                )}
              </div>

              <div className="space-y-2.5 mt-4 max-h-[460px] overflow-y-auto pe-1">
                {calcHistory.length === 0 ? (
                  <div className="text-center py-16 text-slate-400">
                    <Calculator className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-xs">
                      {language === 'ar' ? 'لا توجد عمليات سابقة بعد' : 'No calculations recorded yet'}
                    </p>
                  </div>
                ) : (
                  calcHistory.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        setCalcDisplay(item.result);
                        setCalcEquation(item.expression + ' =');
                      }}
                      className="group p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 hover:border-accent-400 transition-all cursor-pointer text-end font-mono-num"
                    >
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                        <span className="capitalize px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800">
                          {item.mode}
                        </span>
                        <span>{item.timestamp}</span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {item.expression} =
                      </div>
                      <div className="text-base font-extrabold text-accent-600 dark:text-accent-400 group-hover:scale-102 transition-transform">
                        {item.result}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-400 text-center">
              {language === 'ar'
                ? '💡 اضغط على أي عملية سابقة لإعادة استخدام الناتج فورًا'
                : '💡 Tap any calculation to load result into calculator'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
