import prisma from './db.js';

export type GoogleMapsIntegration = {
  serverApiKey?: string;
  /** Optional bias, e.g. `country:ca|country:us` (Google Places `components` param). */
  components?: string;
};

/**
 * Server-side API key for Places Autocomplete, Place Details, and Geocoding.
 * Prefer `SystemConfig.integrations.googleMaps.serverApiKey` (set in Admin);
 * fallback to env for local/dev.
 */
export async function getGoogleMapsServerKey(): Promise<string | null> {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: 'global' },
      select: { integrations: true },
    });
    const integ = config?.integrations as Record<string, unknown> | null | undefined;
    const gm = integ?.googleMaps as GoogleMapsIntegration | undefined;
    const fromDb = gm?.serverApiKey?.trim();
    if (fromDb) return fromDb;
  } catch {
    // non-fatal
  }
  const fromEnv = process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim();
  return fromEnv || null;
}

export async function getGoogleMapsComponents(): Promise<string | undefined> {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: 'global' },
      select: { integrations: true },
    });
    const integ = config?.integrations as Record<string, unknown> | null | undefined;
    const gm = integ?.googleMaps as GoogleMapsIntegration | undefined;
    const c = gm?.components?.trim();
    return c || undefined;
  } catch {
    return undefined;
  }
}

export async function isLocationSearchConfigured(): Promise<boolean> {
  const k = await getGoogleMapsServerKey();
  return !!k;
}
