
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DFS_LOGIN = 'chloelee@puwell.com'
const DFS_PASSWORD = 'a91b3259983a4853'
const dfsAuth = btoa(`${DFS_LOGIN}:${DFS_PASSWORD}`)

async function dfsPost(endpoint: string, data: any) {
  const r = await fetch(`https://api.dataforseo.com/v3/${endpoint}`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${dfsAuth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  return r.json()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { action, params } = await req.json()
    const { keywords, domain, target, locationCode = 2840, languageCode = 'en', limit = 100 } = params || {}
    let result: any

    if (action === 'volume') {
      const payload = keywords.map((kw: string) => ({ keyword: kw, location_code: locationCode, language_code: languageCode }))
      const d = await dfsPost('keywords_data/google_ads/search_volume/live', payload)
      result = (d.tasks || []).flatMap((t: any) => (t.result || []).flatMap((r: any) => r.items || []))

    } else if (action === 'difficulty') {
      const payload = keywords.map((kw: string) => ({ keyword: kw, location_code: locationCode, language_code: languageCode }))
      const d = await dfsPost('dataforseo_labs/google/keyword_difficulty/live', payload)
      result = (d.tasks || []).flatMap((t: any) => (t.result || []).flatMap((r: any) => r.items || []))

    } else if (action === 'competitor-keywords') {
      const d = await dfsPost('dataforseo_labs/google/ranked_keywords/live', [{ target: domain, location_code: locationCode, language_code: languageCode, limit, order_by: ['etv,desc'], filters: ['etv', '>', 0] }])
      result = (d.tasks || []).flatMap((t: any) => (t.result || []).flatMap((r: any) => r.items || []))

    } else if (action === 'domain-overview') {
      const d = await dfsPost('dataforseo_labs/google/domain_rank_overview/live', [{ target: domain, location_code: locationCode, language_code: languageCode }])
      const items = (d.tasks || []).flatMap((t: any) => (t.result || []).flatMap((r: any) => r.items || []))
      result = items[0] || {}

    } else if (action === 'backlinks') {
      const d = await dfsPost('backlinks/backlinks/live', [{ target, limit, order_by: ['domain_from_rank,desc'], filters: ['dofollow', '=', true] }])
      result = (d.tasks || []).flatMap((t: any) => (t.result || []).flatMap((r: any) => r.items || []))

    } else if (action === 'backlinks-summary') {
      const d = await dfsPost('backlinks/summary/live', [{ target }])
      const items = (d.tasks || []).flatMap((t: any) => (t.result || []).flatMap((r: any) => r.items || []))
      result = items[0] || {}

    } else if (action === 'keyword-ideas') {
      const d = await dfsPost('dataforseo_labs/google/keyword_ideas/live', [{ keywords, location_code: locationCode, language_code: languageCode, limit }])
      result = (d.tasks || []).flatMap((t: any) => (t.result || []).flatMap((r: any) => r.items || []))

    } else if (action === 'keyword-gap') {
      const { targets, locationCode: lc = 2840, languageCode: lang = 'en' } = params
      const d = await dfsPost('dataforseo_labs/google/keyword_gap/live', [{ targets, location_code: lc, language_code: lang, limit: 100, order_by: ['etv,desc'] }])
      result = (d.tasks || []).flatMap((t: any) => (t.result || []).flatMap((r: any) => r.items || []))

    } else if (action === 'serp-features') {
      const { keyword, locationCode: lc = 2840, languageCode: lang = 'en' } = params
      const d = await dfsPost('serp/google/organic/live/regular', [{ keyword, location_code: lc, language_code: lang, depth: 10 }])
      const tasks = (d.tasks || []).flatMap((t: any) => (t.result || []))
      const serp = tasks[0] || {}
      const items = serp.items || []
      result = {
        keyword,
        totalResults: serp.se_results_count,
        features: [...new Set(items.map((i: any) => i.type))].filter(Boolean),
        featuredSnippet: items.find((i: any) => i.type === 'featured_snippet') || null,
        peopleAlsoAsk: items.filter((i: any) => i.type === 'people_also_ask').flatMap((i: any) => i.items || []).slice(0, 5),
        topResults: items.filter((i: any) => i.type === 'organic').slice(0, 10).map((i: any) => ({
          rank: i.rank_absolute, title: i.title, url: i.url, description: i.description,
          features: i.extra?.shown_url_breadcrumb || null,
        })),
      }


    } else if (action === 'trends-interest') {
      // Keyword trend over time
      const { keywords, locationCode = 2840, timeRange = 'past_12_months' } = params
      const d = await dfsPost('keywords_data/google_trends/explore/live', [{ keywords, type: 'web', time_range: timeRange, location_code: locationCode }])
      const items = (d.tasks?.[0]?.result?.[0]?.items || [])
      const graph = items.find((i: any) => i.type === 'google_trends_graph')
      result = { data: (graph?.data || []).map((p: any) => ({ date: p.date_from, value: p.values?.[0] || 0 })), keywords }

    } else if (action === 'trends-regions') {
      // Regional interest breakdown
      const { keywords, locationCode = 2840, timeRange = 'past_12_months' } = params
      const d = await dfsPost('keywords_data/google_trends/explore/live', [{ keywords, type: 'web', time_range: timeRange, location_code: locationCode }])
      const items = (d.tasks?.[0]?.result?.[0]?.items || [])
      const geo = items.find((i: any) => i.type === 'google_trends_countries_and_territories')
      result = (geo?.data || []).slice(0, 15).map((r: any) => ({ region: r.geo_name || r.geo, value: r.values?.[0] || 0, code: r.geo }))

    } else if (action === 'trends-related') {
      // Rising & top related queries
      const { keywords, locationCode = 2840, timeRange = 'past_12_months' } = params
      const d = await dfsPost('keywords_data/google_trends/explore/live', [{ keywords, type: 'web', time_range: timeRange, location_code: locationCode }])
      const items = (d.tasks?.[0]?.result?.[0]?.items || [])
      const rising = items.find((i: any) => i.type === 'google_trends_queries' && i.title?.toLowerCase().includes('rising'))
      const top = items.find((i: any) => i.type === 'google_trends_queries' && !i.title?.toLowerCase().includes('rising'))
      result = {
        rising: (rising?.data || []).slice(0, 10).map((q: any) => ({ query: q.query, value: q.values?.[0] || 0 })),
        top: (top?.data || []).slice(0, 10).map((q: any) => ({ query: q.query, value: q.values?.[0] || 0 }))
      }

    } else if (action === 'trends-compare') {
      // Compare multiple keywords
      const { keywords, locationCode = 2840, timeRange = 'past_12_months' } = params
      const d = await dfsPost('keywords_data/google_trends/explore/live', [{ keywords, type: 'web', time_range: timeRange, location_code: locationCode }])
      const items = (d.tasks?.[0]?.result?.[0]?.items || [])
      const graph = items.find((i: any) => i.type === 'google_trends_graph')
      if (!graph?.data) { result = [] }
      result = (graph.data || []).map((p: any) => {
        const point: any = { date: p.date_from }
        keywords.forEach((kw: string, i: number) => { point[kw] = p.values?.[i] || 0 })
        return point
      })

    } else {
      return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
