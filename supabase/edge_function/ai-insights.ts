const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

const OPENROUTER_KEY = Deno.env.get('OPENROUTER_API_KEY') || ''
const MODEL = 'google/gemini-2.5-flash'

function avg(arr: number[]) { return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0 }
function pct(a: number, b: number) { return b === 0 ? 0 : Math.round(((a - b) / b) * 100) }

async function callLLM(systemPrompt: string, userContent: string): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://seo.foreverdoodle.com',
      'X-Title': 'SEO Dashboard AI Analysis'
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ],
      max_tokens: 600,
      temperature: 0.3
    })
  })
  const d = await res.json()
  if (d.error) throw new Error(d.error.message || JSON.stringify(d.error))
  return d.choices?.[0]?.message?.content || ''
}

function parseInsights(text: string): string[] {
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 10 && (l.startsWith('-') || l.startsWith('•') || l.startsWith('*') || /^\d+\./.test(l) || l.includes('：') || l.includes('✅') || l.includes('⚠') || l.includes('🔴') || l.includes('📊') || l.includes('💡') || l.includes('📱') || l.includes('🌍') || l.includes('🔺')))
    .map(l => l.replace(/^[-•*\d.]+\s*/, '').trim())
    .filter(l => l.length > 5)
    .slice(0, 6)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { type, data, period } = await req.json()
    let summary = ''
    let insights: string[] = []

    const sys = `你是专业的 SEO 和数据分析师。根据用户提供的 Google Analytics 4 数据，给出简洁、可执行的中文分析洞察。
要求：
- 每条建议以 emoji 开头（✅⚠️🔴💡📊📱🌍🔺💼 等）
- 每条一行，简洁有力（20-50字）
- 给出具体数字和对比
- 聚焦 SEO 优化行动建议
- 输出 4-6 条，每条独立一行`

    if (type === 'sessions-trend') {
      const sessions = (data || []).map((d: any) => d.sessions)
      const half = Math.floor(sessions.length / 2)
      const firstAvg = Math.round(avg(sessions.slice(0, half)))
      const secondAvg = Math.round(avg(sessions.slice(half)))
      const changePct = pct(secondAvg, firstAvg)
      const total = sessions.reduce((s: number, v: number) => s + v, 0)
      const maxDay = data?.reduce((a: any, b: any) => a.sessions > b.sessions ? a : b, data[0])
      const minDay = data?.reduce((a: any, b: any) => a.sessions < b.sessions ? a : b, data[0])
      summary = `总计 ${total.toLocaleString()} sessions，${changePct > 0 ? '↑' : changePct < 0 ? '↓' : '→'} ${Math.abs(changePct)}%`

      const prompt = `Sessions 趋势数据（${data?.length} 天）：
- 前半段日均 sessions：${firstAvg}
- 后半段日均 sessions：${secondAvg}
- 变化幅度：${changePct > 0 ? '+' : ''}${changePct}%
- 峰值：${maxDay?.date}（${maxDay?.sessions} sessions）
- 低谷：${minDay?.date}（${minDay?.sessions} sessions）
- 总计：${total.toLocaleString()} sessions

请给出 SEO 流量趋势分析和优化建议。`
      const raw = await callLLM(sys, prompt)
      insights = parseInsights(raw)
      if (!insights.length) insights = [raw.slice(0, 200)]

    } else if (type === 'traffic-sources') {
      const total = (data || []).reduce((s: number, r: any) => s + r.sessions, 0)
      const rows = (data || []).map((r: any) => `${r.channel}: ${r.sessions} sessions (${Math.round(r.sessions/total*100)}%)`).join('\n')
      summary = `共 ${total.toLocaleString()} sessions，${data?.length} 个渠道`

      const raw = await callLLM(sys, `流量来源分布数据：\n${rows}\n\n请分析各渠道 SEO 价值，并给出优化 Organic Search 流量的具体建议。`)
      insights = parseInsights(raw)
      if (!insights.length) insights = [raw.slice(0, 200)]

    } else if (type === 'devices') {
      const total = (data || []).reduce((s: number, r: any) => s + r.sessions, 0)
      const rows = (data || []).map((r: any) => `${r.device}: ${r.sessions} sessions (${Math.round(r.sessions/total*100)}%)`).join('\n')
      const mobile = data?.find((r: any) => r.device === 'mobile')
      const mobilePct = mobile ? Math.round(mobile.sessions / total * 100) : 0
      summary = `Mobile ${mobilePct}% · Desktop ${100 - mobilePct}%`

      const raw = await callLLM(sys, `设备分布数据：\n${rows}\n\n请基于设备分布给出 SEO 和用户体验优化建议（Mobile-First、Core Web Vitals 等）。`)
      insights = parseInsights(raw)
      if (!insights.length) insights = [raw.slice(0, 200)]

    } else if (type === 'top-pages') {
      const pages = (data || []).slice(0, 15)
      const total = pages.reduce((s: number, p: any) => s + p.pageviews, 0)
      const rows = pages.map((p: any) => `${p.path} | ${p.pageviews} PV | 跳出率${p.bounceRate}% | 停留${Math.round(p.avgDuration)}s`).join('\n')
      const highBounce = pages.filter((p: any) => p.bounceRate > 70).length
      summary = `分析 ${pages.length} 页面，高跳出率 ${highBounce} 个`

      const raw = await callLLM(sys, `热门页面数据（总计 ${total.toLocaleString()} PV）：\n${rows}\n\n请识别高价值页面和待优化页面，给出内容和 SEO 改进建议。`)
      insights = parseInsights(raw)
      if (!insights.length) insights = [raw.slice(0, 200)]

    } else if (type === 'countries') {
      const total = (data || []).reduce((s: number, r: any) => s + r.sessions, 0)
      const rows = (data || []).slice(0, 10).map((r: any) => `${r.country}: ${r.sessions} sessions (${Math.round(r.sessions/total*100)}%)`).join('\n')
      summary = `用户来自 ${data?.length} 个国家`

      const raw = await callLLM(sys, `地理分布数据（共 ${total.toLocaleString()} sessions）：\n${rows}\n\n请分析市场分布，给出本地化 SEO 和国际化内容策略建议。`)
      insights = parseInsights(raw)
      if (!insights.length) insights = [raw.slice(0, 200)]
    }

    return new Response(JSON.stringify({ summary, insights }), {
      headers: { ...cors, 'Content-Type': 'application/json' }
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }
})
