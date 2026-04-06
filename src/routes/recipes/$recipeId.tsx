import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/recipes/$recipeId')({ component: RecipeDetail })

function RecipeDetail() {
  const { recipeId } = Route.useParams()
  return (
    <div className="max-w-2xl mx-auto p-6">
      <p className="text-gray-500 text-sm">Recipe {recipeId} — coming in Phase 2.</p>
    </div>
  )
}
