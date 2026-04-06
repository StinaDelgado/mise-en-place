import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { RecipeForm } from '@/components/RecipeForm'
import type { SourceType } from '@/lib/types'

export const Route = createFileRoute('/recipes/new')({ component: NewRecipe })

const TABS: { id: SourceType; label: string }[] = [
  { id: 'original', label: 'Original' },
  { id: 'manual', label: 'Manual' },
]

function NewRecipe() {
  const navigate = useNavigate()
  const [userId, setUserId] = useState<string | null>(null)
  const [tab, setTab] = useState<SourceType>('original')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate({ to: '/login' })
      else setUserId(data.session.user.id)
    })
  }, [navigate])

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
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-sm rounded border ${tab === t.id ? 'bg-black text-white border-black' : 'border-gray-300 text-gray-600'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="text-xs text-gray-400 mb-4">
        {tab === 'original' && 'A recipe you created yourself.'}
        {tab === 'manual' && 'A recipe you\'re copying in from another source.'}
      </div>

      <RecipeForm sourceType={tab} mode="create" userId={userId} />
    </div>
  )
}
