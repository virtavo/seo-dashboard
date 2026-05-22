// server/index.cjs — DataForSEO 代理 + 静态文件服务
// 部署到服务器后用 PM2 启动: pm2 start server/index.cjs --name seo-api
const http = require('http')
const https = require('https')
const PORT = process.env.API_PORT || 3001

const DFS_LOGIN = 'chloelee@puwell.com'
const DFS_PASSWORD = 'a91b3259983a4853'
const DFS_AUTH = Buffer.from(`${DFS_LOGIN}:${DFS_PASSWORD}`).toString('base64')

function dfsPost(path, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload)
    const options = {
      hostname: 'api.dataforseo.com',
      path: `/v3/${path}`,
      method: 'POST',
      headers: {
        'Authorization': `Basic ${DFS_AUTH}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      }
    }
    const req = https.request(options, res => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => { try { resolve(JSON.parse(data)) } catch(e) { reject(e) } })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  if (req.method === 'POST' && req.url === '/api/dfs') {
    let body = ''
    req.on('data', c => body += c)
    req.on('end', async () => {
      try {
        const { action, params } = JSON.parse(body)
        const { keywords = [], domain, target, locationCode: lc = 2840, languageCode: lang = 'en', limit = 100, targets } = params || {}
        let result

        if (action === 'volume') {
          const d = await dfsPost('keywords_data/google_ads/search_volume/live',
            keywords.map(kw => ({ keyword: kw, location_code: lc, language_code: lang })))
          result = (d.tasks?.[0]?.result || []).map(r => ({ keyword: r.keyword, volume: r.search_volume || 0, cpc: r.cpc || 0, competition: r.competition || 0 }))
        } else if (action === 'difficulty') {
          const d = await dfsPost('dataforseo_labs/google/keyword_difficulty/live',
            keywords.map(kw => ({ keyword: kw, location_code: lc, language_code: lang })))
          result = (d.tasks?.[0]?.result || []).map(r => ({ keyword: r.keyword, difficulty: r.keyword_difficulty || 0 }))
        } else if (action === 'competitor-keywords') {
          const d = await dfsPost('dataforseo_labs/google/ranked_keywords/live',
            [{ target: domain, location_code: lc, language_code: lang, limit, order_by: ['etv,desc'], filters: ['etv', '>', 0] }])
          result = (d.tasks?.[0]?.result?.[0]?.items || []).map(i => ({ keyword: i.keyword_data?.keyword, position: i.ranked_serp_element?.serp_item?.rank_absolute, url: i.ranked_serp_element?.serp_item?.url, volume: i.keyword_data?.keyword_info?.search_volume || 0 }))
        } else if (action === 'domain-overview') {
          const d = await dfsPost('dataforseo_labs/google/domain_rank_overview/live',
            [{ target: domain || target, location_code: lc, language_code: lang }])
          result = d.tasks?.[0]?.result?.[0] || {}
        } else if (action === 'backlinks') {
          const d = await dfsPost('backlinks/backlinks/live',
            [{ target: target || domain, limit, mode: 'as_is', filters: ['dofollow', '=', true] }])
          result = (d.tasks?.[0]?.result?.[0]?.items || []).map(i => ({ source: i.url_from, target: i.url_to, anchor: i.anchor, domain_rank: i.domain_from_rank || 0, dofollow: i.dofollow }))
        } else if (action === 'backlinks-summary') {
          const d = await dfsPost('backlinks/summary/live', [{ target: target || domain, include_subdomains: true }])
          result = d.tasks?.[0]?.result?.[0] || {}
        } else if (action === 'keyword-ideas') {
          const d = await dfsPost('dataforseo_labs/google/keyword_ideas/live',
            [{ keywords, location_code: lc, language_code: lang, limit }])
          result = (d.tasks?.[0]?.result?.[0]?.items || []).map(i => ({ keyword: i.keyword, volume: i.keyword_info?.search_volume || 0, difficulty: i.keyword_properties?.keyword_difficulty || 0, cpc: i.keyword_info?.cpc || 0 }))
        } else if (action === 'keyword-gap') {
          const d = await dfsPost('dataforseo_labs/google/keyword_gap/live',
            [{ targets: targets || [], location_code: lc || 2840, language_code: lang || 'en', limit: 100, order_by: ['etv,desc'] }])
          result = (d.tasks?.[0]?.result?.[0]?.items || [])
        } else if (action === 'serp-features') {
          const { keyword } = params
          const d = await dfsPost('serp/google/organic/live/regular',
            [{ keyword, location_code: lc, language_code: lang, depth: 10 }])
          const items = d.tasks?.[0]?.result?.[0]?.items || []
          result = { keyword, items: items.map(i => ({ position: i.rank_absolute, url: i.url, title: i.title, type: i.type })) }
        } else {
          res.writeHead(400); res.end(JSON.stringify({ error: 'Unknown action' })); return
        }

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(result))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
    })
    return
  }

  res.writeHead(404); res.end('Not found')
})

server.listen(PORT, () => console.log(`SEO API server running on port ${PORT}`))
