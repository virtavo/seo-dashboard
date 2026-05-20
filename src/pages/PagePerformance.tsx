import { useState, useEffect } from 'react'
import { gscApi, ga4Api, safeArr } from '../api'
import { format, subDays } from 'date-fns'
import { TrendingUp, TrendingDown, Clock, MousePointer } from 'lucide-react'

interface Props { siteUrl: string; providerToken: string; ga4PropertyId: string }
const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }

export default function PagePerformance({ siteUrl, providerToken, ga4PropertyId }: Props) {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [days, setDays] = useState(28)
  const [sortBy, setSortBy] = useState<'clicks' | 'sessions' | 'position' | 'bounceRate'>('clicks')

  const endDate = format(new Date(), 'yyyy-MM-dd')
  const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd')

  useEffect(() => {
    if (!siteUrl) return
    setLoading(true)
    const gscP = gscApi.topPages(providerToken, { siteUrl, startDate, endDate, rowLimit: 100 })
    const ga4P = ga4PropertyId ? ga4Api.topPages(providerToken, ga4PropertyId, startDate, endDate) : Promise.resolve([])

    Promise.allSettled([gscP, ga4P]).then(([gscR, gaR]) => {
      const gscPages: any[] = gscR.status === 'fulfilled' ? safeArr(gscR.value) : []
      const ga4Pages: any[] = gaR.status === 'fulfilled' ? safeArr(gaR.value) : []

      // Build GA4 lookup by path
      const ga4Map: Record<string, any> = {}
      ga4Pages.forEach(p => { ga4Map[p.path] = p })

      // Merge: match GSC full URL path with GA4 path
      const merged = gscPages.map(gp => {
        const path = gp.page.replace(/https?:\/\/[^/]+/, '') || '/'
        const ga = ga4Map[path] || ga4Map[path.replace(/\/$/, '')] || ga4Map[path + '/'] || null
        return {
          page: gp.page, path,
          clicks: gp.clicks, impressions: gp.impressions,
          ctr: gp.ctr, position: gp.position,
          sessions: ga?.sessions ?? null,
          pageviews: ga?.pageviews ?? null,
          bounceRate: ga?.bounceRate ?? null,
          avgDuration: ga?.avgDuration ?? null,
          // SEO score: pages with high impressions but low CTR = opportunity
          opportunity: gp.impressions > 100 && gp.ctr < 0.03,
        }
      })
      setRows(merged)
      setLoading(false)
    })
  }, [siteUrl, ga4PropertyId, days])

  const sorted = [...rows].sort((a, b) => {
    if (sortBy === 'position') return a.position - b.position
    if (sortBy === 'bounceRate') return (b.bounceRate ?? 0) - (a.bounceRate ?? 0)
    if (sortBy === 'sessions') return (b.sessions ?? -1) - (a.sessions ?? -1)
    return b.clicks - a.clicks
  })

  const opportunities = rows.filter(r => r.opportunity).length
  const avgCtr = rows.length ? rows.reduce((s, r) => s + r.ctr, 0) / rows.length * 100 : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {[7, 28, 90].map(d => (
          <button key={d} onClick={() => setDays(d)}
            style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderColor: days === d ? '#6366f1' : '#e2e8f0', background: days === d ? '#6366f1' : '#fff', color: days === d ? '#fff' : '#64748b' }}>
            {d === 7 ? '7 days' : d === 28 ? '28 days' : '90 days'}
          </button>
        ))}
        {!ga4PropertyId && <span style={{ fontSize: 12, color: '#f59e0b', background: '#fef3c7', padding: '4px 10px', borderRadius: 20, fontWeight: 600 }}>⚠️ Select GA4 property for session data</span>}
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {[
          { label: 'Pages Tracked', value: rows.length, color: '#6366f1', bg: '#ede9fe', icon: <MousePointer size={16} color="#6366f1" /> },
          { label: 'Avg CTR', value: `${avgCtr.toFixed(2)}%`, color: avgCtr > 3 ? '#16a34a' : '#d97706', bg: avgCtr > 3 ? '#dcfce7' : '#fef3c7', icon: <TrendingUp size={16} color={avgCtr > 3 ? '#16a34a' : '#d97706'} /> },
          { label: 'CTR Opportunities', value: opportunities, color: '#dc2626', bg: '#fef2f2', icon: <TrendingDown size={16} color="#dc2626" /> },
          { label: 'GA4 Matched', value: rows.filter(r => r.sessions !== null).length, color: '#2563eb', bg: '#dbeafe', icon: <Clock size={16} color="#2563eb" /> },
        ].map(s => (
          <div key={s.label} style={{ ...card, padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <p style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>{s.label}</p>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.icon}</div>
            </div>
            <p style={{ fontSize: 28, fontWeight: 800, color: s.color, letterSpacing: '-0.5px' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Combined table */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', background: '#fafafa', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>Page Performance — GSC + GA4 Combined</h3>
            <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>High impressions + low CTR = content/title optimization needed · High bounce = content quality issue</p>
          </div>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
            style={{ marginLeft: 'auto', height: 34, border: '1px solid #e2e8f0', borderRadius: 8, padding: '0 10px', fontSize: 12, color: '#374151', background: '#fff', cursor: 'pointer' }}>
            <option value="clicks">Sort: Clicks</option>
            <option value="sessions">Sort: GA4 Sessions</option>
            <option value="position">Sort: Position</option>
            <option value="bounceRate">Sort: Bounce Rate</option>
          </select>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Loading page data...</div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: 520, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead style={{ position: 'sticky', top: 0, background: '#f8fafc' }}>
                <tr>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid #f1f5f9', minWidth: 220 }}>Page</th>
                  <th colSpan={4} style={{ padding: '10px 14px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#6366f1', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid #f1f5f9', background: '#fafbff' }}>← Google Search Console →</th>
                  <th colSpan={3} style={{ padding: '10px 14px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#16a34a', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid #f1f5f9', background: '#f0fdf4' }}>← Google Analytics 4 →</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid #f1f5f9' }}>Action</th>
                </tr>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: '6px 14px', borderBottom: '1px solid #f1f5f9' }}></th>
                  {['Clicks', 'Impr.', 'Pos.', 'CTR'].map(h => <th key={h} style={{ padding: '6px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#6366f1', borderBottom: '1px solid #f1f5f9', background: '#fafbff' }}>{h}</th>)}
                  {['Sessions', 'Bounce', 'Duration'].map(h => <th key={h} style={{ padding: '6px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#16a34a', borderBottom: '1px solid #f1f5f9', background: '#f0fdf4' }}>{h}</th>)}
                  <th style={{ padding: '6px 14px', borderBottom: '1px solid #f1f5f9' }}></th>
                </tr>
              </thead>
              <tbody>
                {sorted.slice(0, 100).map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f8fafc', background: r.opportunity ? '#fffbeb' : 'transparent' }}>
                    <td style={{ padding: '9px 14px', maxWidth: 260 }}>
                      <p style={{ fontSize: 12, color: '#374151', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.path}>{r.path || '/'}</p>
                    </td>
                    <td style={{ padding: '9px 14px', fontWeight: 700, color: '#6366f1', background: '#fafbff' }}>{r.clicks.toLocaleString()}</td>
                    <td style={{ padding: '9px 14px', color: '#374151', background: '#fafbff' }}>{r.impressions.toLocaleString()}</td>
                    <td style={{ padding: '9px 14px', background: '#fafbff' }}>
                      <span style={{ padding: '2px 7px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: r.position <= 10 ? '#dbeafe' : '#fef3c7', color: r.position <= 10 ? '#2563eb' : '#ca8a04' }}>#{r.position}</span>
                    </td>
                    <td style={{ padding: '9px 14px', fontWeight: 600, color: r.ctr < 0.02 ? '#dc2626' : r.ctr > 0.05 ? '#16a34a' : '#374151', background: '#fafbff' }}>{(r.ctr * 100).toFixed(1)}%</td>
                    <td style={{ padding: '9px 14px', color: '#374151', background: '#f0fdf4' }}>{r.sessions != null ? r.sessions.toLocaleString() : <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                    <td style={{ padding: '9px 14px', background: '#f0fdf4' }}>
                      {r.bounceRate != null
                        ? <span style={{ padding: '2px 7px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: r.bounceRate > 70 ? '#fef2f2' : r.bounceRate > 50 ? '#fefce8' : '#dcfce7', color: r.bounceRate > 70 ? '#dc2626' : r.bounceRate > 50 ? '#ca8a04' : '#16a34a' }}>{r.bounceRate}%</span>
                        : <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>
                    <td style={{ padding: '9px 14px', color: '#64748b', background: '#f0fdf4' }}>
                      {r.avgDuration != null ? `${Math.floor(r.avgDuration / 60)}:${String(Math.floor(r.avgDuration % 60)).padStart(2, '0')}` : <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>
                    <td style={{ padding: '9px 14px' }}>
                      {r.opportunity && <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: '#fef3c7', color: '#d97706', whiteSpace: 'nowrap' }}>↑ CTR Fix</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
