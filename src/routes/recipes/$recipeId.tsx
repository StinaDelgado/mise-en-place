import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRecipe, useDeleteRecipe, useForkRecipe } from '@/hooks/useRecipe'
import { RecipeForm } from '@/components/RecipeForm'
import { RecipeChangelog } from '@/components/RecipeChangelog'
import { scaleIngredients, formatAmount } from '@/lib/scaling'

export const Route = createFileRoute('/recipes/$recipeId')({ component: RecipeDetail })

function RecipeDetail() {
  const { recipeId } = Route.useParams()
  const navigate = useNavigate()
  const [userId, setUserId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [servings, setServings] = useState<number | null>(null)

  const { data: recipe, isLoading } = useRecipe(recipeId)
  const deleteRecipe = useDeleteRecipe()
  const forkRecipe = useForkRecipe()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate({ to: '/login' })
      else setUserId(data.session.user.id)
    })
  }, [navigate])

  useEffect(() => {
    if (recipe?.yield_servings) setServings(recipe.yield_servings)
  }, [recipe?.yield_servings])

  if (isLoading) return <div className="max-w-2xl mx-auto p-6 text-sm text-gray-400">Loading...</div>
  if (!recipe) return <div className="max-w-2xl mx-auto p-6 text-sm text-gray-400">Recipe not found.</div>

  const isOwner = userId === recipe.created_by
  const scaledIngredients = servings && recipe.yield_servings && servings !== recipe.yield_servings
    ? scaleIngredients(recipe.ingredients, recipe.yield_servings, servings)
    : recipe.ingredients

  async function handleDelete() {
    if (!confirm('Delete this recipe?')) return
    await deleteRecipe.mutateAsync(recipeId)
    navigate({ to: '/recipes' })
  }

  async function handleFork() {
    if (!userId || !recipe) return
    const forked = await forkRecipe.mutateAsync({ recipe, userId })
    navigate({ to: '/recipes/$recipeId', params: { recipeId: forked.id } })
  }

  if (editing && isOwner) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => setEditing(false)} className="text-sm text-gray-500 hover:text-gray-800">← Cancel</button>
          <h1 className="text-2xl font-bold">Edit recipe</h1>
        </div>
        <RecipeForm initial={recipe} sourceType={recipe.source_type} mode="edit" recipeId={recipeId} userId={userId!} />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate({ to: '/recipes' })} className="text-sm text-gray-500 hover:text-gray-800">← Back</button>
        <div className="flex gap-2 ml-auto">
          {isOwner ? (
            <>
              <button onClick={() => setEditing(true)} className="text-sm border border-gray-300 rounded px-3 py-1.5">Edit</button>
              <button onClick={handleDelete} className="text-sm border border-red-200 text-red-600 rounded px-3 py-1.5">Delete</button>
            </>
          ) : (
            <button onClick={handleFork} className="text-sm border border-gray-300 rounded px-3 py-1.5">Save to my book</button>
          )}
        </div>
      </div>

      {recipe.cover_image_path && (
        <img
          src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/recipe-images/${recipe.cover_image_path}`}
          alt={recipe.title}
          className="w-full h-56 object-cover rounded mb-6"
        />
      )}

      <div className="flex items-start justify-between gap-4 mb-2">
        <h1 className="text-2xl font-bold">{recipe.title}</h1>
        {recipe.is_draft && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded shrink-0">Draft</span>}
      </div>

      {recipe.description && <p className="text-gray-600 text-sm mb-4">{recipe.description}</p>}

      {/* Meta */}
      <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-6">
        {recipe.yield_amount && <span>Yield: {recipe.yield_amount}</span>}
        {recipe.prep_time_mins && <span>Prep: {recipe.prep_time_mins}m</span>}
        {recipe.cook_time_mins && <span>Cook: {recipe.cook_time_mins}m</span>}
        {recipe.source_url && <a href={recipe.source_url} target="_blank" rel="noreferrer" className="underline">Source</a>}
      </div>

      {/* Portion scaling */}
      {recipe.yield_servings && (
        <div className="flex items-center gap-3 mb-6 p-3 bg-gray-50 rounded">
          <span className="text-sm text-gray-600">Scale to:</span>
          <input
            type="number"
            min={1}
            value={servings ?? ''}
            onChange={e => setServings(parseInt(e.target.value) || null)}
            className="w-16 border border-gray-300 rounded px-2 py-1 text-sm text-center"
          />
          <span className="text-sm text-gray-500">servings (original: {recipe.yield_servings})</span>
          {servings !== recipe.yield_servings && (
            <button onClick={() => setServings(recipe.yield_servings)} className="text-xs text-gray-400 hover:text-gray-600 underline">reset</button>
          )}
        </div>
      )}

      {/* Ingredients */}
      {recipe.ingredients.length > 0 && (
        <div className="mb-6">
          <h2 className="font-semibold mb-3">Ingredients</h2>
          <ul className="space-y-1">
            {scaledIngredients.map((ing, i) => (
              <li key={i} className="text-sm">
                {ing.amount_decimal != null
                  ? formatAmount(ing.amount_decimal)
                  : ing.amount}{' '}
                {ing.unit} {ing.item}
                {ing.note && <span className="text-gray-400">, {ing.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Steps */}
      {recipe.steps.length > 0 && (
        <div className="mb-6">
          <h2 className="font-semibold mb-3">Steps</h2>
          <ol className="space-y-3">
            {recipe.steps.map((step) => (
              <li key={step.order} className="text-sm flex gap-3">
                <span className="text-gray-400 shrink-0">{step.order}.</span>
                <span>{step.text}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Tags */}
      {recipe.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-6">
          {recipe.tags.map(tag => (
            <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{tag}</span>
          ))}
        </div>
      )}

      {/* Notes */}
      {recipe.notes && (
        <div className="mb-6 p-3 bg-gray-50 rounded">
          <h2 className="font-semibold text-sm mb-1">Notes</h2>
          <p className="text-sm text-gray-600">{recipe.notes}</p>
        </div>
      )}

      <RecipeChangelog recipeId={recipeId} />
    </div>
  )
}
