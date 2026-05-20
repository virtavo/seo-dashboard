import { useState } from 'react'
import { dfsApi, safeArr, safeObj } from '../api'
import { Search, Star, HelpCircle, FileText, Image } from 'lucide-react'

const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }

const FEATURE_LABELS: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  featured_snippet: { label: 'Featured Snippet', color: '#7c3aed', bg: '#ede9fe', icon: '⭐' },
  people_also_ask: { label: 'People Also Ask', color: '#2563eb', bg: '#dbeafe', icon: '❓' },
  local_pack: { label: 'Local Pack', color: '#16a34a', bg: '#dcfce7', icon: '📍' },
  shopping: { label: 'Shopping', color: '#d97706', bg: '#fef3c7', icon: '🛒' },
  images: { label: 'Image Pack', color: '#0891b2', bg: '#cffafe', icon: '🖼️' },
  videos: { label: 'Video Carousel', color: '#dc2626', bg: '#fef2f2', icon: '🎥' },
  knowledge_graph: { label: 'Knowledge Graph', color: '#059669', bg: '#d1fae5', icon: '📊' },
  twitter: { label: 'Twitter/X', color: '#0f172a', bg: '#f1f5f9', icon: '𝕏' },
  organic: { label: 'Organic', color: '#64748b', bg: '#f1f5f9', icon: '🔗' },
}

export default function SerpFeatures() {
  const [keyword, setKeyword] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const analyze = async () => {
    if (!keyword.trim()) return
    setLoading(true); setResult(null)
    try {
      const r = await dfsApi.serpFeatures({ keyword: keyword.trim() })
      setResult(safeObj(r))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const features: string[] = result?.features || []
  const nonOrganic = features.filter(f => f !== 'organic' && f !== 'spell')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ ...card, padding: '20px 22px' }}>
        <h3 style={{ fontWeight: 700, fontSize: 15, color: '#1e293b', marginBottom: 4 }}>SERP Features Analysis</h3>
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>See what SERP features appear for any keyword — Featured Snippets, PAA, Shopping, Images & more</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input value={keyword} onChange={e => setKeyword(e.target.value)}
              placeholder="e.g. blood pressure monitor"
              style={{ paddingLeft: 32, width: '100%', height: 38, border: '1px solid #e2e8f0', borderRadius: 9, fontSize: 13, color: '#374151', outline: 'none' }}
              onKeyDown={e => e.key === 'Enter' && analyze()} />
          </div>
          <button onClick={analyze} disabled={loading}
            style={{ height: 38, padding: '0 20px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, whiteSpace: 'nowrap' }}>
            {loading ? 'Analyzing...' : '🔍 Analyze SERP'}
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ ...card, padding: 60, textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <p style={{ color: '#94a3b8' }}>Fetching live SERP data...</p>
        </div>
      )}

      {result && !loading && (
        <>
          {/* Header */}
          <div style={{ ...card, padding: '16px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Keyword</p>
                <p style={{ fontSize: 20, fontWeight: 800, color: '#1e293b' }}>"{result.keyword}"</p>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <p style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>Total Results</p>
                <p style={{ fontSize: 18, fontWeight: 800, color: '#6366f1' }}>{result.totalResults?.toLocaleString() || '-'}</p>
              </div>
            </div>
          </div>

          {/* SERP Features */}
          <div style={{ ...card, padding: '20px 22px' }}>
            <h3 style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 12 }}>SERP Features Present</h3>
            {nonOrganic.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {nonOrganic.map((f, i) => {
                  const info = FEATURE_LABELS[f] || { label: f, color: '#64748b', bg: '#f1f5f9', icon: '📌' }
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 20, background: info.bg, border: `1px solid ${info.color}22` }}>
                      <span style={{ fontSize: 16 }}>{info.icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: info.color }}>{info.label}</span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p style={{ color: '#94a3b8', fontSize: 13 }}>Only organic results — no special SERP features detected</p>
            )}
            <div style={{ marginTop: 14, padding: '10px 14px', background: nonOrganic.length > 0 ? '#fef3c7' : '#f0fdf4', borderRadius: 10 }}>
              <p style={{ fontSize: 13, color: nonOrganic.length > 0 ? '#d97706' : '#16a34a', fontWeight: 600 }}>
                {nonOrganic.includes('featured_snippet')
                  ? '⭐ Featured Snippet present — structure your content with clear Q&A format to compete for it'
                  : nonOrganic.includes('people_also_ask')
                  ? '❓ PAA present — add FAQ sections to your content to appear in People Also Ask'
                  : nonOrganic.length > 0
                  ? '📊 SERP features present — optimize content format accordingly'
                  : '✅ Clean SERP — rank with well-optimized standard content'}
              </p>
            </div>
          </div>

          {/* Featured Snippet */}
          {result.featuredSnippet && (
            <div style={{ ...card, padding: '20px 22px', borderLeft: '4px solid #7c3aed' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <span style={{ fontSize: 16 }}>⭐</span>
                <h3 style={{ fontWeight: 700, fontSize: 14, color: '#7c3aed' }}>Featured Snippet</h3>
              </div>
              <p style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 6 }}>{result.featuredSnippet.title}</p>
              {result.featuredSnippet.description && <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, marginBottom: 8 }}>{result.featuredSnippet.description}</p>}
              {result.featuredSnippet.url && <a href={result.featuredSnippet.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#6366f1', textDecoration: 'none' }}>{result.featuredSnippet.url}</a>}
            </div>
          )}

          {/* People Also Ask */}
          {result.peopleAlsoAsk?.length > 0 && (
            <div style={{ ...card, padding: '20px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <span style={{ fontSize: 16 }}>❓</span>
                <h3 style={{ fontWeight: 700, fontSize: 14, color: '#2563eb' }}>People Also Ask</h3>
                <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 4 }}>→ Add these as FAQ sections in your content</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {result.peopleAlsoAsk.map((q: any, i: number) => (
                  <div key={i} style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #f1f5f9' }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{q.title || q.question || q}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top 10 Organic Results */}
          {result.topResults?.length > 0 && (
            <div style={{ ...card, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', background: '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
                <h3 style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>Top 10 Organic Results</h3>
                <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Study these pages to understand what Google rewards for this keyword</p>
              </div>
              <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {result.topResults.map((r: any, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 14px', background: i === 0 ? '#f8f7ff' : '#f8fafc', borderRadius: 10, border: `1px solid ${i === 0 ? '#e9d5ff' : '#f1f5f9'}` }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: i === 0 ? '#7c3aed' : '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: i === 0 ? '#fff' : '#64748b', flexShrink: 0 }}>
                      {r.rank}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: '#1a0dab', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</p>
                        <p style={{ fontSize: 11, color: '#16a34a', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.url}</p>
                      </a>
                      {r.description && <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {!result && !loading && (
        <div style={{ ...card, textAlign: 'center', padding: 60 }}>
          <Search size={40} style={{ color: '#cbd5e1', margin: '0 auto 16px' }} />
          <p style={{ color: '#94a3b8', fontWeight: 500 }}>Enter a keyword to analyze its SERP features</p>
          <p style={{ color: '#cbd5e1', fontSize: 13, marginTop: 6 }}>Powered by DataForSEO Live SERP API</p>
        </div>
      )}
    </div>
  )
}
