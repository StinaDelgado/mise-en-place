import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { RecipeForm } from '@/components/RecipeForm'
import type { Recipe, SourceType } from '@/lib/types'

export const Route = createFileRoute('/recipes/new')({ component: NewRecipe })

const TABS: { id: SourceType | 'url'; label: string }[] = [
  { id: 'url', label: 'URL' },
  { id: 'original', label: 'Original' },
  { id: 'manual', label: 'Manual' },
]

function NewRecipe() {
  const navigate = useNavigate()
  const [userId, setUserId] = useState<string | null>(null)
  const [tab, setTab] = useState<SourceType | 'url'>('url')

  // URL extraction state
  const [urlInput, setUrlInput] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState('')
  const [extracted, setExtracted] = useState<Partial<Recipe> | null>(null)
  const [extractedSourceType, setExtractedSourceType] = useState<SourceType>('manual')
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const urlInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate({ to: '/login' })
      else setUserId(data.session.user.id)
    })
  }, [navigate])

  function handleTabChange(id: SourceType | 'url') {
    setTab(id)
    setExtracted(null)
    setExtractError('')
    setUrlInput('')
    setThumbnailFile(null)
  }

  async function handleExtract(e: React.FormEvent) {
    e.preventDefault()
    if (!urlInput.trim()) return
    setExtracting(true)
    setExtractError('')
    setExtracted(null)
    setThumbnailFile(null)

    try {
      const res = await fetch('/api/extract-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Extraction failed')

      // Convert thumbnail base64 to File if present
      if (data.thumbnail_base64 && data.thumbnail_mime) {
        const byteString = atob(data.thumbnail_base64)
        const bytes = new Uint8Array(byteString.length)
        for (let i = 0; i < byteString.length; i++) bytes[i] = byteString.charCodeAt(i)
        const ext = data.thumbnail_mime.split('/')[1] || 'jpg'
        const file = new File([bytes], `thumbnail.${ext}`, { type: data.thumbnail_mime })
        setThumbnailFile(file)
      }

      setExtractedSourceType((data.source_type as SourceType) ?? 'manual')
      setExtracted({
        title: data.title,
        description: data.description,
        yield_amount: data.yield_amount,
        yield_servings: data.yield_servings,
        prep_time_mins: data.prep_time_mins,
        cook_time_mins: data.cook_time_mins,
        ingredients: data.ingredients ?? [],
        steps: data.steps ?? [],
        tags: data.tags ?? [],
        notes: data.notes,
        source_url: data.source_url,
        source_type: data.source_type,
        original_content: data.original_content,
        extraction_confidence: data.extraction_confidence,
      })
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Extraction failed')
    } finally {
      setExtracting(false)
    }
  }

  if (!userId) return null

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate({ to: '/recipes' })} className="text-sm text-gray-500 hover:text-gray-800">← Back</button>
        <h1 className="text-2xl font-bold">Add a recipe</h1>
      </div>

      <div className="flex gap-2 mb-6">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => handleTabChange(t.id)}
            className={`px-3 py-1.5 text-sm rounded border ${tab === t.id ? 'bg-black text-white border-black' : 'border-gray-300 text-gray-600'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="text-xs text-gray-400 mb-4">
        {tab === 'url' && 'Paste a link to a recipe website or YouTube video.'}
        {tab === 'original' && 'A recipe you created yourself.'}
        {tab === 'manual' && 'A recipe you\'re copying in from another source.'}
      </div>

      {tab === 'url' && !extracted && (
        <form onSubmit={handleExtract} className="space-y-4">
          <div className="flex gap-2">
            <input
              ref={urlInputRef}
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              placeholder="https://..."
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
              autoFocus
            />
            <button
              type="submit"
              disabled={extracting || !urlInput.trim()}
              className="bg-black text-white rounded px-4 py-2 text-sm font-medium disabled:opacity-50 whitespace-nowrap"
            >
              {extracting ? 'Extracting...' : 'Extract'}
            </button>
          </div>
          {extractError && (
            <p className="text-sm text-red-600">{extractError}</p>
          )}
        </form>
      )}

      {tab === 'url' && extracted && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded text-sm">
            <span className="text-gray-500 truncate flex-1">{urlInput}</span>
            <button
              onClick={() => { setExtracted(null); setThumbnailFile(null); setExtractError('') }}
              className="text-gray-400 hover:text-gray-700 shrink-0"
            >
              Try another URL
            </button>
          </div>
          <RecipeForm
            initial={extracted}
            sourceType={extractedSourceType}
            mode="create"
            userId={userId}
            initialCoverImage={thumbnailFile ?? undefined}
          />
        </div>
      )}

      {tab !== 'url' && (
        <RecipeForm sourceType={tab as SourceType} mode="create" userId={userId} />
      )}
    </div>
  )
}
