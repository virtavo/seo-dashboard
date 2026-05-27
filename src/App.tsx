import { useState, useEffect } from 'react'
import { authApi, gscApi, ga4Api, loadSession, safeArr, getValidToken, emailLoginApi } from './api'
import Rankings from './pages/Rankings'
import Opportunities from './pages/Opportunities'
import Competitors from './pages/Competitors'
import Backlinks from './pages/Backlinks'
import Trends from './pages/Trends'
import Overview from './pages/Overview'
import Analytics from './pages/Analytics'
import CoreWebVitals from './pages/CoreWebVitals'
import Coverage from './pages/Coverage'
import PagePerformance from './pages/PagePerformance'
import KeywordGap from './pages/KeywordGap'
import SerpFeatures from './pages/SerpFeatures'
import SEOActivity from './pages/SEOActivity'
import {
  BarChart2, Users, Link, LogOut, Search, LineChart,
  Zap, Gauge, FileSearch, Layers, GitCompare, Sparkles, TrendingUp,
  Globe, Activity
} from 'lucide-react'

const NAV = [
  { id: 'overview', label: 'Google Search Console', icon: Globe },
  { id: 'analytics', label: 'Analytics (GA4)', icon: LineChart },
  { id: 'divider1', label: '', icon: null },
  { id: 'rankings', label: 'Keyword Rankings', icon: BarChart2 },
  { id: 'opportunities', label: 'Opportunities', icon: Zap },
  { id: 'seo-activity', label: 'SEO Activity', icon: Activity },
  { id: 'divider2', label: '', icon: null },
  { id: 'cwv', label: 'Core Web Vitals', icon: Gauge },
  { id: 'coverage', label: 'Index Coverage', icon: FileSearch },
  { id: 'page-perf', label: 'Page Performance', icon: Layers },
  { id: 'divider3', label: '', icon: null },
  { id: 'keyword-gap', label: 'Keyword Gap', icon: GitCompare },
  { id: 'serp', label: 'SERP Features', icon: Sparkles },
  { id: 'divider4', label: '', icon: null },
  { id: 'competitors', label: 'Competitors', icon: Users },
  { id: 'backlinks', label: 'Backlinks', icon: Link },
  { id: 'divider5', label: '', icon: null },
  { id: 'trends', label: 'Google Trends', icon: TrendingUp },
]

export default function App() {
  const [user, setUser] = useState<any>(null)
  const [providerToken, setProviderToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')
  const [sites, setSites] = useState<any[]>([])
  const [siteUrl, setSiteUrl] = useState('')
  const [ga4Properties, setGa4Properties] = useState<any[]>([])
  const [ga4PropertyId, setGa4PropertyId] = useState('')
  const [ga4Error, setGa4Error] = useState('')
  const [loginMode, setLoginMode] = useState<'google'|'email'>('google')
  const [emailInput, setEmailInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  useEffect(() => {
    loadSession().then(session => {
      if (session?.access_token) {
        setProviderToken(session.access_token)
        const u = session.user || { name: session.user_name, email: session.user_email, picture: session.user_picture }
        setUser(u)
        loadSites(session.access_token)
        loadGA4(session.access_token)
      }
      setLoading(false)
    })
  }, [])

  const loadSites = async (token: string) => {
    try {
      const data = await gscApi.sites(token)
      const list = safeArr(data)
      setSites(list)
      if (list.length > 0) setSiteUrl(list[0].siteUrl)
    } catch (e: any) {
      const msg = String(e?.message || '')
      if (msg.includes('401') || msg.includes('expired') || msg.includes('UNAUTHENTICATED') || msg.includes('invalid_grant')) {
        // Token invalid/expired — clear session so user sees login screen
        sessionStorage.clear()
        setUser(null)
        setProviderToken('')
      }
      console.error('[loadSites]', e)
    }
  }

  const loadGA4 = async (token: string) => {
    try {
      setGa4Error('')
      const freshToken = await getValidToken() || token
      const data = await ga4Api.listProperties(freshToken)
      if (data?.error) {
        setGa4Error(data.error.includes('401') || data.error.includes('expired') ? 'token_expired' : data.error)
        return
      }
      const list = safeArr(data)
      setGa4Properties(list)
      if (list.length === 0) setGa4Error('no_properties')
      const saved = sessionStorage.getItem('seo_ga4_property')
      if (saved && list.find((p: any) => p.id === saved)) {
        setGa4PropertyId(saved)
      } else if (list.length > 0) {
        setGa4PropertyId(list[0].id)
        sessionStorage.setItem('seo_ga4_property', list[0].id)
      }
    } catch (e: any) {
      const msg = e.message || ''
      setGa4Error(msg.includes('401') || msg.includes('expired') ? 'token_expired' : 'api_error')
    }
  }

  const doEmailLogin = async () => {
    setLoginLoading(true); setLoginError('')
    try {
      const data = await emailLoginApi.login(emailInput, passwordInput)
      sessionStorage.setItem('seo_session_id', data.session_id)
      sessionStorage.setItem('seo_token', data.access_token)
      sessionStorage.setItem('seo_refresh_token', data.refresh_token || '')
      sessionStorage.setItem('seo_token_expires', String(Date.now() + 3000 * 1000))
      sessionStorage.setItem('seo_user', JSON.stringify(data.user))
      setUser(data.user); setProviderToken(data.access_token)
      loadSites(data.access_token); loadGA4(data.access_token)
    } catch(e:any) { setLoginError(e.message) } finally { setLoginLoading(false) }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f8fafc' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <p style={{ color: '#94a3b8', fontFamily: 'system-ui' }}>Loading...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  if (!user) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 32, background: 'linear-gradient(135deg, #f8fafc 0%, #ede9fe 100%)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 12 }}>
          <div style={{ width: 44, height: 44, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(99,102,241,0.35)' }}>
            <Search size={22} color="white" />
          </div>
          <span style={{ fontSize: 26, fontWeight: 800, color: '#1e293b', fontFamily: 'system-ui' }}>SEO Dashboard</span>
        </div>
        <p style={{ color: '#64748b', fontSize: 15, fontFamily: 'system-ui' }}>Powered by Google Search Console + Google Analytics + DataForSEO</p>
      </div>
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 36, width: 420, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <h2 style={{ fontWeight: 700, fontSize: 20, marginBottom: 6, color: '#1e293b', fontFamily: 'system-ui', textAlign: 'center' }}>Sign In</h2>
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 24, lineHeight: 1.6, fontFamily: 'system-ui', textAlign: 'center' }}>Access your SEO Dashboard</p>

        <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 10, padding: 3, marginBottom: 24, gap: 3 }}>
          {(['email','google'] as const).map(mode => (
            <button key={mode} onClick={() => { setLoginMode(mode); setLoginError('') }}
              style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'system-ui', transition: 'all 0.15s', background: loginMode === mode ? '#fff' : 'transparent', color: loginMode === mode ? '#6366f1' : '#64748b', boxShadow: loginMode === mode ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
              {mode === 'google' ? '🔑 Google' : '✉️ Email'}
            </button>
          ))}
        </div>

        {loginMode === 'email' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input type="email" placeholder="Email address" value={emailInput} onChange={e => setEmailInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !loginLoading && doEmailLogin()}
              style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #e2e8f0', borderRadius: 9, fontSize: 14, fontFamily: 'system-ui', outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => e.target.style.borderColor='#6366f1'} onBlur={e => e.target.style.borderColor='#e2e8f0'} />
            <input type="password" placeholder="Password" value={passwordInput} onChange={e => setPasswordInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !loginLoading && doEmailLogin()}
              style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #e2e8f0', borderRadius: 9, fontSize: 14, fontFamily: 'system-ui', outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => e.target.style.borderColor='#6366f1'} onBlur={e => e.target.style.borderColor='#e2e8f0'} />
            {loginError && <p style={{ color: '#ef4444', fontSize: 13, margin: 0, textAlign: 'center' }}>⚠️ {loginError}</p>}
            <button disabled={loginLoading || !emailInput || !passwordInput} onClick={doEmailLogin}
              style={{ width: '100%', background: loginLoading ? '#a5b4fc' : 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', padding: '13px', fontSize: 15, borderRadius: 10, border: 'none', cursor: loginLoading ? 'not-allowed' : 'pointer', fontWeight: 600, boxShadow: '0 4px 14px rgba(99,102,241,0.3)', fontFamily: 'system-ui', marginTop: 4 }}>
              {loginLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </div>
        ) : (
          <div>
            <button onClick={() => authApi.signInWithGoogle()}
              style={{ width: '100%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', padding: '13px', fontSize: 15, borderRadius: 10, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontWeight: 600, boxShadow: '0 4px 14px rgba(99,102,241,0.35)', fontFamily: 'system-ui' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Sign in with Google
            </button>
            <p style={{ color: '#94a3b8', fontSize: 12, marginTop: 14, fontFamily: 'system-ui', textAlign: 'center' }}>Read-only access · Google OAuth</p>
          </div>
        )}
      </div>
    </div>
  )

  const currentNav = NAV.find(n => n.id === tab)

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f1f5f9', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Sidebar */}
      <aside style={{ width: 220, background: '#ffffff', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', flexShrink: 0, boxShadow: '2px 0 8px rgba(0,0,0,0.04)' }}>
        {/* Logo */}
        <div style={{ padding: '18px 14px 14px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <img src="/logo-mark.png" alt="SEO Dashboard" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'contain' }} />
            <div>
              <p style={{ fontWeight: 800, fontSize: 13, color: '#1e293b', lineHeight: 1.2 }}>SEO Dashboard</p>
              <p style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1 }}>by ForeverDoodles</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto' }}>
          {NAV.map(n => {
            if (n.id.startsWith('divider')) return <div key={n.id} style={{ height: 1, background: '#f1f5f9', margin: '5px 4px' }} />
            const Icon = n.icon!
            const active = tab === n.id
            return (
              <button key={n.id} onClick={() => setTab(n.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px', borderRadius: 8, border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', fontWeight: active ? 600 : 400, fontSize: 13, background: active ? 'linear-gradient(135deg, #ede9fe, #e0e7ff)' : 'transparent', color: active ? '#6366f1' : '#64748b', transition: 'all 0.15s' }}>
                <Icon size={15} style={{ flexShrink: 0 }} />{n.label}
              </button>
            )
          })}
        </nav>

        {/* User */}
        <div style={{ padding: '10px 12px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
          {user?.picture
            ? <img src={user.picture} alt="" style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid #e2e8f0' }} />
            : <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'white' }}>{user?.email?.[0]?.toUpperCase()}</div>
          }
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name || user?.email}</p>
            <p style={{ fontSize: 10, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</p>
          </div>
          <button onClick={() => authApi.signOut()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, borderRadius: 6 }} title="Sign out"><LogOut size={14} /></button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {/* Header */}
        <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', letterSpacing: '-0.3px' }}>{currentNav?.label}</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* Site selector — shown on all GSC-based tabs */}
            {!['overview', 'analytics', 'serp', 'trends'].includes(tab) && sites.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Globe size={14} color="#6366f1" />
                <select
                  value={siteUrl}
                  onChange={e => setSiteUrl(e.target.value)}
                  style={{ height: 32, border: '1px solid #c7d2fe', borderRadius: 8, padding: '0 10px', fontSize: 12, fontWeight: 600, color: '#4338ca', background: '#eef2ff', cursor: 'pointer', outline: 'none', maxWidth: 260 }}
                >
                  {sites.map((s: any) => (
                    <option key={s.siteUrl} value={s.siteUrl}>
                      {s.siteUrl.replace(/https?:\/\//, '').replace(/\/$/, '')}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div style={{ background: '#dcfce7', color: '#16a34a', fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
              Live Data
            </div>
          </div>
        </div>

        {/* Pages */}
        {tab === 'overview' && (
          <Overview
            siteUrl={siteUrl}
            providerToken={providerToken}
            sites={sites}
            onSiteChange={setSiteUrl}
          />
        )}
        {tab === 'analytics' && (
          <Analytics
            providerToken={providerToken}
            ga4PropertyId={ga4PropertyId}
            ga4Properties={ga4Properties}
            ga4Error={ga4Error}
            onPropertyChange={(id: string) => {
              setGa4PropertyId(id)
              sessionStorage.setItem('seo_ga4_property', id)
            }}
          />
        )}
        {tab !== 'overview' && tab !== 'analytics' && !siteUrl ? (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 60, textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <Globe size={40} style={{ color: '#cbd5e1', margin: '0 auto 16px' }} />
            <p style={{ color: '#94a3b8', fontWeight: 500 }}>Please go to "Google Search Console" tab to select a site</p>
          </div>
        ) : (
          <>
            {tab === 'rankings' && <Rankings siteUrl={siteUrl} providerToken={providerToken} />}
            {tab === 'opportunities' && <Opportunities siteUrl={siteUrl} providerToken={providerToken} />}
            {tab === 'seo-activity' && <SEOActivity siteUrl={siteUrl} />}
            {tab === 'cwv' && <CoreWebVitals siteUrl={siteUrl} providerToken={providerToken} />}
            {tab === 'coverage' && <Coverage siteUrl={siteUrl} providerToken={providerToken} />}
            {tab === 'page-perf' && <PagePerformance siteUrl={siteUrl} providerToken={providerToken} ga4PropertyId={ga4PropertyId} />}
            {tab === 'keyword-gap' && <KeywordGap siteUrl={siteUrl} />}
            {tab === 'serp' && <SerpFeatures />}
            {tab === 'competitors' && <Competitors siteUrl={siteUrl} />}
            {tab === 'backlinks' && <Backlinks siteUrl={siteUrl} />}
            {tab === 'trends' && <Trends siteUrl={siteUrl} />}
          </>
        )}
      </main>
    </div>
  )
}
