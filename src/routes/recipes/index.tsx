import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/recipes/')({ component: RecipeList })

function RecipeList() {
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate({ to: '/login' })
    })
  }, [navigate])

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Recipes</h1>
        <button
          onClick={() => navigate({ to: '/recipes/new' })}
          className="bg-black text-white rounded px-3 py-2 text-sm font-medium"
        >
          + Add recipe
        </button>
      </div>
      <p className="text-gray-500 text-sm">No recipes yet. Add one to get started.</p>
    </div>
  )
}
