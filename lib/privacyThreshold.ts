/**
 * Privacy threshold enforcement for aggregate data display.
 *
 * Ensures no individual-identifiable data is ever exposed through
 * market intelligence endpoints. All aggregates must meet minimum
 * data point thresholds before being returned.
 */

/** Default minimum data points required before showing any aggregate */
export const MIN_DATA_POINTS = 5;

/** Default minimum unique providers before showing service rates */
export const MIN_UNIQUE_PROVIDERS = 3;

/**
 * Checks if a sample size meets the minimum threshold for safe display.
 */
export function isDataSafe(sampleSize: number, minPoints?: number): boolean {
  return sampleSize >= (minPoints ?? MIN_DATA_POINTS);
}

/**
 * Anonymizes data by returning null if the sample size is below threshold.
 * If safe, returns the data as-is.
 *
 * @param data - The aggregate data to check
 * @param sampleSize - The number of data points used to compute the aggregate
 * @param minPoints - Optional minimum threshold override
 * @returns The data if safe, or null if below threshold
 */
export function anonymizeData<T>(
  data: T,
  sampleSize: number,
  minPoints?: number,
): T | null {
  if (!isDataSafe(sampleSize, minPoints)) {
    return null;
  }
  return data;
}

/**
 * Rounds a coordinate to N decimal places for privacy.
 * Default 3 decimal places ≈ ~111m precision at the equator.
 */
export function roundCoordinate(latOrLng: number, decimals = 3): number {
  const factor = Math.pow(10, decimals);
  return Math.round(latOrLng * factor) / factor;
}

/**
 * Strips any fields that could identify individuals from an array of records.
 */
export function stripIdentifyingFields<T extends Record<string, unknown>>(
  records: T[],
  identifyingFields: string[],
): Array<Omit<T, keyof T>> {
  return records.map((record) => {
    const cleaned = { ...record };
    for (const field of identifyingFields) {
      delete cleaned[field];
    }
    return cleaned;
  }) as Array<Omit<T, keyof T>>;
}
