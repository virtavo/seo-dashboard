import React, { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { gscApi, getValidToken } from '@/api'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, FileText, Lightbulb, AlignLeft, Search, ChevronDown, ChevronUp, CheckCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react'

const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }
const COLORS = ['#6366f1','#22c55e','#f59e0b','#06b6d4','#ec4899','#8b5cf6','#ef4444','#14b8a6']

function deriveKwSite(siteUrl: string): string {
  if (!siteUrl) return ''
  const scMatch = siteUrl.match(/^sc-domain:(.+)$/)
  if (scMatch) return `https://www.${scMatch[1]}/`
  return siteUrl.endsWith('/') ? siteUrl : siteUrl + '/'
}
function deriveOptSite(siteUrl: string): string {
  if (!siteUrl) return ''
  const scMatch = siteUrl.match(/^sc-domain:(.+)$/)
  if (scMatch) return scMatch[1]
  try { return new URL(siteUrl).hostname.replace(/^www\./, '') } catch { return siteUrl }
}
function badgeLabel(siteUrl: string): string {
  if (!siteUrl) return ''
  const scMatch = siteUrl.match(/^sc-domain:(.+)$/)
  if (scMatch) return scMatch[1]
  try { return new URL(siteUrl).hostname } catch { return siteUrl }
}

// ── Articles registry: keyed by site domain ──────────────────────
// Add new sites/articles here without touching component logic
const ARTICLES_REGISTRY: Record<string, Array<{
  id: number; title: string; slug: string; keyword: string;
  secondary: string[]; product: string; file: string; status: string; date: string;
}>> = {
  // ── showmo365.com ──────────────────────────────────────────────
  'showmo365.com': [
    { id: 1, title: 'Best Long-Range Security Camera with No Monthly Fees (2026 Guide)', slug: '/blog/long-range-security-camera-no-monthly-fee/', keyword: 'long range security camera no monthly fee', secondary: ['wifi halow security camera','1 mile range security camera','remote security camera no cell service'], product: 'MileFlask', file: 'showmo_article1_wordpress.html', status: 'ready', date: '2026-05-27' },
    { id: 2, title: 'Window Mounted Security Camera: The Complete Guide (2026)',           slug: '/blog/window-mounted-security-camera-guide/',          keyword: 'window mounted security camera',              secondary: ['glass mounted camera','indoor security camera outdoor view','security camera through window'],                product: 'WinEye',    file: 'showmo_article2_wordpress.html', status: 'ready', date: '2026-05-27' },
    { id: 3, title: 'Why Glass-Mounted Security Cameras Are Booming in 2026',             slug: '/blog/why-glass-mounted-security-cameras-are-growing/', keyword: 'glass mounted camera',                        secondary: ['window mounted security camera','no drill security camera','rental apartment security camera'],            product: 'WinEye',    file: 'showmo_article3_wordpress.html', status: 'ready', date: '2026-05-27' },
    { id: 4, title: 'Best Security Camera for Renters: No Drilling, No Permission Needed (2026)', slug: '/blog/best-security-camera-for-renters/', keyword: 'security camera for renters',               secondary: ['apartment security camera no drilling','no drill security camera','window security camera apartment'], product: 'WinEye',    file: 'showmo_article4_wordpress.html', status: 'ready', date: '2026-05-27' },
    { id: 5, title: 'Wi-Fi HaLow Security Camera: The Complete 2026 Guide (802.11ah)',    slug: '/blog/wifi-halow-security-camera-guide/',               keyword: 'wifi halow security camera',                secondary: ['802.11ah security camera','long range wifi security camera','halow camera system'],                      product: 'MileFlask', file: 'showmo_article5_wordpress.html', status: 'ready', date: '2026-05-27' },
  ],
  // ── virtavo.com ────────────────────────────────────────────────
  'virtavo.com': [
    // Articles will be added here as they are written
    // Example format:
    // { id: 1, title: '...', slug: '/blog/.../', keyword: '...', secondary: ['...'], product: 'EggSentry', file: 'virtavo_article1_wordpress.html', status: 'ready', date: '2026-05-27' },
  ],
}

function deriveSiteDomain(siteUrl: string): string {
  if (!siteUrl) return ''
  const scMatch = siteUrl.match(/^sc-domain:(.+)$/)
  if (scMatch) return scMatch[1].replace(/^www\./, '')
  try { return new URL(siteUrl).hostname.replace(/^www\./, '') } catch { return siteUrl }
}

interface SEOActivityProps { siteUrl?: string }

export default function SEOActivity({ siteUrl = '' }: SEOActivityProps) {
  const [activeTab, setActiveTab] = useState<'trends' | 'log' | 'articles'>('trends')
  const [keywords, setKeywords] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [optimizations, setOptimizations] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedKws, setSelectedKws] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  // Articles tab state — MUST be at component level (not inside render/IIFE)
  const [articleExpId, setArticleExpId] = useState<number | null>(null)
  const [articleStats, setArticleStats] = useState<Record<string, { clicks: number; impressions: number; position: number; ctr: number }>>({})
  const [articleStatsLoading, setArticleStatsLoading] = useState(false)
  const [articleStatsError, setArticleStatsError] = useState<string | null>(null)

  const kwSite  = deriveKwSite(siteUrl)
  const optSite = deriveOptSite(siteUrl)

  useEffect(() => { loadData() }, [siteUrl])

  useEffect(() => {
    if (activeTab === 'articles' && siteUrl && Object.keys(articleStats).length === 0 && !articleStatsLoading) {
      fetchArticleStats()
    }
  }, [activeTab, siteUrl])

  const loadData = async () => {
    setLoading(true)
    try {
      const [kwRes, histRes, optRes] = await Promise.all([
        supabase
          .from('keyword_tracking')
          .select('keyword, current_position, previous_position, clicks, impressions, ctr, last_checked, is_active, position_change')
          .eq('site_domain', kwSite)
          .eq('is_active', true)
          .order('current_position', { ascending: true, nullsFirst: false }),
        supabase
          .from('keyword_tracking_history')
          .select('keyword, position, impressions, clicks, recorded_at, date_range_start')
          .eq('site_domain', kwSite)
          .not('position', 'is', null)
          .order('recorded_at', { ascending: true }),
        supabase
          .from('blog_seo_optimizations')
          .select('id, slug, title, original_excerpt, optimized_excerpt, target_keywords, meta_description, ai_suggestions, status, created_at')
          .ilike('site_domain', `%${optSite}%`)
          .order('created_at', { ascending: false })
      ])
      setKeywords(kwRes.data || [])
      setHistory(histRes.data || [])
      setOptimizations(optRes.data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const fetchArticleStats = async () => {
    if (!siteUrl) return
    setArticleStatsLoading(true)
    setArticleStatsError(null)
    try {
      const token = await getValidToken()
      if (!token) { setArticleStatsError('Not authenticated'); return }
      const endDate = new Date().toISOString().slice(0, 10)
      const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const rows = await gscApi.topPages(token, { siteUrl, startDate, endDate, rowLimit: 500 })
      const stats: Record<string, any> = {}
      rows.forEach((row: any) => {
        try {
          const path = new URL(row.page).pathname
          stats[path] = { clicks: row.clicks, impressions: row.impressions, position: row.position, ctr: row.ctr }
        } catch {
          stats[row.page] = { clicks: row.clicks, impressions: row.impressions, position: row.position, ctr: row.ctr }
        }
      })
      setArticleStats(stats)
    } catch (e: any) {
      console.error('Article stats fetch failed:', e)
      setArticleStatsError(e?.message || 'Failed to load GSC data')
    } finally {
      setArticleStatsLoading(false)
    }
  }

  const buildChartData = () => {
    const kwsToShow = selectedKws.length > 0 ? selectedKws : keywords.filter(k => k.current_position).slice(0, 5).map((k: any) => k.keyword)
    const dateMap: Record<string, Record<string, number>> = {}
    history
      .filter((h: any) => kwsToShow.includes(h.keyword) && h.position)
      .forEach((h: any) => {
        const date = h.date_range_start?.slice(0, 10) || h.recorded_at?.slice(0, 10)
        if (!dateMap[date]) dateMap[date] = {}
        dateMap[date][h.keyword] = parseFloat(parseFloat(h.position).toFixed(1))
      })
    return Object.entries(dateMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({ date, ...vals }))
  }

  const chartData = buildChartData()
  const kwsWithPos = keywords.filter(k => k.current_position)
  const kwsToShow = selectedKws.length > 0 ? selectedKws : kwsWithPos.slice(0, 5).map((k: any) => k.keyword)
  const filteredKws = keywords.filter(k => k.keyword.toLowerCase().includes(search.toLowerCase()))
  const toggleKw = (kw: string) =>
    setSelectedKws(prev => prev.includes(kw) ? prev.filter(k => k !== kw) : [...prev, kw].slice(0, 8))
  const improved = keywords.filter(k => k.position_change != null && k.position_change > 0).length
  const declined = keywords.filter(k => k.position_change != null && k.position_change < 0).length
  const pColor: Record<string, string> = { MileFlask: '#6366f1', WinEye: '#06b6d4', EggSentry: '#f59e0b', XD1: '#8b5cf6' }

  // Derive articles for the current site
  const siteDomain = deriveSiteDomain(siteUrl)
  const ARTICLES = ARTICLES_REGISTRY[siteDomain] ?? []
  const wpAdminUrl = siteUrl
    ? `https://${siteDomain}/wp-admin/`
    : 'https://www.showmo365.com/wp-admin/'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 20, padding: '4px 12px', alignSelf: 'flex-start' }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: '#16a34a' }}>{badgeLabel(siteUrl)}</span>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        {[['trends', '📈 Keyword Trends'], ['log', '📋 SEO Optimization Log'], ['articles', '📝 Blog Articles']].map(([v, l]) => (
          <button key={v} onClick={() => setActiveTab(v as any)}
            style={{ padding: '7px 18px', borderRadius: 20, border: '1px solid', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              borderColor: activeTab === v ? '#6366f1' : '#e2e8f0',
              background: activeTab === v ? '#6366f1' : '#fff',
              color: activeTab === v ? '#fff' : '#64748b' }}>
            {l}
          </button>
        ))}
      </div>

      {/* ── TRENDS TAB ── */}
      {activeTab === 'trends' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
            {[
              { label: 'Tracked Keywords', value: keywords.length, color: '#6366f1', bg: '#ede9fe' },
              { label: 'Ranked (have position)', value: kwsWithPos.length, color: '#2563eb', bg: '#dbeafe' },
              { label: 'Improved ↑', value: improved, color: '#16a34a', bg: '#dcfce7' },
              { label: 'Declined ↓', value: declined, color: '#ef4444', bg: '#fef2f2' },
            ].map(s => (
              <div key={s.label} style={{ ...card, padding: '16px 18px' }}>
                <p style={{ fontSize: 12, color: '#64748b', fontWeight: 500, marginBottom: 8 }}>{s.label}</p>
                <p style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>
          <div style={{ ...card, padding: '20px 22px' }}>
            <h3 style={{ fontWeight: 700, fontSize: 15, color: '#1e293b', marginBottom: 4 }}>Position History</h3>
            <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 14 }}>Lower = better. Click keywords in table below to add to chart (max 8).</p>
            {chartData.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: 40, fontSize: 13 }}>
                No history data with positions yet — GSC sync runs weekly (Mon UTC 02:00).<br />
                Only keywords that appear in GSC will have position data.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis reversed domain={['auto','auto']} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 12 }}
                    formatter={(v: any, n: string) => [`#${v}`, n]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {kwsToShow.map((kw, i) => (
                    <Line key={kw} type="monotone" dataKey={kw} name={kw}
                      stroke={COLORS[i % COLORS.length]} strokeWidth={2}
                      dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          <div style={{ ...card, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 10, alignItems: 'center', background: '#fafafa' }}>
              <h3 style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', flex: 1 }}>Current vs Previous Position</h3>
              <div style={{ position: 'relative' }}>
                <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter..."
                  style={{ paddingLeft: 28, height: 32, width: 160, border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, color: '#374151', outline: 'none' }} />
              </div>
            </div>
            <div style={{ overflowX: 'auto', maxHeight: 440, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f8fafc' }}>
                  <tr>
                    {['', 'Keyword', 'Current Pos', 'Previous Pos', 'Change', 'Clicks', 'Impressions', 'Last Synced'].map(h => (
                      <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f1f5f9' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>Loading...</td></tr>
                  ) : filteredKws.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>No keyword data yet</td></tr>
                  ) : filteredKws.map((row: any, i: number) => {
                    const selected = selectedKws.includes(row.keyword) || (selectedKws.length === 0 && i < 5)
                    const delta = row.position_change
                    return (
                      <tr key={row.keyword} onClick={() => toggleKw(row.keyword)}
                        style={{ borderBottom: '1px solid #f8fafc', cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f0f4ff')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '9px 14px' }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: selected ? COLORS[kwsToShow.indexOf(row.keyword) % COLORS.length] : '#e2e8f0' }} />
                        </td>
                        <td style={{ padding: '9px 14px', fontWeight: 600, color: '#374151', maxWidth: 220 }}>{row.keyword}</td>
                        <td style={{ padding: '9px 14px' }}>
                          {row.current_position
                            ? <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                                background: row.current_position <= 3 ? '#dcfce7' : row.current_position <= 10 ? '#dbeafe' : '#f8fafc',
                                color: row.current_position <= 3 ? '#16a34a' : row.current_position <= 10 ? '#2563eb' : '#94a3b8' }}>
                                #{parseFloat(row.current_position).toFixed(0)}
                              </span>
                            : <span style={{ color: '#94a3b8', fontSize: 12 }}>Not ranked</span>}
                        </td>
                        <td style={{ padding: '9px 14px', color: '#94a3b8', fontSize: 12 }}>
                          {row.previous_position ? `#${parseFloat(row.previous_position).toFixed(0)}` : '—'}
                        </td>
                        <td style={{ padding: '9px 14px' }}>
                          {delta == null ? <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                            : delta > 0 ? <span style={{ color: '#16a34a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}><TrendingUp size={13} />+{parseFloat(delta).toFixed(0)}</span>
                            : delta < 0 ? <span style={{ color: '#ef4444', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}><TrendingDown size={13} />{parseFloat(delta).toFixed(0)}</span>
                            : <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 3 }}><Minus size={13} />0</span>}
                        </td>
                        <td style={{ padding: '9px 14px', color: '#374151', fontWeight: 600 }}>{row.clicks?.toLocaleString() ?? '—'}</td>
                        <td style={{ padding: '9px 14px', color: '#64748b' }}>{row.impressions?.toLocaleString() ?? '—'}</td>
                        <td style={{ padding: '9px 14px', color: '#94a3b8', fontSize: 11 }}>{row.last_checked?.slice(0, 10) ?? '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── SEO LOG TAB ── */}
      {activeTab === 'log' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
            {[
              { label: 'Optimized Articles', value: optimizations.length, color: '#6366f1', bg: '#ede9fe', icon: <FileText size={16} color="#6366f1" /> },
              { label: 'With AI Suggestions', value: optimizations.filter((o: any) => o.ai_suggestions).length, color: '#16a34a', bg: '#dcfce7', icon: <Lightbulb size={16} color="#16a34a" /> },
              { label: 'With Meta Description', value: optimizations.filter((o: any) => o.meta_description).length, color: '#d97706', bg: '#fef3c7', icon: <AlignLeft size={16} color="#d97706" /> },
            ].map(s => (
              <div key={s.label} style={{ ...card, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.icon}</div>
                <div>
                  <p style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>{s.label}</p>
                  <p style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</p>
                </div>
              </div>
            ))}
          </div>
          <div style={{ ...card, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
              <h3 style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>Blog SEO Optimizations</h3>
              <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Target keywords, optimized excerpts and AI suggestions per article</p>
            </div>
            {loading ? (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>Loading...</div>
            ) : (
              <div style={{ maxHeight: 600, overflowY: 'auto' }}>
                {optimizations.map((opt: any) => (
                  <div key={opt.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <div onClick={() => setExpandedRow(expandedRow === opt.id ? null : opt.id)}
                      style={{ padding: '12px 18px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 12 }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#fafafe')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                          <span style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>{opt.title || opt.slug}</span>
                          {opt.status && (
                            <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                              background: opt.status === 'applied' ? '#dcfce7' : '#fef9c3',
                              color: opt.status === 'applied' ? '#16a34a' : '#ca8a04' }}>
                              {opt.status}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {(Array.isArray(opt.target_keywords) ? opt.target_keywords.slice(0, 3) : []).map((kw: string) => (
                            <span key={kw} style={{ padding: '1px 7px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: '#ede9fe', color: '#6366f1' }}>{kw}</span>
                          ))}
                        </div>
                        {opt.optimized_excerpt && (
                          <p style={{ fontSize: 11, color: '#64748b', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '90%' }}>
                            {opt.optimized_excerpt}
                          </p>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>{opt.created_at?.slice(0, 10)}</span>
                        {expandedRow === opt.id ? <ChevronUp size={14} color="#94a3b8" /> : <ChevronDown size={14} color="#94a3b8" />}
                      </div>
                    </div>
                    {expandedRow === opt.id && (
                      <div style={{ padding: '0 18px 16px', background: '#fafafa', borderTop: '1px solid #f1f5f9' }}>
                        {opt.meta_description && (
                          <div style={{ marginTop: 10 }}>
                            <p style={{ fontSize: 11, fontWeight: 600, color: '#2563eb', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Meta Description</p>
                            <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.6 }}>{opt.meta_description}</p>
                          </div>
                        )}
                        {opt.optimized_excerpt && (
                          <div style={{ marginTop: 10 }}>
                            <p style={{ fontSize: 11, fontWeight: 600, color: '#16a34a', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Optimized Excerpt</p>
                            <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.6 }}>{opt.optimized_excerpt}</p>
                          </div>
                        )}
                        {opt.ai_suggestions && (
                          <div style={{ marginTop: 10 }}>
                            <p style={{ fontSize: 11, fontWeight: 600, color: '#6366f1', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Suggestions</p>
                            <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                              {typeof opt.ai_suggestions === 'string' ? opt.ai_suggestions : JSON.stringify(opt.ai_suggestions, null, 2)}
                            </p>
                          </div>
                        )}
                        {opt.target_keywords?.length > 0 && (
                          <div style={{ marginTop: 10 }}>
                            <p style={{ fontSize: 11, fontWeight: 600, color: '#d97706', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>All Target Keywords</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {opt.target_keywords.map((kw: string) => (
                                <span key={kw} style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#fef3c7', color: '#d97706' }}>{kw}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── BLOG ARTICLES TAB ── */}
      {activeTab === 'articles' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
            {[
              { label: 'Total Articles',          value: ARTICLES.length,                                                                             color: '#6366f1', bg: '#ede9fe' },
              { label: 'Ready to Publish',         value: ARTICLES.filter(a => a.status === 'ready').length,                                          color: '#16a34a', bg: '#dcfce7' },
              { label: 'Indexed by Google',        value: ARTICLES.filter(a => (articleStats[a.slug]?.impressions ?? 0) > 0).length,                  color: '#0891b2', bg: '#e0f2fe' },
              { label: 'Total GSC Clicks (90d)',   value: ARTICLES.reduce((sum, a) => sum + (articleStats[a.slug]?.clicks ?? 0), 0),                  color: '#d97706', bg: '#fef3c7' },
            ].map(s => (
              <div key={s.label} style={{ ...card, padding: '16px 18px' }}>
                <p style={{ fontSize: 12, color: '#64748b', fontWeight: 500, marginBottom: 8 }}>{s.label}</p>
                <p style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          <div style={{ ...card, padding: '14px 18px', background: '#f8faff', border: '1px solid #e0e7ff' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#6366f1', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Target Keywords Coverage</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {ARTICLES.map(a => {
                const kwData = keywords.find(k => k.keyword.toLowerCase() === a.keyword.toLowerCase())
                return (
                  <span key={a.id} style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: pColor[a.product] + '18', color: pColor[a.product], border: `1px solid ${pColor[a.product]}30`, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    🎯 {a.keyword}
                    {kwData?.current_position
                      ? <span style={{ background: pColor[a.product], color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 800 }}>#{Math.round(kwData.current_position)}</span>
                      : <span style={{ background: '#e2e8f0', color: '#94a3b8', borderRadius: 10, padding: '1px 6px', fontSize: 10 }}>not ranked</span>
                    }
                  </span>
                )
              })}
            </div>
          </div>

          <div style={{ ...card, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>WordPress Blog Articles</h3>
                <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>GSC 数据来自近 90 天 · 点击行展开查看详细关键词策略与流量</p>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {articleStatsLoading && (
                  <span style={{ fontSize: 11, color: '#6366f1', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <RefreshCw size={12} /> Loading GSC…
                  </span>
                )}
                {articleStatsError && !articleStatsLoading && (
                  <span style={{ fontSize: 11, color: '#ef4444' }}>⚠ {articleStatsError}</span>
                )}
                <button onClick={fetchArticleStats} disabled={articleStatsLoading}
                  style={{ fontSize: 12, fontWeight: 600, color: '#6366f1', cursor: articleStatsLoading ? 'not-allowed' : 'pointer', padding: '5px 12px', border: '1px solid #c7d2fe', borderRadius: 8, background: '#fff', opacity: articleStatsLoading ? 0.5 : 1 }}>
                  ↻ Refresh GSC
                </button>
                <a href={wpAdminUrl} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 12, fontWeight: 600, color: '#6366f1', textDecoration: 'none', padding: '5px 12px', border: '1px solid #c7d2fe', borderRadius: 8, background: '#fff' }}>
                  → WP Admin
                </a>
              </div>
            </div>

            {ARTICLES.length === 0 ? (
              <div style={{ padding: '40px 24px', textAlign: 'center', color: '#94a3b8' }}>
                <p style={{ fontSize: 24, marginBottom: 8 }}>📭</p>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>No articles for {siteDomain} yet</p>
                <p style={{ fontSize: 12 }}>Add articles to <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>ARTICLES_REGISTRY['{siteDomain}']</code> in SEOActivity.tsx</p>
              </div>
            ) : ARTICLES.map((a, i) => {
              const gsc = articleStats[a.slug]
              const kwData = keywords.find(k => k.keyword.toLowerCase() === a.keyword.toLowerCase())
              const statsLoaded = Object.keys(articleStats).length > 0
              const indexed = statsLoaded ? (gsc && gsc.impressions > 0 ? 'yes' : 'no') : 'unknown'

              return (
                <div key={a.id} style={{ borderBottom: i < ARTICLES.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                  <div onClick={() => setArticleExpId(articleExpId === a.id ? null : a.id)}
                    style={{ padding: '13px 18px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 12 }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#fafafe')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: pColor[a.product] + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12, fontWeight: 700, color: pColor[a.product] }}>
                      {a.id}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 5 }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>{a.title}</span>
                        <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: pColor[a.product] + '18', color: pColor[a.product] }}>{a.product}</span>
                        {indexed === 'yes'
                          ? <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: '#dcfce7', color: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: 3 }}><CheckCircle size={10} /> Indexed</span>
                          : indexed === 'no'
                          ? <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: '#fef9c3', color: '#ca8a04', display: 'inline-flex', alignItems: 'center', gap: 3 }}><Clock size={10} /> Not indexed yet</span>
                          : <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: '#f1f5f9', color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: 3 }}><AlertCircle size={10} /> Pending check</span>
                        }
                        <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: '#dcfce7', color: '#16a34a' }}>✓ {a.status}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Focus:</span>
                          <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#ede9fe', color: '#6366f1' }}>{a.keyword}</span>
                          {kwData?.current_position && (
                            <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: '#dbeafe', color: '#2563eb' }}>
                              Rank #{Math.round(kwData.current_position)}
                            </span>
                          )}
                        </div>
                        {gsc && (
                          <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#64748b' }}>
                            <span>👆 <strong style={{ color: '#374151' }}>{gsc.clicks}</strong> clicks</span>
                            <span>👁 <strong style={{ color: '#374151' }}>{gsc.impressions.toLocaleString()}</strong> impr</span>
                            {gsc.position > 0 && <span>📍 pos <strong style={{ color: '#374151' }}>#{gsc.position.toFixed(1)}</strong></span>}
                          </div>
                        )}
                        {!gsc && statsLoaded && (
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>No GSC data — not live yet</span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>{a.date}</span>
                      {articleExpId === a.id ? <ChevronUp size={14} color="#94a3b8" /> : <ChevronDown size={14} color="#94a3b8" />}
                    </div>
                  </div>

                  {articleExpId === a.id && (
                    <div style={{ padding: '0 18px 20px 58px', background: '#fafafa', borderTop: '1px solid #f1f5f9' }}>
                      {gsc && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginTop: 14, marginBottom: 14 }}>
                          {[
                            { label: 'Clicks (90d)',      value: gsc.clicks.toLocaleString(),                              color: '#6366f1' },
                            { label: 'Impressions (90d)', value: gsc.impressions.toLocaleString(),                          color: '#0891b2' },
                            { label: 'Avg Position',      value: gsc.position > 0 ? `#${gsc.position.toFixed(1)}` : '—',   color: '#d97706' },
                            { label: 'CTR',               value: gsc.ctr > 0 ? `${(gsc.ctr * 100).toFixed(2)}%` : '—',    color: '#16a34a' },
                          ].map(s => (
                            <div key={s.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px' }}>
                              <p style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</p>
                              <p style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {kwData && (
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
                          <p style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Keyword Tracking (Supabase)</p>
                          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: '#374151' }}>
                            <span>Position: <strong>{kwData.current_position ? `#${Math.round(kwData.current_position)}` : 'Not ranked'}</strong></span>
                            <span>Prev: <strong>{kwData.previous_position ? `#${Math.round(kwData.previous_position)}` : '—'}</strong></span>
                            <span>Clicks: <strong>{kwData.clicks ?? '—'}</strong></span>
                            <span>Impressions: <strong>{kwData.impressions ?? '—'}</strong></span>
                            <span>Last synced: <strong>{kwData.last_checked?.slice(0, 10) ?? '—'}</strong></span>
                          </div>
                        </div>
                      )}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 4 }}>
                        <div>
                          <p style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Secondary Keywords</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {a.secondary.map(kw => (
                              <span key={kw} style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#fef3c7', color: '#d97706' }}>{kw}</span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Upload Reference</p>
                          <code style={{ fontSize: 11, background: '#f1f5f9', padding: '3px 8px', borderRadius: 5, color: '#374151' }}>{a.file}</code>
                          <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>WordPress → Code Editor → Paste HTML → Add Schema block</p>
                          <a href={`https://${siteDomain}${a.slug}`} target="_blank" rel="noopener noreferrer"
                            style={{ display: 'inline-block', marginTop: 6, fontSize: 11, color: '#6366f1', textDecoration: 'none' }}>
                            🔗 {`https://${siteDomain}${a.slug}`}
                          </a>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
