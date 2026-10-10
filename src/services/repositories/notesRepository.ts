import { Note, NoteFolder, NoteTag, CalculatorHistoryItem, DailyTask } from '../../types';
import { STORAGE_KEYS } from '../storageKeys';
import { StorageAdapter } from '../storageAdapter';
import { DEFAULT_NOTES, DEFAULT_NOTE_FOLDERS, DEFAULT_NOTE_TAGS, DEFAULT_DAILY_TASKS } from '../seedData';

export class NotesRepository {
  // Notes
  static getNotes(): Note[] {
    return StorageAdapter.getItem<Note[]>(STORAGE_KEYS.NOTES, DEFAULT_NOTES);
  }

  static saveNotes(notes: Note[]): void {
    StorageAdapter.setItem(STORAGE_KEYS.NOTES, notes);
  }

  static addNote(note: Note): Note[] {
    const list = this.getNotes();
    const updated = [note, ...list];
    this.saveNotes(updated);
    return updated;
  }

  static updateNote(note: Note): Note[] {
    const list = this.getNotes();
    const updated = list.map((item) => (item.id === note.id ? note : item));
    this.saveNotes(updated);
    return updated;
  }

  static deleteNote(id: string): Note[] {
    const list = this.getNotes();
    const updated = list.filter((item) => item.id !== id);
    this.saveNotes(updated);
    return updated;
  }

  // Daily Tasks (ذكرني - المهمات اليومية فى قسم الملاحظات)
  static getDailyTasks(): DailyTask[] {
    return StorageAdapter.getItem<DailyTask[]>(STORAGE_KEYS.DAILY_TASKS, DEFAULT_DAILY_TASKS);
  }

  static saveDailyTasks(tasks: DailyTask[]): void {
    StorageAdapter.setItem(STORAGE_KEYS.DAILY_TASKS, tasks);
  }

  static addDailyTask(task: Omit<DailyTask, 'id' | 'createdAt'>): DailyTask[] {
    const list = this.getDailyTasks();
    const newTask: DailyTask = {
      ...task,
      id: 'dt_' + Date.now(),
      createdAt: new Date().toISOString(),
    };
    const updated = [newTask, ...list];
    this.saveDailyTasks(updated);
    return updated;
  }

  static toggleDailyTask(id: string): DailyTask[] {
    const list = this.getDailyTasks();
    const updated = list.map((item) => {
      if (item.id === id) {
        const nextCompleted = !item.completed;
        return {
          ...item,
          completed: nextCompleted,
          completedAt: nextCompleted ? new Date().toISOString() : undefined,
        };
      }
      return item;
    });
    this.saveDailyTasks(updated);
    return updated;
  }

  static updateDailyTask(task: DailyTask): DailyTask[] {
    const list = this.getDailyTasks();
    const updated = list.map((item) => (item.id === task.id ? task : item));
    this.saveDailyTasks(updated);
    return updated;
  }

  static deleteDailyTask(id: string): DailyTask[] {
    const list = this.getDailyTasks();
    const updated = list.filter((item) => item.id !== id);
    this.saveDailyTasks(updated);
    return updated;
  }

  // Folders & Tags
  static getFolders(): NoteFolder[] {
    return StorageAdapter.getItem<NoteFolder[]>(STORAGE_KEYS.NOTE_FOLDERS, DEFAULT_NOTE_FOLDERS);
  }

  static saveFolders(folders: NoteFolder[]): void {
    StorageAdapter.setItem(STORAGE_KEYS.NOTE_FOLDERS, folders);
  }

  static getTags(): NoteTag[] {
    return StorageAdapter.getItem<NoteTag[]>(STORAGE_KEYS.NOTE_TAGS, DEFAULT_NOTE_TAGS);
  }

  static saveTags(tags: NoteTag[]): void {
    StorageAdapter.setItem(STORAGE_KEYS.NOTE_TAGS, tags);
  }

  // Calculator History
  static getCalculatorHistory(): CalculatorHistoryItem[] {
    return StorageAdapter.getItem<CalculatorHistoryItem[]>(STORAGE_KEYS.CALCULATOR_HISTORY, []);
  }

  static saveCalculatorHistory(history: CalculatorHistoryItem[]): void {
    StorageAdapter.setItem(STORAGE_KEYS.CALCULATOR_HISTORY, history);
  }

  static addCalculatorHistory(item: Omit<CalculatorHistoryItem, 'id' | 'timestamp'>): CalculatorHistoryItem[] {
    const list = this.getCalculatorHistory();
    const newItem: CalculatorHistoryItem = {
      ...item,
      id: 'calc_' + Date.now(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    const updated = [newItem, ...list].slice(0, 100);
    this.saveCalculatorHistory(updated);
    return updated;
  }

  static clearCalculatorHistory(): void {
    StorageAdapter.setItem(STORAGE_KEYS.CALCULATOR_HISTORY, []);
  }
}
