/**
 * Maps a raw percentage (0-100) to the dynamic final score (0-5)
 * based on the performance-based scoring ranges:
 *
 *   >= 90%  →  4.00 – 5.00
 *   80–89%  →  3.00 – 3.99
 *   60–79%  →  2.00 – 2.99
 *    < 60%  →  0.00 – 1.99
 */
export function percentageToScore5(percentage: number): number {
  if (percentage >= 90) {
    // 90% → 4, 100% → 5
    return 4 + ((percentage - 90) / 10);
  } else if (percentage >= 80) {
    // 80% → 3, 89.99% → 3.99
    return 3 + ((percentage - 80) / 10);
  } else if (percentage >= 60) {
    // 60% → 2, 79.99% → 2.99
    return 2 + ((percentage - 60) / 20);
  } else {
    // 0% → 0, 59.99% → 1.99
    return (percentage / 60) * 2;
  }
}

/**
 * Returns the Arabic general rating label based on the percentage.
 */
export function percentageToRating(percentage: number): string {
  if (percentage >= 90) return 'ممتاز';
  if (percentage >= 80) return 'جيد جدًا';
  if (percentage >= 60) return 'جيد';
  return 'يحتاج تحسين';
}

/**
 * Compute all final results from a raw percentage.
 * Returns final_score_5, final_score_500, and general_rating.
 */
export function computeFinalScores(percentage: number) {
  const finalScore5 = percentageToScore5(percentage);
  const finalScore500 = finalScore5 * 100;
  const generalRating = percentageToRating(percentage);
  return { finalScore5, finalScore500, percentage, generalRating };
}
