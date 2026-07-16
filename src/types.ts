export type SyncStatus = 'pending' | 'synced' | 'error'

export interface BaseRecord {
  id: string
  date: string
  source: 'manual' | 'ai_confirmed' | 'import'
  createdAt: string
  updatedAt: string
  syncStatus: SyncStatus
}

export interface MealLog extends BaseRecord {
  kind: 'meal'
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'drink' | 'other'
  rawText: string
  foodItems?: string
  portionText?: string
  caloriesKcal?: number
  proteinG?: number
  carbsG?: number
  fatG?: number
  sodiumMg?: number
  score?: number
  scoreReason?: string
  riskTags?: string[]
  positiveTags?: string[]
  note?: string
  isConfirmed: boolean
}

export type HealthRecordType = 'weight' | 'sleep' | 'exercise' | 'body'

export interface HealthLog extends BaseRecord {
  kind: 'health'
  recordType: HealthRecordType
  rawText?: string
  weightKg?: number
  sleepTotalMinutes?: number
  sleepDeepMinutes?: number
  sleepRemMinutes?: number
  sleepCoreMinutes?: number
  sleepAwakeMinutes?: number
  recoveryRating?: string
  exercise?: string
  exerciseMinutes?: number
  avgHeartRate?: number
  activeCaloriesKcal?: number
  symptoms?: string
  mood?: string
  note?: string
}

export interface ProfileSettings {
  id: 'profile'
  targetWeightKg?: number
  longTermTargetWeightKg?: number
  calorieTargetMin?: number
  calorieTargetMax?: number
  proteinTargetMin?: number
  proteinTargetMax?: number
  preferenceBrief: string
  safetyBrief: string
  updatedAt: string
}

export interface LocalConfig {
  supabaseUrl: string
  supabaseAnonKey: string
  accessCode: string
  weightUnit: 'kg' | 'jin'
}

export type AppRecord = MealLog | HealthLog

export interface ExportPayload {
  version: 1
  exportedAt: string
  meal_logs: MealLog[]
  health_logs: HealthLog[]
  profile_settings: ProfileSettings
}
