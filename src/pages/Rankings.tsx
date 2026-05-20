import { useState, useEffect } from 'react'
import { gscApi, safeArr } from '../api'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Search, TrendingUp, TrendingDown, Award, Target, Activity } from 'lucide-react'
import { format, subDays } from 'date-fns'

interface Props { siteUrl: string; providerToken: string }

const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }

const posBadge = (pos: number) => {
  if (pos <= 3) return { bg: '#f0fdf4', color: '#16a34a', label: `#${pos.toFixed(0)} Top 3` }
  if (pos <= 10) return { bg: '#eff6ff', color: '#2563eb', label: `#${pos.toFixed(0)} P1` }
  if (pos <= 20) return { bg: '#fefce8', color: '#ca8a04', label: `#${pos.toFixed(0)} P2` }
  return { bg: '#f8fafc', color: '#94a3b8', label: `#${pos.toFixed(0)}` }
}

export default function Rankings({ siteUrl, providerToken }: Props) {
  const [keywords, setKeywords] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedKw, setSelectedKw] = useState<string | null>(null)
  const [history, setHistory] = useState<any[]>([])
  const [histLoading, setHistLoading] = useState(false)
  const [sortBy, setSortBy] = useState<'clicks' | 'impressions' | 'position' | 'ctr'>('clicks')
  const [days, setDays] = useState(28)

  const endDate = format(new Date(), 'yyyy-MM-dd')
  const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd')

  useEffect(() => {
    if (!siteUrl) return
    setLoading(true)
    gscApi.keywords(providerToken, { siteUrl, startDate, endDate, rowLimit: 500 })
      .then(r => setKeywords(safeArr(r)))
      .catch(() => setKeywords([]))
      .finally(() => setLoading(false))
  }, [siteUrl, days])

  useEffect(() => {
    if (!selectedKw || !siteUrl) return
    setHistLoading(true)
    gscApi.keywordHistory(providerToken, { siteUrl, keyword: selectedKw, startDate, endDate })
      .then(r => {
        const rows = safeArr(r).map((row: any) => ({
          date: row.keys?.[0] || row.date,
          position: parseFloat(row.position?.toFixed(1)),
          clicks: row.clicks,
        }))
        setHistory(rows)
      })
      .catch(() => setHistory([]))
      .finally(() => setHistLoading(false))
  }, [selectedKw])

  const filtered = keywords
    .filter(k => k.keys?.[0]?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sortBy === 'position' ? a.position - b.position : b[sortBy] - a[sortBy])

  const stats = {
    total: keywords.length,
    top3: keywords.filter(k => k.position <= 3).length,
    top10: keywords.filter(k => k.position <= 10).length,
    avgPos: keywords.length ? (keywords.reduce((s, k) => s + k.position, 0) / keywords.length).toFixed(1) : '-'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Period */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[7, 28, 90].map(d => (
          <button key={d} onClick={() => setDays(d)}
            style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderColor: days === d ? '#6366f1' : '#e2e8f0', background: days === d ? '#6366f1' : '#fff', color: days === d ? '#fff' : '#64748b' }}>
            {d === 7 ? '7 days' : d === 28 ? '28 days' : '90 days'}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {[
          { label: 'Total Keywords', value: stats.total.toLocaleString(), color: '#6366f1', bg: '#ede9fe', icon: <Activity size={17} color="#6366f1" /> },
          { label: 'Top 3 Positions', value: stats.top3, color: '#16a34a', bg: '#dcfce7', icon: <Award size={17} color="#16a34a" /> },
          { label: 'Top 10 (Page 1)', value: stats.top10, color: '#2563eb', bg: '#dbeafe', icon: <Target size={17} color="#2563eb" /> },
          { label: 'Avg. Position', value: `#${stats.avgPos}`, color: '#d97706', bg: '#fef3c7', icon: <TrendingUp size={17} color="#d97706" /> }
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

      {/* History chart */}
      {selectedKw && (
        <div style={{ ...card, padding: '20px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <p style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ranking History</p>
              <h3 style={{ fontWeight: 700, fontSize: 16, color: '#1e293b', marginTop: 2 }}>"{selectedKw}"</h3>
            </div>
            <button onClick={() => setSelectedKw(null)}
              style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', color: '#64748b', padding: '6px 12px', borderRadius: 8, fontSize: 12 }}>✕ Close</button>
          </div>
          {histLoading ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>Loading...</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis reversed tick={{ fontSize: 11, fill: '#94a3b8' }} domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 12 }} formatter={(v: any, n: string) => [n === 'position' ? `#${v}` : v, n]} />
                <Line type="monotone" dataKey="position" name="Position" stroke="#6366f1" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Table */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', display: 'flex', gap: 10, alignItems: 'center', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap', background: '#fafafa' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter keywords..."
              style={{ paddingLeft: 32, width: '100%', height: 36, border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, color: '#374151', background: '#fff', outline: 'none' }} />
          </div>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
            style={{ height: 36, border: '1px solid #e2e8f0', borderRadius: 8, padding: '0 10px', fontSize: 13, color: '#374151', background: '#fff', cursor: 'pointer' }}>
            <option value="clicks">Sort: Clicks</option>
            <option value="impressions">Sort: Impressions</option>
            <option value="position">Sort: Position</option>
            <option value="ctr">Sort: CTR</option>
          </select>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>{filtered.length} keywords</span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: 60 }}>Loading keywords...</div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: 480, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ position: 'sticky', top: 0, background: '#f8fafc' }}>
                <tr>
                  {['Keyword', 'Position', 'Clicks', 'Impressions', 'CTR'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase', borderBottom: '1px solid #f1f5f9' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 200).map((row, i) => {
                  const badge = posBadge(row.position)
                  return (
                    <tr key={i} style={{ cursor: 'pointer', borderBottom: '1px solid #f8fafc', transition: 'background 0.1s' }}
                      onClick={() => setSelectedKw(row.keys[0])}
                      onMouseEnter={e => (e.currentTarget.style.background = '#fafafe')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '10px 16px', fontWeight: 600, color: '#6366f1' }}>{row.keys[0]}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: badge.bg, color: badge.color }}>{badge.label}</span>
                      </td>
                      <td style={{ padding: '10px 16px', fontWeight: 600, color: '#374151' }}>{row.clicks?.toLocaleString()}</td>
                      <td style={{ padding: '10px 16px', color: '#64748b' }}>{row.impressions?.toLocaleString()}</td>
                      <td style={{ padding: '10px 16px', color: row.ctr > 0.05 ? '#16a34a' : '#94a3b8', fontWeight: 600 }}>{(row.ctr * 100).toFixed(1)}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
