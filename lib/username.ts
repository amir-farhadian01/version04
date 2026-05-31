/**
 * Username normalization, validation, and generation utilities.
 *
 * Rules:
 * - 3–30 characters
 * - Lowercase alphanumeric + dash
 * - No leading/trailing dash
 * - No consecutive dashes
 */

/** Normalize a raw username input: lowercase, strip non-alnum/dash, collapse dashes. */
export function normalizeUsername(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '-')  // replace any disallowed chars with dash
    .replace(/-{2,}/g, '-')       // collapse consecutive dashes
    .replace(/^-+/, '')           // strip leading dashes
    .replace(/-+$/, '');          // strip trailing dashes
}

/** Check if a normalized username passes all structural rules. */
export function isValidUsername(username: string): boolean {
  if (username.length < 3 || username.length > 30) return false;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(username)) return false;
  return true;
}

/** Suggest an alternative username by appending a short hash suffix to the base. */
export function suggestUsername(base: string): string {
  // Generate a deterministic 4-char suffix from the base
  const hash = simpleHash(base).slice(0, 4);
  const suggestion = `${base}-${hash}`;
  // Ensure it's within 30 chars
  if (suggestion.length > 30) {
    return `${base.slice(0, 25)}-${hash}`;
  }
  return suggestion;
}

/** Simple DJB2-like hash returning a hex string for suffix generation. */
function simpleHash(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) & 0xffffffff;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Auto-generate a username from firstName and optional lastName. */
export function generateUsername(
  firstName: string,
  lastName?: string,
  suffix?: string,
): string {
  let base = normalizeUsername(firstName);
  if (!base || base.length < 3) {
    base = lastName ? normalizeUsername(lastName) : '';
  }
  if (!base || base.length < 3) {
    base = 'user';
  }

  // Try combining first + last
  if (lastName) {
    const combined = normalizeUsername(`${firstName}-${lastName}`);
    if (combined.length >= 3) {
      base = combined;
    }
  }

  // Ensure minimum length
  if (base.length < 3) {
    base = base + '-00';
  }

  // Trim to max if needed (leave room for suffix)
  if (base.length > 26) {
    base = base.slice(0, 26);
  }

  // Append suffix if provided
  if (suffix) {
    const withSuffix = `${base}-${suffix}`;
    if (withSuffix.length <= 30) return withSuffix;
    return `${base.slice(0, 30 - suffix.length - 1)}-${suffix}`;
  }

  return base;
}