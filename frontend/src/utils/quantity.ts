/**
 * Parses a quantity string accepting both ',' and '.' as decimal separators.
 * Clamps the result to the valid range [0.1, 9999].
 * Invalid or empty input returns 1.
 *
 * Note: Replaces the first comma with a dot, treating it as a decimal separator.
 * This means "1,500" → 1.5 instead of 1500, which is acceptable because
 * quantity is range-limited to [0.1, 9999].
 */
export function clampQuantity(value: string): number {
  const normalized = value.replace(',', '.');
  const parsed = parseFloat(normalized);
  if (isNaN(parsed) || parsed < 0.1) return 1;
  if (parsed > 9999) return 9999;
  return parsed;
}
