import { useState } from 'react'
import { cwvApi, gscApi, safeArr, safeObj } from '../api'
import { format, subDays } from 'date-fns'
import { Zap, Monitor, Smartphone, CheckCircle, XCircle, AlertCircle, Search } from 'lucide-react'

interface Props { siteUrl: string; providerToken: string }

const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }

const CWV_THRESHOLDS: Record<string, { good: number; poor: number; unit: string; label: string }> = {
  lcp: { good: 2500, poor: 4000, unit: 'ms', label: 'LCP' },
  fcp: { good: 1800, poor: 3000, unit: 'ms', label: 'FCP' },
  cls: { good: 0.1, poor: 0.25, unit: '', label: 'CLS' },
  inp: { good: 200, poor: 500, unit: 'ms', label: 'INP' },
  ttfb: { good: 800, poor: 1800, unit: 'ms', label: 'TTFB' },
}

function scoreColor(cat: string | null) {
  if (cat === 'FAST' || cat === 'GOOD') return { color: '#16a34a', bg: '#dcfce7' }
  if (cat === 'AVERAGE' || cat === 'NEEDS_IMPROVEMENT') return { color: '#d97706', bg: '#fef3c7' }
  if (cat === 'SLOW' || cat === 'POOR') return { color: '#dc2626', bg: '#fef2f2' }
  return { color: '#64748b', bg: '#f1f5f9' }
}

function perfColor(score: number) {
  if (score >= 90) return '#16a34a'
  if (score >= 50) return '#d97706'
  return '#dc2626'
}

function labCat(key: string, val: number | null) {
  if (val === null) return null
  const t = CWV_THRESHOLDS[key]
  if (!t) return null
  if (val <= t.good) return 'FAST'
  if (val <= t.poor) return 'AVERAGE'
  return 'SLOW'
}

function fmtVal(key: string, val: number | null) {
  if (val === null) return 'N/A'
  if (key === 'cls') return val.toFixed(3)
  return `${Math.round(val)}ms`
}

function ScoreRing({ score }: { score: number }) {
  const c = perfColor(score)
  const r = 28, circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  return (
    <svg width={72} height={72} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={36} cy={36} r={r} fill="none" stroke="#f1f5f9" strokeWidth={6} />
      <circle cx={36} cy={36} r={r} fill="none" stroke={c} strokeWidth={6}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      <text x={36} y={36} textAnchor="middle" dominantBaseline="middle"
        style={{ fill: c, fontSize: 16, fontWeight: 800, transform: 'rotate(90deg)', transformOrigin: '36px 36px' }}>
        {score}
      </text>
    </svg>
  )
}

export default function CoreWebVitals({ siteUrl, providerToken }: Props) {
  const [url, setUrl] = useState(siteUrl.replace(/\/$/, '') || '')
  const [mobileData, setMobileData] = useState<any>(null)
  const [desktopData, setDesktopData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [batchPages, setBatchPages] = useState<any[]>([])
  const [batchLoading, setBatchLoading] = useState(false)
  const [batchResults, setBatchResults] = useState<any[]>([])

  const analyze = async () => {
    if (!url) return
    setLoading(true)
    setMobileData(null); setDesktopData(null)
    try {
      const result = await cwvApi.analyzeAll(url)
      const r = safeObj(result)
      setMobileData(safeObj(r.mobile))
      setDesktopData(safeObj(r.desktop))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const batchAnalyze = async () => {
    setBatchLoading(true)
    setBatchResults([])
    const endDate = format(new Date(), 'yyyy-MM-dd')
    const startDate = format(subDays(new Date(), 28), 'yyyy-MM-dd')
    try {
      const pages = await gscApi.topPages(providerToken, { siteUrl, startDate, endDate, rowLimit: 10 })
      const list = safeArr(pages)
      setBatchPages(list)
      const results: any[] = []
      for (const p of list.slice(0, 8)) {
        try {
          const r = await cwvApi.analyze(p.page, 'mobile')
          results.push({ page: p.page, clicks: p.clicks, ...safeObj(r) })
          setBatchResults([...results])
        } catch { results.push({ page: p.page, clicks: p.clicks, error: true }) }
      }
    } catch (e) { console.error(e) }
    finally { setBatchLoading(false) }
  }

  const renderMetrics = (data: any, label: string, Icon: any) => {
    if (!data) return null
    const fd = data.fieldData || {}
    const ld = data.labData || {}
    return (
      <div style={{ ...card, padding: '20px 22px', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Icon size={16} color="#6366f1" />
          <span style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>{label}</span>
          {data.overallCategory && (
            <span style={{ ...scoreColor(data.overallCategory), padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
              {data.overallCategory === 'FAST' ? '✅ Good' : data.overallCategory === 'AVERAGE' ? '⚠️ Needs Work' : '❌ Poor'}
            </span>
          )}
        </div>

        {/* Lighthouse scores */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 20, justifyContent: 'center' }}>
          {[
            { label: 'Performance', score: ld.performanceScore },
            { label: 'SEO', score: ld.seoScore },
            { label: 'Accessibility', score: ld.accessibilityScore },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <ScoreRing score={s.score || 0} />
              <p style={{ fontSize: 11, color: '#64748b', fontWeight: 500, marginTop: 4 }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* CWV metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {Object.entries(fd).map(([key, m]: [string, any]) => {
            if (!m || m.value === null) return null
            const sc = scoreColor(m.category)
            const t = CWV_THRESHOLDS[key]
            if (!t) return null
            return (
              <div key={key} style={{ background: sc.bg, borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: sc.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t.label}</p>
                <p style={{ fontSize: 18, fontWeight: 800, color: sc.color, margin: '4px 0' }}>{fmtVal(key, m.value)}</p>
                <p style={{ fontSize: 10, color: sc.color, opacity: 0.8 }}>{m.category?.replace(/_/g, ' ')}</p>
              </div>
            )
          })}
          {/* Lab CLS if no field data */}
          {!fd.cls?.value && ld.cls != null && (() => {
            const cat = labCat('cls', ld.cls); const sc = scoreColor(cat)
            return <div style={{ background: sc.bg, borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: sc.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>CLS</p>
              <p style={{ fontSize: 18, fontWeight: 800, color: sc.color, margin: '4px 0' }}>{ld.cls.toFixed(3)}</p>
              <p style={{ fontSize: 10, color: sc.color, opacity: 0.8 }}>Lab</p>
            </div>
          })()}
        </div>

        {/* Opportunities */}
        {(data.opportunities || []).length > 0 && (
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Top Fix Opportunities</p>
            {data.opportunities.slice(0, 4).map((op: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid #f1f5f9' }}>
                <AlertCircle size={13} color="#d97706" />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{op.title}</p>
                </div>
                {op.savingsMs > 0 && <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 700, whiteSpace: 'nowrap' }}>-{op.savingsMs}ms</span>}
              </div>
            ))}
          </div>
        )}

        {/* SEO audits */}
        {(data.seoAudits || []).length > 0 && (
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>SEO Checks</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {data.seoAudits.map((a: any, i: number) => (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: a.score === 1 ? '#dcfce7' : a.score === 0 ? '#fef2f2' : '#fef3c7', color: a.score === 1 ? '#16a34a' : a.score === 0 ? '#dc2626' : '#d97706' }}>
                  {a.score === 1 ? <CheckCircle size={11} /> : a.score === 0 ? <XCircle size={11} /> : <AlertCircle size={11} />}
                  {a.title}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* URL input */}
      <div style={{ ...card, padding: '20px 22px' }}>
        <h3 style={{ fontWeight: 700, fontSize: 15, color: '#1e293b', marginBottom: 4 }}>Core Web Vitals & Page Speed</h3>
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>Google ranking factor — analyze real-user CrUX data + Lighthouse scores for any URL</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://mysnapvitals.com"
              style={{ paddingLeft: 32, width: '100%', height: 38, border: '1px solid #e2e8f0', borderRadius: 9, fontSize: 13, color: '#374151', outline: 'none' }}
              onKeyDown={e => e.key === 'Enter' && analyze()} />
          </div>
          <button onClick={analyze} disabled={loading}
            style={{ height: 38, padding: '0 20px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, whiteSpace: 'nowrap' }}>
            {loading ? 'Analyzing...' : '⚡ Analyze'}
          </button>
          <button onClick={batchAnalyze} disabled={batchLoading}
            style={{ height: 38, padding: '0 16px', background: '#f1f5f9', color: '#6366f1', border: '1px solid #e2e8f0', borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: batchLoading ? 'not-allowed' : 'pointer', opacity: batchLoading ? 0.7 : 1, whiteSpace: 'nowrap' }}>
            {batchLoading ? 'Scanning...' : '📊 Scan Top Pages'}
          </button>
        </div>
        <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>Powered by DataForSEO on_page API · "Scan Top Pages" auto-analyzes your top 8 GSC pages</p>
      </div>

      {/* Mobile + Desktop results */}
      {(mobileData || desktopData || loading) && (
        <div style={{ display: 'flex', gap: 16 }}>
          {loading ? (
            <div style={{ ...card, padding: 60, flex: 1, textAlign: 'center' }}>
              <div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
              <p style={{ color: '#94a3b8' }}>Analyzing mobile & desktop...</p>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          ) : (
            <>
              {renderMetrics(mobileData, 'Mobile', Smartphone)}
              {renderMetrics(desktopData, 'Desktop', Monitor)}
            </>
          )}
        </div>
      )}

      {/* Batch results */}
      {batchResults.length > 0 && (
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
            <h3 style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>Top Pages Performance Scan</h3>
            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
              {batchLoading ? `Scanning... ${batchResults.length} / 8` : `${batchResults.length} pages analyzed`}
            </p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ background: '#f8fafc' }}>
                <tr>
                  {['Page', 'Clicks', 'Perf', 'SEO', 'LCP', 'CLS', 'Overall'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase', borderBottom: '1px solid #f1f5f9' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {batchResults.map((r, i) => {
                  const ld = r.labData || {}
                  const fd = r.fieldData || {}
                  const overall = r.overallCategory
                  const sc = scoreColor(overall)
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={{ padding: '10px 14px', maxWidth: 260 }}>
                        <p style={{ fontSize: 12, fontWeight: 500, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.page.replace(/https?:\/\/[^/]+/, '')}</p>
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: '#6366f1' }}>{r.clicks?.toLocaleString() || '-'}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontWeight: 800, color: perfColor(ld.performanceScore || 0) }}>{ld.performanceScore ?? '-'}</span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontWeight: 800, color: perfColor(ld.seoScore || 0) }}>{ld.seoScore ?? '-'}</span>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#374151' }}>{ld.lcp ? `${Math.round(ld.lcp)}ms` : '-'}</td>
                      <td style={{ padding: '10px 14px', color: '#374151' }}>{ld.cls != null ? ld.cls.toFixed(3) : '-'}</td>
                      <td style={{ padding: '10px 14px' }}>
                        {overall ? <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, ...sc }}>{overall === 'FAST' ? '✅ Good' : overall === 'AVERAGE' ? '⚠️ Fair' : '❌ Poor'}</span> : <span style={{ color: '#94a3b8' }}>Lab only</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
