// server/index.cjs — SEO Dashboard API Server (no Supabase)
// Start: pm2 start server/index.cjs --name seo-api
const http = require('http'), https = require('https')
const fs = require('fs'), path = require('path'), crypto = require('crypto')

const PORT        = process.env.API_PORT || 3001
const CLIENT_ID   = process.env.GOOGLE_CLIENT_ID   || '543084749909-v88o8qoea0s1vh3etg1vbhkkm2b572d4.apps.googleusercontent.com'
const CLIENT_SEC  = process.env.GOOGLE_CLIENT_SEC  || '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'
const SERVER_URL  = (process.env.SERVER_URL || '').replace(/\/$/, '')
const SESSION_DB  = path.join(__dirname, 'sessions.json')

// ── admin email-login config (set in .env or hardcoded) ───────────
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'homevirtavo@gmail.com'
// Generate hash: node -e "const c=require('crypto');const k=c.pbkdf2Sync('YOUR_PASS','seo_dashboard_salt_2024',100000,32,'sha256');console.log('pbkdf2:'+k.toString('base64'))"
const ADMIN_HASH  = process.env.ADMIN_PASSWORD_HASH || ''

// ── Session storage (JSON file) ───────────────────────────────────
function readDB()  { try { return JSON.parse(fs.readFileSync(SESSION_DB,'utf-8')) } catch { return {} } }
function writeDB(d){ fs.writeFileSync(SESSION_DB, JSON.stringify(d)) }
function saveSession(id, data) { const db=readDB(); db[id]={...data,ts:Date.now()}; writeDB(db); return db[id] }
function getSession(id){ return readDB()[id] || null }

// ── Google OAuth helpers ──────────────────────────────────────────
const SCOPES = [
  'openid','email','profile',
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/analytics.readonly',
].join(' ')

function googlePost(path, params) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams(params).toString()
    const opts = { hostname:'oauth2.googleapis.com', path, method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(body)} }
    const req = https.request(opts, res => {
      let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ try{resolve(JSON.parse(d))}catch(e){reject(e)} })
    })
    req.on('error',reject); req.write(body); req.end()
  })
}

function googleGet(url, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const opts = { hostname:u.hostname, path:u.pathname+u.search, headers:{'Authorization':`Bearer ${token}`} }
    https.get(opts, res => {
      let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ try{resolve(JSON.parse(d))}catch(e){reject(e)} })
    }).on('error',reject)
  })
}

// ── DataForSEO helpers ────────────────────────────────────────────
const DFS_AUTH = Buffer.from('chloelee@puwell.com:a91b3259983a4853').toString('base64')
function dfsPost(p, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload)
    const opts = { hostname:'api.dataforseo.com', path:`/v3/${p}`, method:'POST',
      headers:{'Authorization':`Basic ${DFS_AUTH}`,'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)} }
    const req = https.request(opts, res => {
      let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ try{resolve(JSON.parse(d))}catch(e){reject(e)} })
    })
    req.on('error',reject); req.write(body); req.end()
  })
}

// ── Parse request body ────────────────────────────────────────────
function readBody(req) {
  return new Promise(resolve => { let d=''; req.on('data',c=>d+=c); req.on('end',()=>{ try{resolve(JSON.parse(d))}catch{resolve({})} }) })
}

function json(res, data, status=200) {
  res.writeHead(status, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'})
  res.end(JSON.stringify(data))
}

// ── Server ────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin','*')
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers','Content-Type')
  if (req.method==='OPTIONS') { res.writeHead(204); res.end(); return }

  const url = new URL(req.url, `http://localhost:${PORT}`)
  const pathname = url.pathname

  try {
    // ── GET /api/oauth/init?redirect_to=URL ───────────────────────
    if (pathname === '/api/oauth/init') {
      const redirectTo = url.searchParams.get('redirect_to') || `${SERVER_URL}/`
      const state = crypto.randomBytes(16).toString('hex')
      saveSession('state_'+state, { redirect_to: redirectTo, ts: Date.now() })
      const callbackUrl = `${SERVER_URL}/api/oauth/callback`
      const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
        client_id: CLIENT_ID, redirect_uri: callbackUrl,
        response_type: 'code', scope: SCOPES,
        access_type: 'offline', prompt: 'consent', state
      })
      res.writeHead(302, { Location: authUrl }); res.end(); return
    }

    // ── GET /api/oauth/callback?code=X&state=Y ────────────────────
    if (pathname === '/api/oauth/callback') {
      const code  = url.searchParams.get('code')
      const state = url.searchParams.get('state')
      const stateData = getSession('state_'+state)
      const redirectTo = stateData?.redirect_to || `${SERVER_URL}/`

      if (!code) { res.writeHead(302,{Location:`${redirectTo}?auth_error=no_code`}); res.end(); return }

      const tokens = await googlePost('/token', {
        code, client_id: CLIENT_ID, client_secret: CLIENT_SEC,
        redirect_uri: `${SERVER_URL}/api/oauth/callback`, grant_type: 'authorization_code'
      })
      if (tokens.error) { res.writeHead(302,{Location:`${redirectTo}?auth_error=token_exchange`}); res.end(); return }

      // Get user info
      const userInfo = await googleGet('https://www.googleapis.com/oauth2/v2/userinfo', tokens.access_token)

      const sessionId = crypto.randomBytes(20).toString('hex')
      saveSession(sessionId, {
        access_token: tokens.access_token, refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in || 3600,
        user_name: userInfo.name, user_email: userInfo.email, user_picture: userInfo.picture
      })

      const dest = redirectTo.includes('?')
        ? `${redirectTo}&session_id=${sessionId}`
        : `${redirectTo}?session_id=${sessionId}`
      res.writeHead(302, { Location: dest }); res.end(); return
    }

    // ── GET /api/session/:id ──────────────────────────────────────
    if (pathname.startsWith('/api/session/')) {
      const id = pathname.split('/')[3]
      const s = getSession(id)
      if (!s) { json(res,{error:'Not found'},404); return }
      json(res, s); return
    }

    // ── POST /api/oauth/refresh ───────────────────────────────────
    if (pathname === '/api/oauth/refresh' && req.method==='POST') {
      const { refresh_token } = await readBody(req)
      if (!refresh_token) { json(res,{error:'No refresh_token'},400); return }
      const tokens = await googlePost('/token', {
        refresh_token, client_id: CLIENT_ID, client_secret: CLIENT_SEC, grant_type: 'refresh_token'
      })
      if (tokens.error) { json(res,{error:tokens.error_description||tokens.error},400); return }
      json(res, { access_token: tokens.access_token, expires_in: tokens.expires_in || 3600 }); return
    }

    // ── POST /api/email-login ─────────────────────────────────────
    if (pathname === '/api/email-login' && req.method==='POST') {
      const { email, password } = await readBody(req)
      if (email !== ADMIN_EMAIL) { json(res,{error:'Invalid credentials'},401); return }
      // Verify PBKDF2 hash (same algo as frontend: salt='seo_dashboard_salt_2024', 100000 iter, sha256)
      const expected = crypto.pbkdf2Sync(
        password.replace(/^pbkdf2:/,''), 'seo_dashboard_salt_2024', 100000, 32, 'sha256'
      ).toString('base64')
      const incoming = password.replace(/^pbkdf2:/,'')
      // Accept either raw password or already-hashed
      const rawHash = crypto.pbkdf2Sync(incoming, 'seo_dashboard_salt_2024', 100000, 32, 'sha256').toString('base64')
      const storedHash = ADMIN_HASH.replace(/^pbkdf2:/,'')
      if (!ADMIN_HASH || rawHash !== storedHash) { json(res,{error:'Invalid credentials'},401); return }
      const sessionId = crypto.randomBytes(20).toString('hex')
      saveSession(sessionId, { user_email: email, user_name: 'Admin', access_token: 'email_login', refresh_token: '' })
      json(res, { session_id: sessionId, user: { email, name: 'Admin' } }); return
    }

    // ── POST /api/dfs ─────────────────────────────────────────────
    if (pathname === '/api/dfs' && req.method==='POST') {
      const { action, params } = await readBody(req)
      const { keywords=[], domain, target, locationCode:lc=2840, languageCode:lang='en', limit=100, targets } = params||{}
      let result

      if (action==='volume') {
        const d = await dfsPost('keywords_data/google_ads/search_volume/live', keywords.map(kw=>({keyword:kw,location_code:lc,language_code:lang})))
        result = (d.tasks?.[0]?.result||[]).map(r=>({keyword:r.keyword,volume:r.search_volume||0,cpc:r.cpc||0,competition:r.competition||0}))
      } else if (action==='difficulty') {
        const d = await dfsPost('dataforseo_labs/google/keyword_difficulty/live', keywords.map(kw=>({keyword:kw,location_code:lc,language_code:lang})))
        result = (d.tasks?.[0]?.result||[]).map(r=>({keyword:r.keyword,difficulty:r.keyword_difficulty||0}))
      } else if (action==='competitor-keywords') {
        const d = await dfsPost('dataforseo_labs/google/ranked_keywords/live',[{target:domain,location_code:lc,language_code:lang,limit,order_by:['etv,desc'],filters:['etv','>',0]}])
        result = (d.tasks?.[0]?.result?.[0]?.items||[]).map(i=>({keyword:i.keyword_data?.keyword,position:i.ranked_serp_element?.serp_item?.rank_absolute,url:i.ranked_serp_element?.serp_item?.url,volume:i.keyword_data?.keyword_info?.search_volume||0}))
      } else if (action==='domain-overview') {
        const d = await dfsPost('dataforseo_labs/google/domain_rank_overview/live',[{target:domain||target,location_code:lc,language_code:lang}])
        result = d.tasks?.[0]?.result?.[0]||{}
      } else if (action==='backlinks') {
        const d = await dfsPost('backlinks/backlinks/live',[{target:target||domain,limit,mode:'as_is',filters:['dofollow','=',true]}])
        result = (d.tasks?.[0]?.result?.[0]?.items||[]).map(i=>({source:i.url_from,target:i.url_to,anchor:i.anchor,domain_rank:i.domain_from_rank||0,dofollow:i.dofollow}))
      } else if (action==='backlinks-summary') {
        const d = await dfsPost('backlinks/summary/live',[{target:target||domain,include_subdomains:true}])
        result = d.tasks?.[0]?.result?.[0]||{}
      } else if (action==='keyword-ideas') {
        const d = await dfsPost('dataforseo_labs/google/keyword_ideas/live',[{keywords,location_code:lc,language_code:lang,limit}])
        result = (d.tasks?.[0]?.result?.[0]?.items||[]).map(i=>({keyword:i.keyword,volume:i.keyword_info?.search_volume||0,difficulty:i.keyword_properties?.keyword_difficulty||0,cpc:i.keyword_info?.cpc||0}))
      } else if (action==='keyword-gap') {
        const d = await dfsPost('dataforseo_labs/google/keyword_gap/live',[{targets:targets||[],location_code:lc||2840,language_code:lang||'en',limit:100,order_by:['etv,desc']}])
        result = d.tasks?.[0]?.result?.[0]?.items||[]
      } else if (action==='serp-features') {
        const {keyword} = params
        const d = await dfsPost('serp/google/organic/live/regular',[{keyword,location_code:lc,language_code:lang,depth:10}])
        result = {keyword, items:(d.tasks?.[0]?.result?.[0]?.items||[]).map(i=>({position:i.rank_absolute,url:i.url,title:i.title,type:i.type}))}
      } else { json(res,{error:'Unknown action'},400); return }

      json(res, result); return
    }

    res.writeHead(404); res.end('Not found')
  } catch(e) {
    json(res, {error:e.message}, 500)
  }
})

server.listen(PORT, () => console.log(`SEO API server on port ${PORT}`))
