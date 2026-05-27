import { useState, useEffect } from 'react'
import { gscApi, dfsApi, safeArr } from '../api'
import { Lightbulb, TrendingUp, Zap, Search } from 'lucide-react'
import { format, subDays } from 'date-fns'

interface Props { siteUrl: string; providerToken: string }

const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }

export default function Opportunities({ siteUrl, providerToken }: Props) {
  const [opps, setOpps] = useState<any[]>([])
  const [ideas, setIdeas] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [ideasLoading, setIdeasLoading] = useState(false)
  const [seedKeywords, setSeedKeywords] = useState('')
  const [filter, setFilter] = useState<'all' | 'quick-win' | 'high-impression'>('all')

  const endDate = format(new Date(), 'yyyy-MM-dd')
  const startDate = format(subDays(new Date(), 90), 'yyyy-MM-dd')

  useEffect(() => {
    if (!siteUrl) return
    setLoading(true)
    gscApi.opportunities(providerToken, { siteUrl, startDate, endDate })
      .then(r => setOpps(safeArr(r)))
      .catch(() => setOpps([]))
      .finally(() => setLoading(false))
  }, [siteUrl])

  const fetchIdeas = async () => {
    const seeds = seedKeywords.split(',').map(s => s.trim()).filter(Boolean)
    if (!seeds.length) return
    setIdeasLoading(true)
    try {
      const r = await dfsApi.keywordIdeas({ keywords: seeds })
      setIdeas(safeArr(r))
    } catch (e) { console.error(e) }
    finally { setIdeasLoading(false) }
  }

  const filtered = opps.filter(row => {
    if (filter === 'quick-win') return row.position >= 4 && row.position <= 10
    if (filter === 'high-impression') return row.impressions >= 500
    return true
  })

  const quickWins = opps.filter(r => r.position >= 4 && r.position <= 10).length
  const highImp = opps.filter(r => r.position > 10 && r.position <= 20).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {[
          { label: 'Quick Wins (Pos 4–10)', value: quickWins, color: '#16a34a', bg: '#dcfce7', icon: <Zap size={17} color="#16a34a" />, hint: 'Small push → big click gains' },
          { label: 'Page 2 → Page 1', value: highImp, color: '#2563eb', bg: '#dbeafe', icon: <TrendingUp size={17} color="#2563eb" />, hint: 'High impressions, low clicks' },
          { label: 'Total Opportunities', value: opps.length, color: '#d97706', bg: '#fef3c7', icon: <Lightbulb size={17} color="#d97706" />, hint: 'Keywords with ranking potential' },
        ].map(s => (
          <div key={s.label} style={{ ...card, padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <p style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>{s.label}</p>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.icon}</div>
            </div>
            <p style={{ fontSize: 30, fontWeight: 800, color: s.color, letterSpacing: '-0.5px' }}>{s.value}</p>
            <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{s.hint}</p>
          </div>
        ))}
      </div>

      {/* Opportunity table */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', background: '#fafafa' }}>
          <div>
            <h3 style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>Traffic Opportunities</h3>
            <p style={{ fontSize: 11, color: '#94a3b8' }}>Keywords ranking 4–20 — optimize content to boost CTR</p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {[['all', 'All'], ['quick-win', '⚡ Quick Win'], ['high-impression', '📈 High Imp']].map(([v, l]) => (
              <button key={v} onClick={() => setFilter(v as any)}
                style={{ padding: '5px 12px', borderRadius: 20, border: '1px solid', fontSize: 11, fontWeight: 600, cursor: 'pointer', borderColor: filter === v ? '#6366f1' : '#e2e8f0', background: filter === v ? '#6366f1' : '#fff', color: filter === v ? '#fff' : '#64748b' }}>
                {l}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: 60 }}>Analyzing opportunities...</div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: 380, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ position: 'sticky', top: 0, background: '#f8fafc' }}>
                <tr>
                  {['Keyword', 'Position', 'Impressions', 'Clicks', 'CTR', 'Type'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase', borderBottom: '1px solid #f1f5f9' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: '#374151' }}>{row.keyword ?? row.keys?.[0] ?? row.query ?? '—'}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: row.position <= 10 ? '#dbeafe' : '#fefce8', color: row.position <= 10 ? '#2563eb' : '#ca8a04' }}>
                        #{row.position.toFixed(0)}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', color: '#374151', fontWeight: 600 }}>{row.impressions?.toLocaleString()}</td>
                    <td style={{ padding: '10px 16px', color: '#64748b' }}>{row.clicks?.toLocaleString()}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ color: row.ctr < 0.02 ? '#ef4444' : '#16a34a', fontWeight: 600 }}>{(row.ctr * 100).toFixed(1)}%</span>
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      {row.position <= 10
                        ? <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#dcfce7', color: '#16a34a' }}>⚡ Quick Win</span>
                        : <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#fefce8', color: '#ca8a04' }}>📈 P2 → P1</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Keyword Ideas */}
      <div style={{ ...card, padding: '20px 22px' }}>
        <h3 style={{ fontWeight: 700, fontSize: 15, color: '#1e293b', marginBottom: 4 }}>Keyword Ideas via DataForSEO</h3>
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>Enter seed keywords to discover related terms with volume & difficulty</p>
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input value={seedKeywords} onChange={e => setSeedKeywords(e.target.value)} placeholder="e.g. blood pressure monitor, bp tracker"
              style={{ paddingLeft: 32, width: '100%', height: 38, border: '1px solid #e2e8f0', borderRadius: 9, fontSize: 13, color: '#374151', background: '#fff', outline: 'none' }}
              onKeyDown={e => e.key === 'Enter' && fetchIdeas()} />
          </div>
          <button onClick={fetchIdeas} disabled={ideasLoading}
            style={{ padding: '0 20px', height: 38, background: '#6366f1', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: ideasLoading ? 'not-allowed' : 'pointer', opacity: ideasLoading ? 0.7 : 1 }}>
            {ideasLoading ? 'Searching...' : 'Find Ideas'}
          </button>
        </div>
        {ideas.length > 0 && (
          <div style={{ overflowX: 'auto', maxHeight: 380, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ position: 'sticky', top: 0, background: '#f8fafc' }}>
                <tr>
                  {['Keyword', 'Monthly Volume', 'CPC', 'Competition', 'Trend'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase', borderBottom: '1px solid #f1f5f9' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ideas.slice(0, 100).map((item, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: '#6366f1' }}>{item.keyword}</td>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: '#374151' }}>{item.search_volume?.toLocaleString() || '-'}</td>
                    <td style={{ padding: '10px 16px', color: '#64748b' }}>${item.cpc?.toFixed(2) || '-'}</td>
                    <td style={{ padding: '10px 16px' }}>
                      {item.competition_level === 'HIGH' && <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#fef2f2', color: '#ef4444' }}>High</span>}
                      {item.competition_level === 'MEDIUM' && <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#fefce8', color: '#ca8a04' }}>Medium</span>}
                      {item.competition_level === 'LOW' && <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#dcfce7', color: '#16a34a' }}>Low</span>}
                      {!item.competition_level && <span style={{ color: '#94a3b8' }}>-</span>}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 11, color: '#64748b' }}>
                      {item.monthly_searches?.slice(-6).map((m: any) => m.search_volume).join(' → ')}
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
