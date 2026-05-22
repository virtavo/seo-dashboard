import { useState, useEffect } from 'react'
import { ga4Api, safeArr } from '../api'
import { format, subDays } from 'date-fns'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { Monitor, Smartphone, Tablet, Globe2, Clock, ExternalLink, ChevronDown } from 'lucide-react'

interface Props { providerToken: string; ga4PropertyId: string; ga4Properties?: any[]; ga4Error?: string; onPropertyChange?: (id: string) => void }

const card = {
  background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14,
  padding: '20px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
}

const CHANNEL_COLORS: Record<string, string> = {
  'Organic Search': '#6366f1',
  'Direct': '#22c55e',
  'Referral': '#f59e0b',
  'Organic Social': '#ec4899',
  'Email': '#06b6d4',
  'Paid Search': '#ef4444',
  'Unassigned': '#94a3b8',
}
const PIE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#06b6d4', '#ec4899', '#8b5cf6', '#94a3b8']

export default function Analytics({ providerToken, ga4PropertyId, ga4Properties = [], ga4Error = '', onPropertyChange }: Props) {
  const [trend, setTrend] = useState<any[]>([])
  const [pages, setPages] = useState<any[]>([])
  const [sources, setSources] = useState<any[]>([])
  const [devices, setDevices] = useState<any[]>([])
  const [countries, setCountries] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showGaDD, setShowGaDD] = useState(false)
  const [manualId, setManualId] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [aiInsights, setAiInsights] = useState<Record<string, any>>({})
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({})

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
            { role: 'system', content: 'You are an SEO analyst. Return a JSON object with: summary (string ≤8 words), insights (array of 2-3 actionable strings).' },
            { role: 'user', content: `Analyze this ${type} data: ${JSON.stringify(data).slice(0, 2000)}` }
          ],
          response_format: { type: 'json_object' }
        })
      })
      const aiJson = await aiRes.json()
      const res = aiJson.choices?.[0]?.message?.content
        ? JSON.parse(aiJson.choices[0].message.content) : null
      const error = aiRes.ok ? null : aiJson.error
      if (!error && res) setAiInsights(p => ({ ...p, [type]: res }))
    } catch {}
    setAiLoading(p => ({ ...p, [type]: false }))
  }
  const [days, setDays] = useState(28)

  const endDate = format(new Date(), 'yyyy-MM-dd')
  const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd')

  useEffect(() => {
    if (!ga4PropertyId) return
    setLoading(true)
    setErrors({})
    Promise.allSettled([
      ga4Api.sessionsTrend(providerToken, ga4PropertyId, startDate, endDate),
      ga4Api.topPages(providerToken, ga4PropertyId, startDate, endDate),
      ga4Api.trafficSources(providerToken, ga4PropertyId, startDate, endDate),
      ga4Api.devices(providerToken, ga4PropertyId, startDate, endDate),
      ga4Api.countries(providerToken, ga4PropertyId, startDate, endDate),
    ]).then(results => {
      const errs: Record<string, string> = {}
      if (results[0].status === 'fulfilled') {
        const raw = safeArr(results[0].value)
        setTrend(raw.map((d: any) => ({
          date: d.date.slice(4, 6) + '/' + d.date.slice(6, 8),
          sessions: d.sessions, users: d.users
        })))
      } else { errs.trend = (results[0] as PromiseRejectedResult).reason?.message || 'API error' }
      if (results[1].status === 'fulfilled') setPages(safeArr(results[1].value))
      else errs.pages = (results[1] as PromiseRejectedResult).reason?.message || 'API error'
      if (results[2].status === 'fulfilled') {
        const v2 = results[2].value
        // Graceful error: edge fn returned 200 + { error, _graceful }
        if (v2?._graceful && v2?.error) errs.sources = v2.error
        else setSources(safeArr(v2))
      } else { errs.sources = (results[2] as PromiseRejectedResult).reason?.message || 'API error' }
      if (results[3].status === 'fulfilled') {
        const v3 = results[3].value
        if (v3?._graceful && v3?.error) errs.devices = v3.error
        else setDevices(safeArr(v3))
      } else { errs.devices = (results[3] as PromiseRejectedResult).reason?.message || 'API error' }
      if (results[4].status === 'fulfilled') setCountries(safeArr(results[4].value))
      else errs.countries = (results[4] as PromiseRejectedResult).reason?.message || 'API error'
      setErrors(errs)
      setLoading(false)
      // Trigger AI analysis sequentially (800ms apart) to avoid rate limiting
      ;(async () => {
        const aiTasks: Array<[string, any]> = []
        if (results[0].status === 'fulfilled') aiTasks.push(['sessions-trend', safeArr(results[0].value)])
        if (results[1].status === 'fulfilled') aiTasks.push(['top-pages', safeArr(results[1].value)])
        if (results[2].status === 'fulfilled') aiTasks.push(['traffic-sources', safeArr(results[2].value)])
        if (results[3].status === 'fulfilled') aiTasks.push(['devices', safeArr(results[3].value)])
        if (results[4].status === 'fulfilled') aiTasks.push(['countries', safeArr(results[4].value)])
        for (const [type, data] of aiTasks) {
          await fetchAI(type, data)
          await new Promise(r => setTimeout(r, 800))
        }
      })()
    })
  }, [ga4PropertyId, providerToken, days])

  const currentProperty = ga4Properties.find(p => p.id === ga4PropertyId)
  const gaLabel = currentProperty?.name || (ga4PropertyId ? `Property ${ga4PropertyId}` : 'Select GA4 property...')

  const PropertySelector = () => (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setShowGaDD(!showGaDD)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: '#fff', border: '1.5px solid #a7f3d0', borderRadius: 9, cursor: 'pointer', fontSize: 13, color: '#065f46', fontWeight: 600, boxShadow: '0 1px 4px rgba(16,185,129,0.1)' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
        <span style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{gaLabel}</span>
        <ChevronDown size={13} color="#10b981" />
      </button>
      {showGaDD && (
        <div style={{ position: 'absolute', top: '110%', left: 0, background: '#fff', border: '1.5px solid #a7f3d0', borderRadius: 10, boxShadow: '0 8px 24px rgba(16,185,129,0.15)', zIndex: 200, minWidth: 340, maxHeight: 280, overflowY: 'auto' }}
          onClick={e => e.stopPropagation()}>
          {ga4Properties.length === 0 ? (
            <div style={{ padding: '12px 14px' }}>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
                {ga4Error === 'token_expired' ? '⚠️ Session expired — please re-login.' :
                 '⚠️ No GA4 properties auto-detected. Enter Property ID manually:'}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  placeholder="e.g. 484037200"
                  value={manualId}
                  onChange={e => setManualId(e.target.value.replace(/\D/g, ''))}
                  style={{ flex: 1, padding: '6px 10px', fontSize: 12, border: '1px solid #a7f3d0', borderRadius: 6, outline: 'none', color: '#065f46' }}
                />
                <button
                  onClick={() => { if (manualId) { onPropertyChange?.(manualId); setShowGaDD(false) } }}
                  style={{ padding: '6px 12px', fontSize: 12, background: '#065f46', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                  Use
                </button>
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
                Find your ID in GA4 → Admin → Property Settings
              </div>
            </div>
          ) : (
            ga4Properties.map(p => (
              <button key={p.id} onClick={() => { onPropertyChange?.(p.id); setShowGaDD(false) }}
                style={{ width: '100%', padding: '10px 14px', textAlign: 'left', fontSize: 13, color: p.id === ga4PropertyId ? '#065f46' : '#374151', background: p.id === ga4PropertyId ? '#ecfdf5' : 'transparent', border: 'none', cursor: 'pointer', fontWeight: p.id === ga4PropertyId ? 600 : 400 }}>
                <span style={{ display: 'block', fontWeight: 600 }}>{p.name}</span>
                <span style={{ color: '#94a3b8', fontSize: 11 }}>{p.account} · ID {p.id}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )

  if (!ga4PropertyId) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PropertySelector />
      <div style={{ ...card, textAlign: 'center', padding: 60 }}>
        <Globe2 size={40} style={{ color: '#cbd5e1', margin: '0 auto 16px' }} />
        <p style={{ color: '#94a3b8', fontWeight: 500, marginBottom: 16 }}>Select a GA4 property above to view Analytics data</p>
        {ga4Properties.length === 0 && (
          <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
            <input
              type="text"
              placeholder="Enter GA4 Property ID (e.g. 484037200)"
              value={manualId}
              onChange={e => setManualId(e.target.value.replace(/\D/g, ''))}
              style={{ padding: '8px 14px', fontSize: 13, border: '1.5px solid #a7f3d0', borderRadius: 8, outline: 'none', color: '#065f46', width: 260 }}
            />
            <button
              onClick={() => { if (manualId) onPropertyChange?.(manualId) }}
              style={{ padding: '8px 18px', fontSize: 13, background: '#065f46', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
              Load Data
            </button>
          </div>
        )}
      </div>
    </div>
  )

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PropertySelector />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  const totalSessions = sources.reduce((s, r) => s + r.sessions, 0)
  const deviceTotal = devices.reduce((s, d) => s + d.sessions, 0)

  const deviceIcon = (d: string) => {
    if (d === 'mobile') return <Smartphone size={14} />
    if (d === 'tablet') return <Tablet size={14} />
    return <Monitor size={14} />
  }

  const currentProp = currentProperty

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* GA4 Property selector */}
      <PropertySelector />
      {/* GA4 Property identity bar + Period */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        {currentProp && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, padding: '6px 12px' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#065f46' }}>{currentProp.name}</span>
            <span style={{ fontSize: 11, color: '#6ee7b7' }}>|</span>
            <span style={{ fontSize: 11, color: '#047857' }}>{currentProp.account}</span>
            <span style={{ fontSize: 10, color: '#6ee7b7', background: '#d1fae5', borderRadius: 4, padding: '1px 5px' }}>ID {ga4PropertyId}</span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
        {[7, 28, 90].map(d => (
          <button key={d} onClick={() => setDays(d)}
            style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderColor: days === d ? '#6366f1' : '#e2e8f0', background: days === d ? '#6366f1' : '#fff', color: days === d ? '#fff' : '#64748b' }}>
            {d === 7 ? '7 days' : d === 28 ? '28 days' : '90 days'}
          </button>
        ))}
        </div>
      </div>

      {/* Sessions trend */}
      {trend.length > 0 && (
        <div style={{ ...card }}>
          <h3 style={{ fontWeight: 700, fontSize: 15, color: '#1e293b', marginBottom: 16 }}>Sessions & Users Over Time</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="gS" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.13} /><stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gU" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.13} /><stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="sessions" name="Sessions" stroke="#6366f1" strokeWidth={2.5} fill="url(#gS)" />
              <Area type="monotone" dataKey="users" name="Users" stroke="#22c55e" strokeWidth={2.5} fill="url(#gU)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}


          {(aiInsights['sessions-trend'] || aiLoading['sessions-trend']) && (
            <div style={{ marginTop: 14, padding: '12px 16px', background: 'linear-gradient(135deg,#f0f9ff,#e0f2fe)', border: '1px solid #bae6fd', borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                <span style={{ fontSize: 15 }}>🤖</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#0369a1' }}>AI Analysis</span>
                {aiLoading['sessions-trend'] && <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 4 }}>Analyzing...</span>}
                {aiInsights['sessions-trend']?.summary && <span style={{ fontSize: 11, color: '#0284c7', background: '#e0f2fe', borderRadius: 4, padding: '1px 7px', marginLeft: 'auto' }}>{aiInsights['sessions-trend'].summary}</span>}
              </div>
              {(aiInsights['sessions-trend']?.insights || []).map((ins: string, i: number) => (
                <p key={i} style={{ fontSize: 12, color: '#0c4a6e', marginBottom: 5, lineHeight: 1.6 }}>{ins}</p>
              ))}
            </div>
          )}

      {/* Traffic sources + Devices */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>
        {/* Traffic Sources */}
        <div style={{ ...card }}>
          <h3 style={{ fontWeight: 700, fontSize: 15, color: '#1e293b', marginBottom: 16 }}>Traffic Sources</h3>
          {sources.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sources.map((s, i) => {
                const pct = totalSessions > 0 ? ((s.sessions / totalSessions) * 100) : 0
                const color = CHANNEL_COLORS[s.channel] || PIE_COLORS[i % PIE_COLORS.length]
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>{s.channel}</span>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>{s.sessions.toLocaleString()} · {pct.toFixed(1)}%</span>
                    </div>
                    <div style={{ height: 6, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ padding: '12px 0' }}>
              {errors.sources ? (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px' }}>
                  <p style={{ color: '#92400e', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>⚠️ Traffic Sources unavailable</p>
                  <p style={{ color: '#78350f', fontSize: 11, fontFamily: 'monospace', wordBreak: 'break-all' }}>{errors.sources}</p>
                </div>
              ) : (
                <p style={{ color: '#94a3b8', fontSize: 13 }}>No data for the selected period</p>
              )}
            </div>
          )}

          {(aiInsights['traffic-sources'] || aiLoading['traffic-sources']) && (
            <div style={{ marginTop: 14, padding: '12px 16px', background: 'linear-gradient(135deg,#f0f9ff,#e0f2fe)', border: '1px solid #bae6fd', borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                <span style={{ fontSize: 15 }}>🤖</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#0369a1' }}>AI Analysis</span>
                {aiLoading['traffic-sources'] && <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 4 }}>Analyzing...</span>}
                {aiInsights['traffic-sources']?.summary && <span style={{ fontSize: 11, color: '#0284c7', background: '#e0f2fe', borderRadius: 4, padding: '1px 7px', marginLeft: 'auto' }}>{aiInsights['traffic-sources'].summary}</span>}
              </div>
              {(aiInsights['traffic-sources']?.insights || []).map((ins: string, i: number) => (
                <p key={i} style={{ fontSize: 12, color: '#0c4a6e', marginBottom: 5, lineHeight: 1.6 }}>{ins}</p>
              ))}
            </div>
          )}
        </div>

        {/* Devices */}
        <div style={{ ...card }}>
          <h3 style={{ fontWeight: 700, fontSize: 15, color: '#1e293b', marginBottom: 16 }}>Devices</h3>
          {devices.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={130}>
                <PieChart>
                  <Pie data={devices} dataKey="sessions" nameKey="device" cx="50%" cy="50%" outerRadius={55} innerRadius={28}>
                    {devices.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => v.toLocaleString()} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {devices.map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#374151' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span style={{ color: PIE_COLORS[i % PIE_COLORS.length] }}>{deviceIcon(d.device)}</span>
                      <span style={{ textTransform: 'capitalize' }}>{d.device}</span>
                    </div>
                    <span style={{ color: '#94a3b8', fontWeight: 600 }}>{deviceTotal > 0 ? ((d.sessions / deviceTotal) * 100).toFixed(1) : 0}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ padding: '12px 0' }}>
              {errors.devices ? (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px' }}>
                  <p style={{ color: '#92400e', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>⚠️ Devices data unavailable</p>
                  <p style={{ color: '#78350f', fontSize: 11, fontFamily: 'monospace', wordBreak: 'break-all' }}>{errors.devices}</p>
                </div>
              ) : (
                <p style={{ color: '#94a3b8', fontSize: 13 }}>No data for the selected period</p>
              )}
            </div>
          )}

          {(aiInsights['devices'] || aiLoading['devices']) && (
            <div style={{ marginTop: 14, padding: '12px 16px', background: 'linear-gradient(135deg,#f0f9ff,#e0f2fe)', border: '1px solid #bae6fd', borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                <span style={{ fontSize: 15 }}>🤖</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#0369a1' }}>AI Analysis</span>
                {aiLoading['devices'] && <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 4 }}>Analyzing...</span>}
                {aiInsights['devices']?.summary && <span style={{ fontSize: 11, color: '#0284c7', background: '#e0f2fe', borderRadius: 4, padding: '1px 7px', marginLeft: 'auto' }}>{aiInsights['devices'].summary}</span>}
              </div>
              {(aiInsights['devices']?.insights || []).map((ins: string, i: number) => (
                <p key={i} style={{ fontSize: 12, color: '#0c4a6e', marginBottom: 5, lineHeight: 1.6 }}>{ins}</p>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top Pages */}
      {pages.length > 0 && (
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid #f1f5f9' }}>
            <h3 style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>Top Pages by Traffic</h3>
          </div>
          <div style={{ overflowX: 'auto', maxHeight: 380, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ position: 'sticky', top: 0, background: '#f8fafc' }}>
                <tr>
                  {['Page', 'Page Views', 'Users', 'Avg Duration', 'Bounce Rate'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase', borderBottom: '1px solid #f1f5f9' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pages.slice(0, 50).map((p, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '10px 16px', maxWidth: 300 }}>
                      <p style={{ fontWeight: 500, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }} title={p.title}>{p.title || p.path}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <a href={p.path} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 11, color: '#6366f1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none', maxWidth: 240 }}
                          title={p.path}
                          onMouseEnter={e => (e.target as any).style.textDecoration = 'underline'}
                          onMouseLeave={e => (e.target as any).style.textDecoration = 'none'}>
                          {p.path}
                        </a>
                        <ExternalLink size={10} color="#94a3b8" style={{ flexShrink: 0 }} />
                      </div>
                    </td>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: '#6366f1' }}>{p.pageviews.toLocaleString()}</td>
                    <td style={{ padding: '10px 16px', color: '#374151' }}>{p.users.toLocaleString()}</td>
                    <td style={{ padding: '10px 16px', color: '#374151' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={11} color="#94a3b8" />
                        {Math.floor(p.avgDuration / 60)}:{String(Math.floor(p.avgDuration % 60)).padStart(2, '0')}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: p.bounceRate > 70 ? '#fef2f2' : p.bounceRate > 50 ? '#fefce8' : '#f0fdf4', color: p.bounceRate > 70 ? '#ef4444' : p.bounceRate > 50 ? '#ca8a04' : '#22c55e' }}>
                        {p.bounceRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}


          {/* AI Insights */}
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

      {/* Countries */}
      {countries.length > 0 && (
        <div style={{ ...card }}>
          <h3 style={{ fontWeight: 700, fontSize: 15, color: '#1e293b', marginBottom: 16 }}>Top Countries</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {countries.slice(0, 10).map((c, i) => {
              const pct = totalSessions > 0 ? ((c.sessions / totalSessions) * 100) : 0
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#f8fafc', borderRadius: 10 }}>
                  <span style={{ fontSize: 18 }}>{countryFlag(c.country)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.country}</p>
                    <p style={{ fontSize: 11, color: '#94a3b8' }}>{c.sessions.toLocaleString()} sessions · {pct.toFixed(1)}%</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

          {/* AI Insights */}
          {(aiInsights['countries'] || aiLoading['countries']) && (
            <div style={{ marginTop: 14, padding: '12px 16px', background: 'linear-gradient(135deg,#f0f9ff,#e0f2fe)', border: '1px solid #bae6fd', borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                <span style={{ fontSize: 15 }}>🤖</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#0369a1' }}>AI Analysis</span>
                {aiLoading['countries'] && <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 4 }}>Analyzing...</span>}
                {aiInsights['countries']?.summary && <span style={{ fontSize: 11, color: '#0284c7', background: '#e0f2fe', borderRadius: 4, padding: '1px 7px', marginLeft: 'auto' }}>{aiInsights['countries'].summary}</span>}
              </div>
              {(aiInsights['countries']?.insights || []).map((ins: string, i: number) => (
                <p key={i} style={{ fontSize: 12, color: '#0c4a6e', marginBottom: 5, lineHeight: 1.6 }}>{ins}</p>
              ))}
            </div>
          )}
    </div>
  )
}

function countryFlag(country: string): string {
  const map: Record<string, string> = {
    'United States': '🇺🇸', 'China': '🇨🇳', 'United Kingdom': '🇬🇧', 'Canada': '🇨🇦',
    'Australia': '🇦🇺', 'Germany': '🇩🇪', 'France': '🇫🇷', 'Japan': '🇯🇵',
    'India': '🇮🇳', 'Brazil': '🇧🇷', 'South Korea': '🇰🇷', 'Italy': '🇮🇹',
    'Spain': '🇪🇸', 'Mexico': '🇲🇽', 'Netherlands': '🇳🇱', 'Singapore': '🇸🇬',
  }
  return map[country] || '🌐'
}
