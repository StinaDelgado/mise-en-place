import type { Ingredient } from './types'

export function scaleIngredients(ingredients: Ingredient[], originalServings: number, desiredServings: number): Ingredient[] {
  const factor = desiredServings / originalServings
  return ingredients.map(ing => ({
    ...ing,
    amount_decimal: ing.amount_decimal != null ? ing.amount_decimal * factor : null,
    amount: ing.amount_decimal != null ? formatAmount(ing.amount_decimal * factor) : ing.amount,
  }))
}

export function formatAmount(value: number): string {
  if (value === 0) return '0'

  const whole = Math.floor(value)
  const decimal = value - whole

  const fractions: [number, string][] = [
    [1 / 8, '⅛'], [1 / 4, '¼'], [1 / 3, '⅓'],
    [3 / 8, '⅜'], [1 / 2, '½'], [5 / 8, '⅝'],
    [2 / 3, '⅔'], [3 / 4, '¾'], [7 / 8, '⅞'],
  ]

  const closest = fractions.reduce((best, frac) =>
    Math.abs(frac[0] - decimal) < Math.abs(best[0] - decimal) ? frac : best
  )

  if (Math.abs(decimal) < 0.05) return whole > 0 ? String(whole) : '0'
  if (Math.abs(closest[0] - decimal) < 0.05) {
    return whole > 0 ? `${whole} ${closest[1]}` : closest[1]
  }

  // fallback: round to 2 decimal places
  return value.toFixed(2).replace(/\.?0+$/, '')
}
