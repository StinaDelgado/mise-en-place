import { Link } from '@tanstack/react-router'
import type { Recipe } from '@/lib/types'

const SOURCE_LABELS: Record<string, string> = {
  url_recipe: 'Web',
  url_tiktok: 'TikTok',
  url_instagram: 'Instagram',
  url_youtube: 'YouTube',
  photo: 'Photo',
  original: 'Original',
  manual: 'Manual',
}

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  return (
    <Link to="/recipes/$recipeId" params={{ recipeId: recipe.id }} className="block border border-gray-200 rounded p-4 hover:border-gray-400 transition-colors">
      {recipe.cover_image_path && (
        <img
          src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/recipe-images/${recipe.cover_image_path}`}
          alt={recipe.title}
          className="w-full h-40 object-cover rounded mb-3"
        />
      )}
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-semibold text-sm leading-snug">{recipe.title}</h2>
        {recipe.is_draft && <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded shrink-0">Draft</span>}
      </div>
      {recipe.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{recipe.description}</p>}
      <div className="flex flex-wrap gap-1 mt-2">
        <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
          {SOURCE_LABELS[recipe.source_type] ?? recipe.source_type}
        </span>
        {recipe.tags.slice(0, 3).map(tag => (
          <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{tag}</span>
        ))}
      </div>
    </Link>
  )
}
