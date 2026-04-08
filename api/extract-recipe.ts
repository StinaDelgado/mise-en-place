import type { VercelRequest, VercelResponse } from '@vercel/node'
import { YoutubeTranscript } from 'youtube-transcript'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY!

const RECIPE_PROMPT = `You are a recipe extraction assistant. Extract the recipe from the following content and return ONLY valid JSON with this exact shape:
{
  "title": "string",
  "description": "string or null",
  "yield_amount": "string or null",
  "yield_servings": "integer or null",
  "prep_time_mins": "integer or null",
  "cook_time_mins": "integer or null",
  "ingredients": [{ "amount": "string or null", "amount_decimal": "float or null", "unit": "string or null", "item": "string", "note": "string or null" }],
  "steps": [{ "order": "integer", "text": "string" }],
  "tags": ["string"],
  "notes": "string or null"
}
Rules:
- yield_servings must be an integer or null
- amount_decimal must be a float or null (null if non-numeric e.g. "a pinch", "to taste")
- unit and amount should be empty string "" (not null) if not applicable
- Use null for any field not present in the source
- Do not invent ingredients or steps
- tags should be 1-3 words each, lowercase`

async function callGemini(content: string): Promise<Record<string, unknown>> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${RECIPE_PROMPT}\n\n${content}` }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    }
  )
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Gemini error ${response.status}: ${body}`)
  }
  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('No response from Gemini')
  return JSON.parse(text)
}

function isYouTube(url: string) {
  return url.includes('youtube.com/watch') || url.includes('youtu.be/')
}

function isNYT(url: string) {
  return url.includes('cooking.nytimes.com') || (url.includes('nytimes.com') && url.includes('recipe'))
}

function parseYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.hostname.includes('youtu.be')) return parsed.pathname.slice(1)
    return parsed.searchParams.get('v')
  } catch {
    return null
  }
}

async function downloadAsBase64(url: string): Promise<{ base64: string; mime: string } | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buffer = await res.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const mime = res.headers.get('content-type') || 'image/jpeg'
    return { base64, mime }
  } catch {
    return null
  }
}

async function extractYouTube(url: string) {
  const videoId = parseYouTubeId(url)
  if (!videoId) throw new Error('Invalid YouTube URL')

  const ytRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet&key=${YOUTUBE_API_KEY}`
  )
  if (!ytRes.ok) throw new Error(`YouTube API error: ${ytRes.status}`)
  const ytData = await ytRes.json()

  if (!ytData.items?.length) throw new Error('YouTube video not found. Check that the URL is correct and the video is public.')
  const snippet = ytData.items[0].snippet

  const thumbnailUrl =
    snippet.thumbnails?.maxres?.url ||
    snippet.thumbnails?.high?.url ||
    snippet.thumbnails?.medium?.url ||
    null

  const thumbnail = thumbnailUrl ? await downloadAsBase64(thumbnailUrl) : null

  // Try to fetch transcript — much more reliable than description for recipes
  let transcript = ''
  try {
    const lines = await YoutubeTranscript.fetchTranscript(videoId)
    transcript = lines.map(l => l.text).join(' ')
  } catch { /* transcript not available, fall back to description */ }

  const content = transcript
    ? `Title: ${snippet.title}\n\nTranscript: ${transcript.slice(0, 12000)}`
    : `Title: ${snippet.title}\n\nDescription: ${snippet.description}`
  const recipe = await callGemini(content)

  return {
    ...recipe,
    title: recipe.title || snippet.title,
    source_url: url,
    source_type: 'url_youtube',
    original_content: snippet.description,
    extraction_confidence: 'medium',
    thumbnail_base64: thumbnail?.base64 ?? null,
    thumbnail_mime: thumbnail?.mime ?? null,
  }
}

function extractOgImage(html: string): string | null {
  const match =
    html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i) ||
    html.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:image"/i)
  return match?.[1] ?? null
}

function extractJsonLdImage(recipe: Record<string, unknown>): string | null {
  const image = recipe.image
  if (!image) return null
  if (typeof image === 'string') return image
  if (Array.isArray(image)) {
    const first = image[0]
    return typeof first === 'string' ? first : (first as Record<string, unknown>)?.url as string ?? null
  }
  if (typeof image === 'object') return (image as Record<string, unknown>).url as string ?? null
  return null
}

function findRecipeJsonLd(obj: unknown): Record<string, unknown> | null {
  if (!obj || typeof obj !== 'object') return null
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findRecipeJsonLd(item)
      if (found) return found
    }
    return null
  }
  const record = obj as Record<string, unknown>
  const type = record['@type']
  if (type === 'Recipe' || (Array.isArray(type) && (type as string[]).includes('Recipe'))) {
    return record
  }
  if (record['@graph']) return findRecipeJsonLd(record['@graph'])
  return null
}

async function extractRecipeSite(url: string) {
  if (isNYT(url)) {
    throw { status: 422, message: 'NYT Cooking recipes are behind a paywall and cannot be extracted. Try the Photo tab instead — take a screenshot of the recipe page.' }
  }

  const siteRes = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
    },
    redirect: 'follow',
  })

  if (!siteRes.ok) {
    const blockedSites = ['seriouseats.com', 'bonappetit.com']
    const isBlocked = blockedSites.some(s => url.includes(s))
    if (isBlocked || siteRes.status === 402 || siteRes.status === 403) {
      throw { status: 422, message: `This site blocks automated access. Try taking a screenshot of the recipe and using the Photo tab instead.` }
    }
    throw new Error(`Could not fetch that URL (${siteRes.status}). Check that it's publicly accessible.`)
  }
  const html = await siteRes.text()

  // Extract cover image from og:image (works for all sites)
  const ogImageUrl = extractOgImage(html)

  // Try JSON-LD structured data first
  const jsonLdMatches = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)]
  for (const match of jsonLdMatches) {
    try {
      const parsed = JSON.parse(match[1].trim())
      const recipe = findRecipeJsonLd(parsed)
      if (recipe) {
        const normalized = await callGemini(
          `Normalize this schema.org Recipe JSON into our format:\n${JSON.stringify(recipe)}`
        )
        // Prefer JSON-LD image over og:image
        const imageUrl = extractJsonLdImage(recipe) || ogImageUrl
        const thumbnail = imageUrl ? await downloadAsBase64(imageUrl) : null
        return {
          ...normalized,
          source_url: url,
          source_type: 'url_recipe',
          original_content: JSON.stringify(recipe).slice(0, 5000),
          extraction_confidence: 'high',
          thumbnail_base64: thumbnail?.base64 ?? null,
          thumbnail_mime: thumbnail?.mime ?? null,
        }
      }
    } catch { /* try next */ }
  }

  // Fallback: strip HTML and pass to Gemini
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 12000)

  const normalized = await callGemini(text)
  const thumbnail = ogImageUrl ? await downloadAsBase64(ogImageUrl) : null
  return {
    ...normalized,
    source_url: url,
    source_type: 'url_recipe',
    original_content: text.slice(0, 5000),
    extraction_confidence: 'medium',
    thumbnail_base64: thumbnail?.base64 ?? null,
    thumbnail_mime: thumbnail?.mime ?? null,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { url } = (req.body ?? {}) as { url?: string }
  if (!url?.trim()) {
    return res.status(400).json({ error: 'URL is required' })
  }

  try {
    const result = isYouTube(url) ? await extractYouTube(url) : await extractRecipeSite(url)
    return res.status(200).json(result)
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) {
      const e = err as { status: number; message: string }
      return res.status(e.status).json({ error: e.message })
    }
    const message = err instanceof Error ? err.message : 'Extraction failed'
    console.error('extract-recipe error:', err)
    return res.status(500).json({ error: message })
  }
}
