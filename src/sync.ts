import { createClient } from '@supabase/supabase-js'
import { getLocalConfig, getProfile, listRecords, saveProfile, saveRecord } from './db'
import type { AppRecord, HealthLog, MealLog, ProfileSettings } from './types'

const toMealRow = (record: MealLog, accessCode: string) => ({
  id: record.id,
  date: record.date,
  meal_type: record.mealType,
  raw_text: record.rawText,
  food_items: record.foodItems,
  portion_text: record.portionText,
  calories_kcal: record.caloriesKcal,
  protein_g: record.proteinG,
  carbs_g: record.carbsG,
  fat_g: record.fatG,
  sodium_mg: record.sodiumMg,
  score: record.score,
  score_reason: record.scoreReason,
  risk_tags: record.riskTags,
  positive_tags: record.positiveTags,
  note: record.note,
  source: record.source,
  is_confirmed: record.isConfirmed,
  access_code: accessCode,
  created_at: record.createdAt,
  updated_at: record.updatedAt,
  sync_status: 'synced',
})

const toHealthRow = (record: HealthLog, accessCode: string) => ({
  id: record.id,
  date: record.date,
  raw_text: record.rawText,
  weight_kg: record.weightKg,
  sleep_total_minutes: record.sleepTotalMinutes,
  sleep_deep_minutes: record.sleepDeepMinutes,
  sleep_rem_minutes: record.sleepRemMinutes,
  sleep_core_minutes: record.sleepCoreMinutes,
  sleep_awake_minutes: record.sleepAwakeMinutes,
  recovery_rating: record.recoveryRating,
  exercise: record.exercise,
  exercise_minutes: record.exerciseMinutes,
  avg_heart_rate: record.avgHeartRate,
  active_calories_kcal: record.activeCaloriesKcal,
  symptoms: record.symptoms,
  mood: record.mood,
  note: record.note,
  source: record.source,
  access_code: accessCode,
  created_at: record.createdAt,
  updated_at: record.updatedAt,
  sync_status: 'synced',
})

function client() {
  const config = getLocalConfig()
  if (!config.supabaseUrl || !config.supabaseAnonKey || !config.accessCode) return null
  return {
    supabase: createClient(config.supabaseUrl, config.supabaseAnonKey, {
      global: { headers: { 'x-health-access-code': config.accessCode } },
    }),
    config,
  }
}

export async function syncRecord(record: AppRecord) {
  const connection = client()
  if (!connection || !navigator.onLine) return false
  const { supabase, config } = connection
  const { error } = record.kind === 'meal'
    ? await supabase.from('meal_logs').upsert(toMealRow(record, config.accessCode))
    : await supabase.from('health_logs').upsert(toHealthRow(record, config.accessCode))
  const next: AppRecord = { ...record, syncStatus: error ? 'error' : 'synced' }
  await saveRecord(next)
  if (error) throw error
  return true
}

export async function syncAll(onProgress?: (message: string) => void) {
  const connection = client()
  if (!connection) throw new Error('请先完整填写 Supabase 配置')
  if (!navigator.onLine) throw new Error('当前离线，记录仍安全保存在本机')
  const records = await listRecords()
  const pending = records.filter((record) => record.syncStatus !== 'synced')
  for (let index = 0; index < pending.length; index += 1) {
    onProgress?.(`正在同步 ${index + 1}/${pending.length}`)
    await syncRecord(pending[index])
  }
  onProgress?.('正在合并云端记录')
  const [{ data: mealRows, error: mealError }, { data: healthRows, error: healthError }] = await Promise.all([
    connection.supabase.from('meal_logs').select('*').eq('access_code', connection.config.accessCode),
    connection.supabase.from('health_logs').select('*').eq('access_code', connection.config.accessCode),
  ])
  if (mealError) throw mealError
  if (healthError) throw healthError
  const current = new Map((await listRecords()).map((record) => [record.id, record]))
  const remoteRecords = [
    ...(mealRows ?? []).map(fromMealRow),
    ...(healthRows ?? []).map(fromHealthRow),
  ]
  for (const remote of remoteRecords) {
    const local = current.get(remote.id)
    // A successful sync has already uploaded pending local edits. Prefer the
    // normalized cloud row afterwards so new client-side field handling also
    // applies to records cached by an earlier app version.
    if (!local || local.syncStatus === 'synced' || new Date(remote.updatedAt) > new Date(local.updatedAt)) await saveRecord(remote)
  }
  await syncProfile(connection.supabase, connection.config.accessCode)
  return pending.length
}

export async function deleteRemoteRecord(record: AppRecord) {
  const connection = client()
  if (!connection || record.syncStatus !== 'synced') return
  const table = record.kind === 'meal' ? 'meal_logs' : 'health_logs'
  const { error } = await connection.supabase.from(table).delete().eq('id', record.id).eq('access_code', connection.config.accessCode)
  if (error) throw error
}

export async function testConnection() {
  const connection = client()
  if (!connection) throw new Error('请先完整填写 Supabase 配置')
  const { error } = await connection.supabase
    .from('meal_logs')
    .select('id', { count: 'exact', head: true })
    .eq('access_code', connection.config.accessCode)
  if (error) throw error
  return true
}

function fromMealRow(row: Record<string, unknown>): MealLog {
  return {
    id: String(row.id), kind: 'meal', date: String(row.date),
    mealType: String(row.meal_type) as MealLog['mealType'], rawText: String(row.raw_text ?? ''),
    foodItems: String(row.food_items ?? ''), portionText: String(row.portion_text ?? ''),
    caloriesKcal: optionalNumber(row.calories_kcal), proteinG: optionalNumber(row.protein_g),
    carbsG: optionalNumber(row.carbs_g), fatG: optionalNumber(row.fat_g), sodiumMg: optionalNumber(row.sodium_mg),
    score: optionalNumber(row.score), scoreReason: String(row.score_reason ?? ''),
    riskTags: Array.isArray(row.risk_tags) ? row.risk_tags.map(String) : [],
    positiveTags: Array.isArray(row.positive_tags) ? row.positive_tags.map(String) : [],
    note: String(row.note ?? ''), source: (row.source as MealLog['source']) ?? 'manual',
    isConfirmed: Boolean(row.is_confirmed ?? true), createdAt: String(row.created_at),
    updatedAt: String(row.updated_at), syncStatus: 'synced',
  }
}

function fromHealthRow(row: Record<string, unknown>): HealthLog {
  const rawText = String(row.raw_text ?? '')
  const note = String(row.note ?? '')
  const sleepTotalMinutes = optionalNumber(row.sleep_total_minutes) ?? extractSleepMinutes(`${rawText} ${note}`)
  const recordType: HealthLog['recordType'] = row.weight_kg != null ? 'weight' : sleepTotalMinutes !== undefined ? 'sleep' : row.exercise != null || row.exercise_minutes != null ? 'exercise' : 'body'
  return {
    id: String(row.id), kind: 'health', recordType, date: String(row.date), rawText,
    weightKg: optionalNumber(row.weight_kg), sleepTotalMinutes,
    sleepDeepMinutes: optionalNumber(row.sleep_deep_minutes), sleepRemMinutes: optionalNumber(row.sleep_rem_minutes),
    sleepCoreMinutes: optionalNumber(row.sleep_core_minutes), sleepAwakeMinutes: optionalNumber(row.sleep_awake_minutes),
    recoveryRating: String(row.recovery_rating ?? ''), exercise: String(row.exercise ?? ''),
    exerciseMinutes: optionalNumber(row.exercise_minutes), avgHeartRate: optionalNumber(row.avg_heart_rate),
    activeCaloriesKcal: optionalNumber(row.active_calories_kcal), symptoms: String(row.symptoms ?? ''),
    mood: String(row.mood ?? ''), note,
    source: (row.source as HealthLog['source']) ?? 'manual', createdAt: String(row.created_at),
    updatedAt: String(row.updated_at), syncStatus: 'synced',
  }
}

function optionalNumber(value: unknown) {
  return value === null || value === undefined || value === '' ? undefined : Number(value)
}

function extractSleepMinutes(text: string) {
  const match = text.match(/(?:总)?睡眠\s*(\d+)\s*(?:小时|h)\s*(\d+)?\s*(?:分钟|分|m)?/i)
  if (!match) return undefined
  const hours = Number(match[1])
  const minutes = Number(match[2] ?? 0)
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : undefined
}

// The app intentionally uses Supabase without generated database types so the trial can be
// pointed at any project created from supabase/schema.sql.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncProfile(supabase: any, accessCode: string) {
  const local = await getProfile()
  const { data: remote, error: readError } = await supabase.from('profile_settings').select('*').eq('access_code', accessCode).maybeSingle()
  if (readError) throw readError
  if (remote && new Date(String(remote.updated_at)) > new Date(local.updatedAt)) {
    const merged: ProfileSettings = {
      id: 'profile', targetWeightKg: optionalNumber(remote.target_weight_kg),
      longTermTargetWeightKg: optionalNumber(remote.long_term_target_weight_kg),
      calorieTargetMin: optionalNumber(remote.calorie_target_min), calorieTargetMax: optionalNumber(remote.calorie_target_max),
      proteinTargetMin: optionalNumber(remote.protein_target_min), proteinTargetMax: optionalNumber(remote.protein_target_max),
      preferenceBrief: String(remote.preference_brief ?? ''), safetyBrief: String(remote.safety_brief ?? ''),
      updatedAt: String(remote.updated_at),
    }
    await saveProfile(merged)
    return
  }
  const { error: writeError } = await supabase.from('profile_settings').upsert({
    access_code: accessCode, target_weight_kg: local.targetWeightKg,
    long_term_target_weight_kg: local.longTermTargetWeightKg, calorie_target_min: local.calorieTargetMin,
    calorie_target_max: local.calorieTargetMax, protein_target_min: local.proteinTargetMin,
    protein_target_max: local.proteinTargetMax, preference_brief: local.preferenceBrief,
    safety_brief: local.safetyBrief, updated_at: local.updatedAt,
  }, { onConflict: 'access_code' })
  if (writeError) throw writeError
}
