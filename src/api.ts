// ── Auth ─────────────────────────────────────────────────────────
const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')

export const authApi = {
  signInWithGoogle: () => {
    const redirectTo = encodeURIComponent(window.location.origin + '/')
    window.location.href = `${API_BASE}/api/oauth/init?redirect_to=${redirectTo}`
  },
  signOut: () => {
    sessionStorage.clear()
    window.location.reload()
  }
}

// ── Token refresh ─────────────────────────────────────────────────
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = sessionStorage.getItem('seo_refresh_token')
  if (!refreshToken) return null

  try {
    const r = await fetch(`${API_BASE}/api/oauth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    const data = await r.json()
    if (!r.ok || !data?.access_token) return null
    sessionStorage.setItem('seo_token', data.access_token)
    const expiresAt = Date.now() + ((data.expires_in || 3600) - 300) * 1000
    sessionStorage.setItem('seo_token_expires', String(expiresAt))
    return data.access_token
  } catch { return null }
}

// Get valid token (refresh if expired)
export async function getValidToken(): Promise<string> {
  const token = sessionStorage.getItem('seo_token') || ''
  const expiresAt = parseInt(sessionStorage.getItem('seo_token_expires') || '0')

  // If token is about to expire (< 5 min left), refresh proactively
  if (expiresAt && Date.now() >= expiresAt) {
    const newToken = await refreshAccessToken()
    return newToken || token
  }
  return token
}

// ── Session ───────────────────────────────────────────────────────
export async function loadSession() {
  const params = new URLSearchParams(window.location.search)
  const sessionId = params.get('session_id')
  const authError = params.get('auth_error')

  if (authError) {
    console.error('Auth error:', authError)
    window.history.replaceState({}, '', window.location.pathname)
    return null
  }

  if (sessionId) {
    window.history.replaceState({}, '', window.location.pathname)
    const r = await fetch(`${API_BASE}/api/session/${sessionId}`)
    if (!r.ok) return null
    const data = await r.json()
    if (!data || data.error) return null
    sessionStorage.setItem('seo_session_id', sessionId)
    sessionStorage.setItem('seo_refresh_token', data.refresh_token || '')
    sessionStorage.setItem('seo_user', JSON.stringify({
      name: data.user_name,
      email: data.user_email,
      picture: data.user_picture
    }))
    // Always refresh token on new session load to ensure freshness
    const refreshed = await refreshAccessToken()
    const finalToken = refreshed || data.access_token
    sessionStorage.setItem('seo_token', finalToken)
    sessionStorage.setItem('seo_token_expires', String(Date.now() + 3000 * 1000)) // 50min
    return { ...data, access_token: finalToken }
  }

  const token = sessionStorage.getItem('seo_token')
  const user = sessionStorage.getItem('seo_user')
  if (token && user) {
    // Check if token needs refresh (older than 45 min)
    const expires = parseInt(sessionStorage.getItem('seo_token_expires') || '0')
    // If token expired or expiry unknown, await refresh before returning
    if (!expires || Date.now() >= expires - 900000) {
      const refreshed = await refreshAccessToken()
      if (refreshed) return { access_token: refreshed, user: JSON.parse(user) }
      // Refresh failed — clear session so UI shows login screen
      sessionStorage.clear()
      return null
    }
    return { access_token: token, user: JSON.parse(user) }
  }
  return null
}

// ── GSC API（direct browser → Google Search Console API）────────────

// Helper: unpack GSC { rows:[{keys:[],clicks,impressions,ctr,position}] }
// and rename keys[i] to the named dimension props
function mapGscRows(d: any, dimProps: string[]): any[] {
  const rows: any[] = d?.rows ?? []
  return rows.map((row: any) => {
    const out: any = {
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
      ctr: row.ctr ?? 0,
      position: row.position ?? 0,
    }
    dimProps.forEach((prop, i) => { out[prop] = row.keys?.[i] ?? '' })
    return out
  })
}
const GSC = 'https://searchconsole.googleapis.com/webmasters/v3'

async function gscFetch(token: string, url: string, body?: any) {
  const r = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const d = await r.json()
  if (d.error) throw new Error(d.error.message || JSON.stringify(d.error))
  return d
}

export const gscApi = {
  sites: async (token: string) => {
    const d = await gscFetch(token, `${GSC}/sites`)
    return d.siteEntry || []
  },
  keywords: async (token: string, body: any) => {
    const d = await gscFetch(token, `${GSC}/sites/${encodeURIComponent(body.siteUrl)}/searchAnalytics/query`,
      { ...body, dimensions: ['query'] })
    return mapGscRows(d, ['keyword'])
  },
  keywordHistory: (token: string, body: any) =>
    gscFetch(token, `${GSC}/sites/${encodeURIComponent(body.siteUrl)}/searchAnalytics/query`, body),
  pages: (token: string, body: any) =>
    gscFetch(token, `${GSC}/sites/${encodeURIComponent(body.siteUrl)}/searchAnalytics/query`, body),
  topPages: async (token: string, body: any) => {
    const d = await gscFetch(token, `${GSC}/sites/${encodeURIComponent(body.siteUrl)}/searchAnalytics/query`,
      { ...body, dimensions: ['page'] })
    return mapGscRows(d, ['page'])
  },
  opportunities: async (token: string, body: any) => {
    const d = await gscFetch(token, `${GSC}/sites/${encodeURIComponent(body.siteUrl)}/searchAnalytics/query`,
      { ...body, dimensions: ['query'] })
    return mapGscRows(d, ['keyword'])
  },
  sitemaps: async (token: string, params: any) => {
    const d = await gscFetch(token, `${GSC}/sites/${encodeURIComponent(params.siteUrl)}/sitemaps`)
    return d.sitemap || []
  },
  urlInspect: (token: string, siteUrl: string, inspectionUrl: string) =>
    gscFetch(token,
      'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect',
      { inspectionUrl, siteUrl }
    ),
  // Fetch true aggregate totals (no dimension filter = matches GSC native UI)
  aggregate: async (token: string, params: any) => {
    const body = { startDate: params.startDate, endDate: params.endDate }
    const d = await gscFetch(token,
      `${GSC}/sites/${encodeURIComponent(params.siteUrl)}/searchAnalytics/query`, body)
    // Returns {rows:[{clicks,impressions,ctr,position}]} or {clicks,...} at top level
    const row = d.rows?.[0] ?? d
    return {
      clicks: row.clicks || d.clicks || 0,
      impressions: row.impressions || d.impressions || 0,
      ctr: row.ctr || d.ctr || 0,
      position: row.position || d.position || 0,
    }
  },
  callAction: async (action: string, params: any, token: string) => {
    // Generic fallback for any remaining callAction uses
    if (action === 'sites') return gscApi.sites(token)
    if (action === 'sitemaps') return gscApi.sitemaps(token, params)
    if (action === 'url-inspect') return gscApi.urlInspect(token, params.siteUrl, params.inspectionUrl)
    const dimMap: Record<string, string[]> = {
      'performance-trend': ['date'],
      'by-country': ['country'],
      'by-device': ['device'],
      'opportunities': ['query'],
      'top-keywords-by-page': ['query'],
    }
    const propMap: Record<string, string[]> = {
      'performance-trend': ['date'],
      'by-country': ['country'],
      'by-device': ['device'],
      'opportunities': ['keyword'],
      'top-keywords-by-page': ['keyword'],
    }
    const body = { ...params }
    if (dimMap[action] && !body.dimensions) body.dimensions = dimMap[action]
    const d = await gscFetch(token, `${GSC}/sites/${encodeURIComponent(params.siteUrl)}/searchAnalytics/query`, body)
    return mapGscRows(d, propMap[action] ?? ['keyword'])
  },
}

// ── GA4 API（direct browser → Google Analytics Data API）───────────
async function ga4Report(token: string, propertyId: string, body: any) {
  const r = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  )
  return r.json()
}

function prevPeriod(start: string, end: string) {
  const s = new Date(start), e = new Date(end)
  const days = Math.round((e.getTime() - s.getTime()) / 86400000)
  const pe = new Date(s); pe.setDate(pe.getDate() - 1)
  const ps = new Date(pe); ps.setDate(ps.getDate() - days)
  return { ps: ps.toISOString().split('T')[0], pe: pe.toISOString().split('T')[0] }
}

export const ga4Api = {
  listProperties: async (token: string) => {
    const r = await fetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries',
      { headers: { 'Authorization': `Bearer ${token}` } })
    const d = await r.json()
    if (d.error) throw new Error(d.error.message)
    const props: any[] = []
    ;(d.accountSummaries || []).forEach((acc: any) => {
      ;(acc.propertySummaries || []).forEach((p: any) => {
        props.push({ id: p.property.replace('properties/', ''), name: p.displayName, account: acc.displayName })
      })
    })
    return props
  },

  overview: async (token: string, propertyId: string, startDate: string, endDate: string) => {
    const { ps, pe } = prevPeriod(startDate, endDate)
    const d = await ga4Report(token, propertyId, {
      dateRanges: [{ startDate, endDate }, { startDate: ps, endDate: pe }],
      metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'screenPageViews' }, { name: 'bounceRate' }, { name: 'averageSessionDuration' }]
    })
    if (d.error) throw new Error(d.error.message)
    const cur = d.rows?.[0]?.metricValues || [], prev = d.rows?.[1]?.metricValues || []
    return {
      sessions: { value: parseInt(cur[0]?.value || '0'), prev: parseInt(prev[0]?.value || '0') },
      users: { value: parseInt(cur[1]?.value || '0'), prev: parseInt(prev[1]?.value || '0') },
      pageviews: { value: parseInt(cur[2]?.value || '0'), prev: parseInt(prev[2]?.value || '0') },
      bounceRate: { value: parseFloat((parseFloat(cur[3]?.value || '0') * 100).toFixed(1)), prev: parseFloat((parseFloat(prev[3]?.value || '0') * 100).toFixed(1)) },
      avgDuration: { value: parseFloat(parseFloat(cur[4]?.value || '0').toFixed(0)), prev: parseFloat(parseFloat(prev[4]?.value || '0').toFixed(0)) },
      conversions: { value: 0, prev: 0 }
    }
  },

  sessionsTrend: async (token: string, propertyId: string, startDate: string, endDate: string) => {
    const d = await ga4Report(token, propertyId, {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
      orderBys: [{ dimension: { dimensionName: 'date' } }]
    })
    if (d.error) throw new Error(d.error.message)
    return (d.rows || []).map((row: any) => ({
      date: row.dimensionValues[0].value,
      sessions: parseInt(row.metricValues[0].value),
      users: parseInt(row.metricValues[1].value)
    }))
  },

  topPages: async (token: string, propertyId: string, startDate: string, endDate: string) => {
    const d = await ga4Report(token, propertyId, {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
      metrics: [{ name: 'screenPageViews' }, { name: 'totalUsers' }, { name: 'averageSessionDuration' }, { name: 'bounceRate' }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }], limit: 50
    })
    if (d.error) throw new Error(d.error.message)
    return (d.rows || []).map((row: any) => ({
      path: row.dimensionValues[0].value, title: row.dimensionValues[1].value,
      pageviews: parseInt(row.metricValues[0].value), users: parseInt(row.metricValues[1].value),
      avgDuration: parseFloat(parseFloat(row.metricValues[2].value).toFixed(0)),
      bounceRate: parseFloat((parseFloat(row.metricValues[3].value) * 100).toFixed(1))
    }))
  },

  trafficSources: async (token: string, propertyId: string, startDate: string, endDate: string) => {
    for (const dim of ['sessionDefaultChannelGroup', 'sessionMedium', 'sessionSource']) {
      const d = await ga4Report(token, propertyId, {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: dim }],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }]
      })
      if (!d.error) return (d.rows || []).map((row: any) => ({
        channel: row.dimensionValues[0].value,
        sessions: parseInt(row.metricValues[0].value),
        users: parseInt(row.metricValues[1].value), conversions: 0
      }))
    }
    return []
  },

  devices: async (token: string, propertyId: string, startDate: string, endDate: string) => {
    for (const dim of ['deviceCategory', 'platform', 'operatingSystem']) {
      const d = await ga4Report(token, propertyId, {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: dim }],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }]
      })
      if (!d.error) return (d.rows || []).map((row: any) => ({
        device: row.dimensionValues[0].value,
        sessions: parseInt(row.metricValues[0].value),
        users: parseInt(row.metricValues[1].value)
      }))
    }
    return []
  },

  countries: async (token: string, propertyId: string, startDate: string, endDate: string) => {
    const d = await ga4Report(token, propertyId, {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'country' }],
      metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 20
    })
    if (d.error) throw new Error(d.error.message)
    return (d.rows || []).map((row: any) => ({
      country: row.dimensionValues[0].value,
      sessions: parseInt(row.metricValues[0].value),
      users: parseInt(row.metricValues[1].value)
    }))
  },
}

// ── DataForSEO API（via local Express proxy /api/dfs）────────────────
async function dfsCall(action: string, params: any) {
  const r = await fetch('/api/dfs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, params }),
  })
  if (!r.ok) throw new Error(`DFS proxy error: ${r.status}`)
  return r.json()
}

export const dfsApi = {
  volume: (body: any) => dfsCall('volume', body),
  difficulty: (body: any) => dfsCall('difficulty', body),
  competitorKeywords: (body: any) => dfsCall('competitor-keywords', body),
  domainOverview: (body: any) => dfsCall('domain-overview', body),
  backlinks: (body: any) => dfsCall('backlinks', body),
  backlinksSummary: (body: any) => dfsCall('backlinks-summary', body),
  keywordIdeas: (body: any) => dfsCall('keyword-ideas', body),
  keywordGap: (body: any) => dfsCall('keyword-gap', body),
  serpFeatures: (body: any) => dfsCall('serp-features', body),
}

// ── CWV API（direct → PageSpeed Insights API）───────────────────────
const PSI = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'

async function psiRun(url: string, strategy: string) {
  const r = await fetch(`${PSI}?url=${encodeURIComponent(url)}&strategy=${strategy}`)
  const d = await r.json()
  if (d.error) throw new Error(d.error.message)
  return d
}

export const cwvApi = {
  analyze: (url: string, strategy: 'mobile' | 'desktop' = 'mobile') =>
    psiRun(url, strategy),
  analyzeAll: async (url: string) => {
    const [mobile, desktop] = await Promise.all([psiRun(url, 'mobile'), psiRun(url, 'desktop')])
    return { mobile, desktop }
  },
}

// ── Helpers ───────────────────────────────────────────────────────
export function safeArr(r: any): any[] {
  if (Array.isArray(r)) return r
  if (Array.isArray(r?.rows)) return r.rows
  if (Array.isArray(r?.data)) return r.data
  return []
}
export function safeObj(r: any): any {
  if (r && typeof r === 'object' && !Array.isArray(r)) {
    if (r.data !== undefined) return r.data
    return r
  }
  return {}
}

// ── Email Login ───────────────────────────────────────────────────
export const emailLoginApi = {
  login: async (email: string, password: string) => {
    // PBKDF2 hash (must match Edge Function)
    const salt = 'seo_dashboard_salt_2024'
    const keyMaterial = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
    )
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 100000, hash: 'SHA-256' },
      keyMaterial, 256
    )
    const b64 = btoa(String.fromCharCode(...new Uint8Array(bits)))
    const hash = 'pbkdf2:' + b64

    const r = await fetch(`${API_BASE}/api/email-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: hash }),
    })
    const data = await r.json()
    if (!r.ok) throw new Error(data?.error || 'Login failed')
    return data
  }
}
