import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
}

const mealFields = [
  'date', 'meal_type', 'raw_text', 'food_items', 'portion_text', 'calories_kcal',
  'protein_g', 'carbs_g', 'fat_g', 'sodium_mg', 'score', 'score_reason',
  'risk_tags', 'positive_tags', 'note',
]

const healthFields = [
  'date', 'raw_text', 'weight_kg', 'sleep_total_minutes', 'sleep_deep_minutes',
  'sleep_rem_minutes', 'sleep_core_minutes', 'sleep_awake_minutes',
  'recovery_rating', 'exercise', 'exercise_minutes', 'avg_heart_rate',
  'active_calories_kcal', 'symptoms', 'mood', 'note',
]

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function pick(input: Record<string, unknown>, fields: string[]) {
  return Object.fromEntries(fields.flatMap((field) => input[field] === undefined ? [] : [[field, input[field]]]))
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const expectedToken = Deno.env.get('HEALTH_AGENT_TOKEN')
  const authorization = request.headers.get('authorization') ?? ''
  if (!expectedToken || authorization !== `Bearer ${expectedToken}`) return json({ error: 'Unauthorized' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const accessCode = Deno.env.get('HEALTH_ACCESS_CODE')
  if (!supabaseUrl || !serviceRoleKey || !accessCode) return json({ error: 'Function secrets are incomplete' }, 500)

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  const url = new URL(request.url)
  const path = url.pathname.replace(/^.*\/health-agent/, '') || '/'

  if (request.method === 'GET' && path === '/context') {
    const date = url.searchParams.get('date') ?? today()
    const days = Math.min(Math.max(Number(url.searchParams.get('days') ?? 7), 1), 30)
    const since = new Date(`${date}T00:00:00Z`)
    since.setUTCDate(since.getUTCDate() - (days - 1))
    const from = since.toISOString().slice(0, 10)
    const [meals, health, profile] = await Promise.all([
      supabase.from('meal_logs').select('*').eq('access_code', accessCode).gte('date', from).lte('date', date).order('date', { ascending: false }),
      supabase.from('health_logs').select('*').eq('access_code', accessCode).gte('date', from).lte('date', date).order('date', { ascending: false }),
      supabase.from('profile_settings').select('*').eq('access_code', accessCode).maybeSingle(),
    ])
    const error = meals.error ?? health.error ?? profile.error
    if (error) return json({ error: error.message }, 500)
    return json({ date, days, meals: meals.data ?? [], health: health.data ?? [], profile: profile.data ?? null })
  }

  if (request.method === 'POST' && path === '/records') {
    const input = await request.json().catch(() => null) as Record<string, unknown> | null
    if (!input || (input.kind !== 'meal' && input.kind !== 'health') || typeof input.date !== 'string') {
      return json({ error: 'Provide kind (meal or health) and date (YYYY-MM-DD)' }, 400)
    }

    const row = {
      ...pick(input, input.kind === 'meal' ? mealFields : healthFields),
      id: crypto.randomUUID(),
      access_code: accessCode,
      source: 'ai_confirmed',
      is_confirmed: true,
      sync_status: 'synced',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const table = input.kind === 'meal' ? 'meal_logs' : 'health_logs'
    const { data, error } = await supabase.from(table).insert(row).select().single()
    if (error) return json({ error: error.message }, 500)
    return json({ saved: true, record: data }, 201)
  }

  return json({ error: 'Not found' }, 404)
})
