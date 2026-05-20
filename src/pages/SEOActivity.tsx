import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, FileText, Zap, Search, ChevronDown, ChevronUp } from 'lucide-react'

interface Props { siteUrl: string }

const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }

const COLORS = ['#6366f1','#22c55e','#f59e0b','#06b6d4','#ec4899','#8b5cf6','#ef4444','#14b8a6']

export default function SEOActivity({ siteUrl }: Props) {
  const [activeTab, setActiveTab] = useState<'trends' | 'log'>('trends')
  const [keywords, setKeywords] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [optimizations, setOptimizations] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedKws, setSelectedKws] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  const domain = siteUrl.replace(/https?:\/\//, '').replace(/\/$/, '')

  useEffect(() => {
    loadData()
  }, [siteUrl])

  const loadData = async () => {
    setLoading(true)
    try {
      // 1. keyword_tracking — current + previous position
      const { data: kws } = await supabase
        .from('keyword_tracking')
        .select('keyword, position, previous_position, clicks, impressions, ctr, last_checked, is_active')
        .eq('site_domain', siteUrl)
        .eq('is_active', true)
        .order('position', { ascending: true })
      setKeywords(kws || [])

      // 2. keyword_tracking_history — position over time
      const { data: hist } = await supabase
        .from('keyword_tracking_history')
        .select('keyword, position, recorded_at, date_range_start')
        .order('recorded_at', { ascending: true })
      setHistory(hist || [])

      // 3. blog_seo_optimizations
      const { data: opts } = await supabase
        .from('blog_seo_optimizations')
        .select('*')
        .order('created_at', { ascending: false })
      setOptimizations(opts || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // Build trend chart data: [{date, kw1, kw2, ...}]
  const buildChartData = () => {
    const kwsToShow = selectedKws.length > 0 ? selectedKws : keywords.slice(0, 5).map((k: any) => k.keyword)
    const dateMap: Record<string, Record<string, number>> = {}
    history
      .filter((h: any) => kwsToShow.includes(h.keyword))
      .forEach((h: any) => {
        const date = h.date_range_start?.slice(0, 10) || h.recorded_at?.slice(0, 10)
        if (!dateMap[date]) dateMap[date] = {}
        dateMap[date][h.keyword] = parseFloat(h.position?.toFixed(1))
      })
    return Object.entries(dateMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({ date, ...vals }))
  }

  const chartData = buildChartData()
  const kwsToShow = selectedKws.length > 0 ? selectedKws : keywords.slice(0, 5).map((k: any) => k.keyword)

  const filteredKws = keywords.filter(k =>
    k.keyword.toLowerCase().includes(search.toLowerCase())
  )

  const toggleKw = (kw: string) => {
    setSelectedKws(prev =>
      prev.includes(kw) ? prev.filter(k => k !== kw) : [...prev, kw].slice(0, 8)
    )
  }

  const posDelta = (cur: number, prev: number | null) => {
    if (prev == null || prev === 0) return null
    return prev - cur // positive = improved
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Tab switch */}
      <div style={{ display: 'flex', gap: 6 }}>
        {[['trends', '📈 Keyword Trends'], ['log', '📋 SEO Activity Log']].map(([v, l]) => (
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
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
            {[
              { label: 'Tracked Keywords', value: keywords.length, color: '#6366f1', bg: '#ede9fe' },
              { label: 'Improved', value: keywords.filter(k => posDelta(k.position, k.previous_position) != null && posDelta(k.position, k.previous_position)! > 0).length, color: '#16a34a', bg: '#dcfce7' },
              { label: 'Declined', value: keywords.filter(k => posDelta(k.position, k.previous_position) != null && posDelta(k.position, k.previous_position)! < 0).length, color: '#ef4444', bg: '#fef2f2' },
              { label: 'History Records', value: history.length, color: '#d97706', bg: '#fef3c7' },
            ].map(s => (
              <div key={s.label} style={{ ...card, padding: '16px 18px' }}>
                <p style={{ fontSize: 12, color: '#64748b', fontWeight: 500, marginBottom: 8 }}>{s.label}</p>
                <p style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Trend chart */}
          <div style={{ ...card, padding: '20px 22px' }}>
            <div style={{ marginBottom: 14 }}>
              <h3 style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>Position History</h3>
              <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Lower position = better ranking. Select keywords below to compare.</p>
            </div>
            {chartData.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: 40, fontSize: 13 }}>
                No history data yet — keyword sync runs every Monday UTC 02:00
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis reversed domain={['auto','auto']} tick={{ fontSize: 11, fill: '#94a3b8' }} label={{ value: 'Position', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 12 }}
                    formatter={(v: any, n: string) => [`#${v}`, n]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {kwsToShow.map((kw, i) => (
                    <Line key={kw} type="monotone" dataKey={kw} name={kw} stroke={COLORS[i % COLORS.length]}
                      strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Keyword position table with delta */}
          <div style={{ ...card, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 10, alignItems: 'center', background: '#fafafa' }}>
              <h3 style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', flex: 1 }}>Current vs Previous Position</h3>
              <div style={{ position: 'relative' }}>
                <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter..."
                  style={{ paddingLeft: 28, height: 32, width: 160, border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, color: '#374151', outline: 'none' }} />
              </div>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>Click to add to chart (max 8)</span>
            </div>
            <div style={{ overflowX: 'auto', maxHeight: 420, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f8fafc' }}>
                  <tr>
                    {['', 'Keyword', 'Current', 'Previous', 'Change', 'Clicks', 'Impressions', 'Last Synced'].map(h => (
                      <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase', borderBottom: '1px solid #f1f5f9' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>Loading...</td></tr>
                  ) : filteredKws.map((row: any, i: number) => {
                    const delta = posDelta(row.position, row.previous_position)
                    const selected = selectedKws.includes(row.keyword) || (selectedKws.length === 0 && i < 5)
                    return (
                      <tr key={row.keyword}
                        onClick={() => toggleKw(row.keyword)}
                        style={{ borderBottom: '1px solid #f8fafc', cursor: 'pointer', background: selected ? '#fafafe' : 'transparent', transition: 'background 0.1s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f0f4ff')}
                        onMouseLeave={e => (e.currentTarget.style.background = selected ? '#fafafe' : 'transparent')}>
                        <td style={{ padding: '9px 14px' }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: selected ? COLORS[kwsToShow.indexOf(row.keyword) % COLORS.length] : '#e2e8f0' }} />
                        </td>
                        <td style={{ padding: '9px 14px', fontWeight: 600, color: '#374151', maxWidth: 200 }}>{row.keyword}</td>
                        <td style={{ padding: '9px 14px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                            background: row.position <= 3 ? '#dcfce7' : row.position <= 10 ? '#dbeafe' : '#f8fafc',
                            color: row.position <= 3 ? '#16a34a' : row.position <= 10 ? '#2563eb' : '#94a3b8' }}>
                            #{row.position?.toFixed(0) ?? '-'}
                          </span>
                        </td>
                        <td style={{ padding: '9px 14px', color: '#94a3b8', fontSize: 12 }}>
                          {row.previous_position ? `#${row.previous_position.toFixed(0)}` : '-'}
                        </td>
                        <td style={{ padding: '9px 14px' }}>
                          {delta == null ? <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                            : delta > 0 ? <span style={{ color: '#16a34a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}><TrendingUp size={13} />+{delta.toFixed(0)}</span>
                            : delta < 0 ? <span style={{ color: '#ef4444', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}><TrendingDown size={13} />{delta.toFixed(0)}</span>
                            : <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 3 }}><Minus size={13} />0</span>}
                        </td>
                        <td style={{ padding: '9px 14px', color: '#374151', fontWeight: 600 }}>{row.clicks?.toLocaleString() ?? '-'}</td>
                        <td style={{ padding: '9px 14px', color: '#64748b' }}>{row.impressions?.toLocaleString() ?? '-'}</td>
                        <td style={{ padding: '9px 14px', color: '#94a3b8', fontSize: 11 }}>{row.last_checked?.slice(0, 10) ?? '-'}</td>
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
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
            {[
              { label: 'Optimized Articles', value: optimizations.length, color: '#6366f1', bg: '#ede9fe', icon: <FileText size={16} color="#6366f1" /> },
              { label: 'With FAQ Schema', value: optimizations.filter((o: any) => o.faq_schema).length, color: '#16a34a', bg: '#dcfce7', icon: <Zap size={16} color="#16a34a" /> },
              { label: 'With Article Schema', value: optimizations.filter((o: any) => o.article_schema).length, color: '#d97706', bg: '#fef3c7', icon: <Zap size={16} color="#d97706" /> },
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

          {/* Optimization log table */}
          <div style={{ ...card, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
              <h3 style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>Blog SEO Optimizations</h3>
              <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Articles optimized with target keywords, meta descriptions, and structured data</p>
            </div>
            {loading ? (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>Loading...</div>
            ) : (
              <div style={{ maxHeight: 600, overflowY: 'auto' }}>
                {optimizations.map((opt: any, i: number) => (
                  <div key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <div
                      onClick={() => setExpandedRow(expandedRow === opt.slug ? null : opt.slug)}
                      style={{ padding: '12px 18px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 12, transition: 'background 0.1s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#fafafe')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>{opt.slug || opt.article_title || `Article #${i + 1}`}</span>
                          {opt.target_keyword && (
                            <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#ede9fe', color: '#6366f1' }}>{opt.target_keyword}</span>
                          )}
                          {opt.faq_schema && <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: '#dcfce7', color: '#16a34a' }}>FAQ Schema ✓</span>}
                          {opt.article_schema && <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: '#dbeafe', color: '#2563eb' }}>Article Schema ✓</span>}
                        </div>
                        {opt.optimized_excerpt && (
                          <p style={{ fontSize: 12, color: '#64748b', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '90%' }}>
                            {opt.optimized_excerpt}
                          </p>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>{opt.created_at?.slice(0, 10)}</span>
                        {expandedRow === opt.slug ? <ChevronUp size={14} color="#94a3b8" /> : <ChevronDown size={14} color="#94a3b8" />}
                      </div>
                    </div>
                    {expandedRow === opt.slug && (
                      <div style={{ padding: '0 18px 16px', background: '#fafafa', borderTop: '1px solid #f1f5f9' }}>
                        {opt.ai_suggestions && (
                          <div style={{ marginTop: 10 }}>
                            <p style={{ fontSize: 11, fontWeight: 600, color: '#6366f1', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Suggestions</p>
                            <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{typeof opt.ai_suggestions === 'string' ? opt.ai_suggestions : JSON.stringify(opt.ai_suggestions, null, 2)}</p>
                          </div>
                        )}
                        {opt.optimized_excerpt && (
                          <div style={{ marginTop: 10 }}>
                            <p style={{ fontSize: 11, fontWeight: 600, color: '#16a34a', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Optimized Excerpt</p>
                            <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.6 }}>{opt.optimized_excerpt}</p>
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
    </div>
  )
}
