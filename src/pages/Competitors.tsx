import { useState } from 'react'
import { dfsApi, safeArr, safeObj } from '../api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Globe, ArrowUpDown, Search } from 'lucide-react'

const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }

export default function Competitors({ siteUrl }: { siteUrl: string }) {
  const [competitor, setCompetitor] = useState('')
  const [myDomain, setMyDomain] = useState(siteUrl.replace(/https?:\/\//, '').replace(/\/$/, '') || '')
  const [myData, setMyData] = useState<any>(null)
  const [compData, setCompData] = useState<any>(null)
  const [compKws, setCompKws] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const analyze = async () => {
    if (!competitor) return
    setLoading(true)
    try {
      const [myOv, compOv, compKwsRes] = await Promise.all([
        dfsApi.domainOverview({ domain: myDomain }),
        dfsApi.domainOverview({ domain: competitor }),
        dfsApi.competitorKeywords({ domain: competitor, limit: 100 })
      ])
      const safeGet = (r: any) => (r && !Array.isArray(r) && r.data !== undefined) ? r.data : r
      setMyData(safeGet(myOv))
      setCompData(safeGet(compOv))
      setCompKws(safeArr(compKwsRes))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const chartData = myData && compData ? [
    { metric: 'Organic Traffic', you: myData.metrics?.organic?.etv || 0, competitor: compData.metrics?.organic?.etv || 0 },
    { metric: 'Keywords', you: myData.metrics?.organic?.count || 0, competitor: compData.metrics?.organic?.count || 0 },
  ] : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Input */}
      <div style={{ ...card, padding: '20px 22px' }}>
        <h3 style={{ fontWeight: 700, fontSize: 15, color: '#1e293b', marginBottom: 4 }}>Competitor Analysis</h3>
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 18 }}>Compare your domain against any competitor using DataForSEO</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your Domain</label>
            <input value={myDomain} onChange={e => setMyDomain(e.target.value)} placeholder="mysnapvitals.com"
              style={{ width: '100%', height: 38, border: '1px solid #e2e8f0', borderRadius: 9, padding: '0 12px', fontSize: 13, color: '#374151', outline: 'none' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Competitor Domain</label>
            <input value={competitor} onChange={e => setCompetitor(e.target.value)} placeholder="e.g. bloodpressureuk.org"
              style={{ width: '100%', height: 38, border: '1px solid #e2e8f0', borderRadius: 9, padding: '0 12px', fontSize: 13, color: '#374151', outline: 'none' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button onClick={analyze} disabled={loading}
              style={{ height: 38, padding: '0 20px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, whiteSpace: 'nowrap' }}>
              {loading ? 'Analyzing...' : '⚡ Compare'}
            </button>
          </div>
        </div>
      </div>

      {/* Overview cards */}
      {myData && compData && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[
              { domain: myDomain, data: myData, color: '#6366f1', accent: '#ede9fe', label: 'Your Domain' },
              { domain: competitor, data: compData, color: '#f59e0b', accent: '#fef3c7', label: 'Competitor' }
            ].map(({ domain, data, color, accent, label }) => (
              <div key={domain} style={{ ...card, padding: '20px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                  <span style={{ fontWeight: 700, fontSize: 13, color }}>{label}</span>
                  <span style={{ color: '#94a3b8', fontSize: 12 }}>{domain}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'Organic Traffic', val: (data.metrics?.organic?.etv || 0).toLocaleString() },
                    { label: 'Organic Keywords', val: (data.metrics?.organic?.count || 0).toLocaleString() },
                    { label: 'Domain Rank', val: data.domain_rank || '-' },
                    { label: 'Traffic Value', val: `$${(data.metrics?.organic?.impressions_etv || 0).toFixed(0)}` }
                  ].map(s => (
                    <div key={s.label} style={{ background: accent, borderRadius: 10, padding: '12px 14px' }}>
                      <p style={{ color: '#64748b', fontSize: 11, fontWeight: 500, marginBottom: 4 }}>{s.label}</p>
                      <p style={{ fontWeight: 800, fontSize: 20, color }}>{s.val}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div style={{ ...card, padding: '20px 22px' }}>
            <h3 style={{ fontWeight: 700, fontSize: 15, color: '#1e293b', marginBottom: 16 }}>Side-by-Side Comparison</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barSize={40}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="metric" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="you" name={myDomain} fill="#6366f1" radius={[6, 6, 0, 0]} />
                <Bar dataKey="competitor" name={competitor} fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Competitor keywords */}
          {compKws.length > 0 && (
            <div style={{ ...card, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
                <h3 style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>Competitor's Top Keywords</h3>
                <p style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>Keywords driving traffic to {competitor}</p>
              </div>
              <div style={{ overflowX: 'auto', maxHeight: 380, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#f8fafc' }}>
                    <tr>
                      {['Keyword', 'Position', 'Search Volume', 'Traffic', 'CPC', 'Difficulty'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase', borderBottom: '1px solid #f1f5f9' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {compKws.slice(0, 100).map((item: any, i: number) => {
                      const kd = item.keyword_data
                      const pos = item.ranked_serp_element?.serp_item?.rank_absolute
                      const vol = kd?.keyword_info?.search_volume
                      const cpc = kd?.keyword_info?.cpc
                      const diff = kd?.keyword_properties?.keyword_difficulty
                      const posColor = pos <= 3 ? '#16a34a' : pos <= 10 ? '#2563eb' : '#ca8a04'
                      const posBg = pos <= 3 ? '#dcfce7' : pos <= 10 ? '#dbeafe' : '#fefce8'
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                          <td style={{ padding: '10px 16px', fontWeight: 600, color: '#374151' }}>{kd?.keyword}</td>
                          <td style={{ padding: '10px 16px' }}><span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: posBg, color: posColor }}>#{pos}</span></td>
                          <td style={{ padding: '10px 16px', color: '#374151' }}>{vol?.toLocaleString() || '-'}</td>
                          <td style={{ padding: '10px 16px', color: '#64748b' }}>{item.ranked_serp_element?.serp_item?.etv?.toLocaleString() || '-'}</td>
                          <td style={{ padding: '10px 16px', color: '#64748b' }}>${cpc?.toFixed(2) || '-'}</td>
                          <td style={{ padding: '10px 16px' }}>
                            {diff != null ? <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: diff < 30 ? '#dcfce7' : diff < 60 ? '#fefce8' : '#fef2f2', color: diff < 30 ? '#16a34a' : diff < 60 ? '#ca8a04' : '#ef4444' }}>{diff}</span> : '-'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {!myData && !loading && (
        <div style={{ ...card, textAlign: 'center', padding: 60 }}>
          <ArrowUpDown size={40} style={{ color: '#cbd5e1', margin: '0 auto 16px' }} />
          <p style={{ color: '#94a3b8', fontWeight: 500 }}>Enter your domain and a competitor domain above to start</p>
        </div>
      )}
    </div>
  )
}
