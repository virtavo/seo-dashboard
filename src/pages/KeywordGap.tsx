import { useState } from 'react'
import { dfsApi, safeArr } from '../api'
import { TrendingUp, Search, AlertCircle } from 'lucide-react'

const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }

export default function KeywordGap({ siteUrl }: { siteUrl: string }) {
  const myDomain = siteUrl.replace(/https?:\/\//, '').replace(/\/$/, '')
  const [competitor1, setCompetitor1] = useState('')
  const [competitor2, setCompetitor2] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'missing' | 'weak'>('all')

  const analyze = async () => {
    if (!competitor1) return
    setLoading(true); setResults([])
    try {
      const targets = [myDomain, competitor1, competitor2].filter(Boolean)
      const r = await dfsApi.keywordGap({ targets })
      setResults(safeArr(r))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const filtered = results.filter(item => {
    const myKw = item.keywords_data?.find((k: any) => k.se_domain === myDomain || k.se_domain?.includes(myDomain))
    if (filter === 'missing') return !myKw
    if (filter === 'weak') return myKw && myKw.rank_absolute > 20
    return true
  })

  const missing = results.filter(item => !item.keywords_data?.find((k: any) => k.se_domain?.includes(myDomain))).length
  const weak = results.filter(item => {
    const myKw = item.keywords_data?.find((k: any) => k.se_domain?.includes(myDomain))
    return myKw && myKw.rank_absolute > 20
  }).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ ...card, padding: '20px 22px' }}>
        <h3 style={{ fontWeight: 700, fontSize: 15, color: '#1e293b', marginBottom: 4 }}>Keyword Gap Analysis</h3>
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>Find keywords your competitors rank for but you don't — powered by DataForSEO</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your Domain</label>
            <input value={myDomain} readOnly style={{ width: '100%', height: 36, border: '1px solid #e2e8f0', borderRadius: 8, padding: '0 10px', fontSize: 13, color: '#94a3b8', background: '#f8fafc' }} />
          </div>
          {[
            { val: competitor1, set: setCompetitor1, label: 'Competitor 1' },
            { val: competitor2, set: setCompetitor2, label: 'Competitor 2 (optional)' },
          ].map(f => (
            <div key={f.label}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{f.label}</label>
              <input value={f.val} onChange={e => f.set(e.target.value)} placeholder="example.com"
                style={{ width: '100%', height: 36, border: '1px solid #e2e8f0', borderRadius: 8, padding: '0 10px', fontSize: 13, color: '#374151', outline: 'none' }} />
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button onClick={analyze} disabled={loading || !competitor1}
              style={{ height: 36, padding: '0 18px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: (loading || !competitor1) ? 'not-allowed' : 'pointer', opacity: (loading || !competitor1) ? 0.7 : 1, whiteSpace: 'nowrap' }}>
              {loading ? 'Analyzing...' : '🔍 Find Gaps'}
            </button>
          </div>
        </div>
      </div>

      {results.length > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {[
              { label: 'Total Keywords Found', value: results.length, color: '#6366f1', bg: '#ede9fe' },
              { label: 'Missing (You don\'t rank)', value: missing, color: '#dc2626', bg: '#fef2f2', hint: '→ New content opportunities' },
              { label: 'Weak (Position 20+)', value: weak, color: '#d97706', bg: '#fef3c7', hint: '→ Content to improve' },
            ].map(s => (
              <div key={s.label} style={{ ...card, padding: '16px 20px' }}>
                <p style={{ fontSize: 12, color: '#64748b', fontWeight: 500, marginBottom: 8 }}>{s.label}</p>
                <p style={{ fontSize: 28, fontWeight: 800, color: s.color, letterSpacing: '-0.5px' }}>{s.value}</p>
                {s.hint && <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{s.hint}</p>}
              </div>
            ))}
          </div>

          <div style={{ ...card, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', background: '#fafafa', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <h3 style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', flex: 1 }}>Keyword Gap Results</h3>
              {[['all', 'All'], ['missing', '🚫 Missing'], ['weak', '⚠️ Weak']].map(([v, l]) => (
                <button key={v} onClick={() => setFilter(v as any)}
                  style={{ padding: '4px 12px', borderRadius: 20, border: '1px solid', fontSize: 11, fontWeight: 600, cursor: 'pointer', borderColor: filter === v ? '#6366f1' : '#e2e8f0', background: filter === v ? '#6366f1' : '#fff', color: filter === v ? '#fff' : '#64748b' }}>
                  {l}
                </button>
              ))}
            </div>
            <div style={{ overflowX: 'auto', maxHeight: 480, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f8fafc' }}>
                  <tr>
                    {['Keyword', 'Search Volume', 'Difficulty', `You (${myDomain})`, `Comp 1 (${competitor1})`, competitor2 ? `Comp 2 (${competitor2})` : null].filter(Boolean).map(h => (
                      <th key={h!} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase', borderBottom: '1px solid #f1f5f9' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 100).map((item: any, i: number) => {
                    const kd = item.keyword_data || {}
                    const kwDataArr = item.keywords_data || []
                    const getRank = (domain: string) => kwDataArr.find((k: any) => k.se_domain?.includes(domain))?.rank_absolute ?? null
                    const myRank = getRank(myDomain)
                    const c1Rank = getRank(competitor1)
                    const c2Rank = competitor2 ? getRank(competitor2) : null
                    const vol = kd.keyword_info?.search_volume
                    const diff = kd.keyword_properties?.keyword_difficulty

                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #f8fafc', background: !myRank ? '#fff8f8' : myRank > 20 ? '#fffbeb' : 'transparent' }}>
                        <td style={{ padding: '9px 14px', fontWeight: 600, color: '#374151' }}>{item.keyword}</td>
                        <td style={{ padding: '9px 14px', color: '#374151' }}>{vol?.toLocaleString() ?? '-'}</td>
                        <td style={{ padding: '9px 14px' }}>
                          {diff != null
                            ? <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: diff < 30 ? '#dcfce7' : diff < 60 ? '#fefce8' : '#fef2f2', color: diff < 30 ? '#16a34a' : diff < 60 ? '#ca8a04' : '#dc2626' }}>{diff}</span>
                            : '-'}
                        </td>
                        {[
                          { rank: myRank, isMine: true },
                          { rank: c1Rank },
                          ...(competitor2 ? [{ rank: c2Rank }] : [])
                        ].map((d, j) => (
                          <td key={j} style={{ padding: '9px 14px' }}>
                            {d.rank
                              ? <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: d.rank <= 10 ? (d.isMine ? '#dcfce7' : '#dbeafe') : '#fefce8', color: d.rank <= 10 ? (d.isMine ? '#16a34a' : '#2563eb') : '#ca8a04' }}>#{d.rank}</span>
                              : <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>Not ranked</span>}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!results.length && !loading && (
        <div style={{ ...card, textAlign: 'center', padding: 60 }}>
          <TrendingUp size={40} style={{ color: '#cbd5e1', margin: '0 auto 16px' }} />
          <p style={{ color: '#94a3b8', fontWeight: 500 }}>Enter a competitor domain to discover keyword gaps</p>
        </div>
      )}
    </div>
  )
}
