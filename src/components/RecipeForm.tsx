import { useState, useRef, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { supabase } from '@/lib/supabase'
import { useSaveRecipe, useUpdateRecipe } from '@/hooks/useRecipe'
import type { Recipe, Ingredient, Step, SourceType } from '@/lib/types'

interface RecipeFormProps {
  initial?: Partial<Recipe>
  sourceType: SourceType
  mode: 'create' | 'edit'
  recipeId?: string
  userId: string
  initialCoverImage?: File
}

const EMPTY_INGREDIENT: Ingredient = { amount: '', amount_decimal: null, unit: '', item: '', note: null }

export function RecipeForm({ initial, sourceType, mode, recipeId, userId, initialCoverImage }: RecipeFormProps) {
  const navigate = useNavigate()
  const saveRecipe = useSaveRecipe()
  const updateRecipe = useUpdateRecipe()

  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [yieldAmount, setYieldAmount] = useState(initial?.yield_amount ?? '')
  const [yieldServings, setYieldServings] = useState<string>(initial?.yield_servings?.toString() ?? '')
  const [prepTime, setPrepTime] = useState<string>(initial?.prep_time_mins?.toString() ?? '')
  const [cookTime, setCookTime] = useState<string>(initial?.cook_time_mins?.toString() ?? '')
  const [ingredients, setIngredients] = useState<Ingredient[]>(initial?.ingredients?.length ? initial.ingredients : [{ ...EMPTY_INGREDIENT }])
  const [steps, setSteps] = useState<Step[]>(initial?.steps?.length ? initial.steps : [{ order: 1, text: '' }])
  const [tags, setTags] = useState<string>(initial?.tags?.join(', ') ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [editNote, setEditNote] = useState('')
  const [coverImageFile, setCoverImageFile] = useState<File | null>(initialCoverImage ?? null)
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(
    initialCoverImage ? URL.createObjectURL(initialCoverImage) : null
  )
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (initialCoverImage) {
      setCoverImageFile(initialCoverImage)
      const url = URL.createObjectURL(initialCoverImage)
      setCoverImagePreview(url)
      return () => URL.revokeObjectURL(url)
    }
  }, [initialCoverImage])

  function parseAmount(val: string): number | null {
    if (!val) return null
    // handle fractions like "1/2"
    const parts = val.trim().split('/')
    if (parts.length === 2) {
      const n = parseFloat(parts[0])
      const d = parseFloat(parts[1])
      return isNaN(n) || isNaN(d) || d === 0 ? null : n / d
    }
    const n = parseFloat(val)
    return isNaN(n) ? null : n
  }

  function updateIngredient(i: number, field: keyof Ingredient, value: string) {
    setIngredients(prev => prev.map((ing, idx) => {
      if (idx !== i) return ing
      if (field === 'amount') return { ...ing, amount: value, amount_decimal: parseAmount(value) }
      return { ...ing, [field]: value }
    }))
  }

  function addIngredient() {
    setIngredients(prev => [...prev, { ...EMPTY_INGREDIENT }])
  }

  function removeIngredient(i: number) {
    setIngredients(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateStep(i: number, text: string) {
    setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, text } : s))
  }

  function addStep() {
    setSteps(prev => [...prev, { order: prev.length + 1, text: '' }])
  }

  function removeStep(i: number) {
    setSteps(prev => prev.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, order: idx + 1 })))
  }

  async function uploadCoverImage(): Promise<string | null> {
    if (!coverImageFile) return initial?.cover_image_path ?? null
    const ext = coverImageFile.name.split('.').pop()
    const path = `${userId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('recipe-images').upload(path, coverImageFile)
    if (error) throw error
    return path
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!title.trim()) { setError('Title is required'); return }

    setUploading(true)
    try {
      // Refresh session in case token expired while page was open
      await supabase.auth.refreshSession()
      const coverImagePath = await uploadCoverImage()
      const parsedTags = tags.split(',').map(t => t.trim()).filter(Boolean)

      if (mode === 'create') {
        const recipe = {
          created_by: userId,
          forked_from: null,
          title: title.trim(),
          description: description.trim() || null,
          source_url: initial?.source_url ?? null,
          source_type: sourceType,
          original_content: initial?.original_content ?? null,
          yield_amount: yieldAmount.trim() || null,
          yield_servings: yieldServings ? parseInt(yieldServings) : null,
          prep_time_mins: prepTime ? parseInt(prepTime) : null,
          cook_time_mins: cookTime ? parseInt(cookTime) : null,
          ingredients,
          steps,
          tags: parsedTags,
          notes: notes.trim() || null,
          cover_image_path: coverImagePath,
          is_draft: false,
          extraction_confidence: initial?.extraction_confidence ?? 'manual',
        }
        const saved = await saveRecipe.mutateAsync({ recipe })
        navigate({ to: '/recipes/$recipeId', params: { recipeId: saved.id } })
      } else if (mode === 'edit' && recipeId) {
        await updateRecipe.mutateAsync({
          id: recipeId,
          userId,
          note: editNote.trim() || undefined,
          updates: {
            title: title.trim(),
            description: description.trim() || null,
            yield_amount: yieldAmount.trim() || null,
            yield_servings: yieldServings ? parseInt(yieldServings) : null,
            prep_time_mins: prepTime ? parseInt(prepTime) : null,
            cook_time_mins: cookTime ? parseInt(cookTime) : null,
            ingredients,
            steps,
            tags: parsedTags,
            notes: notes.trim() || null,
            cover_image_path: coverImagePath,
          },
        })
        navigate({ to: '/recipes/$recipeId', params: { recipeId } })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setUploading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium mb-1">Title *</label>
        <input value={title} onChange={e => setTitle(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
      </div>

      {/* Yield + times */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <label className="block text-sm font-medium mb-1">Yield</label>
          <input value={yieldAmount} onChange={e => setYieldAmount(e.target.value)} placeholder="4 servings" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Servings #</label>
          <input type="number" value={yieldServings} onChange={e => setYieldServings(e.target.value)} placeholder="4" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Prep (mins)</label>
          <input type="number" value={prepTime} onChange={e => setPrepTime(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Cook (mins)</label>
          <input type="number" value={cookTime} onChange={e => setCookTime(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
        </div>
      </div>

      {/* Ingredients */}
      <div>
        <label className="block text-sm font-medium mb-2">Ingredients</label>
        <div className="space-y-2">
          {ingredients.map((ing, i) => (
            <div key={i} className="flex gap-2 items-start">
              <input value={ing.amount ?? ''} onChange={e => updateIngredient(i, 'amount', e.target.value)} placeholder="Amount" className="w-20 border border-gray-300 rounded px-2 py-1.5 text-sm" />
              <input value={ing.unit ?? ''} onChange={e => updateIngredient(i, 'unit', e.target.value)} placeholder="Unit" className="w-20 border border-gray-300 rounded px-2 py-1.5 text-sm" />
              <input value={ing.item} onChange={e => updateIngredient(i, 'item', e.target.value)} placeholder="Ingredient" className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm" />
              <input value={ing.note ?? ''} onChange={e => updateIngredient(i, 'note', e.target.value)} placeholder="Note" className="w-24 border border-gray-300 rounded px-2 py-1.5 text-sm" />
              <button type="button" onClick={() => removeIngredient(i)} className="text-gray-400 hover:text-red-500 text-sm px-1">×</button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addIngredient} className="mt-2 text-sm text-gray-500 hover:text-gray-800">+ Add ingredient</button>
      </div>

      {/* Steps */}
      <div>
        <label className="block text-sm font-medium mb-2">Steps</label>
        <div className="space-y-2">
          {steps.map((step, i) => (
            <div key={i} className="flex gap-2 items-start">
              <span className="text-sm text-gray-400 mt-2 w-5 shrink-0">{i + 1}.</span>
              <textarea value={step.text} onChange={e => updateStep(i, e.target.value)} rows={2} placeholder={`Step ${i + 1}`} className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm" />
              <button type="button" onClick={() => removeStep(i)} className="text-gray-400 hover:text-red-500 text-sm px-1 mt-1">×</button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addStep} className="mt-2 text-sm text-gray-500 hover:text-gray-800">+ Add step</button>
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium mb-1">Tags <span className="font-normal text-gray-400">(comma separated)</span></label>
        <input value={tags} onChange={e => setTags(e.target.value)} placeholder="pasta, quick, vegetarian" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium mb-1">Notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
      </div>

      {/* Cover image */}
      <div>
        <label className="block text-sm font-medium mb-1">Cover image</label>
        {coverImagePreview && (
          <img src={coverImagePreview} alt="Cover preview" className="w-full h-40 object-cover rounded mb-2" />
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={e => {
            const file = e.target.files?.[0] ?? null
            setCoverImageFile(file)
            if (file) {
              const url = URL.createObjectURL(file)
              setCoverImagePreview(url)
            } else {
              setCoverImagePreview(null)
            }
          }}
          className="text-sm"
        />
      </div>

      {/* Edit note (edit mode only) */}
      {mode === 'edit' && (
        <div>
          <label className="block text-sm font-medium mb-1">What changed? <span className="font-normal text-gray-400">(optional)</span></label>
          <input value={editNote} onChange={e => setEditNote(e.target.value)} placeholder="e.g. fixed the salt amount" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
        </div>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={uploading} className="bg-black text-white rounded px-4 py-2 text-sm font-medium disabled:opacity-50">
          {uploading ? 'Saving...' : mode === 'edit' ? 'Save changes' : 'Add recipe'}
        </button>
        <button type="button" onClick={() => navigate({ to: '/recipes' })} className="border border-gray-300 rounded px-4 py-2 text-sm">
          Cancel
        </button>
      </div>
    </form>
  )
}
