export type SourceType =
  | 'url_recipe'
  | 'url_tiktok'
  | 'url_instagram'
  | 'url_youtube'
  | 'photo'
  | 'original'
  | 'manual'

export type ExtractionConfidence = 'high' | 'medium' | 'low' | 'manual'

export type EventType = 'created' | 'saved' | 'edited' | 'photo_added'

export interface Ingredient {
  amount: string | null
  amount_decimal: number | null
  unit: string | null
  item: string
  note: string | null
}

export interface Step {
  order: number
  text: string
}

export interface Recipe {
  id: string
  created_at: string
  updated_at: string
  created_by: string
  forked_from: string | null

  title: string
  description: string | null
  source_url: string | null
  source_type: SourceType
  original_content: string | null

  yield_amount: string | null
  yield_servings: number | null
  prep_time_mins: number | null
  cook_time_mins: number | null
  ingredients: Ingredient[]
  steps: Step[]
  tags: string[]
  notes: string | null

  cover_image_path: string | null

  is_draft: boolean
  extraction_confidence: ExtractionConfidence
}

export interface RecipeEvent {
  id: string
  created_at: string
  recipe_id: string
  user_id: string
  event_type: EventType
  note: string | null
}
