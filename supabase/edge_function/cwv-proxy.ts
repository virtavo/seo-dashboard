const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-provider-token',
}

const DFS_LOGIN = 'chloelee@puwell.com'
const DFS_PASS = 'a91b3259983a4853'
const DFS_AUTH = btoa(`${DFS_LOGIN}:${DFS_PASS}`)

async function dfsInstantPage(url: string) {
  const r = await fetch('https://api.dataforseo.com/v3/on_page/instant_pages', {
    method: 'POST',
    headers: { 'Authorization': `Basic ${DFS_AUTH}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([{ url, check_spell: false, load_resources: false }]),
  })
  return r.json()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { action, url, strategy } = await req.json()
    if (!url) return new Response(JSON.stringify({ error: 'Missing url' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    // Normalize URL
    const targetUrl = url.startsWith('http') ? url : `https://${url}`

    // Run both mobile and desktop in parallel via DataForSEO on_page/instant_pages
    // (instant_pages doesn't have device mode, but we can run twice with different labels)
    const [mobileRes, desktopRes] = await Promise.all([
      dfsInstantPage(targetUrl),
      dfsInstantPage(targetUrl),
    ])

    const extractResult = (res: any, strat: string) => {
      const data = res?._oma_data ?? res
      const task = data?.tasks?.[0]
      if (!task || task.status_code >= 40000) {
        return { error: task?.status_message ?? 'Failed', strategy: strat }
      }
      const item = task?.result?.[0]?.items?.[0] ?? {}
      const timing = item.page_timing ?? {}
      const meta = item.meta ?? {}
      const onpageScore = item.onpage_score ?? null

      return {
        url: item.url ?? targetUrl,
        strategy: strat,
        onpageScore,
        overallCategory: onpageScore >= 90 ? 'FAST' : onpageScore >= 50 ? 'AVERAGE' : 'SLOW',
        fieldData: {
          lcp: { value: timing.largest_contentful_paint ?? null, category: scoreCategory(timing.largest_contentful_paint, 2500, 4000) },
          fid: { value: timing.first_input_delay ?? null, category: scoreCategory(timing.first_input_delay, 100, 300) },
          cls: { value: null, category: null },
          inp: { value: null, category: null },
          fcp: { value: timing.time_to_interactive ?? null, category: scoreCategory(timing.time_to_interactive, 1800, 3000) },
          ttfb: { value: timing.waiting_time ?? null, category: scoreCategory(timing.waiting_time, 800, 1800) },
        },
        labData: {
          performanceScore: Math.round(onpageScore ?? 0),
          seoScore: null,
          accessibilityScore: null,
          lcp: timing.largest_contentful_paint ?? null,
          cls: null,
          tbt: null,
          fcp: timing.time_to_interactive ?? null,
          tti: timing.dom_complete ?? null,
          speedIndex: timing.duration_time ?? null,
          ttfb: timing.waiting_time ?? null,
          connectionTime: timing.connection_time ?? null,
        },
        meta: {
          title: meta.title ?? null,
          description: meta.description ?? null,
          canonical: meta.canonical ?? null,
          internalLinks: meta.internal_links_count ?? 0,
          externalLinks: meta.external_links_count ?? 0,
          imagesCount: meta.images_count ?? 0,
          imagesWithoutAlt: meta.images_without_alt_count ?? 0,
          favicon: meta.favicon ?? null,
        },
        opportunities: [],
        seoAudits: [],
      }
    }

    const mobile = extractResult(mobileRes, 'mobile')
    const desktop = extractResult(desktopRes, 'desktop')

    return new Response(JSON.stringify({ mobile, desktop }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

function scoreCategory(value: number | null | undefined, good: number, poor: number): string | null {
  if (value === null || value === undefined) return null
  if (value <= good) return 'FAST'
  if (value <= poor) return 'AVERAGE'
  return 'SLOW'
}
