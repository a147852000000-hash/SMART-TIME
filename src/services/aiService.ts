import { apiUrl } from './apiConfig';
import { authHeaders } from './authService';
import {
  AiMessage,
  CalendarEvent,
  DailyTask,
  EducationExpense,
  Expense,
  FuelRecord,
  LessonItem,
  MonthlyIncome,
  Note,
  RecentTrip,
  Student,
  Vehicle,
} from '../types';

export type SmartAiAction =
  | {
      type: 'add_expense';
      payload: {
        title: string;
        amount: number;
        category: Expense['category'];
        date?: string;
        paymentMethod?: Expense['paymentMethod'];
        notes?: string;
      };
    }
  | {
      type: 'add_education_expense';
      payload: {
        studentId?: string;
        studentName?: string;
        title: string;
        amount: number;
        category: EducationExpense['category'];
        date?: string;
        notes?: string;
      };
    }
  | {
      type: 'add_fuel_record';
      payload: {
        vehicleId?: string;
        vehicleName?: string;
        liters: number;
        pricePerLiter: number;
        totalCost?: number;
        mileage: number;
        date?: string;
        stationName?: string;
        notes?: string;
      };
    }
  | {
      type: 'add_daily_task';
      payload: {
        title: string;
        priority?: DailyTask['priority'];
        category?: DailyTask['category'];
        dueDate?: string;
        dueTime?: string;
        noteId?: string;
        reminderEnabled?: boolean;
      };
    }
  | null;

export interface SmartAiResponse {
  reply: string;
  action: SmartAiAction;
  actionSummary?: string;
  requiresConfirmation?: boolean;
  needsClarification?: boolean;
  model?: string;
  provider?: string;
}

export interface SmartAiContext {
  profile: { name: string; currency: string; language: string };
  expenses: Array<Pick<Expense, 'id' | 'title' | 'amount' | 'category' | 'date' | 'paymentMethod' | 'notes'>>;
  monthlyIncome: Array<Pick<MonthlyIncome, 'id' | 'month' | 'salary' | 'bonuses' | 'otherIncome' | 'otherIncomeNote'>>;
  vehicles: Array<Pick<Vehicle, 'id' | 'name' | 'model' | 'year' | 'fuelType' | 'currentMileage'>>;
  fuelRecords: Array<Pick<FuelRecord, 'id' | 'vehicleId' | 'liters' | 'pricePerLiter' | 'totalCost' | 'mileage' | 'date' | 'stationName' | 'notes'>>;
  students: Array<Pick<Student, 'id' | 'name' | 'grade' | 'schoolName'>>;
  lessons: Array<Pick<LessonItem, 'id' | 'studentId' | 'subject' | 'title' | 'dayOfWeek' | 'time' | 'monthlyFee' | 'isPaid'>>;
  educationExpenses: Array<Pick<EducationExpense, 'id' | 'studentId' | 'title' | 'amount' | 'category' | 'date' | 'notes'>>;
  notes: Array<Pick<Note, 'id' | 'title' | 'content' | 'date'>>;
  dailyTasks: Array<Pick<DailyTask, 'id' | 'title' | 'completed' | 'priority' | 'category' | 'dueDate' | 'dueTime'>>;
  recentTrips: Array<Pick<RecentTrip, 'id' | 'date' | 'provider' | 'rideType' | 'fare' | 'distanceKm'>>;
}

export interface AskSmartAiRequest {
  message: string;
  language: 'ar' | 'en';
  model?: string;
  conversationHistory?: Array<{ sender: 'user' | 'model'; text: string }>;
  appContext: SmartAiContext;
  confirmed?: boolean;
}

export function buildSmartAiContext(input: {
  profile: { name: string; currency: string; language: string };
  expenses: Expense[];
  monthlyIncome: MonthlyIncome[];
  vehicles: Vehicle[];
  fuelRecords: FuelRecord[];
  students: Student[];
  lessons: LessonItem[];
  educationExpenses: EducationExpense[];
  notes: Note[];
  dailyTasks: DailyTask[];
  recentTrips: RecentTrip[];
}): SmartAiContext {
  const limit = <T,>(items: T[], max: number) => items.slice(0, max);
  return {
    profile: {
      name: input.profile.name,
      currency: input.profile.currency,
      language: input.profile.language,
    },
    expenses: limit(input.expenses, 250).map((e) => ({
      id: e.id,
      title: e.title,
      amount: e.amount,
      category: e.category,
      date: e.date,
      paymentMethod: e.paymentMethod,
      notes: e.notes,
    })),
    monthlyIncome: limit(input.monthlyIncome, 60).map((m) => ({
      id: m.id,
      month: m.month,
      salary: m.salary,
      bonuses: m.bonuses,
      otherIncome: m.otherIncome,
      otherIncomeNote: m.otherIncomeNote,
    })),
    vehicles: limit(input.vehicles, 30).map((v) => ({
      id: v.id,
      name: v.name,
      model: v.model,
      year: v.year,
      fuelType: v.fuelType,
      currentMileage: v.currentMileage,
    })),
    fuelRecords: limit(input.fuelRecords, 200),
    students: limit(input.students, 50).map((s) => ({
      id: s.id,
      name: s.name,
      grade: s.grade,
      schoolName: s.schoolName,
    })),
    lessons: limit(input.lessons, 150),
    educationExpenses: limit(input.educationExpenses, 200),
    notes: limit(input.notes, 80).map((n) => ({
      id: n.id,
      title: n.title,
      content: n.content.slice(0, 600),
      date: n.date,
    })),
    dailyTasks: limit(input.dailyTasks, 80).map((t) => ({
      id: t.id,
      title: t.title,
      completed: t.completed,
      priority: t.priority,
      category: t.category,
      dueDate: t.dueDate,
      dueTime: t.dueTime,
    })),
    recentTrips: limit(input.recentTrips, 150).map((t) => ({
      id: t.id,
      date: t.date,
      provider: t.provider,
      rideType: t.rideType,
      fare: t.fare,
      distanceKm: t.distanceKm,
    })),
  };
}

export interface SmartAiState {
  source: 'smart-ai-sqlite';
  transactions: Expense[];
  budget: { userId: string; monthlyLimit: number; currency: string; updatedAt: string } | null;
  tasks: DailyTask[];
  calendarEvents: CalendarEvent[];
  fetchedAt: string;
}

function normalizeCanonicalTask(task: any): DailyTask {
  return { ...task, completed: Boolean(task?.completed), reminderEnabled: task?.reminderEnabled ?? true };
}

async function smartAiMutation(path: string, method: string, body?: unknown) {
  const res = await fetch(apiUrl(path), {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'تعذر تحديث بيانات SMART AI');
  return data;
}

export async function createCanonicalTask(task: Omit<DailyTask, 'id' | 'createdAt'>): Promise<DailyTask> {
  return normalizeCanonicalTask(await smartAiMutation('/api/ai/tasks', 'POST', task));
}

export async function updateCanonicalTask(task: DailyTask): Promise<DailyTask> {
  return normalizeCanonicalTask(await smartAiMutation(`/api/ai/tasks/${encodeURIComponent(task.id)}`, 'PATCH', task));
}

export async function deleteCanonicalTask(id: string): Promise<void> {
  await smartAiMutation(`/api/ai/tasks/${encodeURIComponent(id)}`, 'DELETE');
}

export async function importCanonicalTasks(tasks: DailyTask[]): Promise<{ imported: number }> {
  return smartAiMutation('/api/ai/tasks/import', 'POST', { tasks }) as Promise<{ imported: number }>;
}

export interface PendingEventReminder {
  id: string;
  eventId: string;
  userId: string;
  title: string;
  startAt: string;
  timezone: string;
  reminderMinutes: number;
  scheduledFor: string;
  queuedAt: string;
}

export async function fetchPendingEventReminders(limit = 50): Promise<PendingEventReminder[]> {
  const data = await smartAiMutation(`/api/ai/reminders?limit=${Math.max(1, Math.min(100, Math.floor(limit)))}`, 'GET');
  return Array.isArray(data?.reminders) ? data.reminders : [];
}

export async function acknowledgeEventReminder(id: string): Promise<void> {
  await smartAiMutation(`/api/ai/reminders/${encodeURIComponent(id)}/ack`, 'POST', {});
}

export async function fetchCanonicalEvents(options: { from?: string; to?: string } = {}): Promise<CalendarEvent[]> {
  const params = new URLSearchParams();
  if (options.from) params.set('from', options.from);
  if (options.to) params.set('to', options.to);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const data = await smartAiMutation(`/api/ai/events${suffix}`, 'GET');
  return Array.isArray(data?.events) ? data.events : [];
}

export async function createCanonicalEvent(event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>): Promise<CalendarEvent> {
  return smartAiMutation('/api/ai/events', 'POST', event) as Promise<CalendarEvent>;
}

export async function updateCanonicalEvent(event: CalendarEvent): Promise<CalendarEvent> {
  return smartAiMutation(`/api/ai/events/${encodeURIComponent(event.id)}`, 'PATCH', event) as Promise<CalendarEvent>;
}

export async function deleteCanonicalEvent(id: string): Promise<void> {
  await smartAiMutation(`/api/ai/events/${encodeURIComponent(id)}`, 'DELETE');
}

export async function fetchSmartAiState(): Promise<SmartAiState> {
  const res = await fetch(apiUrl('/api/ai/state'), {
    method: 'GET',
    headers: { ...authHeaders() },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'تعذر قراءة بيانات SMART AI');
  return data as SmartAiState;
}

export async function askSmartAi(request: AskSmartAiRequest): Promise<SmartAiResponse> {
  const res = await fetch(apiUrl('/api/ai/chat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(request),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || 'تعذر الاتصال بمساعد SMART AI');
  }
  return data as SmartAiResponse;
}
