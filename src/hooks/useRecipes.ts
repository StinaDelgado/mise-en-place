import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Recipe } from '@/lib/types'

export function useRecipes({ search, tags }: { search?: string; tags?: string[] } = {}) {
  return useQuery({
    queryKey: ['recipes', search, tags],
    queryFn: async () => {
      let query = supabase
        .from('recipes')
        .select('*')
        .order('created_at', { ascending: false })

      if (search) {
        query = query.textSearch('search_vector', search, { type: 'websearch' })
      }

      if (tags && tags.length > 0) {
        query = query.overlaps('tags', tags)
      }

      const { data, error } = await query
      if (error) throw error
      return data as Recipe[]
    },
  })
}
