import { Student, LessonItem, EducationExpense } from '../../types';
import { STORAGE_KEYS } from '../storageKeys';
import { StorageAdapter } from '../storageAdapter';
import { DEFAULT_STUDENTS, DEFAULT_LESSONS, DEFAULT_EDUCATION_EXPENSES } from '../seedData';

export class EducationRepository {
  // Students
  static getStudents(): Student[] {
    return StorageAdapter.getItem<Student[]>(STORAGE_KEYS.STUDENTS, DEFAULT_STUDENTS);
  }

  static saveStudents(students: Student[]): void {
    StorageAdapter.setItem(STORAGE_KEYS.STUDENTS, students);
  }

  static addStudent(student: Student): Student[] {
    const list = this.getStudents();
    const updated = [...list, student];
    this.saveStudents(updated);
    return updated;
  }

  // Lessons
  static getLessons(): LessonItem[] {
    return StorageAdapter.getItem<LessonItem[]>(STORAGE_KEYS.LESSONS, DEFAULT_LESSONS);
  }

  static saveLessons(lessons: LessonItem[]): void {
    StorageAdapter.setItem(STORAGE_KEYS.LESSONS, lessons);
  }

  static addLesson(lesson: LessonItem): LessonItem[] {
    const list = this.getLessons();
    const updated = [lesson, ...list];
    this.saveLessons(updated);
    return updated;
  }

  // Education Expenses
  static getEducationExpenses(): EducationExpense[] {
    return StorageAdapter.getItem<EducationExpense[]>(STORAGE_KEYS.EDUCATION_EXPENSES, DEFAULT_EDUCATION_EXPENSES);
  }

  static saveEducationExpenses(expenses: EducationExpense[]): void {
    StorageAdapter.setItem(STORAGE_KEYS.EDUCATION_EXPENSES, expenses);
  }

  static addEducationExpense(expense: EducationExpense): EducationExpense[] {
    const list = this.getEducationExpenses();
    const updated = [expense, ...list];
    this.saveEducationExpenses(updated);
    return updated;
  }
}
