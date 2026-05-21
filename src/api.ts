import { supabase } from '@/integrations/supabase/client'

const OAUTH_INIT_URL = 'https://grogrigybgimvuuunxef.supabase.co/functions/v1/oauth-callback?action=init&redirect_to='

// ── Auth ─────────────────────────────────────────────────────────
export const authApi = {
  signInWithGoogle: () => {
    const redirectTo = encodeURIComponent(window.location.origin + '/')
    window.location.href = OAUTH_INIT_URL + redirectTo
  },
  signOut: () => {
    sessionStorage.clear()
    window.location.reload()
  }
}

// ── Token refresh ─────────────────────────────────────────────────
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = sessionStorage.getItem('seo_refresh_token')
  const sessionId = sessionStorage.getItem('seo_session_id')
  if (!refreshToken) return null

  try {
    const { data, error } = await supabase.functions.invoke('token-refresh', {
      body: { session_id: sessionId, refresh_token: refreshToken }
    })
    if (error || !data?.access_token) return null
    sessionStorage.setItem('seo_token', data.access_token)
    // Set new expiry (subtract 5 min buffer)
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
    const { data, error } = await supabase
      .from('oauth_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()
    if (error || !data) return null
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
    if (expires && Date.now() >= expires - 900000) { // refresh if < 15min left
      refreshAccessToken() // async, non-blocking
    }
    return { access_token: token, user: JSON.parse(user) }
  }
  return null
}

// ── Edge Function helper ──────────────────────────────────────────
async function callEdge(fnName: string, body: any, providerToken?: string) {
  const headers: Record<string, string> = {}
  if (providerToken) headers['x-provider-token'] = providerToken
  const { data, error } = await supabase.functions.invoke(fnName, { body, headers })
  if (error) throw new Error(error.message)
  return data
}

// Auto-refreshing version for authenticated calls
async function callEdgeAuth(fnName: string, body: any) {
  let token = await getValidToken()
  const headers: Record<string, string> = { 'x-provider-token': token }
  const { data, error } = await supabase.functions.invoke(fnName, { body, headers })
  if (error) {
    // If 401, try one refresh
    if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
      const newToken = await refreshAccessToken()
      if (newToken) {
        headers['x-provider-token'] = newToken
        const retry = await supabase.functions.invoke(fnName, { body, headers })
        if (retry.error) throw new Error(retry.error.message)
        return retry.data
      }
    }
    throw new Error(error.message)
  }
  return data
}

// ── GSC API ───────────────────────────────────────────────────────
export const gscApi = {
  sites: (token: string) =>
    callEdge('gsc-proxy', { action: 'sites', params: {} }, token),
  keywords: (token: string, body: any) =>
    callEdge('gsc-proxy', { action: 'keywords', params: body }, token),
  keywordHistory: (token: string, body: any) =>
    callEdge('gsc-proxy', { action: 'keyword-history', params: body }, token),
  pages: (token: string, body: any) =>
    callEdge('gsc-proxy', { action: 'pages', params: body }, token),
  topPages: (token: string, body: any) =>
    callEdge('gsc-proxy', { action: 'top-pages', params: body }, token),
  opportunities: (token: string, body: any) =>
    callEdge('gsc-proxy', { action: 'opportunities', params: body }, token),
  sitemaps: (token: string, params: any) =>
    callEdge('gsc-proxy', { action: 'sitemaps', params }, token),
  urlInspect: (token: string, siteUrl: string, inspectionUrl: string) =>
    callEdge('gsc-proxy', { action: 'url-inspect', params: { siteUrl, inspectionUrl } }, token),
  callAction: (action: string, params: any, token: string) =>
    callEdge('gsc-proxy', { action, params }, token),
}

// ── GA4 API ───────────────────────────────────────────────────────
export const ga4Api = {
  listProperties: (token: string) =>
    callEdge('ga4-proxy', { action: 'list-properties', params: {} }, token),
  overview: (token: string, propertyId: string, startDate: string, endDate: string) =>
    callEdge('ga4-proxy', { action: 'overview', params: { propertyId, startDate, endDate } }, token),
  sessionsTrend: (token: string, propertyId: string, startDate: string, endDate: string) =>
    callEdge('ga4-proxy', { action: 'sessions-trend', params: { propertyId, startDate, endDate } }, token),
  topPages: (token: string, propertyId: string, startDate: string, endDate: string) =>
    callEdge('ga4-proxy', { action: 'top-pages', params: { propertyId, startDate, endDate } }, token),
  trafficSources: (token: string, propertyId: string, startDate: string, endDate: string) =>
    callEdge('ga4-proxy', { action: 'traffic-sources', params: { propertyId, startDate, endDate } }, token),
  devices: (token: string, propertyId: string, startDate: string, endDate: string) =>
    callEdge('ga4-proxy', { action: 'devices', params: { propertyId, startDate, endDate } }, token),
  countries: (token: string, propertyId: string, startDate: string, endDate: string) =>
    callEdge('ga4-proxy', { action: 'countries', params: { propertyId, startDate, endDate } }, token),
}

// ── DataForSEO API ────────────────────────────────────────────────
export const dfsApi = {
  volume: (body: any) => callEdge('dfs-proxy', { action: 'volume', params: body }),
  difficulty: (body: any) => callEdge('dfs-proxy', { action: 'difficulty', params: body }),
  competitorKeywords: (body: any) => callEdge('dfs-proxy', { action: 'competitor-keywords', params: body }),
  domainOverview: (body: any) => callEdge('dfs-proxy', { action: 'domain-overview', params: body }),
  backlinks: (body: any) => callEdge('dfs-proxy', { action: 'backlinks', params: body }),
  backlinksSummary: (body: any) => callEdge('dfs-proxy', { action: 'backlinks-summary', params: body }),
  keywordIdeas: (body: any) => callEdge('dfs-proxy', { action: 'keyword-ideas', params: body }),
  keywordGap: (body: any) => callEdge('dfs-proxy', { action: 'keyword-gap', params: body }),
  serpFeatures: (body: any) => callEdge('dfs-proxy', { action: 'serp-features', params: body }),
}

// ── CWV API ───────────────────────────────────────────────────────
export const cwvApi = {
  analyze: (url: string, strategy: 'mobile' | 'desktop' = 'mobile') =>
    callEdge('cwv-proxy', { url, strategy }),
  analyzeAll: (url: string) =>
    callEdge('cwv-proxy', { url, action: 'all' }),
}

// ── Helpers ───────────────────────────────────────────────────────
export function safeArr(r: any): any[] {
  if (Array.isArray(r)) return r
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

    const { data, error } = await supabase.functions.invoke('email-login', {
      body: { action: 'login', email, password: hash }
    })
    if (error) throw new Error(error.message)
    if (data?.error) throw new Error(data.error)
    return data
  }
}
