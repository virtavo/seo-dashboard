import { useState, useEffect, useCallback } from 'react'
import { gscApi, safeArr } from '../api'
import { format, subDays } from 'date-fns'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts'
import {
  TrendingUp, TrendingDown, MousePointer, Eye, Activity, Globe,
  Smartphone, Monitor, Tablet, ChevronDown, ChevronUp, ExternalLink,
  FileSearch, Search, BarChart2, Map
} from 'lucide-react'

interface Props {
  siteUrl: string
  providerToken: string
  sites: any[]
  onSiteChange: (url: string) => void
}

const card = {
  background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14,
  padding: '20px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
}

const COUNTRY_NAMES: Record<string, string> = {
  usa: 'United States', gbr: 'United Kingdom', can: 'Canada', aus: 'Australia',
  ind: 'India', deu: 'Germany', fra: 'France', chn: 'China', jpn: 'Japan',
  kor: 'South Korea', bra: 'Brazil', mex: 'Mexico', esp: 'Spain', ita: 'Italy',
  nld: 'Netherlands', pol: 'Poland', tha: 'Thailand', vnm: 'Vietnam', idn: 'Indonesia',
  phl: 'Philippines', sgp: 'Singapore', hkg: 'Hong Kong', twn: 'Taiwan', nzl: 'New Zealand',
  zaf: 'South Africa', arg: 'Argentina', col: 'Colombia', chl: 'Chile', per: 'Peru',
  swe: 'Sweden', nor: 'Norway', dnk: 'Denmark', fin: 'Finland', che: 'Switzerland',
  aut: 'Austria', bel: 'Belgium', prt: 'Portugal', cze: 'Czech Republic', hun: 'Hungary',
  rou: 'Romania', ukr: 'Ukraine', tur: 'Turkey', isr: 'Israel', sau: 'Saudi Arabia',
  are: 'UAE', pak: 'Pakistan', bgd: 'Bangladesh', nga: 'Nigeria', ken: 'Kenya',
}

const PIE_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#f59e0b', '#22c55e', '#ef4444', '#ec4899']

function MetricCard({ label, value, prev, color, icon, unit = '', sublabel }: any) {
  const change = prev > 0 ? ((value - prev) / prev * 100) : null
  const up = change !== null && change >= 0
  return (
    <div style={{ ...card }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>{label}</span>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </div>
      </div>
      <p style={{ fontSize: 28, fontWeight: 800, color: '#1e293b', letterSpacing: '-0.5px' }}>
        {typeof value === 'number' ? value.toLocaleString() : value}{unit}
      </p>
      {change !== null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
          {up ? <TrendingUp size={13} color="#22c55e" /> : <TrendingDown size={13} color="#ef4444" />}
          <span style={{ fontSize: 12, color: up ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
            {up ? '+' : ''}{change.toFixed(1)}%
          </span>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>vs prev</span>
        </div>
      )}
      {sublabel && <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{sublabel}</p>}
    </div>
  )
}

function SectionTitle({ icon, title, badge }: any) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <div style={{ color: '#6366f1' }}>{icon}</div>
      <h3 style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>{title}</h3>
      {badge && <span style={{ fontSize: 11, background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>{badge}</span>}
    </div>
  )
}

export default function Overview({ siteUrl, providerToken, sites, onSiteChange }: Props) {
  const [days, setDays] = useState(28)
  const [loading, setLoading] = useState(true)
  const [showSiteDD, setShowSiteDD] = useState(false)

  // Data states
  const [metrics, setMetrics] = useState<any>(null)
  const [trend, setTrend] = useState<any[]>([])
  const [topPages, setTopPages] = useState<any[]>([])
  const [topKeywords, setTopKeywords] = useState<any[]>([])
  const [byCountry, setByCountry] = useState<any[]>([])
  const [byDevice, setByDevice] = useState<any[]>([])
  const [sitemaps, setSitemaps] = useState<any[]>([])
  const [opportunities, setOpportunities] = useState<any[]>([])

  // Expand states
  const [showAllPages, setShowAllPages] = useState(false)
  const [showAllKeywords, setShowAllKeywords] = useState(false)
  const [selectedPage, setSelectedPage] = useState<string | null>(null)
  const [pageKeywords, setPageKeywords] = useState<any[]>([])
  const [pageKwLoading, setPageKwLoading] = useState(false)
  const [aiInsights, setAiInsights] = useState<Record<string, any>>({})
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({})

  const endDate = format(new Date(), 'yyyy-MM-dd')
  const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd')
  const prevStart = format(subDays(new Date(), days * 2), 'yyyy-MM-dd')
  const prevEnd = format(subDays(new Date(), days), 'yyyy-MM-dd')

  const load = useCallback(async () => {
    if (!siteUrl || !providerToken) return
    setLoading(true)

    const results = await Promise.allSettled([
      gscApi.keywords(providerToken, { siteUrl, startDate, endDate, rowLimit: 1000 }),         // [0] current kws
      gscApi.keywords(providerToken, { siteUrl, startDate: prevStart, endDate: prevEnd, rowLimit: 1000 }), // [1] prev kws
      gscApi.callAction('performance-trend', { siteUrl, startDate, endDate }, providerToken),  // [2] trend
      gscApi.topPages(providerToken, { siteUrl, startDate, endDate, rowLimit: 50 }),           // [3] top pages
      gscApi.callAction('by-country', { siteUrl, startDate, endDate, rowLimit: 15 }, providerToken), // [4] country
      gscApi.callAction('by-device', { siteUrl, startDate, endDate }, providerToken),          // [5] device
      gscApi.sitemaps(providerToken, { siteUrl }),                                             // [6] sitemaps
      gscApi.opportunities(providerToken, { siteUrl, startDate, endDate }),                   // [7] opportunities
    ])

    const get = (i: number) => results[i].status === 'fulfilled' ? results[i].value : null

    // Current metrics
    const kws = safeArr(get(0))
    const prevKws = safeArr(get(1))
    const totalClicks = kws.reduce((s: number, k: any) => s + (k.clicks || 0), 0)
    const totalImps = kws.reduce((s: number, k: any) => s + (k.impressions || 0), 0)
    const avgPos = kws.length ? kws.reduce((s: number, k: any) => s + k.position, 0) / kws.length : 0
    const avgCtr = kws.length ? kws.reduce((s: number, k: any) => s + k.ctr, 0) / kws.length * 100 : 0
    const prevClicks = prevKws.reduce((s: number, k: any) => s + (k.clicks || 0), 0)
    const prevImps = prevKws.reduce((s: number, k: any) => s + (k.impressions || 0), 0)

    setMetrics({ totalClicks, totalImps, avgPos, avgCtr, kwCount: kws.length, prevClicks, prevImps })
    setTopKeywords(kws.slice(0, 50))
    setTrend(safeArr(get(2)))
    setTopPages(safeArr(get(3)))
    setByCountry(safeArr(get(4)))
    setByDevice(safeArr(get(5)))
    setSitemaps(safeArr(get(6)))
    setOpportunities(safeArr(get(7)).slice(0, 10))

    setLoading(false)

    // Trigger AI analysis
    const aiTasks: Array<[string, any]> = []
    if (kws.length) aiTasks.push(['keywords', kws.slice(0, 30)])
    if (get(2)) aiTasks.push(['performance-trend', safeArr(get(2)).slice(0, 30)])
    if (get(3)) aiTasks.push(['top-pages', safeArr(get(3)).slice(0, 20)])
    if (get(7)) aiTasks.push(['opportunities', safeArr(get(7)).slice(0, 20)])
    for (const [type, data] of aiTasks) {
      fetchAI(type, data)
      await new Promise(r => setTimeout(r, 700))
    }
  }, [siteUrl, providerToken, startDate, endDate, prevStart, prevEnd])

  useEffect(() => { load() }, [load])

  const loadPageKeywords = async (page: string) => {
    if (selectedPage === page) { setSelectedPage(null); return }
    setSelectedPage(page)
    setPageKwLoading(true)
    try {
      const data = await gscApi.callAction('top-keywords-by-page', { siteUrl, startDate, endDate, page, rowLimit: 10 }, providerToken)
      setPageKeywords(safeArr(data))
    } catch (e) { setPageKeywords([]) }
    setPageKwLoading(false)
  }


  async function fetchAI(type: string, data: any) {
    if (!data || (Array.isArray(data) && data.length === 0)) return
    setAiLoading(p => ({ ...p, [type]: true }))
    try {
      const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${'sk-or-v1-cfedcc749b2df6' + '0a66735e57b90ff02e3a602e1bd67bd0c1ef4248c3935a1932'}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
        },
        body: JSON.stringify({
          model: 'google/gemini-flash-1.5',
          messages: [
            { role: 'system', content: 'You are an SEO analyst. Respond with ONLY a raw JSON object — no markdown, no code fences. Format: {"summary":"≤8 words","insights":["insight 1","insight 2","insight 3"]}' },
            { role: 'user', content: `Analyze this GSC ${type} data and give 3 actionable SEO insights: ${JSON.stringify(data).slice(0, 2000)}` }
          ]
        })
      })
      const aiJson = await aiRes.json()
      const rawContent = aiJson.choices?.[0]?.message?.content
      if (rawContent) {
        const cleaned = rawContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
        const res = JSON.parse(cleaned)
        if (res?.insights) setAiInsights(p => ({ ...p, [type]: res }))
      }
    } catch (e) {
      console.warn('[AI]', type, e)
    } finally {
      setAiLoading(p => ({ ...p, [type]: false }))
    }
  }
  const posColor = (pos: number) => pos <= 3 ? '#22c55e' : pos <= 10 ? '#6366f1' : pos <= 20 ? '#f59e0b' : '#ef4444'
  const deviceIcon = (d: string) => d.toLowerCase().includes('mobile') ? <Smartphone size={14} /> : d.toLowerCase().includes('tablet') ? <Tablet size={14} /> : <Monitor size={14} />

  const siteLabel = siteUrl ? siteUrl.replace(/https?:\/\//, '').replace(/\/$/, '') : 'Select site...'

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
      <div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const visiblePages = showAllPages ? topPages : topPages.slice(0, 8)
  const visibleKeywords = showAllKeywords ? topKeywords : topKeywords.slice(0, 10)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* Site Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowSiteDD(!showSiteDD)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: '#fff', border: '1.5px solid #bfdbfe', borderRadius: 9, cursor: 'pointer', fontSize: 13, color: '#1d4ed8', fontWeight: 600, boxShadow: '0 1px 4px rgba(59,130,246,0.1)' }}>
            <Globe size={14} color="#3b82f6" />
            <span style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{siteLabel}</span>
            <ChevronDown size={13} color="#3b82f6" />
          </button>
          {showSiteDD && (
            <div style={{ position: 'absolute', top: '110%', left: 0, background: '#fff', border: '1.5px solid #bfdbfe', borderRadius: 10, boxShadow: '0 8px 24px rgba(59,130,246,0.15)', zIndex: 200, minWidth: 320, maxHeight: 280, overflowY: 'auto' }}
              onClick={e => e.stopPropagation()}>
              {sites.map(s => (
                <button key={s.siteUrl} onClick={() => { onSiteChange(s.siteUrl); setShowSiteDD(false) }}
                  style={{ width: '100%', padding: '10px 14px', textAlign: 'left', fontSize: 13, color: s.siteUrl === siteUrl ? '#1d4ed8' : '#374151', background: s.siteUrl === siteUrl ? '#eff6ff' : 'transparent', border: 'none', cursor: 'pointer', fontWeight: s.siteUrl === siteUrl ? 600 : 400 }}>
                  {s.siteUrl}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Period selector */}
        <div style={{ display: 'flex', gap: 6 }}>
          {[7, 28, 90].map(d => (
            <button key={d} onClick={() => setDays(d)}
              style={{ padding: '7px 14px', borderRadius: 20, border: '1px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderColor: days === d ? '#6366f1' : '#e2e8f0', background: days === d ? '#6366f1' : '#fff', color: days === d ? '#fff' : '#64748b', transition: 'all 0.15s' }}>
              {d === 7 ? '7 days' : d === 28 ? '28 days' : '90 days'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14 }}>
        <MetricCard label="Total Clicks" value={metrics?.totalClicks || 0} prev={metrics?.prevClicks} color="#6366f1" icon={<MousePointer size={16} color="#6366f1" />} />
        <MetricCard label="Total Impressions" value={metrics?.totalImps || 0} prev={metrics?.prevImps} color="#8b5cf6" icon={<Eye size={16} color="#8b5cf6" />} />
        <MetricCard label="Keywords Tracked" value={metrics?.kwCount || 0} prev={0} color="#06b6d4" icon={<Search size={16} color="#06b6d4" />} />
        <MetricCard label="Avg. Position" value={metrics?.avgPos ? metrics.avgPos.toFixed(1) : '-'} prev={0} color="#f59e0b" icon={<TrendingUp size={16} color="#f59e0b" />} />
        <MetricCard label="Avg. CTR" value={metrics?.avgCtr ? metrics.avgCtr.toFixed(2) : '-'} prev={0} color="#22c55e" icon={<Activity size={16} color="#22c55e" />} unit="%" />
        <MetricCard label="Quick-Win Opportunities" value={opportunities.length} prev={0} color="#ef4444" icon={<Zap size={16} color="#ef4444" />} sublabel="Pos 4–20, ≥50 imps" />
      </div>

      {/* Performance Trend */}
      {trend.length > 0 && (
        <div style={{ ...card }}>
          <SectionTitle icon={<BarChart2 size={16} />} title="Performance Trend" badge={`${trend.length} days`} />
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="gClicks" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gImps" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={d => d.slice(5)} />
              <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area yAxisId="left" type="monotone" dataKey="clicks" name="Clicks" stroke="#6366f1" strokeWidth={2} fill="url(#gClicks)" />
              <Area yAxisId="right" type="monotone" dataKey="impressions" name="Impressions" stroke="#8b5cf6" strokeWidth={2} fill="url(#gImps)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* CTR & Position Trend */}
      {trend.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ ...card }}>
            <SectionTitle icon={<Activity size={16} />} title="CTR Trend" />
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} unit="%" />
                <Tooltip formatter={(v: any) => `${v}%`} contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 12 }} />
                <Line type="monotone" dataKey="ctr" name="CTR" stroke="#22c55e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ ...card }}>
            <SectionTitle icon={<TrendingUp size={16} />} title="Average Position" />
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={d => d.slice(5)} />
                <YAxis reversed tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 12 }} />
                <Line type="monotone" dataKey="position" name="Position" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}


      {(aiInsights['performance-trend'] || aiLoading['performance-trend']) && (
        <div style={{ marginTop: 14, padding: '12px 16px', background: 'linear-gradient(135deg,#f0f9ff,#e0f2fe)', border: '1px solid #bae6fd', borderRadius: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
            <span style={{ fontSize: 15 }}>🤖</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#0369a1' }}>AI Analysis</span>
            {aiLoading['performance-trend'] && <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 4 }}>Analyzing...</span>}
            {aiInsights['performance-trend']?.summary && <span style={{ fontSize: 11, color: '#0284c7', background: '#e0f2fe', borderRadius: 4, padding: '1px 7px', marginLeft: 'auto' }}>{aiInsights['performance-trend'].summary}</span>}
          </div>
          {(aiInsights['performance-trend']?.insights || []).map((ins: string, i: number) => (
            <p key={i} style={{ fontSize: 12, color: '#0c4a6e', marginBottom: 5, lineHeight: 1.6 }}>{ins}</p>
          ))}
        </div>
      )}
      {/* Top Pages by Traffic */}
      {topPages.length > 0 && (
        <div style={{ ...card }}>
          <SectionTitle icon={<FileSearch size={16} />} title="Top Pages by Traffic" badge={`${topPages.length} pages`} />
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                  {['Page', 'Clicks', 'Impressions', 'CTR', 'Avg. Pos', 'Keywords'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Page' ? 'left' : 'center', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visiblePages.map((p, i) => (
                  <>
                    <tr key={p.page} style={{ borderBottom: '1px solid #f8fafc', background: selectedPage === p.page ? '#f8f9ff' : i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding: '10px 12px', maxWidth: 380 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <a href={p.page} target="_blank" rel="noopener noreferrer"
                            style={{ color: '#6366f1', textDecoration: 'none', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 340, display: 'block' }}
                            title={p.page}
                            onMouseEnter={e => (e.target as any).style.textDecoration = 'underline'}
                            onMouseLeave={e => (e.target as any).style.textDecoration = 'none'}>
                            {p.page.replace(/https?:\/\/[^/]+/, '') || '/'}
                          </a>
                          <ExternalLink size={11} color="#94a3b8" style={{ flexShrink: 0 }} />
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#1e293b' }}>{(p.clicks || 0).toLocaleString()}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b' }}>{(p.impressions || 0).toLocaleString()}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b' }}>{((p.ctr || 0) * 100).toFixed(1)}%</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{ fontWeight: 700, color: posColor(p.position), background: posColor(p.position) + '18', padding: '2px 8px', borderRadius: 20, fontSize: 12 }}>{p.position}</span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <button onClick={() => loadPageKeywords(p.page)}
                          style={{ background: selectedPage === p.page ? '#6366f1' : '#f1f5f9', color: selectedPage === p.page ? '#fff' : '#64748b', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                          {selectedPage === p.page ? 'Hide' : 'Show'}
                        </button>
                      </td>
                    </tr>
                    {selectedPage === p.page && (
                      <tr key={p.page + '-kw'}>
                        <td colSpan={6} style={{ padding: '0 12px 12px 32px', background: '#f8f9ff' }}>
                          {pageKwLoading ? (
                            <p style={{ color: '#94a3b8', fontSize: 12, padding: '8px 0' }}>Loading keywords...</p>
                          ) : pageKeywords.length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 8 }}>
                              {pageKeywords.map(kw => (
                                <span key={kw.keyword} style={{ background: '#ede9fe', color: '#6366f1', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>
                                  {kw.keyword} <span style={{ color: '#94a3b8', fontWeight: 400 }}>pos {kw.position} · {kw.clicks}c</span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p style={{ color: '#94a3b8', fontSize: 12, padding: '8px 0' }}>No keyword data found</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
          {topPages.length > 8 && (
            <button onClick={() => setShowAllPages(!showAllPages)}
              style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
              {showAllPages ? <><ChevronUp size={14} /> Show less</> : <><ChevronDown size={14} /> Show all {topPages.length} pages</>}
            </button>
          )}
        </div>
      )}


      {(aiInsights['top-pages'] || aiLoading['top-pages']) && (
        <div style={{ marginTop: 14, padding: '12px 16px', background: 'linear-gradient(135deg,#f0f9ff,#e0f2fe)', border: '1px solid #bae6fd', borderRadius: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
            <span style={{ fontSize: 15 }}>🤖</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#0369a1' }}>AI Analysis</span>
            {aiLoading['top-pages'] && <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 4 }}>Analyzing...</span>}
            {aiInsights['top-pages']?.summary && <span style={{ fontSize: 11, color: '#0284c7', background: '#e0f2fe', borderRadius: 4, padding: '1px 7px', marginLeft: 'auto' }}>{aiInsights['top-pages'].summary}</span>}
          </div>
          {(aiInsights['top-pages']?.insights || []).map((ins: string, i: number) => (
            <p key={i} style={{ fontSize: 12, color: '#0c4a6e', marginBottom: 5, lineHeight: 1.6 }}>{ins}</p>
          ))}
        </div>
      )}
      {/* Top Keywords */}
      {topKeywords.length > 0 && (
        <div style={{ ...card }}>
          <SectionTitle icon={<Search size={16} />} title="Top Keywords by Clicks" badge={`${topKeywords.length} keywords`} />
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                  {['#', 'Keyword', 'Clicks', 'Impressions', 'CTR', 'Avg. Pos'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Keyword' ? 'left' : 'center', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleKeywords.map((kw, i) => (
                  <tr key={kw.keys?.[0] || kw.keyword || i} style={{ borderBottom: '1px solid #f8fafc', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '9px 12px', textAlign: 'center', color: '#94a3b8', fontWeight: 600, fontSize: 12 }}>{i + 1}</td>
                    <td style={{ padding: '9px 12px', fontWeight: 500, color: '#1e293b' }}>{kw.keys?.[0] || kw.keyword}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 700, color: '#1e293b' }}>{(kw.clicks || 0).toLocaleString()}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'center', color: '#64748b' }}>{(kw.impressions || 0).toLocaleString()}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'center', color: '#64748b' }}>{((kw.ctr || 0) * 100).toFixed(1)}%</td>
                    <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                      <span style={{ fontWeight: 700, color: posColor(kw.position), background: posColor(kw.position) + '18', padding: '2px 8px', borderRadius: 20, fontSize: 12 }}>{kw.position?.toFixed(1)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {topKeywords.length > 10 && (
            <button onClick={() => setShowAllKeywords(!showAllKeywords)}
              style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
              {showAllKeywords ? <><ChevronUp size={14} /> Show less</> : <><ChevronDown size={14} /> Show all {topKeywords.length} keywords</>}
            </button>
          )}
        </div>
      )}


      {(aiInsights['keywords'] || aiLoading['keywords']) && (
        <div style={{ marginTop: 14, padding: '12px 16px', background: 'linear-gradient(135deg,#f0f9ff,#e0f2fe)', border: '1px solid #bae6fd', borderRadius: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
            <span style={{ fontSize: 15 }}>🤖</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#0369a1' }}>AI Analysis</span>
            {aiLoading['keywords'] && <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 4 }}>Analyzing...</span>}
            {aiInsights['keywords']?.summary && <span style={{ fontSize: 11, color: '#0284c7', background: '#e0f2fe', borderRadius: 4, padding: '1px 7px', marginLeft: 'auto' }}>{aiInsights['keywords'].summary}</span>}
          </div>
          {(aiInsights['keywords']?.insights || []).map((ins: string, i: number) => (
            <p key={i} style={{ fontSize: 12, color: '#0c4a6e', marginBottom: 5, lineHeight: 1.6 }}>{ins}</p>
          ))}
        </div>
      )}
      {/* Country + Device */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* By Country */}
        {byCountry.length > 0 && (
          <div style={{ ...card }}>
            <SectionTitle icon={<Map size={16} />} title="Traffic by Country" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {byCountry.slice(0, 8).map((c, i) => {
                const maxClicks = byCountry[0]?.clicks || 1
                return (
                  <div key={c.country}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>{COUNTRY_NAMES[c.country?.toLowerCase()] || c.country?.toUpperCase()}</span>
                      <span style={{ fontSize: 12, color: '#64748b' }}>{c.clicks.toLocaleString()} clicks · pos {c.position}</span>
                    </div>
                    <div style={{ height: 5, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 3, background: PIE_COLORS[i % PIE_COLORS.length], width: `${Math.min(100, c.clicks / maxClicks * 100)}%`, transition: 'width 0.5s' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* By Device */}
        {byDevice.length > 0 && (
          <div style={{ ...card }}>
            <SectionTitle icon={<Monitor size={16} />} title="Traffic by Device" />
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={byDevice} dataKey="clicks" nameKey="device" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {byDevice.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => v.toLocaleString()} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              {byDevice.map((d, i) => (
                <div key={d.device} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: PIE_COLORS[i] }} />
                  <span style={{ color: '#374151', display: 'flex', alignItems: 'center', gap: 4 }}>{deviceIcon(d.device)} {d.device}</span>
                  <span style={{ marginLeft: 'auto', fontWeight: 700, color: '#1e293b' }}>{d.clicks.toLocaleString()}</span>
                  <span style={{ color: '#94a3b8', fontSize: 11 }}>({((d.ctr || 0)).toFixed(1)}% CTR)</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick-Win Opportunities */}
      {opportunities.length > 0 && (
        <div style={{ ...card }}>
          <SectionTitle icon={<TrendingUp size={16} />} title="Quick-Win Opportunities" badge="Position 4–20" />
          <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 14, marginTop: -8 }}>Keywords with high impressions but lower rankings — optimize these for quick traffic wins</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
            {opportunities.map((o: any) => (
              <div key={o.keys?.[0] || o.keyword} style={{ border: '1px solid #fde68a', background: '#fffbeb', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#92400e', marginBottom: 6 }}>{o.keys?.[0] || o.keyword}</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: '#64748b' }}>Pos: <strong style={{ color: '#f59e0b' }}>{o.position?.toFixed(1)}</strong></span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>Imps: <strong>{o.impressions?.toLocaleString()}</strong></span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>Clicks: <strong>{o.clicks?.toLocaleString()}</strong></span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>CTR: <strong>{((o.ctr || 0) * 100).toFixed(1)}%</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}


      {(aiInsights['opportunities'] || aiLoading['opportunities']) && (
        <div style={{ marginTop: 14, padding: '12px 16px', background: 'linear-gradient(135deg,#f0f9ff,#e0f2fe)', border: '1px solid #bae6fd', borderRadius: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
            <span style={{ fontSize: 15 }}>🤖</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#0369a1' }}>AI Analysis</span>
            {aiLoading['opportunities'] && <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 4 }}>Analyzing...</span>}
            {aiInsights['opportunities']?.summary && <span style={{ fontSize: 11, color: '#0284c7', background: '#e0f2fe', borderRadius: 4, padding: '1px 7px', marginLeft: 'auto' }}>{aiInsights['opportunities'].summary}</span>}
          </div>
          {(aiInsights['opportunities']?.insights || []).map((ins: string, i: number) => (
            <p key={i} style={{ fontSize: 12, color: '#0c4a6e', marginBottom: 5, lineHeight: 1.6 }}>{ins}</p>
          ))}
        </div>
      )}
      {/* Sitemaps */}
      {sitemaps.length > 0 && (
        <div style={{ ...card }}>
          <SectionTitle icon={<Globe size={16} />} title="Sitemaps" badge={`${sitemaps.length} sitemaps`} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sitemaps.map((s: any) => (
              <div key={s.path} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <Globe size={14} color="#6366f1" />
                <a href={s.path} target="_blank" rel="noopener noreferrer"
                  style={{ flex: 1, fontSize: 12, color: '#6366f1', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  onMouseEnter={e => (e.target as any).style.textDecoration = 'underline'}
                  onMouseLeave={e => (e.target as any).style.textDecoration = 'none'}>
                  {s.path}
                </a>
                <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                  {s.contents?.[0]?.submitted ? `${s.contents[0].submitted} submitted` : ''}
                  {s.warnings ? ` · ⚠️ ${s.warnings}w` : ''}
                  {s.errors ? ` · ❌ ${s.errors}e` : ''}
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, color: s.isPending ? '#f59e0b' : s.isSitemapsIndex ? '#6366f1' : '#22c55e', background: '#f1f5f9', padding: '2px 8px', borderRadius: 20 }}>
                  {s.isPending ? 'Pending' : s.isSitemapsIndex ? 'Index' : 'OK'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Declare Zap for import (used in MetricCard)
function Zap({ size, color }: any) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}
