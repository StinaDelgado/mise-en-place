import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/recipes/new')({ component: NewRecipe })

function NewRecipe() {
  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Add a recipe</h1>
      <p className="text-gray-500 text-sm">Recipe form coming in Phase 2.</p>
    </div>
  )
}
