import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Recipe, RecipeEvent } from '@/lib/types'

export function useRecipe(id: string) {
  return useQuery({
    queryKey: ['recipe', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Recipe
    },
  })
}

export function useRecipeEvents(recipeId: string) {
  return useQuery({
    queryKey: ['recipe-events', recipeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recipe_events')
        .select('*')
        .eq('recipe_id', recipeId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as RecipeEvent[]
    },
  })
}

export function useSaveRecipe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ recipe, note }: { recipe: Omit<Recipe, 'id' | 'created_at' | 'updated_at'>; note?: string }) => {
      const { data, error } = await supabase
        .from('recipes')
        .insert(recipe)
        .select()
        .single()
      if (error) throw error

      await supabase.from('recipe_events').insert({
        recipe_id: data.id,
        user_id: recipe.created_by,
        event_type: recipe.forked_from ? 'saved' : 'created',
        note: note ?? null,
      })

      return data as Recipe
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recipes'] }),
  })
}

export function useUpdateRecipe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, updates, userId, note }: { id: string; updates: Partial<Recipe>; userId: string; note?: string }) => {
      const { data, error } = await supabase
        .from('recipes')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error

      await supabase.from('recipe_events').insert({
        recipe_id: id,
        user_id: userId,
        event_type: 'edited',
        note: note ?? null,
      })

      return data as Recipe
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['recipes'] })
      qc.invalidateQueries({ queryKey: ['recipe', id] })
      qc.invalidateQueries({ queryKey: ['recipe-events', id] })
    },
  })
}

export function useDeleteRecipe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('recipes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recipes'] }),
  })
}

export function useForkRecipe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ recipe, userId }: { recipe: Recipe; userId: string }) => {
      const fork: Omit<Recipe, 'id' | 'created_at' | 'updated_at'> = {
        ...recipe,
        created_by: userId,
        forked_from: recipe.id,
        is_draft: false,
        extraction_confidence: recipe.extraction_confidence,
      }

      const { data, error } = await supabase
        .from('recipes')
        .insert(fork)
        .select()
        .single()
      if (error) throw error

      await supabase.from('recipe_events').insert({
        recipe_id: data.id,
        user_id: userId,
        event_type: 'saved',
        note: null,
      })

      return data as Recipe
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recipes'] }),
  })
}
