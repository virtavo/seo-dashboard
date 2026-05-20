import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { TrendingUp, MapPin, Search, GitCompare, Calendar, Loader2, AlertCircle } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts'

const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }
const LINE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4']

async function callDfs(action: string, params: any) {
  const { data, error } = await supabase.functions.invoke('dfs-proxy', { body: { action, params } })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  return data
}

function AiTag({ color, text }: { color: string; text: string }) {
  return <span style={{ display: 'inline-block', fontSize: 11, padding: '2px 8px', borderRadius: 20, background: color === 'green' ? '#ecfdf5' : color === 'yellow' ? '#fffbeb' : '#fef2f2', color: color === 'green' ? '#065f46' : color === 'yellow' ? '#92400e' : '#991b1b', fontWeight: 600, marginRight: 6 }}>{text}</span>
}

function LoadingCard({ label }: { label: string }) {
  return (
    <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, gap: 12, color: '#94a3b8' }}>
      <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
      <span style={{ fontSize: 14 }}>Loading {label}...</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

function ErrorCard({ msg }: { msg: string }) {
  return (
    <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 10, color: '#ef4444', minHeight: 120 }}>
      <AlertCircle size={18} /><span style={{ fontSize: 13 }}>{msg}</span>
    </div>
  )
}

export default function Trends({ siteUrl }: { siteUrl: string }) {
  const [keywords, setKeywords] = useState('blood pressure monitor')
  const [compareKeywords, setCompareKeywords] = useState('blood pressure monitor, wrist blood pressure, omron blood pressure')
  const [timeRange, setTimeRange] = useState('past_12_months')
  const [trendData, setTrendData] = useState<any>(null)
  const [regionData, setRegionData] = useState<any[]>([])
  const [relatedData, setRelatedData] = useState<any>(null)
  const [compareData, setCompareData] = useState<any[]>([])
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  const kwList = keywords.split(',').map(k => k.trim()).filter(Boolean)
  const compareList = compareKeywords.split(',').map(k => k.trim()).filter(Boolean).slice(0, 5)

  const setLoad = (k: string, v: boolean) => setLoading(p => ({ ...p, [k]: v }))
  const setErr = (k: string, v: string) => setErrors(p => ({ ...p, [k]: v }))

  async function fetchTrend() {
    if (!kwList.length) return
    setLoad('trend', true); setErr('trend', '')
    try {
      const d = await callDfs('trends-interest', { keywords: kwList, timeRange })
      setTrendData(d)
    } catch (e: any) { setErr('trend', e.message) }
    setLoad('trend', false)
  }

  async function fetchRegions() {
    if (!kwList.length) return
    setLoad('regions', true); setErr('regions', '')
    try { setRegionData(await callDfs('trends-regions', { keywords: kwList, timeRange })) }
    catch (e: any) { setErr('regions', e.message) }
    setLoad('regions', false)
  }

  async function fetchRelated() {
    if (!kwList.length) return
    setLoad('related', true); setErr('related', '')
    try { setRelatedData(await callDfs('trends-related', { keywords: kwList, timeRange })) }
    catch (e: any) { setErr('related', e.message) }
    setLoad('related', false)
  }

  async function fetchCompare() {
    if (compareList.length < 2) return
    setLoad('compare', true); setErr('compare', '')
    try { setCompareData(await callDfs('trends-compare', { keywords: compareList, timeRange })) }
    catch (e: any) { setErr('compare', e.message) }
    setLoad('compare', false)
  }

  function runAll() {
    fetchTrend(); fetchRegions(); fetchRelated(); fetchCompare()
  }

  useEffect(() => { if (kwList.length) runAll() }, [])

  const timeRanges = [
    { value: 'past_7_days', label: '7 Days' },
    { value: 'past_30_days', label: '30 Days' },
    { value: 'past_90_days', label: '90 Days' },
    { value: 'past_12_months', label: '12 Months' },
    { value: 'past_5_years', label: '5 Years' },
  ]

  // Seasonal insight from trend data
  const trendValues = (trendData?.data || []).map((d: any) => d.value)
  const maxVal = Math.max(...trendValues)
  const minVal = Math.min(...trendValues)
  const peakPoint = trendData?.data?.find((d: any) => d.value === maxVal)
  const troughPoint = trendData?.data?.find((d: any) => d.value === minVal)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Controls */}
      <div style={{ ...card, padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '2 1 300px' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 5 }}>TARGET KEYWORDS <span style={{ color: '#94a3b8', fontWeight: 400 }}>(comma-separated)</span></label>
            <input value={keywords} onChange={e => setKeywords(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              placeholder="blood pressure monitor, wrist monitor..." />
          </div>
          <div style={{ flex: '1 1 140px' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 5 }}>TIME RANGE</label>
            <select value={timeRange} onChange={e => setTimeRange(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, background: '#fff', cursor: 'pointer' }}>
              {timeRanges.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <button onClick={runAll} style={{ padding: '9px 20px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            🔍 Analyze
          </button>
        </div>
      </div>

      {/* 1. Trend Over Time */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <TrendingUp size={16} color="#6366f1" />
          <h3 style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>Search Interest Over Time</h3>
        </div>
        {peakPoint && <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
          Peak: <strong>{peakPoint.date}</strong> (score {maxVal}) · Trough: <strong>{troughPoint?.date}</strong> (score {minVal}) ·
          <span style={{ color: maxVal > 60 ? '#10b981' : '#f59e0b', fontWeight: 600 }}> {maxVal > 60 ? ' High demand period identified' : ' Moderate demand'}</span>
        </p>}
        {!peakPoint && !loading.trend && <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Enter keywords and click Analyze</p>}
        {loading.trend ? <LoadingCard label="trend data" /> : errors.trend ? <ErrorCard msg={errors.trend} /> : trendData?.data?.length > 0 && (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => v?.slice(5)} interval={Math.floor(trendData.data.length / 8)} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: any) => [`${v} / 100`, 'Interest']} />
                <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            {/* Seasonal AI insight */}
            {maxVal > 0 && (
              <div style={{ marginTop: 12, padding: '10px 14px', background: '#f8faff', border: '1px solid #e0e7ff', borderRadius: 8, fontSize: 12 }}>
                <span style={{ fontWeight: 700, color: '#4f46e5' }}>🤖 Seasonal Insight: </span>
                {maxVal - minVal > 40
                  ? `强烈季节性波动（峰谷差 ${maxVal - minVal} 分），建议在 ${peakPoint?.date?.slice(0,7)} 前后集中发布内容和广告，提前 4-6 周备战流量高峰。`
                  : maxVal - minVal > 20
                  ? `中等季节性波动（峰谷差 ${maxVal - minVal} 分），${peakPoint?.date?.slice(0,7)} 是流量最佳时期，可适当增加内容产出。`
                  : `搜索需求较为稳定，全年均可持续发布内容，无明显季节性高峰需要特别备战。`}
              </div>
            )}
          </>
        )}
      </div>

      {/* 2+3. Regions + Related side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Regional Interest */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <MapPin size={16} color="#10b981" />
            <h3 style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>Regional Interest</h3>
          </div>
          {loading.regions ? <LoadingCard label="regions" /> : errors.regions ? <ErrorCard msg={errors.regions} /> : regionData.length > 0 ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {regionData.slice(0, 8).map((r, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                      <span style={{ color: '#374151', fontWeight: 500 }}>{r.region}</span>
                      <span style={{ color: '#94a3b8' }}>{r.value}/100</span>
                    </div>
                    <div style={{ height: 5, background: '#f1f5f9', borderRadius: 3 }}>
                      <div style={{ width: `${r.value}%`, height: '100%', background: i === 0 ? '#10b981' : '#a7f3d0', borderRadius: 3 }} />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, padding: '8px 12px', background: '#ecfdf5', borderRadius: 7, fontSize: 11, color: '#065f46' }}>
                🤖 <strong>Market Insight:</strong> {regionData[0]?.region} 是搜索热度最高市场，建议优先针对该地区优化本地化内容和 Google My Business。
              </div>
            </>
          ) : <p style={{ color: '#94a3b8', fontSize: 13 }}>Click Analyze to load regional data</p>}
        </div>

        {/* Related Queries */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Search size={16} color="#f59e0b" />
            <h3 style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>Related Queries</h3>
          </div>
          {loading.related ? <LoadingCard label="related queries" /> : errors.related ? <ErrorCard msg={errors.related} /> : relatedData ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', letterSpacing: '0.05em', marginBottom: 8 }}>🔺 RISING</p>
                {(relatedData.rising || []).map((q: any, i: number) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f8fafc', fontSize: 12 }}>
                    <span style={{ color: '#374151' }}>{q.query}</span>
                    <AiTag color="yellow" text={q.value > 5000 ? 'Breakout' : `+${q.value}%`} />
                  </div>
                ))}
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', letterSpacing: '0.05em', marginBottom: 8 }}>🔝 TOP</p>
                {(relatedData.top || []).map((q: any, i: number) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f8fafc', fontSize: 12 }}>
                    <span style={{ color: '#374151' }}>{q.query}</span>
                    <span style={{ color: '#94a3b8', fontSize: 11 }}>{q.value}/100</span>
                  </div>
                ))}
              </div>
              {relatedData.rising?.length > 0 && (
                <div style={{ gridColumn: '1/-1', padding: '8px 12px', background: '#fffbeb', borderRadius: 7, fontSize: 11, color: '#92400e' }}>
                  🤖 <strong>Keyword Opportunity:</strong> Rising 词 "{relatedData.rising[0]?.query}" 增速显著，可创建专题内容页面抢占排名先机。
                </div>
              )}
            </div>
          ) : <p style={{ color: '#94a3b8', fontSize: 13 }}>Click Analyze to load related queries</p>}
        </div>
      </div>

      {/* 4. Keyword Comparison */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <GitCompare size={16} color="#ef4444" />
          <h3 style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>Keyword Comparison</h3>
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
          <input value={compareKeywords} onChange={e => setCompareKeywords(e.target.value)}
            style={{ flex: 1, padding: '7px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 12, outline: 'none' }}
            placeholder="keyword1, keyword2, keyword3 (max 5)" />
          <button onClick={fetchCompare} style={{ padding: '7px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>Compare</button>
        </div>
        {loading.compare ? <LoadingCard label="comparison" /> : errors.compare ? <ErrorCard msg={errors.compare} /> : compareData.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={compareData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => v?.slice(5)} interval={Math.floor(compareData.length / 6)} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {compareList.map((kw, i) => <Line key={kw} type="monotone" dataKey={kw} stroke={LINE_COLORS[i % LINE_COLORS.length]} strokeWidth={2} dot={false} name={kw} />)}
              </LineChart>
            </ResponsiveContainer>
            {compareList.length >= 2 && compareData.length > 0 && (() => {
              const avgs = compareList.map(kw => ({ kw, avg: compareData.reduce((s: number, d: any) => s + (d[kw] || 0), 0) / compareData.length }))
              avgs.sort((a, b) => b.avg - a.avg)
              return (
                <div style={{ marginTop: 12, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#991b1b' }}>
                  🤖 <strong>Competitive Insight:</strong> "{avgs[0].kw}" 搜索均值最高（{Math.round(avgs[0].avg)}/100），
                  是核心竞争词。"{avgs[avgs.length-1].kw}" 搜索量相对低，可作为低竞争长尾词优先布局内容。
                </div>
              )
            })()}
          </>
        ) : <p style={{ color: '#94a3b8', fontSize: 13 }}>Enter 2-5 keywords to compare their search trends</p>}
      </div>
    </div>
  )
}
