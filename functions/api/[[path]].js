// Cloudflare Pages Function — SEO Dashboard API
// Handles all /api/* requests on seo.foreverdoodle.com

const ADMIN_EMAIL = 'homevirtavo@gmail.com'
const DFS_AUTH    = btoa('chloelee@puwell.com:a91b3259983a4853')
const SCOPES = [
  'openid','email','profile',
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/analytics.readonly',
].join(' ')

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function corsResp(body, status=200, extra={}) {
  return new Response(body, { status, headers: { 'Content-Type':'application/json', ...CORS, ...extra } })
}
function json(data, status=200) { return corsResp(JSON.stringify(data), status) }
function redir(url) { return Response.redirect(url, 302) }

async function saveSession(env, id, data) {
  await env.SEO_SESSIONS.put(id, JSON.stringify({...data, ts: Date.now()}), { expirationTtl: 86400 * 30 })
}
async function getSession(env, id) {
  const v = await env.SEO_SESSIONS.get(id)
  return v ? JSON.parse(v) : null
}

async function googlePost(path, params) {
  const r = await fetch(`https://oauth2.googleapis.com${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  })
  return r.json()
}

async function checkPassword(env, password) {
  const hash = env.ADMIN_PASSWORD_HASH || ''
  if (!hash.startsWith('pbkdf2:')) return false
  const stored = hash.slice(7)
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name:'PBKDF2', salt: enc.encode('seo_dashboard_salt_2024'), iterations:100000, hash:'SHA-256' },
    key, 256
  )
  const derived = btoa(String.fromCharCode(...new Uint8Array(bits)))
  return derived === stored
}

// Pages Function entry point
export async function onRequest(context) {
  const { request: req, env } = context
  const url = new URL(req.url)
  const p   = url.pathname
  const SERVER_URL  = `https://${url.hostname}`
  const CLIENT_ID   = env.GOOGLE_CLIENT_ID   || ''
  const CLIENT_SEC  = env.GOOGLE_CLIENT_SECRET || ''

  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  // OAuth init
  if (p === '/api/oauth/init') {
    const redirectTo = url.searchParams.get('redirect_to') || `${SERVER_URL}/`
    const state = crypto.randomUUID().replace(/-/g,'')
    await saveSession(env, 'state_'+state, { redirect_to: redirectTo })
    const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: `${SERVER_URL}/api/oauth/callback`,
      response_type: 'code', scope: SCOPES,
      access_type: 'offline', prompt: 'consent', state,
    })
    return redir(authUrl)
  }

  // OAuth callback
  if (p === '/api/oauth/callback') {
    const code  = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const stateData  = await getSession(env, 'state_'+state)
    const redirectTo = stateData?.redirect_to || `${SERVER_URL}/`
    if (!code) return redir(`${redirectTo}?auth_error=no_code`)

    const tokens = await googlePost('/token', {
      code, client_id: CLIENT_ID, client_secret: CLIENT_SEC,
      redirect_uri: `${SERVER_URL}/api/oauth/callback`,
      grant_type: 'authorization_code',
    })
    if (tokens.error) return redir(`${redirectTo}?auth_error=token_exchange`)

    const userInfo = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    }).then(r => r.json())

    const sessionId = crypto.randomUUID().replace(/-/g,'')
    await saveSession(env, sessionId, {
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in:    tokens.expires_in || 3600,
      user_name:     userInfo.name,
      user_email:    userInfo.email,
      user_picture:  userInfo.picture,
    })
    const sep  = redirectTo.includes('?') ? '&' : '?'
    return redir(`${redirectTo}${sep}session_id=${sessionId}`)
  }

  // Session get
  if (p.startsWith('/api/session/')) {
    const id = p.split('/')[3]
    const s  = await getSession(env, id)
    if (!s) return json({ error: 'not found' }, 404)
    return json(s)
  }

  // Token refresh
  if (p === '/api/oauth/refresh' && req.method === 'POST') {
    const { refresh_token } = await req.json().catch(() => ({}))
    if (!refresh_token) return json({ error: 'No refresh_token' }, 400)
    const tokens = await googlePost('/token', {
      refresh_token, client_id: CLIENT_ID, client_secret: CLIENT_SEC,
      grant_type: 'refresh_token',
    })
    if (tokens.error) return json({ error: tokens.error_description || tokens.error }, 400)
    return json({ access_token: tokens.access_token, expires_in: tokens.expires_in || 3600 })
  }

  // Email login
  if (p === '/api/email-login' && req.method === 'POST') {
    const { email, password } = await req.json().catch(() => ({}))
    if (email !== ADMIN_EMAIL) return json({ error: 'Invalid credentials' }, 401)
    const ok = await checkPassword(env, password)
    if (!ok) return json({ error: 'Invalid credentials' }, 401)
    const sessionId = crypto.randomUUID().replace(/-/g,'')
    await saveSession(env, sessionId, {
      access_token: '', refresh_token: '', expires_in: 86400,
      user_name: 'Admin', user_email: ADMIN_EMAIL, user_picture: '',
    })
    return json({ session_id: sessionId, access_token: '',
                  user: { name:'Admin', email:ADMIN_EMAIL, picture:'' } })
  }

  // DataForSEO proxy
  if (p.startsWith('/api/dfs/') && req.method === 'POST') {
    const dfsPath = p.replace('/api/dfs/', '')
    const body = await req.text()
    const r = await fetch(`https://api.dataforseo.com/v3/${dfsPath}`, {
      method: 'POST',
      headers: { Authorization: `Basic ${DFS_AUTH}`, 'Content-Type': 'application/json' },
      body,
    })
    return json(await r.json())
  }

  return json({ error: 'Not found' }, 404)
}
