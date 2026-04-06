import { useRecipeEvents } from '@/hooks/useRecipe'

const EVENT_LABELS: Record<string, string> = {
  created: 'added this recipe',
  saved: 'saved this recipe',
  edited: 'edited this recipe',
  photo_added: 'added a photo',
}

export function RecipeChangelog({ recipeId }: { recipeId: string }) {
  const { data: events, isLoading } = useRecipeEvents(recipeId)

  if (isLoading) return null
  if (!events || events.length === 0) return null

  return (
    <div className="mt-8 border-t border-gray-200 pt-6">
      <h3 className="text-sm font-semibold mb-3">History</h3>
      <ul className="space-y-2">
        {events.map(event => (
          <li key={event.id} className="text-sm text-gray-600">
            <span className="text-gray-400 text-xs mr-2">
              {new Date(event.created_at).toLocaleDateString()}
            </span>
            <span>{EVENT_LABELS[event.event_type] ?? event.event_type}</span>
            {event.note && <span className="text-gray-500 ml-1">— "{event.note}"</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
