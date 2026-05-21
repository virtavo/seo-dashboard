
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-provider-token',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { action, params } = await req.json()
    const providerToken = req.headers.get('x-provider-token')
    if (!providerToken) return new Response(JSON.stringify({ error: 'Missing provider token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const authHeader = { 'Authorization': `Bearer ${providerToken}`, 'Content-Type': 'application/json' }
    const { propertyId, startDate, endDate } = params
    const gaBase = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}`

    let result: any

    // ── List GA4 Properties ──────────────────────────────────────────
    if (action === 'list-properties') {
      const r = await fetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries', { headers: authHeader })
      const d = await r.json()
      const props: any[] = []
      ;(d.accountSummaries || []).forEach((acc: any) => {
        ;(acc.propertySummaries || []).forEach((p: any) => {
          props.push({ id: p.property.replace('properties/', ''), name: p.displayName, account: acc.displayName })
        })
      })
      result = props

    // ── Overview metrics ─────────────────────────────────────────────
    } else if (action === 'overview') {
      const r = await fetch(`${gaBase}:runReport`, {
        method: 'POST', headers: authHeader,
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }, { startDate: getPrevPeriodStart(startDate, endDate), endDate: getPrevPeriodEnd(startDate) }],
          metrics: [
            { name: 'sessions' }, { name: 'totalUsers' }, { name: 'screenPageViews' },
            { name: 'bounceRate' }, { name: 'averageSessionDuration' }
          ]
        })
      })
      const d = await r.json()
      if (d.error) throw new Error(d.error.message)
      const cur = d.rows?.[0]?.metricValues || []
      const prev = d.rows?.[1]?.metricValues || []
      result = {
        sessions: { value: parseInt(cur[0]?.value || '0'), prev: parseInt(prev[0]?.value || '0') },
        users: { value: parseInt(cur[1]?.value || '0'), prev: parseInt(prev[1]?.value || '0') },
        pageviews: { value: parseInt(cur[2]?.value || '0'), prev: parseInt(prev[2]?.value || '0') },
        bounceRate: { value: parseFloat((parseFloat(cur[3]?.value || '0') * 100).toFixed(1)), prev: parseFloat((parseFloat(prev[3]?.value || '0') * 100).toFixed(1)) },
        avgDuration: { value: parseFloat(parseFloat(cur[4]?.value || '0').toFixed(0)), prev: parseFloat(parseFloat(prev[4]?.value || '0').toFixed(0)) },
        conversions: { value: 0, prev: 0 }
      }

    // ── Sessions trend (daily) ────────────────────────────────────────
    } else if (action === 'sessions-trend') {
      const r = await fetch(`${gaBase}:runReport`, {
        method: 'POST', headers: authHeader,
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'date' }],
          metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
          orderBys: [{ dimension: { dimensionName: 'date' } }]
        })
      })
      const d = await r.json()
      if (d.error) throw new Error(d.error.message)
      result = (d.rows || []).map((row: any) => ({
        date: row.dimensionValues[0].value,
        sessions: parseInt(row.metricValues[0].value),
        users: parseInt(row.metricValues[1].value)
      }))

    // ── Top pages ─────────────────────────────────────────────────────
    } else if (action === 'top-pages') {
      const r = await fetch(`${gaBase}:runReport`, {
        method: 'POST', headers: authHeader,
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
          metrics: [{ name: 'screenPageViews' }, { name: 'totalUsers' }, { name: 'averageSessionDuration' }, { name: 'bounceRate' }],
          orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
          limit: 50
        })
      })
      const d = await r.json()
      if (d.error) throw new Error(d.error.message)
      result = (d.rows || []).map((row: any) => ({
        path: row.dimensionValues[0].value,
        title: row.dimensionValues[1].value,
        pageviews: parseInt(row.metricValues[0].value),
        users: parseInt(row.metricValues[1].value),
        avgDuration: parseFloat(parseFloat(row.metricValues[2].value).toFixed(0)),
        bounceRate: parseFloat((parseFloat(row.metricValues[3].value) * 100).toFixed(1))
      }))

    // ── Traffic sources ───────────────────────────────────────────────
    } else if (action === 'traffic-sources') {
      // Try sessionDefaultChannelGroup first (may fail on older/limited properties)
      let r = await fetch(`${gaBase}:runReport`, {
        method: 'POST', headers: authHeader,
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'sessionDefaultChannelGroup' }],
          metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }]
        })
      })
      let d = await r.json()
      let usedDim = 'sessionDefaultChannelGroup'
      // Fallback 1: sessionMedium
      if (d.error) {
        usedDim = 'sessionMedium'
        r = await fetch(`${gaBase}:runReport`, {
          method: 'POST', headers: authHeader,
          body: JSON.stringify({
            dateRanges: [{ startDate, endDate }],
            dimensions: [{ name: 'sessionMedium' }],
            metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
            orderBys: [{ metric: { metricName: 'sessions' }, desc: true }]
          })
        })
        d = await r.json()
      }
      // Fallback 2: sessionSource (most universally available)
      if (d.error) {
        usedDim = 'sessionSource'
        r = await fetch(`${gaBase}:runReport`, {
          method: 'POST', headers: authHeader,
          body: JSON.stringify({
            dateRanges: [{ startDate, endDate }],
            dimensions: [{ name: 'sessionSource' }],
            metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
            orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
            limit: 20
          })
        })
        d = await r.json()
      }
      if (d.error) throw new Error(`[${usedDim}] ${d.error.message || JSON.stringify(d.error)}`)
      result = (d.rows || []).map((row: any) => ({
        channel: row.dimensionValues[0].value,
        sessions: parseInt(row.metricValues[0].value),
        users: parseInt(row.metricValues[1].value),
        conversions: 0
      }))

    // ── Devices breakdown ─────────────────────────────────────────────
    } else if (action === 'devices') {
      const r = await fetch(`${gaBase}:runReport`, {
        method: 'POST', headers: authHeader,
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'deviceCategory' }],
          metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }]
        })
      })
      const d = await r.json()
      if (d.error) throw new Error(d.error.message)
      result = (d.rows || []).map((row: any) => ({
        device: row.dimensionValues[0].value,
        sessions: parseInt(row.metricValues[0].value),
        users: parseInt(row.metricValues[1].value)
      }))

    // ── Country breakdown ─────────────────────────────────────────────
    } else if (action === 'countries') {
      const r = await fetch(`${gaBase}:runReport`, {
        method: 'POST', headers: authHeader,
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'country' }],
          metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: 20
        })
      })
      const d = await r.json()
      if (d.error) throw new Error(d.error.message)
      result = (d.rows || []).map((row: any) => ({
        country: row.dimensionValues[0].value,
        sessions: parseInt(row.metricValues[0].value),
        users: parseInt(row.metricValues[1].value)
      }))

    } else if (action === 'debug') {
      // Debug: return raw GA4 API response for traffic-sources
      const { propertyId, startDate, endDate } = params
      const gaBaseDebug = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}`
      const r1 = await fetch(`${gaBaseDebug}:runReport`, {
        method: 'POST', headers: authHeader,
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'sessionDefaultChannelGroup' }],
          metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }]
        })
      })
      const d1 = await r1.json()
      const r2 = await fetch(`${gaBaseDebug}:runReport`, {
        method: 'POST', headers: authHeader,
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'deviceCategory' }],
          metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }]
        })
      })
      const d2 = await r2.json()
      // Also test accountSummaries
      const r3 = await fetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries', { headers: authHeader })
      const d3 = await r3.json()
      result = { traffic_sources_raw: d1, devices_raw: d2, account_summaries_raw: d3, token_preview: providerToken.slice(0, 20) + '...' }
    } else {
      return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})

function getPrevPeriodStart(startDate: string, endDate: string): string {
  const start = new Date(startDate), end = new Date(endDate)
  const days = Math.round((end.getTime() - start.getTime()) / 86400000)
  const prevEnd = new Date(start); prevEnd.setDate(prevEnd.getDate() - 1)
  const prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate() - days)
  return prevStart.toISOString().split('T')[0]
}
function getPrevPeriodEnd(startDate: string): string {
  const d = new Date(startDate); d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}
