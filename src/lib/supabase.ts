import { createClient } from '@supabase/supabase-js'
import type { Recipe, RecipeEvent } from './types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export interface Database {
  public: {
    Tables: {
      recipes: { Row: Recipe; Insert: Omit<Recipe, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Recipe> }
      recipe_events: { Row: RecipeEvent; Insert: Omit<RecipeEvent, 'id' | 'created_at'>; Update: never }
    }
  }
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
