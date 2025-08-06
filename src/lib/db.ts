import Dexie, { Table } from 'dexie'

export interface User {
  id?: number
  name: string
  avatar?: string
  color: string
  type: 'resident' | 'guest'
  createdAt: Date
}

export interface Chore {
  id?: number
  title: string
  description?: string
  assignedUserId?: number
  frequency: 'daily' | 'weekly' | 'monthly'
  lastCompleted?: Date
  nextDue: Date
  isCompleted: boolean
  createdAt: Date
}

export interface GroceryItem {
  id?: number
  name: string
  category?: string
  isCompleted: boolean
  addedBy?: number
  createdAt: Date
}

export interface Task {
  id?: number
  title: string
  description?: string
  assignedUserId?: number
  dueDate?: Date
  priority: 'low' | 'medium' | 'high'
  isCompleted: boolean
  createdAt: Date
}

export interface HomeImprovement {
  id?: number
  title: string
  description?: string
  status: 'todo' | 'in-progress' | 'done'
  assignedUserId?: number
  estimatedCost?: number
  priority: 'low' | 'medium' | 'high'
  createdAt: Date
}

export interface Meal {
  id?: number
  title: string
  description?: string
  date: Date
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  assignedUserId?: number
  ingredients?: string[]
  createdAt: Date
}

export interface Reminder {
  id?: number
  title: string
  description?: string
  reminderTime: Date
  isCompleted: boolean
  userId?: number
  type: 'general' | 'chore' | 'task' | 'meal'
  createdAt: Date
}

export interface CalendarEvent {
  id?: number
  title: string
  description?: string
  date: Date
  type: 'task' | 'meal' | 'reminder' | 'general'
  relatedId?: number
  userId?: number
  createdAt: Date
}

export class DomusDatabase extends Dexie {
  users!: Table<User>
  chores!: Table<Chore>
  groceryItems!: Table<GroceryItem>
  tasks!: Table<Task>
  homeImprovements!: Table<HomeImprovement>
  meals!: Table<Meal>
  reminders!: Table<Reminder>
  calendarEvents!: Table<CalendarEvent>

  constructor() {
    super('DomusDatabase')
    this.version(1).stores({
      users: '++id, name, color, type',
      chores: '++id, title, assignedUserId, frequency, nextDue, isCompleted',
      groceryItems: '++id, name, category, isCompleted, addedBy',
      tasks: '++id, title, assignedUserId, dueDate, priority, isCompleted',
      homeImprovements: '++id, title, status, assignedUserId, priority',
      meals: '++id, title, date, mealType, assignedUserId',
      reminders: '++id, title, reminderTime, isCompleted, userId, type',
      calendarEvents: '++id, title, date, type, userId'
    })
  }
}

export const db = new DomusDatabase()