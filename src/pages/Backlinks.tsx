import { useState } from 'react'
import { dfsApi, safeArr, safeObj } from '../api'
import { Link, ExternalLink, Shield, TrendingUp, Globe } from 'lucide-react'

const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }

export default function Backlinks({ siteUrl }: { siteUrl: string }) {
  const [target, setTarget] = useState(siteUrl.replace(/https?:\/\//, '').replace(/\/$/, '') || '')
  const [summary, setSummary] = useState<any>(null)
  const [links, setLinks] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const analyze = async () => {
    if (!target) return
    setLoading(true)
    try {
      const [sumRes, linksRes] = await Promise.all([
        dfsApi.backlinksSummary({ target }),
        dfsApi.backlinks({ target, limit: 100 })
      ])
      const safeGet = (r: any) => (r && !Array.isArray(r) && r.data !== undefined) ? r.data : r
      setSummary(safeGet(sumRes))
      setLinks(safeArr(linksRes))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Input */}
      <div style={{ ...card, padding: '20px 22px' }}>
        <h3 style={{ fontWeight: 700, fontSize: 15, color: '#1e293b', marginBottom: 4 }}>Backlink Analysis</h3>
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 18 }}>Analyze the backlink profile of any domain or URL</p>
        <div style={{ display: 'flex', gap: 12 }}>
          <input value={target} onChange={e => setTarget(e.target.value)} placeholder="mysnapvitals.com"
            style={{ flex: 1, height: 38, border: '1px solid #e2e8f0', borderRadius: 9, padding: '0 12px', fontSize: 13, color: '#374151', outline: 'none' }}
            onKeyDown={e => e.key === 'Enter' && analyze()} />
          <button onClick={analyze} disabled={loading}
            style={{ height: 38, padding: '0 20px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, whiteSpace: 'nowrap' }}>
            {loading ? 'Analyzing...' : '🔗 Analyze'}
          </button>
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {[
            { label: 'Total Backlinks', val: (summary.backlinks || 0).toLocaleString(), color: '#6366f1', bg: '#ede9fe', icon: <Link size={16} color="#6366f1" /> },
            { label: 'Referring Domains', val: (summary.referring_domains || 0).toLocaleString(), color: '#16a34a', bg: '#dcfce7', icon: <Globe size={16} color="#16a34a" /> },
            { label: 'Domain Rank', val: summary.rank || '-', color: '#d97706', bg: '#fef3c7', icon: <Shield size={16} color="#d97706" /> },
            { label: 'DoFollow Links', val: (summary.backlinks != null && summary.backlinks_spam_score != null ? Math.round((1 - summary.backlinks_spam_score / 100) * summary.backlinks) : '-').toString(), color: '#2563eb', bg: '#dbeafe', icon: <TrendingUp size={16} color="#2563eb" /> }
          ].map(s => (
            <div key={s.label} style={{ ...card, padding: '18px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <p style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>{s.label}</p>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.icon}</div>
              </div>
              <p style={{ fontSize: 28, fontWeight: 800, color: s.color, letterSpacing: '-0.5px' }}>{s.val}</p>
            </div>
          ))}
        </div>
      )}

      {/* Links table */}
      {links.length > 0 && (
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
            <h3 style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>Top Backlinks</h3>
            <p style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>Sorted by referring domain rank (highest authority first)</p>
          </div>
          <div style={{ overflowX: 'auto', maxHeight: 480, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ position: 'sticky', top: 0, background: '#f8fafc' }}>
                <tr>
                  {['Source Domain', 'Domain Rank', 'Anchor Text', 'Type', 'First Seen'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase', borderBottom: '1px solid #f1f5f9' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {links.slice(0, 100).map((link: any, i: number) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '10px 16px', maxWidth: 280 }}>
                      <a href={link.url_from} target="_blank" rel="noopener noreferrer"
                        style={{ color: '#6366f1', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}>{link.domain_from}</span>
                        <ExternalLink size={11} />
                      </a>
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: link.domain_from_rank > 70 ? '#dcfce7' : link.domain_from_rank > 40 ? '#dbeafe' : '#f8fafc', color: link.domain_from_rank > 70 ? '#16a34a' : link.domain_from_rank > 40 ? '#2563eb' : '#94a3b8' }}>
                        {link.domain_from_rank}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', color: link.anchor ? '#374151' : '#cbd5e1', fontStyle: link.anchor ? 'normal' : 'italic' }}>
                      {link.anchor || 'No anchor'}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: link.dofollow ? '#dcfce7' : '#f8fafc', color: link.dofollow ? '#16a34a' : '#94a3b8' }}>
                        {link.dofollow ? 'DoFollow' : 'NoFollow'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', color: '#94a3b8', fontSize: 12 }}>{link.first_seen?.split('T')[0] || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!summary && !loading && (
        <div style={{ ...card, textAlign: 'center', padding: 60 }}>
          <Link size={40} style={{ color: '#cbd5e1', margin: '0 auto 16px' }} />
          <p style={{ color: '#94a3b8', fontWeight: 500 }}>Enter a domain above to analyze its backlink profile</p>
        </div>
      )}
    </div>
  )
}
