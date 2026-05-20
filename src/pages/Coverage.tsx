import { useState, useEffect } from 'react'
import { gscApi, safeArr, safeObj } from '../api'
import { format, subDays } from 'date-fns'
import { CheckCircle, XCircle, AlertCircle, Globe, FileSearch, List, Search } from 'lucide-react'

interface Props { siteUrl: string; providerToken: string }
const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }

export default function Coverage({ siteUrl, providerToken }: Props) {
  const [sitemaps, setSitemaps] = useState<any[]>([])
  const [topPages, setTopPages] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [inspectUrl, setInspectUrl] = useState('')
  const [inspecting, setInspecting] = useState(false)
  const [inspectResult, setInspectResult] = useState<any>(null)

  const endDate = format(new Date(), 'yyyy-MM-dd')
  const startDate = format(subDays(new Date(), 28), 'yyyy-MM-dd')

  useEffect(() => {
    if (!siteUrl) return
    setLoading(true)
    Promise.allSettled([
      gscApi.sitemaps(providerToken, siteUrl),
      gscApi.topPages(providerToken, { siteUrl, startDate, endDate, rowLimit: 50 }),
    ]).then(([s, p]) => {
      if (s.status === 'fulfilled') setSitemaps(safeArr(s.value))
      if (p.status === 'fulfilled') setTopPages(safeArr(p.value))
      setLoading(false)
    })
  }, [siteUrl])

  const inspectOne = async () => {
    if (!inspectUrl) return
    setInspecting(true)
    setInspectResult(null)
    try {
      const r = await gscApi.urlInspect(providerToken, siteUrl, inspectUrl)
      setInspectResult(safeObj(r))
    } catch (e: any) { setInspectResult({ error: e.message }) }
    finally { setInspecting(false) }
  }

  const indexStatus = (s: string) => {
    if (s === 'INDEXING_ALLOWED') return { icon: <CheckCircle size={14} />, color: '#16a34a', bg: '#dcfce7', label: 'Indexed' }
    if (s === 'FAILED' || s === 'BLOCKED') return { icon: <XCircle size={14} />, color: '#dc2626', bg: '#fef2f2', label: s }
    return { icon: <AlertCircle size={14} />, color: '#d97706', bg: '#fef3c7', label: s || 'Unknown' }
  }

  const urlIndex = inspectResult?.indexStatusResult
  const coverage = urlIndex?.coverageState
  const robotsTxt = urlIndex?.robotsTxtState
  const indexing = urlIndex?.indexingState
  const verdict = urlIndex?.verdict

  const verdictStyle = verdict === 'PASS' ? { color: '#16a34a', bg: '#dcfce7' }
    : verdict === 'FAIL' ? { color: '#dc2626', bg: '#fef2f2' } : { color: '#d97706', bg: '#fef3c7' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {[
          { label: 'Pages in Search', value: topPages.length, color: '#6366f1', bg: '#ede9fe', icon: <Globe size={17} color="#6366f1" />, hint: 'Pages with GSC data (28 days)' },
          { label: 'Sitemaps Submitted', value: sitemaps.length, color: '#16a34a', bg: '#dcfce7', icon: <List size={17} color="#16a34a" />, hint: `${sitemaps.reduce((s, sm) => s + (sm.contents?.[0]?.submitted || 0), 0).toLocaleString()} URLs submitted` },
          { label: 'Total Clicks (28d)', value: topPages.reduce((s, p) => s + p.clicks, 0).toLocaleString(), color: '#2563eb', bg: '#dbeafe', icon: <FileSearch size={17} color="#2563eb" />, hint: 'Organic clicks from GSC' },
        ].map(s => (
          <div key={s.label} style={{ ...card, padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <p style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>{s.label}</p>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.icon}</div>
            </div>
            <p style={{ fontSize: 28, fontWeight: 800, color: s.color, letterSpacing: '-0.5px' }}>{s.value}</p>
            <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{s.hint}</p>
          </div>
        ))}
      </div>

      {/* URL Inspector */}
      <div style={{ ...card, padding: '20px 22px' }}>
        <h3 style={{ fontWeight: 700, fontSize: 15, color: '#1e293b', marginBottom: 4 }}>URL Index Inspector</h3>
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 14 }}>Check if a specific URL is indexed by Google via GSC URL Inspection API</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input value={inspectUrl} onChange={e => setInspectUrl(e.target.value)}
              placeholder={`${siteUrl.replace(/\/$/, '')}/your-page`}
              style={{ paddingLeft: 32, width: '100%', height: 38, border: '1px solid #e2e8f0', borderRadius: 9, fontSize: 13, color: '#374151', outline: 'none' }}
              onKeyDown={e => e.key === 'Enter' && inspectOne()} />
          </div>
          <button onClick={inspectOne} disabled={inspecting}
            style={{ height: 38, padding: '0 20px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: inspecting ? 'not-allowed' : 'pointer', opacity: inspecting ? 0.7 : 1, whiteSpace: 'nowrap' }}>
            {inspecting ? 'Checking...' : '🔍 Inspect URL'}
          </button>
        </div>

        {inspectResult && !inspectResult.error && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {verdict && (
                <span style={{ padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700, background: verdictStyle.bg, color: verdictStyle.color }}>
                  {verdict === 'PASS' ? '✅ Indexed' : verdict === 'FAIL' ? '❌ Not Indexed' : `⚠️ ${verdict}`}
                </span>
              )}
              {coverage && <span style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: '#f1f5f9', color: '#374151' }}>Coverage: {coverage}</span>}
              {robotsTxt && <span style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: robotsTxt === 'ALLOWED' ? '#dcfce7' : '#fef2f2', color: robotsTxt === 'ALLOWED' ? '#16a34a' : '#dc2626' }}>robots.txt: {robotsTxt}</span>}
              {indexing && <span style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: indexing === 'INDEXING_ALLOWED' ? '#dcfce7' : '#fef2f2', color: indexing === 'INDEXING_ALLOWED' ? '#16a34a' : '#dc2626' }}>Indexing: {indexing}</span>}
            </div>
            {urlIndex?.lastCrawlTime && <p style={{ fontSize: 12, color: '#94a3b8' }}>Last crawled: {new Date(urlIndex.lastCrawlTime).toLocaleString()}</p>}
            {urlIndex?.googleCanonical && <p style={{ fontSize: 12, color: '#64748b' }}>Google canonical: <span style={{ color: '#6366f1' }}>{urlIndex.googleCanonical}</span></p>}
          </div>
        )}
        {inspectResult?.error && <p style={{ marginTop: 12, fontSize: 13, color: '#dc2626' }}>Error: {inspectResult.error}</p>}
      </div>

      {/* Sitemaps */}
      {sitemaps.length > 0 && (
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
            <h3 style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>Submitted Sitemaps</h3>
          </div>
          <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sitemaps.map((sm: any, i: number) => {
              const st = indexStatus(sm.isPending ? 'PENDING' : sm.errors > 0 ? 'FAILED' : 'INDEXING_ALLOWED')
              const submitted = sm.contents?.[0]?.submitted || sm.contents?.reduce((s: number, c: any) => s + (c.submitted || 0), 0) || 0
              const indexed = sm.contents?.[0]?.indexed || sm.contents?.reduce((s: number, c: any) => s + (c.indexed || 0), 0) || 0
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#f8fafc', borderRadius: 10 }}>
                  <div style={{ color: st.color }}>{st.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sm.path}</p>
                    <p style={{ fontSize: 11, color: '#94a3b8' }}>Last submitted: {sm.lastSubmitted ? new Date(sm.lastSubmitted).toLocaleDateString() : '-'}</p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{indexed.toLocaleString()} / {submitted.toLocaleString()}</p>
                    <p style={{ fontSize: 10, color: '#94a3b8' }}>indexed / submitted</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Top indexed pages */}
      {topPages.length > 0 && (
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
            <h3 style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>Pages Appearing in Search</h3>
            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>All pages with impressions in last 28 days — click any to inspect index status</p>
          </div>
          <div style={{ overflowX: 'auto', maxHeight: 420, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ position: 'sticky', top: 0, background: '#f8fafc' }}>
                <tr>
                  {['Page URL', 'Clicks', 'Impressions', 'Avg Position', 'CTR'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase', borderBottom: '1px solid #f1f5f9' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topPages.map((p, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f8fafc', cursor: 'pointer' }}
                    onClick={() => setInspectUrl(p.page)}
                    onMouseEnter={e => (e.currentTarget.style.background = '#fafafe')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '10px 16px', maxWidth: 320 }}>
                      <p style={{ fontSize: 12, color: '#6366f1', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.page.replace(/https?:\/\/[^/]+/, '') || '/'}</p>
                    </td>
                    <td style={{ padding: '10px 16px', fontWeight: 700, color: '#374151' }}>{p.clicks.toLocaleString()}</td>
                    <td style={{ padding: '10px 16px', color: '#64748b' }}>{p.impressions.toLocaleString()}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: p.position <= 10 ? '#dbeafe' : '#fef3c7', color: p.position <= 10 ? '#2563eb' : '#ca8a04' }}>#{p.position}</span>
                    </td>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: p.ctr > 0.05 ? '#16a34a' : '#94a3b8' }}>{(p.ctr * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
