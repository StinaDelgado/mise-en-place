import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRecipes } from '@/hooks/useRecipes'
import { RecipeCard } from '@/components/RecipeCard'

export const Route = createFileRoute('/recipes/')({ component: RecipeList })

function RecipeList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate({ to: '/login' })
    })
  }, [navigate])

  const { data: recipes, isLoading } = useRecipes({
    search: search.trim() || undefined,
    tags: activeTag ? [activeTag] : undefined,
  })

  // collect all unique tags from loaded recipes
  const allTags = Array.from(new Set(recipes?.flatMap(r => r.tags) ?? [])).sort()

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate({ to: '/login' })
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Mise en Place</h1>
        <div className="flex gap-2">
          <button onClick={() => navigate({ to: '/recipes/new' })} className="bg-black text-white rounded px-3 py-2 text-sm font-medium">
            + Add recipe
          </button>
          <button onClick={handleSignOut} className="border border-gray-300 rounded px-3 py-2 text-sm text-gray-500">
            Sign out
          </button>
        </div>
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search recipes..."
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm mb-4"
      />

      {/* Tag filter */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setActiveTag(null)}
            className={`text-xs px-2 py-1 rounded border ${!activeTag ? 'bg-black text-white border-black' : 'border-gray-300 text-gray-600'}`}
          >
            All
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={`text-xs px-2 py-1 rounded border ${activeTag === tag ? 'bg-black text-white border-black' : 'border-gray-300 text-gray-600'}`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Recipe grid */}
      {isLoading && <p className="text-sm text-gray-400">Loading...</p>}
      {!isLoading && recipes?.length === 0 && (
        <p className="text-sm text-gray-400">No recipes yet. Add one to get started.</p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {recipes?.map(recipe => <RecipeCard key={recipe.id} recipe={recipe} />)}
      </div>
    </div>
  )
}
