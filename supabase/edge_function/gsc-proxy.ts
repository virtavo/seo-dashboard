
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

    const gscBase = 'https://searchconsole.googleapis.com/webmasters/v3'
    const authHeader = { 'Authorization': `Bearer ${providerToken}` }

    let result: any

    if (action === 'sites') {
      const r = await fetch(`${gscBase}/sites`, { headers: authHeader })
      const d = await r.json()
      result = d.siteEntry || []

    } else if (action === 'keywords') {
      const { siteUrl, startDate, endDate, rowLimit = 1000 } = params
      const r = await fetch(`${gscBase}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
        method: 'POST', headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate, dimensions: ['query'], rowLimit, orderBy: [{ field: 'clicks', sortOrder: 'DESCENDING' }] })
      })
      const d = await r.json()
      result = d.rows || []

    } else if (action === 'keyword-history') {
      const { siteUrl, keyword, startDate, endDate } = params
      const r = await fetch(`${gscBase}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
        method: 'POST', headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate, dimensions: ['date', 'query'], dimensionFilterGroups: [{ filters: [{ dimension: 'query', expression: keyword, operator: 'equals' }] }] })
      })
      const d = await r.json()
      result = d.rows || []

    } else if (action === 'pages') {
      const { siteUrl, startDate, endDate, rowLimit = 500 } = params
      const r = await fetch(`${gscBase}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
        method: 'POST', headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate, dimensions: ['page'], rowLimit, orderBy: [{ field: 'clicks', sortOrder: 'DESCENDING' }] })
      })
      const d = await r.json()
      result = d.rows || []

    } else if (action === 'opportunities') {
      const { siteUrl, startDate, endDate } = params
      const r = await fetch(`${gscBase}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
        method: 'POST', headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate, dimensions: ['query'], rowLimit: 1000, orderBy: [{ field: 'impressions', sortOrder: 'DESCENDING' }] })
      })
      const d = await r.json()
      const rows = (d.rows || []).filter((r: any) => r.position >= 4 && r.position <= 20 && r.impressions >= 50)
      result = rows

    } else if (action === 'sitemaps') {
      const { siteUrl } = params
      const r = await fetch(`${gscBase}/sites/${encodeURIComponent(siteUrl)}/sitemaps`, { headers: authHeader })
      const d = await r.json()
      result = d.sitemap || []

    } else if (action === 'url-inspect') {
      const { siteUrl, inspectionUrl } = params
      const r = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
        method: 'POST', headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ inspectionUrl, siteUrl })
      })
      const d = await r.json()
      if (d.error) throw new Error(d.error.message)
      result = d.inspectionResult || d

    } else if (action === 'top-pages') {
      const { siteUrl, startDate, endDate, rowLimit = 100 } = params
      const r = await fetch(`${gscBase}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
        method: 'POST', headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate, dimensions: ['page'], rowLimit, orderBy: [{ field: 'clicks', sortOrder: 'DESCENDING' }] })
      })
      const d = await r.json()
      result = (d.rows || []).map((row: any) => ({
        page: row.keys[0],
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: parseFloat(row.position?.toFixed(1)),
      }))


    } else if (action === 'performance-trend') {
      // Daily performance trend: clicks + impressions over time
      const { siteUrl, startDate, endDate } = params
      const r = await fetch(`${gscBase}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
        method: 'POST', headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate, dimensions: ['date'], rowLimit: 500, orderBy: [{ field: 'date', sortOrder: 'ASCENDING' }] })
      })
      const d = await r.json()
      result = (d.rows || []).map((row: any) => ({
        date: row.keys[0],
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: parseFloat((row.ctr * 100).toFixed(2)),
        position: parseFloat(row.position?.toFixed(1)),
      }))

    } else if (action === 'by-country') {
      const { siteUrl, startDate, endDate, rowLimit = 20 } = params
      const r = await fetch(`${gscBase}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
        method: 'POST', headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate, dimensions: ['country'], rowLimit, orderBy: [{ field: 'clicks', sortOrder: 'DESCENDING' }] })
      })
      const d = await r.json()
      result = (d.rows || []).map((row: any) => ({
        country: row.keys[0],
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: parseFloat((row.ctr * 100).toFixed(2)),
        position: parseFloat(row.position?.toFixed(1)),
      }))

    } else if (action === 'by-device') {
      const { siteUrl, startDate, endDate } = params
      const r = await fetch(`${gscBase}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
        method: 'POST', headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate, dimensions: ['device'], rowLimit: 10 })
      })
      const d = await r.json()
      result = (d.rows || []).map((row: any) => ({
        device: row.keys[0],
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: parseFloat((row.ctr * 100).toFixed(2)),
        position: parseFloat(row.position?.toFixed(1)),
      }))

    } else if (action === 'by-search-type') {
      // web vs image vs video vs news
      const { siteUrl, startDate, endDate } = params
      const types = ['WEB', 'IMAGE', 'VIDEO', 'NEWS']
      const reqs = types.map(type =>
        fetch(`${gscBase}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
          method: 'POST', headers: { ...authHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify({ startDate, endDate, dimensions: ['query'], rowLimit: 1, type })
        }).then(r => r.json()).catch(() => ({}))
      )
      const responses = await Promise.all(reqs)
      result = types.map((type, i) => {
        const rows = responses[i]?.rows || []
        const totals = rows.reduce((acc: any, r: any) => ({ clicks: acc.clicks + r.clicks, impressions: acc.impressions + r.impressions }), { clicks: 0, impressions: 0 })
        return { type, ...totals }
      })

    } else if (action === 'top-keywords-by-page') {
      // Keywords driving traffic to a specific page
      const { siteUrl, startDate, endDate, page, rowLimit = 20 } = params
      const r = await fetch(`${gscBase}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
        method: 'POST', headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate, endDate, dimensions: ['query'], rowLimit,
          dimensionFilterGroups: [{ filters: [{ dimension: 'page', expression: page, operator: 'equals' }] }],
          orderBy: [{ field: 'clicks', sortOrder: 'DESCENDING' }]
        })
      })
      const d = await r.json()
      result = (d.rows || []).map((row: any) => ({
        keyword: row.keys[0],
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: parseFloat((row.ctr * 100).toFixed(2)),
        position: parseFloat(row.position?.toFixed(1)),
      }))

    } else {
      return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
