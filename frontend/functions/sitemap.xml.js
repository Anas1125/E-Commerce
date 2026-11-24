const SITE = 'https://e-commerce-3q5.pages.dev'
const API = 'https://e-commerce-api-lac-psi.vercel.app'
const escapeXml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c])

export async function onRequestGet({ env }) {
  const origin = (env.PUBLIC_SITE_URL || SITE).replace(/\/+$/, '')
  const api = (env.PUBLIC_API_URL || API).replace(/\/+$/, '')
  try {
    const lists = await Promise.all(['products', 'categories'].map(async name => {
      const response = await fetch(`${api}/api/${name}/`, { signal: AbortSignal.timeout(10000) })
      if (!response.ok) throw new Error('Catalogue unavailable')
      const data = await response.json()
      if (!Array.isArray(data)) throw new Error('Invalid catalogue')
      return data
    }))
    const [products, categories] = lists
    const paths = new Set(['/', '/shop', '/categories', '/deals', '/contact', '/privacy', '/terms'])
    for (const p of products) {
      if (p.is_active !== false && Number.isSafeInteger(p.id) && p.id > 0) paths.add('/products/' + p.id)
    }
    for (const c of categories) {
      if (c.is_active !== false && typeof c.slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(c.slug)) paths.add('/categories/' + c.slug)
    }
    if (paths.size > 50000) throw new Error('Sitemap requires splitting')
    const body = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      [...paths].map(path => '  <url><loc>' + escapeXml(origin + path) + '</loc></url>').join('\n') + '\n</urlset>\n'
    if (new TextEncoder().encode(body).length > 50 * 1024 * 1024) throw new Error('Sitemap too large')
    return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=300' } })
  } catch {
    return new Response('Sitemap temporarily unavailable', { status: 503, headers: { 'Retry-After': '300', 'Cache-Control': 'no-store' } })
  }
}
