import { openDB, type DBSchema } from 'idb'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './cloud'
import type { AppRecord, LocalConfig, ProfileSettings } from './types'

interface HealthDb extends DBSchema {
  records: {
    key: string
    value: AppRecord
    indexes: { date: string; syncStatus: string }
  }
  settings: {
    key: string
    value: ProfileSettings
  }
}

const database = openDB<HealthDb>('health-pwa-trial', 1, {
  upgrade(db) {
    const records = db.createObjectStore('records', { keyPath: 'id' })
    records.createIndex('date', 'date')
    records.createIndex('syncStatus', 'syncStatus')
    db.createObjectStore('settings', { keyPath: 'id' })
  },
})

export const defaultProfile: ProfileSettings = {
  id: 'profile',
  preferenceBrief: '温和、长期可持续减脂；允许偏离，拒绝连续偏离；不因单日体重波动惩罚性运动。',
  safetyBrief: '头晕、心慌、胸闷、明显疲劳或睡眠严重不足时，优先休息补水并降低运动强度，必要时就医评估。',
  updatedAt: new Date().toISOString(),
}

export async function listRecords() {
  return (await database).getAll('records')
}

export async function saveRecord(record: AppRecord) {
  await (await database).put('records', record)
}

export async function removeRecord(id: string) {
  await (await database).delete('records', id)
}

export async function getProfile() {
  return (await (await database).get('settings', 'profile')) ?? defaultProfile
}

export async function saveProfile(profile: ProfileSettings) {
  await (await database).put('settings', profile)
}

export async function clearLocalData() {
  const db = await database
  await Promise.all([db.clear('records'), db.clear('settings')])
}

const CONFIG_KEY = 'health-pwa-local-config'

export function getLocalConfig(): LocalConfig {
  const fallback: LocalConfig = { supabaseUrl: SUPABASE_URL, supabaseAnonKey: SUPABASE_PUBLISHABLE_KEY, accessCode: '', weightUnit: 'jin' }
  try {
    const saved = JSON.parse(localStorage.getItem(CONFIG_KEY) ?? '{}') as Partial<LocalConfig>
    return {
      ...fallback,
      ...saved,
      supabaseUrl: saved.supabaseUrl || fallback.supabaseUrl,
      supabaseAnonKey: saved.supabaseAnonKey || fallback.supabaseAnonKey,
    }
  } catch {
    return fallback
  }
}

export function saveLocalConfig(config: LocalConfig) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
}

export function clearLocalKeys() {
  const config = getLocalConfig()
  saveLocalConfig({ ...config, accessCode: '' })
}

export async function mergeRecords(incoming: AppRecord[]) {
  const db = await database
  const tx = db.transaction('records', 'readwrite')
  for (const record of incoming) {
    const current = await tx.store.get(record.id)
    if (!current || new Date(record.updatedAt) > new Date(current.updatedAt)) {
      await tx.store.put({ ...record, source: 'import', syncStatus: 'pending' })
    }
  }
  await tx.done
}
