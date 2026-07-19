import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  Activity, Bot, Check, ChevronRight, Cloud, CloudOff, Download, Dumbbell,
  Home, Moon, Plus, RefreshCw, Scale, Settings, Sparkles, Trash2, TrendingUp,
  Utensils, Upload, X,
} from 'lucide-react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import {
  clearLocalData, defaultProfile, getLocalConfig, getProfile,
  listRecords, mergeRecords, removeRecord, saveProfile, saveRecord,
} from './db'
import { deleteRemoteRecord, syncAll, syncRecord, testConnection } from './sync'
import type {
  AppRecord, ExportPayload, HealthLog, HealthRecordType, LocalConfig, MealLog,
  ProfileSettings,
} from './types'
import './App.css'

type Tab = 'today' | 'records' | 'trends' | 'ai' | 'settings'
type RecordKind = 'meal' | HealthRecordType
type TrendRange = 7 | 14 | 30 | 'previous7'

const today = () => new Date().toLocaleDateString('sv-SE')
const now = () => new Date().toISOString()
const numberOrUndefined = (value: FormDataEntryValue | null) => value === '' || value === null ? undefined : Number(value)
const formatDate = (value: string) => new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', weekday: 'short' }).format(new Date(`${value}T12:00:00`))
const mealNames: Record<MealLog['mealType'], string> = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐', drink: '饮品', other: '其他' }
const typeNames: Record<RecordKind, string> = { meal: '餐次', weight: '体重', sleep: '睡眠', exercise: '运动', body: '身体状态' }

function createId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function App() {
  const [tab, setTab] = useState<Tab>('today')
  const [records, setRecords] = useState<AppRecord[]>([])
  const [profile, setProfile] = useState<ProfileSettings>(defaultProfile)
  const [config] = useState<LocalConfig>(getLocalConfig())
  const [editor, setEditor] = useState<{ kind: RecordKind; record?: AppRecord } | null>(null)
  const [toast, setToast] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [range, setRange] = useState<TrendRange>(7)
  const importRef = useRef<HTMLInputElement>(null)

  const reload = async () => {
    const [nextRecords, nextProfile] = await Promise.all([listRecords(), getProfile()])
    setRecords(nextRecords.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
    setProfile(nextProfile)
  }

  useEffect(() => { void reload() }, [])
  useEffect(() => {
    if (config.supabaseUrl && config.supabaseAnonKey && config.accessCode) void handleSync(true)
  }, [config.supabaseUrl, config.supabaseAnonKey, config.accessCode])
  useEffect(() => {
    const handleOnline = () => { void handleSync(true) }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  })

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2600)
  }

  const handleSync = async (silent = false) => {
    setSyncing(true)
    try {
      const count = await syncAll((message) => !silent && setToast(message))
      await reload()
      if (!silent) notify(count ? `已同步 ${count} 条记录` : '所有记录均已同步')
    } catch (error) {
      if (!silent) notify(error instanceof Error ? error.message : '同步失败，数据仍保存在本机')
    } finally {
      setSyncing(false)
    }
  }

  const pendingCount = records.filter((record) => record.syncStatus !== 'synced').length
  const cloudConnected = Boolean(config.accessCode)

  const tabs = [
    { id: 'today' as const, label: '今日', icon: Home },
    { id: 'records' as const, label: '记录', icon: Plus },
    { id: 'trends' as const, label: '趋势', icon: TrendingUp },
    { id: 'ai' as const, label: 'AI', icon: Bot },
    { id: 'settings' as const, label: '设置', icon: Settings },
  ]

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <span className="eyebrow">HEALTH NOTES</span>
          <h1>健康随记</h1>
        </div>
        <button className={`sync-pill ${pendingCount || !cloudConnected ? 'pending' : ''}`} onClick={() => cloudConnected ? void handleSync() : setTab('settings')} disabled={syncing}>
          {cloudConnected && navigator.onLine ? <Cloud size={15} /> : <CloudOff size={15} />}
          {syncing ? '同步中' : !cloudConnected ? '未连接云端' : pendingCount ? `${pendingCount} 条待同步` : '已同步'}
        </button>
      </header>

      <main>
        {tab === 'today' && <TodayPage records={records} profile={profile} onAdd={(kind) => setEditor({ kind })} onCopy={() => void copyText(buildContext(records, profile), notify)} />}
        {tab === 'records' && <RecordsPage records={records} onAdd={(kind) => setEditor({ kind })} onEdit={(record) => setEditor({ kind: record.kind === 'meal' ? 'meal' : record.recordType, record })} onDelete={async (record) => { if (confirm('确定删除这条记录？已同步的数据也会从 Supabase 删除。')) { try { await deleteRemoteRecord(record); await removeRecord(record.id); await reload(); notify('记录已删除') } catch { notify('云端删除失败，已保留本地记录') } } }} />}
        {tab === 'trends' && <TrendsPage records={records} range={range} setRange={setRange} />}
        {tab === 'ai' && <AiPage records={records} profile={profile} config={config} notify={notify} />}
        {tab === 'settings' && <SettingsPage profile={profile} setProfile={setProfile} onSync={() => void handleSync()} syncing={syncing} importRef={importRef} onImport={async (file) => { await importData(file, notify); await reload() }} onClear={async () => { if (confirm('确定清空本机全部健康记录？此操作不可撤销。')) { await clearLocalData(); await reload(); notify('本地缓存已清空') } }} notify={notify} />}
      </main>

      <nav className="bottom-tabs" aria-label="主导航">
        {tabs.map(({ id, label, icon: Icon }) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><Icon size={21} /><span>{label}</span></button>)}
      </nav>
      {editor && <RecordEditor kind={editor.kind} record={editor.record} onClose={() => setEditor(null)} onSaved={async (record) => { await saveRecord(record); await reload(); setEditor(null); notify('已保存到本机'); try { await syncRecord(record); await reload() } catch { notify('已保存，联网后可继续同步') } }} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}

function TodayPage({ records, profile, onAdd, onCopy }: { records: AppRecord[]; profile: ProfileSettings; onAdd: (kind: RecordKind) => void; onCopy: () => void }) {
  const day = today()
  const todayRecords = records.filter((record) => record.date === day)
  const meals = todayRecords.filter((record): record is MealLog => record.kind === 'meal')
  const health = todayRecords.filter((record): record is HealthLog => record.kind === 'health')
  const latestWeight = records.filter((record): record is HealthLog => record.kind === 'health' && record.weightKg !== undefined).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
  const weightData = buildTrendData(records, 7)
  const previousWeightData = buildTrendData(records, 14).slice(0, 7)
  const recentWeights = weightData.map((item) => item.weight).filter((value): value is number => value !== undefined)
  const previousWeights = previousWeightData.map((item) => item.weight).filter((value): value is number => value !== undefined)
  const recentWeightAverage = recentWeights.length ? recentWeights.reduce((sum, value) => sum + value, 0) / recentWeights.length : undefined
  const previousWeightAverage = previousWeights.length ? previousWeights.reduce((sum, value) => sum + value, 0) / previousWeights.length : undefined
  const targetGap = latestWeight?.weightKg !== undefined && profile.targetWeightKg !== undefined ? latestWeight.weightKg * 2 - profile.targetWeightKg * 2 : undefined
  const weeklyChange = recentWeightAverage !== undefined && previousWeightAverage !== undefined ? recentWeightAverage - previousWeightAverage : undefined
  const targetText = targetGap === undefined ? '设置短期目标后显示距离' : targetGap > 0 ? `距离短期目标还差 ${targetGap.toFixed(1)} 斤` : targetGap < 0 ? `已低于短期目标 ${Math.abs(targetGap).toFixed(1)} 斤` : '已达到短期目标'
  const weeklyText = weeklyChange === undefined ? '累计更多体重记录后比较前 7 天' : weeklyChange > 0 ? `近 7 天均重比前 7 天上浮 ${weeklyChange.toFixed(1)} 斤` : weeklyChange < 0 ? `近 7 天均重比前 7 天下浮 ${Math.abs(weeklyChange).toFixed(1)} 斤` : '近 7 天均重与前 7 天持平'
  const calories = meals.reduce((sum, item) => sum + (item.caloriesKcal ?? 0), 0)
  const protein = meals.reduce((sum, item) => sum + (item.proteinG ?? 0), 0)
  const latestHealth = [...health].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const sleep = latestHealth.find((item) => item.sleepTotalMinutes !== undefined)
  const exercise = latestHealth.find((item) => item.exerciseMinutes !== undefined || Boolean(item.exercise))
  const body = latestHealth.find((item) => Boolean(item.symptoms || item.mood))
  const completed = [meals.length > 0, health.some((r) => r.weightKg !== undefined), sleep, exercise, body].filter(Boolean).length
  const mealScore = (mealType: MealLog['mealType']) => {
    const loggedMeals = meals.filter((item) => item.mealType === mealType)
    if (!loggedMeals.length) return undefined
    const explicitScores = loggedMeals.map((item) => item.score).filter((score): score is number => score !== undefined)
    if (explicitScores.length) return explicitScores.reduce((sum, score) => sum + score, 0) / explicitScores.length
    const mealProtein = loggedMeals.reduce((sum, item) => sum + (item.proteinG ?? 0), 0)
    return Math.min(10, 7 + Math.min(3, mealProtein / 25))
  }
  const breakfastScore = mealScore('breakfast')
  const lunchScore = mealScore('lunch')
  const dinnerScore = mealScore('dinner')
  const snackScore = mealScore('snack')
  const sleepScore = sleep?.sleepTotalMinutes === undefined ? undefined : sleep.sleepTotalMinutes >= 450 ? 10 : sleep.sleepTotalMinutes >= 420 ? 9 : sleep.sleepTotalMinutes >= 390 ? 8 : sleep.sleepTotalMinutes >= 360 ? 7 : sleep.sleepTotalMinutes >= 330 ? 6 : 5
  const exerciseScore = exercise === undefined ? undefined : exercise.exerciseMinutes === undefined ? 7 : exercise.exerciseMinutes >= 20 && exercise.exerciseMinutes <= 45 && (exercise.avgHeartRate === undefined || (exercise.avgHeartRate >= 105 && exercise.avgHeartRate <= 125)) ? 9 : exercise.exerciseMinutes >= 20 ? 8 : 7
  const scoreItems = [breakfastScore, lunchScore, dinnerScore, snackScore, sleepScore, exerciseScore].filter((score): score is number => score !== undefined)
  const todayScore = scoreItems.length ? Math.round(scoreItems.reduce((sum, score) => sum + score, 0) / scoreItems.length * 10) / 10 : 0
  return <div className="page-stack">
    <section className="date-heading"><div><p>{formatDate(day)}</p><h2>今天，照顾好自己</h2></div><div className="completion"><strong>{completed}/5</strong><span>记录完成</span></div></section>
    <section className="hero-card">
      <div><span className="metric-label">最新体重</span><strong>{latestWeight?.weightKg ? (latestWeight.weightKg * 2).toFixed(1) : '—'}<small> 斤</small></strong><p>{latestWeight ? `${targetText} · ${weeklyText}` : '记录后开始观察趋势'}</p></div>
      <div className="target-ring score-ring" style={{ '--progress': `${todayScore * 10}%` } as React.CSSProperties}><div><span>{todayScore.toFixed(1)}</span><small>今日评分</small></div></div>
    </section>
    <section className="chart-card home-weight-card"><div className="chart-title"><div><span>近 7 天平均体重</span><strong>{recentWeightAverage !== undefined ? `${recentWeightAverage.toFixed(1)} 斤` : '等待第一条体重记录'}</strong><small>{recentWeights.length ? `基于 ${recentWeights.length} 条体重记录` : '记录后可看见连续变化'}</small></div><Scale /></div><Chart data={weightData} dataKey="weight" color="#9be2c6" type="area" unit="斤" /></section>
    <section className="metric-grid">
      <article><span>今日热量</span><strong>{Math.round(calories)}</strong><small>kcal {profile.calorieTargetMax ? `/ ${profile.calorieTargetMax}` : ''}</small></article>
      <article><span>今日蛋白质</span><strong>{Math.round(protein)}</strong><small>g {profile.proteinTargetMin ? `/ ${profile.proteinTargetMin}+` : ''}</small></article>
      <article><span>睡眠 / 恢复</span><strong className="text-value">{sleep?.sleepTotalMinutes ? `${Math.floor(sleep.sleepTotalMinutes / 60)}h ${sleep.sleepTotalMinutes % 60}m` : sleep?.recoveryRating ?? '未记录'}</strong><small>{sleep?.recoveryRating ?? '—'}</small></article>
      <article><span>今日运动</span><strong className="text-value">{exercise?.exerciseMinutes ? `${exercise.exerciseMinutes} 分钟` : '未记录'}</strong><small>{exercise?.exercise ?? '—'}</small></article>
    </section>
    <section className="today-score-card"><div className="section-title"><h3>今日评分</h3><span>{scoreItems.length}/6 项已评分</span></div><div className="score-grid">
      {([
        ['早餐', breakfastScore, '餐次质量'],
        ['午餐', lunchScore, '餐次质量'],
        ['晚餐', dinnerScore, '餐次质量'],
        ['加餐', snackScore, '餐次质量'],
        ['睡眠', sleepScore, sleep?.sleepTotalMinutes ? `${Math.floor(sleep.sleepTotalMinutes / 60)}h ${sleep.sleepTotalMinutes % 60}m` : '时长与恢复'],
        ['运动', exerciseScore, exercise?.exerciseMinutes ? `${exercise.exerciseMinutes} 分钟` : '时长与心率'],
      ] as const).map(([label, score, detail]) => <article key={label}><span>{label}</span><strong className={score === undefined ? 'pending-score' : ''}>{score === undefined ? '待记录' : score.toFixed(1)}</strong><small>{score === undefined ? detail : `${detail} · /10`}</small></article>)}
    </div><p className="score-hint">评分会随当天记录补充而更新，不把单日体重波动计入扣分。</p></section>
    <section className="status-card"><div><span>身体状态</span><strong>{body?.symptoms || body?.mood || '今天还没有记录'}</strong><p>{body?.note || '花十秒记一下，之后更容易发现规律。'}</p></div><button onClick={() => onAdd('body')}>{body ? '补充' : '记录'}</button></section>
    <button className="ai-cta" onClick={onCopy}><Sparkles size={19} /><span><strong>复制今日上下文给 AI</strong><small>不包含任何 API Key</small></span><ChevronRight size={18} /></button>
  </div>
}

function RecordsPage({ records, onAdd, onEdit, onDelete }: { records: AppRecord[]; onAdd: (kind: RecordKind) => void; onEdit: (record: AppRecord) => void; onDelete: (record: AppRecord) => void }) {
  const [filter, setFilter] = useState<'all' | RecordKind>('all')
  const [showAddMenu, setShowAddMenu] = useState(false)
  const visible = records.filter((record) => filter === 'all' || (record.kind === 'meal' ? filter === 'meal' : record.recordType === filter))
  const addKinds: RecordKind[] = ['meal', 'weight', 'sleep', 'exercise', 'body']
  return <div className="page-stack"><div className="page-heading"><div><span className="eyebrow">RECORDS</span><h2>健康记录</h2><p>先记下来，之后再慢慢补充。</p></div><div className="record-add"><button className="round-add" aria-label="新增记录" aria-expanded={showAddMenu} onClick={() => setShowAddMenu((open) => !open)}>{showAddMenu ? <X size={20} /> : <Plus />}</button>{showAddMenu && <div className="record-add-menu">{addKinds.map((kind) => <button key={kind} onClick={() => { setShowAddMenu(false); onAdd(kind) }}><Plus size={15} />{typeNames[kind]}</button>)}</div>}</div></div>
    <div className="segmented scrollable">{(['all', 'meal', 'weight', 'sleep', 'exercise', 'body'] as const).map((item) => <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item === 'all' ? '全部' : typeNames[item]}</button>)}</div>
    <div className="record-list">{visible.length ? visible.map((record) => <RecordCard key={record.id} record={record} onEdit={onEdit} onDelete={onDelete} />) : <EmptyState icon={Plus} title="还没有记录" text="从最容易的一项开始，不需要一次填完。" />}</div>
  </div>
}

function RecordCard({ record, onEdit, onDelete }: { record: AppRecord; onEdit: (record: AppRecord) => void; onDelete: (record: AppRecord) => void }) {
  const icon = record.kind === 'meal' ? Utensils : record.recordType === 'weight' ? Scale : record.recordType === 'sleep' ? Moon : record.recordType === 'exercise' ? Dumbbell : Activity
  const Icon = icon
  const title = record.kind === 'meal' ? `${mealNames[record.mealType]} · ${record.rawText || '餐次记录'}` : record.recordType === 'weight' ? `${record.weightKg ? (record.weightKg * 2).toFixed(1) : '—'} 斤` : record.recordType === 'sleep' ? `${record.sleepTotalMinutes ?? 0} 分钟睡眠` : record.recordType === 'exercise' ? (record.exercise || '运动记录') : (record.symptoms || record.mood || '身体状态')
  const detail = record.kind === 'meal' ? [record.caloriesKcal && `${record.caloriesKcal} kcal`, record.proteinG && `蛋白质 ${record.proteinG}g`].filter(Boolean).join(' · ') : record.note || record.recoveryRating || (record.recordType === 'exercise' && record.exerciseMinutes ? `${record.exerciseMinutes} 分钟` : '')
  return <article className="record-card"><div className="record-icon"><Icon size={20} /></div><button className="record-main" onClick={() => onEdit(record)}><span>{formatDate(record.date)}</span><strong>{title}</strong><small>{detail || '点击查看或补充字段'}</small></button><div className="record-tail"><span className={`sync-dot ${record.syncStatus}`} title={record.syncStatus} /><button aria-label="删除" onClick={() => onDelete(record)}><Trash2 size={17} /></button></div></article>
}

function RecordEditor({ kind, record, onClose, onSaved }: { kind: RecordKind; record?: AppRecord; onClose: () => void; onSaved: (record: AppRecord) => void }) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const timestamp = now()
    const base = { id: record?.id ?? createId(), date: String(data.get('date')), source: 'manual' as const, createdAt: record?.createdAt ?? timestamp, updatedAt: timestamp, syncStatus: 'pending' as const }
    if (kind === 'meal') {
      const next: MealLog = { ...base, kind: 'meal', mealType: String(data.get('mealType')) as MealLog['mealType'], rawText: String(data.get('rawText')), foodItems: String(data.get('foodItems') ?? ''), portionText: String(data.get('portionText') ?? ''), caloriesKcal: numberOrUndefined(data.get('caloriesKcal')), proteinG: numberOrUndefined(data.get('proteinG')), carbsG: numberOrUndefined(data.get('carbsG')), fatG: numberOrUndefined(data.get('fatG')), sodiumMg: numberOrUndefined(data.get('sodiumMg')), score: numberOrUndefined(data.get('score')), scoreReason: String(data.get('scoreReason') ?? ''), riskTags: String(data.get('riskTags') ?? '').split(',').map((s) => s.trim()).filter(Boolean), positiveTags: String(data.get('positiveTags') ?? '').split(',').map((s) => s.trim()).filter(Boolean), note: String(data.get('note') ?? ''), isConfirmed: true }
      void onSaved(next)
    } else {
      const rawWeight = numberOrUndefined(data.get('weight'))
      const next: HealthLog = { ...base, kind: 'health', recordType: kind, rawText: String(data.get('rawText') ?? ''), weightKg: rawWeight === undefined ? undefined : rawWeight / 2, sleepTotalMinutes: numberOrUndefined(data.get('sleepTotalMinutes')), sleepDeepMinutes: numberOrUndefined(data.get('sleepDeepMinutes')), sleepRemMinutes: numberOrUndefined(data.get('sleepRemMinutes')), sleepCoreMinutes: numberOrUndefined(data.get('sleepCoreMinutes')), sleepAwakeMinutes: numberOrUndefined(data.get('sleepAwakeMinutes')), recoveryRating: String(data.get('recoveryRating') ?? ''), exercise: String(data.get('exercise') ?? ''), exerciseMinutes: numberOrUndefined(data.get('exerciseMinutes')), avgHeartRate: numberOrUndefined(data.get('avgHeartRate')), activeCaloriesKcal: numberOrUndefined(data.get('activeCaloriesKcal')), symptoms: String(data.get('symptoms') ?? ''), mood: String(data.get('mood') ?? ''), note: String(data.get('note') ?? '') }
      void onSaved(next)
    }
  }
  const health = record?.kind === 'health' ? record : undefined
  const meal = record?.kind === 'meal' ? record : undefined
  return <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className="editor-sheet" role="dialog" aria-modal="true"><div className="sheet-handle" /><header><div><span className="eyebrow">QUICK LOG</span><h2>{record ? '编辑' : '新增'}{typeNames[kind]}记录</h2></div><button onClick={onClose} aria-label="关闭"><X /></button></header><form onSubmit={handleSubmit}>
    <label>日期<input name="date" type="date" defaultValue={record?.date ?? today()} required /></label>
    {kind === 'meal' && <><label>餐次<select name="mealType" defaultValue={meal?.mealType ?? 'lunch'} required>{Object.entries(mealNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>吃了什么<textarea name="rawText" defaultValue={meal?.rawText} placeholder="例：一份鸡腿饭，加青菜" required /></label><div className="two-cols"><label>热量 kcal<input name="caloriesKcal" type="number" inputMode="decimal" defaultValue={meal?.caloriesKcal} /></label><label>蛋白质 g<input name="proteinG" type="number" inputMode="decimal" step="0.1" defaultValue={meal?.proteinG} /></label></div><details><summary>补充营养与评价</summary><label>食物内容<input name="foodItems" defaultValue={meal?.foodItems} /></label><label>份量<input name="portionText" defaultValue={meal?.portionText} /></label><div className="two-cols"><label>碳水 g<input name="carbsG" type="number" step="0.1" defaultValue={meal?.carbsG} /></label><label>脂肪 g<input name="fatG" type="number" step="0.1" defaultValue={meal?.fatG} /></label><label>钠 mg<input name="sodiumMg" type="number" defaultValue={meal?.sodiumMg} /></label><label>评分 0-10<input name="score" type="number" min="0" max="10" step="0.5" defaultValue={meal?.score} /></label></div><label>评分理由<input name="scoreReason" defaultValue={meal?.scoreReason} /></label><label>正向标签（逗号分隔）<input name="positiveTags" defaultValue={meal?.positiveTags?.join(', ')} /></label><label>风险标签（逗号分隔）<input name="riskTags" defaultValue={meal?.riskTags?.join(', ')} /></label></details></>}
    {kind === 'weight' && <><label>体重（斤）<input name="weight" type="number" step="0.1" inputMode="decimal" defaultValue={health?.weightKg ? health.weightKg * 2 : ''} required /></label></>}
    {kind === 'sleep' && <><label>总睡眠（分钟）<input name="sleepTotalMinutes" type="number" defaultValue={health?.sleepTotalMinutes} required /></label><label>恢复状态<select name="recoveryRating" defaultValue={health?.recoveryRating}><option value="">未选择</option><option>很好</option><option>良好</option><option>一般</option><option>较差</option></select></label><details><summary>补充睡眠阶段</summary><div className="two-cols"><label>深睡<input name="sleepDeepMinutes" type="number" defaultValue={health?.sleepDeepMinutes} /></label><label>REM<input name="sleepRemMinutes" type="number" defaultValue={health?.sleepRemMinutes} /></label><label>核心睡眠<input name="sleepCoreMinutes" type="number" defaultValue={health?.sleepCoreMinutes} /></label><label>清醒<input name="sleepAwakeMinutes" type="number" defaultValue={health?.sleepAwakeMinutes} /></label></div></details></>}
    {kind === 'exercise' && <><label>运动内容<input name="exercise" defaultValue={health?.exercise} placeholder="例：快走、力量训练" required /></label><div className="two-cols"><label>时长（分钟）<input name="exerciseMinutes" type="number" defaultValue={health?.exerciseMinutes} /></label><label>动态消耗 kcal<input name="activeCaloriesKcal" type="number" defaultValue={health?.activeCaloriesKcal} /></label></div><label>平均心率<input name="avgHeartRate" type="number" defaultValue={health?.avgHeartRate} /></label></>}
    {kind === 'body' && <><label>身体感受 / 症状<textarea name="symptoms" defaultValue={health?.symptoms} placeholder="只做客观记录，不用于医疗诊断" /></label><label>情绪<input name="mood" defaultValue={health?.mood} placeholder="平静、焦虑、开心……" /></label></>}
    {kind !== 'meal' && <label>原始描述<textarea name="rawText" defaultValue={health?.rawText} placeholder="可选，保留当时的原话" /></label>}
    <label>备注<textarea name="note" defaultValue={record?.note} /></label><button className="primary wide" type="submit"><Check size={18} />保存记录</button>
  </form></section></div>
}

function TrendsPage({ records, range, setRange }: { records: AppRecord[]; range: TrendRange; setRange: (value: TrendRange) => void }) {
  const days = range === 'previous7' ? 7 : range
  const offset = range === 'previous7' ? 7 : 0
  const data = useMemo(() => buildTrendData(records, days, offset), [records, days, offset])
  const comparisonData = useMemo(() => buildTrendData(records, 14), [records])
  const weights = data.map((d) => d.weight).filter((v): v is number => v !== undefined)
  const avg = weights.length ? weights.reduce((a, b) => a + b, 0) / weights.length : undefined
  const scores = data.map((d) => d.score).filter((v): v is number => v !== undefined)
  const priorSeven = comparisonData.slice(0, 7).map((d) => d.weight).filter((v): v is number => v !== undefined)
  const latestSeven = comparisonData.slice(-7).map((d) => d.weight).filter((v): v is number => v !== undefined)
  const priorSevenAverage = priorSeven.length ? priorSeven.reduce((sum, value) => sum + value, 0) / priorSeven.length : undefined
  const latestSevenAverage = latestSeven.length ? latestSeven.reduce((sum, value) => sum + value, 0) / latestSeven.length : undefined
  const sevenDayDelta = priorSevenAverage !== undefined && latestSevenAverage !== undefined ? latestSevenAverage - priorSevenAverage : undefined
  const rangeLabel = range === 'previous7' ? '前 7 天' : `近 ${days} 天`
  const comparisonLabel = sevenDayDelta === undefined ? '' : sevenDayDelta === 0 ? '近 7 天与前 7 天均重持平' : `近 7 天较前 7 天${sevenDayDelta > 0 ? '上升' : '下降'} ${Math.abs(sevenDayDelta).toFixed(1)} 斤`
  return <div className="page-stack"><div className="page-heading"><div><span className="eyebrow">TRENDS</span><h2>最近的变化</h2><p>看方向，不被单日波动绑架。</p></div></div><div className="segmented trend-segmented">{([7, 'previous7', 14, 30] as const).map((value) => <button className={range === value ? 'active' : ''} key={value} onClick={() => setRange(value)}>{value === 'previous7' ? '前7天' : `${value} 天`}</button>)}</div>
    <section className="chart-card"><div className="chart-title"><div><span>{rangeLabel}平均体重</span><strong>{avg?.toFixed(1) ?? '—'} 斤</strong><small>{range === 14 && priorSevenAverage !== undefined && latestSevenAverage !== undefined ? `前7天 ${priorSevenAverage.toFixed(1)} 斤 · 近7天 ${latestSevenAverage.toFixed(1)} 斤 · ${comparisonLabel}` : `基于 ${weights.length} 条体重记录，纵轴按当前范围缩放`}</small></div><Scale /></div><Chart data={data} dataKey="weight" color="#177c63" type="line" unit="斤" /></section>
    <section className="chart-card"><div className="chart-title"><div><span>每日摄入</span><strong>{Math.round(data.reduce((s, d) => s + d.calories, 0) / Math.max(1, data.length))} kcal</strong><small>日均热量</small></div><Utensils /></div><Chart data={data} dataKey="calories" color="#df7d4e" type="area" unit="kcal" /></section>
    <section className="chart-card"><div className="chart-title"><div><span>每日评分</span><strong>{scores.length ? (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1) : '—'} / 10</strong><small>按当天已记录的餐次、睡眠与运动综合计算</small></div><Sparkles /></div><Chart data={data} dataKey="score" color="#2d8eab" type="line" unit="分" /></section>
    <div className="chart-split"><section className="chart-card compact"><div className="chart-title"><div><span>蛋白质</span><strong>{Math.round(data.reduce((s, d) => s + d.protein, 0) / Math.max(1, data.length))}g</strong></div></div><Chart data={data} dataKey="protein" color="#5c72c5" type="bar" unit="g" /></section><section className="chart-card compact"><div className="chart-title"><div><span>运动时长</span><strong>{data.reduce((s, d) => s + d.exercise, 0)}m</strong></div></div><Chart data={data} dataKey="exercise" color="#a15b92" type="bar" unit="m" /></section></div>
    <section className="chart-card"><div className="chart-title"><div><span>睡眠趋势</span><strong>{Math.round(data.reduce((s, d) => s + d.sleep, 0) / Math.max(1, data.filter(d => d.sleep).length) / 60 * 10) / 10 || '—'} h</strong><small>有记录日期平均</small></div><Moon /></div><Chart data={data} dataKey="sleepHours" color="#6658a6" type="area" unit="h" /></section>
    <section className="calendar-card"><div className="section-title"><h3>餐次记录日历</h3><span>颜色越深，记录越完整</span></div><div className="heatmap">{data.map((day) => <div key={day.date} title={`${day.date}: ${day.meals} 餐`} className={`level-${Math.min(3, day.meals)}`}><span>{new Date(`${day.date}T12:00:00`).getDate()}</span></div>)}</div></section>
  </div>
}

function ChartTooltip({ active, payload, label, unit }: { active?: boolean; payload?: Array<{ value?: number | string }>; label?: string; unit: string }) {
  const value = Number(payload?.[0]?.value)
  if (!active || !Number.isFinite(value)) return null
  const displayValue = unit === '斤' || unit === '分' || unit === 'h' ? value.toFixed(1) : Math.round(value).toString()
  return <div className="weight-tooltip"><span>{label}</span><strong>{displayValue} {unit}</strong></div>
}

function Chart({ data, dataKey, color, type, unit }: { data: ReturnType<typeof buildTrendData>; dataKey: string; color: string; type: 'line' | 'area' | 'bar'; unit: string }) {
  const common = { data, margin: { top: 10, right: 4, left: -24, bottom: 0 } }
  const values = data.map((item) => item[dataKey as keyof typeof item]).filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (values.length === 0) return <div className="chart chart-empty">暂无可展示数据</div>
  const isWeight = dataKey === 'weight' && values.length > 0
  const isScore = dataKey === 'score'
  const minimum = isWeight ? Math.min(...values) : undefined
  const maximum = isWeight ? Math.max(...values) : undefined
  const scoreMinimum = isScore ? Math.min(...values) : undefined
  const scoreMaximum = isScore ? Math.max(...values) : undefined
  const weightDomain = isWeight
    ? [Math.floor(((minimum as number) - 0.4) * 2) / 2, Math.ceil(((maximum as number) + 0.4) * 2) / 2] as [number, number]
    : undefined
  const scoreDomain = isScore
    ? [
      Math.max(0, Math.floor(((scoreMinimum as number) - 0.5) * 2) / 2),
      Math.min(10, Math.ceil(((scoreMaximum as number) + 0.5) * 2) / 2),
    ] as [number, number]
    : undefined
  const point = { r: 4, fill: '#fff', stroke: color, strokeWidth: 3 }
  const children = <><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9e6df" /><XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis domain={weightDomain ?? scoreDomain} tickCount={isWeight ? 6 : isScore ? 6 : undefined} tickFormatter={isWeight || isScore ? (value) => Number(value).toFixed(1) : undefined} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip cursor={false} content={<ChartTooltip unit={unit} />} /></>
  return <div className="chart" aria-label={`${dataKey} (${unit})`}><ResponsiveContainer width="100%" height="100%">{type === 'line' ? <LineChart {...common}>{children}<Line connectNulls type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.5} dot={isWeight ? point : { r: 2.5 }} activeDot={isWeight ? { ...point, r: 5 } : undefined} /></LineChart> : type === 'area' ? <AreaChart {...common}>{children}<Area connectNulls type="monotone" dataKey={dataKey} stroke={color} fill={color} fillOpacity={0.13} strokeWidth={2.5} dot={isWeight ? point : false} activeDot={isWeight ? { ...point, r: 5 } : undefined} /></AreaChart> : <BarChart {...common}>{children}<Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} /></BarChart>}</ResponsiveContainer></div>
}

function AiPage({ records, profile, config, notify }: { records: AppRecord[]; profile: ProfileSettings; config: LocalConfig; notify: (message: string) => void }) {
  const actions = [
    { title: '健康上下文', detail: '目标、边界、今日与近 7 天摘要', text: buildContext(records, profile), icon: Sparkles },
    { title: 'API 使用说明', detail: 'Supabase 表、查询与写入规则', text: buildApiGuide(), icon: Bot },
    { title: '最近 7 天摘要', detail: '精简数据，不读取完整历史', text: buildSevenDaySummary(records), icon: TrendingUp },
    { title: '今日记录', detail: '当天餐次与健康日志', text: buildTodaySummary(records), icon: Home },
  ]
  const copyWithKeys = async (base: string) => {
    if (!config.supabaseUrl || !config.supabaseAnonKey || !config.accessCode) return notify('请先在设置中完整保存本地配置')
    if (!confirm('这段文本将包含 Supabase URL、anon key 和访问码。仅复制到你信任的 AI 对话，并确认继续。')) return
    await copyText(`${base}\n\n${buildAuthorization(config)}`, notify)
  }
  return <div className="page-stack"><div className="page-heading"><div><span className="eyebrow">AI HANDOFF</span><h2>把上下文交给 AI</h2><p>默认不含密钥；需要授权时再明确选择。</p></div></div><section className="ai-intro"><div className="ai-orb"><Bot size={28} /></div><div><strong>这是 Supabase 直连版本</strong><p>没有 Java 后端。AI 应先复述候选记录，得到确认后再写入，并且不得回显 Key。</p></div></section>
    <div className="copy-list">{actions.map(({ title, detail, text, icon: Icon }) => <article key={title}><div className="copy-icon"><Icon /></div><div><strong>{title}</strong><p>{detail}</p></div><button onClick={() => void copyText(text, notify)}>复制</button>{title === '健康上下文' || title === 'API 使用说明' ? <button className="key-copy" onClick={() => void copyWithKeys(text)}>含 Key</button> : null}</article>)}</div>
    <section className="security-note"><CloudOff size={20} /><div><strong>密钥只存本机</strong><p>默认复制、JSON 导出和数据库记录都不会包含本地 Key。</p></div></section>
  </div>
}

function SettingsPage({ profile, setProfile, onSync, syncing, importRef, onImport, onClear, notify }: { profile: ProfileSettings; setProfile: (profile: ProfileSettings) => void; onSync: () => void; syncing: boolean; importRef: React.RefObject<HTMLInputElement | null>; onImport: (file: File) => void; onClear: () => void; notify: (message: string) => void }) {
  const [profileDraft, setProfileDraft] = useState(profile)
  useEffect(() => setProfileDraft(profile), [profile])
  const saveGoals = async () => { const next = { ...profileDraft, updatedAt: now() }; await saveProfile(next); setProfile(next); notify('目标设置已保存') }
  return <div className="page-stack"><div className="page-heading"><div><span className="eyebrow">SETTINGS</span><h2>设置</h2><p>连接云端、备份数据和安装应用。</p></div></div>
    <section className="settings-card"><div className="section-title"><h3>云端健康档案</h3><span>已自动连接</span></div><p className="settings-hint">此版本已内置云端连接信息。打开应用后会自动同步你的健康记录，无需额外配置。</p><div className="button-row"><button className="primary" onClick={onSync} disabled={syncing}>立即同步云端</button><button onClick={async () => { try { await testConnection(); notify('连接成功，RLS 查询可用') } catch (e) { notify(e instanceof Error ? e.message : '连接失败') } }}>检测连接</button></div></section>
    <section className="settings-card"><div className="section-title"><h3>目标与偏好</h3><span>用于 AI 上下文</span></div><div className="two-cols"><label>短期目标体重（斤）<input type="number" step="0.1" value={profileDraft.targetWeightKg ? profileDraft.targetWeightKg * 2 : ''} onChange={(e) => setProfileDraft({ ...profileDraft, targetWeightKg: e.target.value ? Number(e.target.value) / 2 : undefined })} /></label><label>长期目标体重（斤）<input type="number" step="0.1" value={profileDraft.longTermTargetWeightKg ? profileDraft.longTermTargetWeightKg * 2 : ''} onChange={(e) => setProfileDraft({ ...profileDraft, longTermTargetWeightKg: e.target.value ? Number(e.target.value) / 2 : undefined })} /></label><label>热量下限<input type="number" value={profileDraft.calorieTargetMin ?? ''} onChange={(e) => setProfileDraft({ ...profileDraft, calorieTargetMin: e.target.value ? Number(e.target.value) : undefined })} /></label><label>热量上限<input type="number" value={profileDraft.calorieTargetMax ?? ''} onChange={(e) => setProfileDraft({ ...profileDraft, calorieTargetMax: e.target.value ? Number(e.target.value) : undefined })} /></label><label>蛋白质下限 g<input type="number" value={profileDraft.proteinTargetMin ?? ''} onChange={(e) => setProfileDraft({ ...profileDraft, proteinTargetMin: e.target.value ? Number(e.target.value) : undefined })} /></label></div><label>目标与原则<textarea value={profileDraft.preferenceBrief} onChange={(e) => setProfileDraft({ ...profileDraft, preferenceBrief: e.target.value })} /></label><label>健康安全边界<textarea value={profileDraft.safetyBrief} onChange={(e) => setProfileDraft({ ...profileDraft, safetyBrief: e.target.value })} /></label><button className="primary" onClick={() => void saveGoals()}>保存目标</button></section>
    <section className="settings-card"><div className="section-title"><h3>同步与数据</h3><span>{navigator.onLine ? '当前在线' : '当前离线'}</span></div><div className="settings-actions"><button onClick={onSync} disabled={syncing}><RefreshCw size={18} className={syncing ? 'spin' : ''} /><span><strong>手动同步</strong><small>上传待同步记录</small></span><ChevronRight /></button><button onClick={() => void exportData(notify)}><Download size={18} /><span><strong>导出 JSON</strong><small>默认不包含配置与 Key</small></span><ChevronRight /></button><button onClick={() => importRef.current?.click()}><Upload size={18} /><span><strong>导入 JSON</strong><small>按 ID 与更新时间合并</small></span><ChevronRight /></button><input hidden ref={importRef} type="file" accept="application/json" onChange={(e) => { const file = e.target.files?.[0]; if (file && confirm('导入会把数据合并到当前本地记录，是否继续？')) void onImport(file); e.currentTarget.value = '' }} /><button onClick={onClear}><Trash2 size={18} /><span><strong>清空本地缓存</strong><small>不会自动删除云端记录</small></span><ChevronRight /></button></div></section>
    <section className="settings-card install-card"><div><strong>安装到主屏幕</strong><p>在手机浏览器菜单中选择“添加到主屏幕”或“安装应用”。安装后仍可离线记录。</p></div></section>
  </div>
}

function EmptyState({ icon: Icon, title, text }: { icon: typeof Plus; title: string; text: string }) { return <div className="empty-state"><Icon /><strong>{title}</strong><p>{text}</p></div> }

function buildTrendData(records: AppRecord[], days: number, offset = 0) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(); date.setDate(date.getDate() - offset - (days - 1 - index)); const key = date.toLocaleDateString('sv-SE')
    const daily = records.filter((record) => record.date === key)
    const meals = daily.filter((record): record is MealLog => record.kind === 'meal')
    const health = daily.filter((record): record is HealthLog => record.kind === 'health')
    const orderedHealth = [...health].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
    const storedWeight = orderedHealth.filter((record) => record.weightKg !== undefined).at(-1)?.weightKg
    const weight = storedWeight === undefined ? undefined : Math.round(storedWeight * 20) / 10
    const sleep = orderedHealth.filter((record) => record.sleepTotalMinutes !== undefined).at(-1)?.sleepTotalMinutes ?? 0
    const mealScores = (['breakfast', 'lunch', 'dinner', 'snack'] as MealLog['mealType'][]).flatMap((mealType) => {
      const matching = meals.filter((meal) => meal.mealType === mealType)
      if (!matching.length) return []
      const explicit = matching.map((meal) => meal.score).filter((score): score is number => score !== undefined)
      if (explicit.length) return [explicit.reduce((sum, score) => sum + score, 0) / explicit.length]
      const mealProtein = matching.reduce((sum, meal) => sum + (meal.proteinG ?? 0), 0)
      return [Math.min(10, 7 + Math.min(3, mealProtein / 25))]
    })
    const sleepScore = sleep ? sleep >= 450 ? 10 : sleep >= 420 ? 9 : sleep >= 390 ? 8 : sleep >= 360 ? 7 : sleep >= 330 ? 6 : 5 : undefined
    const exerciseMinutes = health.reduce((sum, record) => sum + (record.exerciseMinutes ?? 0), 0)
    const avgHeartRate = orderedHealth.filter((record) => record.avgHeartRate !== undefined).at(-1)?.avgHeartRate
    const exerciseScore = exerciseMinutes ? exerciseMinutes >= 20 && exerciseMinutes <= 45 && (avgHeartRate === undefined || (avgHeartRate >= 105 && avgHeartRate <= 125)) ? 9 : exerciseMinutes >= 20 ? 8 : 7 : undefined
    const dayScores = [...mealScores, sleepScore, exerciseScore].filter((score): score is number => score !== undefined)
    const score = dayScores.length ? Math.round(dayScores.reduce((sum, item) => sum + item, 0) / dayScores.length * 10) / 10 : undefined
    return { date: key, label: `${date.getMonth() + 1}/${date.getDate()}`, weight, calories: meals.reduce((s, r) => s + (r.caloriesKcal ?? 0), 0), protein: meals.reduce((s, r) => s + (r.proteinG ?? 0), 0), sleep, sleepHours: Math.round(sleep / 6) / 10, exercise: exerciseMinutes, meals: meals.length, score }
  })
}

function buildTodaySummary(records: AppRecord[]) {
  const day = today(); const daily = records.filter((r) => r.date === day); const meals = daily.filter((r): r is MealLog => r.kind === 'meal'); const health = daily.filter((r): r is HealthLog => r.kind === 'health')
  const weight = health.find((r) => r.weightKg !== undefined)?.weightKg
  return `【今日记录】\n日期：${day}\n餐次：${meals.length ? meals.map((m) => `${mealNames[m.mealType]} ${m.rawText}（${m.caloriesKcal ?? '未估'} kcal，蛋白质 ${m.proteinG ?? '未估'}g）`).join('；') : '暂无'}\n体重：${weight === undefined ? '暂无' : `${(weight * 2).toFixed(1)} 斤`}\n睡眠：${health.find((r) => r.recordType === 'sleep')?.sleepTotalMinutes ?? '暂无'} 分钟\n运动：${health.find((r) => r.recordType === 'exercise')?.exercise ?? '暂无'}\n身体状态：${health.find((r) => r.recordType === 'body')?.symptoms || '暂无'}`
}

function buildSevenDaySummary(records: AppRecord[]) {
  const data = buildTrendData(records, 7)
  return `【最近 7 天摘要】\n${data.map((d) => `${d.date}｜体重 ${d.weight ?? '—'} 斤｜热量 ${d.calories || '—'} kcal｜蛋白质 ${d.protein || '—'} g｜睡眠 ${d.sleep || '—'} 分钟｜运动 ${d.exercise || '—'} 分钟｜餐次 ${d.meals}`).join('\n')}`
}

function buildContext(records: AppRecord[], profile: ProfileSettings) {
  return `你是我的健康记录助手。请基于以下上下文帮助我记录、复盘饮食、体重、睡眠、运动和身体状态。\n\n【目标】\n${profile.preferenceBrief}\n${profile.targetWeightKg ? `短期目标体重：${(profile.targetWeightKg * 2).toFixed(1)} 斤。` : ''}\n\n【安全边界】\n${profile.safetyBrief}\n不要提供医疗诊断。\n\n${buildTodaySummary(records)}\n\n${buildSevenDaySummary(records)}\n\n【API 调用前提】\n这是 Supabase 直连版本，没有 Java 后端。只有当文本末尾存在【本次授权】并提供 SUPABASE_URL、SUPABASE_ANON_KEY、HEALTH_ACCESS_CODE 时，才可以发起 API 请求；否则只整理候选记录、解释或总结，不能假装已查询或保存。\n\n【查询范围】\n默认只查询当天和最近 7 天。所有读取、更新和删除都必须同时带 x-health-access-code 请求头和 access_code 条件，不能读取其他访问码的数据。\n\n【写入工作流】\n1. 先从自然语言整理候选记录。\n2. 明确复述日期、记录类型、内容和关键数值。\n3. 等待用户清晰确认。\n4. 确认后按下方 REST 约定写入。\n5. 成功后只报告保存结果，绝不回显任何 Key 或 access code。\n\n【单位】\n界面展示与输入统一使用斤；API 和数据库内部使用 kg，写入时将斤除以 2。\n\n${buildApiGuide()}\n\n【边界】\n不要诊断疾病，不要在回复中复述、展示或保存 API Key。`
}

function buildApiGuide() {
  return `【健康记录 API 使用说明】\n架构：GitHub Pages 静态前端 + Supabase REST API 直连；没有 Java 后端。\n\n【表与用途】\n- meal_logs：餐次。核心字段：date、meal_type、raw_text、calories_kcal、protein_g、carbs_g、fat_g、sodium_mg、score、note、source、is_confirmed、access_code。\n- health_logs：体重、睡眠、运动、身体状态。核心字段：date、weight_kg、sleep_total_minutes、sleep_awake_minutes、sleep_rem_minutes、sleep_core_minutes、sleep_deep_minutes、recovery_rating、exercise、exercise_minutes、avg_heart_rate、active_calories_kcal、symptoms、mood、note、source、access_code。\n- profile_settings：目标设置；按 access_code 唯一。\n\n【REST 基址与公共请求头】\nREST 基址：SUPABASE_URL/rest/v1\n每次请求都带：\nContent-Type: application/json\napikey: SUPABASE_ANON_KEY\nAuthorization: Bearer SUPABASE_ANON_KEY\nx-health-access-code: HEALTH_ACCESS_CODE\n写入时再带 Prefer: return=representation；upsert 时使用 Prefer: resolution=merge-duplicates,return=representation。\n\n【查询案例】\n读取最近 7 天餐次：\nGET SUPABASE_URL/rest/v1/meal_logs?select=*&access_code=eq.HEALTH_ACCESS_CODE&date=gte.YYYY-MM-DD&order=date.desc\n读取当天健康日志：\nGET SUPABASE_URL/rest/v1/health_logs?select=*&access_code=eq.HEALTH_ACCESS_CODE&date=eq.YYYY-MM-DD\n请求 URL 中的 HEALTH_ACCESS_CODE 必须 URL 编码；不得省略 access_code 过滤条件。\n\n【新增餐次案例】\nPOST SUPABASE_URL/rest/v1/meal_logs\n{\n  "date": "YYYY-MM-DD",\n  "meal_type": "lunch",\n  "raw_text": "一份鸡腿饭，加青菜",\n  "calories_kcal": 650,\n  "protein_g": 35,\n  "source": "ai_confirmed",\n  "is_confirmed": true,\n  "access_code": "HEALTH_ACCESS_CODE"\n}\n可选 meal_type：breakfast、lunch、dinner、snack、drink、other。\n\n【新增健康日志案例】\nPOST SUPABASE_URL/rest/v1/health_logs\n{\n  "date": "YYYY-MM-DD",\n  "weight_kg": 77.9,\n  "sleep_total_minutes": 410,\n  "sleep_deep_minutes": 55,\n  "recovery_rating": "一般",\n  "exercise": "快走",\n  "exercise_minutes": 20,\n  "avg_heart_rate": 106,\n  "symptoms": "轻微头晕",\n  "source": "ai_confirmed",\n  "access_code": "HEALTH_ACCESS_CODE"\n}\n体重一律写 weight_kg；用户说 155.8 斤时应写 77.9。\n\n【更新与冲突】\n更新已知记录：PATCH SUPABASE_URL/rest/v1/meal_logs?id=eq.RECORD_ID&access_code=eq.HEALTH_ACCESS_CODE，并在 body 中提交修改字段和 updated_at。\n新增时让数据库生成 id；如使用固定 id 重试，则 POST + Prefer: resolution=merge-duplicates,return=representation。发生冲突时以 updated_at 更晚者为准。\n\n【禁止事项】\n不得将 Key 或 access_code 写入回复、聊天记录、导出文本以外的地方；不得查询完整历史或其他 access_code 数据；不得未经确认写入；不得提供医疗诊断。`
}

function buildAuthorization(config: LocalConfig) {
  return `【本次授权】\n本次对话已授权你调用我的健康记录 API。\nSUPABASE_URL=${config.supabaseUrl}\nSUPABASE_ANON_KEY=${config.supabaseAnonKey}\nHEALTH_ACCESS_CODE=${config.accessCode}\n\n调用时不要在回答中复述、展示或保存这些 Key。`
}

async function copyText(text: string, notify: (message: string) => void) { await navigator.clipboard.writeText(text); notify('已复制到剪贴板') }

async function exportData(notify: (message: string) => void) {
  const records = await listRecords(); const profile = await getProfile(); const payload: ExportPayload = { version: 1, exportedAt: now(), meal_logs: records.filter((r): r is MealLog => r.kind === 'meal'), health_logs: records.filter((r): r is HealthLog => r.kind === 'health'), profile_settings: profile }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `health-backup-${today()}.json`; anchor.click(); URL.revokeObjectURL(url); notify('备份已导出，不含本地 Key')
}

async function importData(file: File, notify: (message: string) => void) {
  try { const payload = JSON.parse(await file.text()) as ExportPayload; await mergeRecords([...(payload.meal_logs ?? []), ...(payload.health_logs ?? [])]); if (payload.profile_settings) { const current = await getProfile(); if (new Date(payload.profile_settings.updatedAt) > new Date(current.updatedAt)) await saveProfile(payload.profile_settings) } notify('导入完成，数据已合并') } catch { notify('导入失败：文件格式不正确') }
}

export default App
