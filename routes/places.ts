import { Router, Response } from 'express';
import prisma from '../lib/db.js';
import { authenticate, AuthRequest } from '../lib/auth.middleware.js';
import { getGoogleMapsComponents, getGoogleMapsServerKey } from '../lib/googleMapsConfig.js';
import {
  setUserLocation,
  cacheReverseGeocode,
  getCachedReverseGeocode,
} from '../lib/locationCache.js';

const router = Router();

// ─── Public endpoints (no auth required) ──────────────────────────────────

/**
 * GET /api/places/current-location?lat=…&lng=…
 * Public endpoint — reverse-geocodes coordinates and returns a short location string.
 * Uses OpenStreetMap Nominatim (free, no API key) as primary.
 * Falls back to Google Maps Geocoding API if configured.
 * Results are cached in Redis for 1 hour to reduce external API calls.
 * No auth required so Flutter can use it before login.
 */
router.get('/current-location', async (req: AuthRequest, res: Response) => {
  try {
    const lat = parseFloat(String(req.query.lat));
    const lng = parseFloat(String(req.query.lng));
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ error: 'lat and lng are required' });
    }

    // Check Redis cache first
    const cached = await getCachedReverseGeocode(lat, lng);
    if (cached) {
      return res.json(cached);
    }

    // Primary: OpenStreetMap Nominatim (free, no API key, 1 req/sec rate limit)
    try {
      const nomUrl = new URL('https://nominatim.openstreetmap.org/reverse');
      nomUrl.searchParams.set('lat', String(lat));
      nomUrl.searchParams.set('lon', String(lng));
      nomUrl.searchParams.set('format', 'json');
      nomUrl.searchParams.set('addressdetails', '1');

      const nomRes = await fetch(nomUrl, {
        headers: { 'User-Agent': 'NeighborlyApp/1.0 (local-dev)' },
      });
      const nomData = (await nomRes.json()) as {
        address?: Record<string, string>;
        display_name?: string;
        error?: string;
      };

      if (nomData.address && !nomData.error) {
        const addr = nomData.address;
        // Try various city-level fields
        const city = addr.city || addr.town || addr.village || addr.municipality || addr.county || '';
        const state = addr.state || '';
        // Try to get neighbourhood/suburb for more granular location
        const neighbourhood = addr.neighbourhood || addr.suburb || addr.city_district || '';
        const shortLocation = [city, state].filter(Boolean).join(', ');
        // Build a more specific location: neighbourhood, city
        const neighbourhoodLocation = neighbourhood
          ? `${neighbourhood}, ${city}`
          : shortLocation;

        const result = {
          city,
          state,
          neighbourhood,
          shortLocation,
          neighbourhoodLocation,
          formattedAddress: nomData.display_name || shortLocation,
        };

        // Cache the result in Redis for 1 hour
        await cacheReverseGeocode(lat, lng, result as unknown as Record<string, unknown>);

        return res.json(result);
      }
    } catch {
      // Nominatim failed — fall through to Google Maps
    }

    // Fallback: Google Maps Geocoding API (if configured)
    const key = await getGoogleMapsServerKey();
    if (key) {
      const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
      url.searchParams.set('latlng', `${lat},${lng}`);
      url.searchParams.set('key', key);

      const r = await fetch(url);
      const data = (await r.json()) as {
        status: string;
        error_message?: string;
        results?: {
          address_components?: { long_name: string; short_name: string; types: string[] }[];
          formatted_address: string;
        }[];
      };
      if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
        const first = data.results?.[0];
        if (first) {
          let city = '';
          let state = '';
          let neighbourhood = '';
          for (const comp of first.address_components ?? []) {
            if (comp.types.includes('neighborhood')) {
              neighbourhood = comp.long_name;
            }
            if (comp.types.includes('locality') || comp.types.includes('sublocality')) {
              city = comp.long_name;
            }
            if (comp.types.includes('administrative_area_level_1')) {
              state = comp.short_name;
            }
          }
          const shortLocation = [city, state].filter(Boolean).join(', ');
          const neighbourhoodLocation = neighbourhood
            ? `${neighbourhood}, ${city}`
            : shortLocation;

          const result = { city, state, neighbourhood, shortLocation, neighbourhoodLocation, formattedAddress: first.formatted_address };

          // Cache the result in Redis for 1 hour
          await cacheReverseGeocode(lat, lng, result as unknown as Record<string, unknown>);

          return res.json(result);
        }
      }
    }

    // Last resort: return empty
    res.json({ city: '', state: '', shortLocation: '' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'current location failed' });
  }
});

// ─── Authenticated endpoints ─────────────────────────────────────────────
router.use(authenticate);

/** GET /api/places/autocomplete?input=...&session=… */
router.get('/autocomplete', async (req: AuthRequest, res: Response) => {
  try {
    const input = String(req.query.input ?? '').trim();
    if (input.length < 2) {
      return res.json({ predictions: [] as unknown[] });
    }
    const key = await getGoogleMapsServerKey();
    if (!key) {
      return res.status(503).json({ error: 'Location search is not configured', predictions: [] });
    }
    const session = String(req.query.session ?? '').trim();
    const componentsFromQuery = String(req.query.components ?? '').trim();
    const componentsDefault = (await getGoogleMapsComponents()) ?? '';
    const components = componentsFromQuery || componentsDefault;

    const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
    url.searchParams.set('input', input);
    url.searchParams.set('key', key);
    if (components) {
      url.searchParams.set('components', components);
    }
    if (session) {
      url.searchParams.set('sessiontoken', session);
    }

    const r = await fetch(url);
    const data = (await r.json()) as {
      status: string;
      error_message?: string;
      predictions?: { description: string; place_id: string }[];
    };
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      return res
        .status(502)
        .json({ error: data.error_message || data.status, predictions: [] });
    }
    res.json({ predictions: data.predictions ?? [] });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'autocomplete failed', predictions: [] });
  }
});

/** GET /api/places/details?placeId=...&session=… */
router.get('/details', async (req: AuthRequest, res: Response) => {
  try {
    const placeId = String(req.query.placeId ?? '').trim();
    if (!placeId) {
      return res.status(400).json({ error: 'placeId is required' });
    }
    const key = await getGoogleMapsServerKey();
    if (!key) {
      return res.status(503).json({ error: 'Location search is not configured' });
    }
    const session = String(req.query.session ?? '').trim();

    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    url.searchParams.set('place_id', placeId);
    url.searchParams.set('key', key);
    url.searchParams.set('fields', 'formatted_address,geometry,place_id');
    if (session) {
      url.searchParams.set('sessiontoken', session);
    }

    const r = await fetch(url);
    const data = (await r.json()) as { status: string; error_message?: string; result?: { formatted_address?: string } };
    if (data.status !== 'OK') {
      return res.status(502).json({ error: data.error_message || data.status });
    }
    res.json({ result: data.result || {} });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'details failed' });
  }
});

/** GET /api/places/reverse-geocode?lat=…&lng=… */
router.get('/reverse-geocode', async (req: AuthRequest, res: Response) => {
  try {
    const lat = parseFloat(String(req.query.lat));
    const lng = parseFloat(String(req.query.lng));
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ error: 'lat and lng are required' });
    }

    // Check cache first
    const cached = await getCachedReverseGeocode(lat, lng);
    if (cached) {
      return res.json(cached);
    }

    const key = await getGoogleMapsServerKey();
    if (!key) {
      return res.status(503).json({ error: 'Location search is not configured' });
    }

    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('latlng', `${lat},${lng}`);
    url.searchParams.set('key', key);

    const r = await fetch(url);
    const data = (await r.json()) as { status: string; error_message?: string; results?: { formatted_address: string }[] };
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      return res.status(502).json({ error: data.error_message || data.status });
    }
    const first = data.results?.[0];
    const result = {
      formattedAddress: first?.formatted_address || '',
    };

    // Cache the result
    await cacheReverseGeocode(lat, lng, result as unknown as Record<string, unknown>);

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'reverse geocode failed' });
  }
});

router.get('/my-location', async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { location: true, locationLat: true, locationLng: true },
    });
    res.json({
      location: user?.location || '',
      lat: user?.locationLat ?? null,
      lng: user?.locationLng ?? null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'failed to get location' });
  }
});

/**
 * PUT /api/places/my-location
 * Saves the user's current location.
 *
 * Body formats accepted:
 *   - { lat: number, lng: number, location?: string }  → uses Redis cache path
 *   - { location: "Toronto, ON" }                       → backward-compat direct DB write
 *
 * When lat/lng are provided, the location is first written to Redis cache
 * and asynchronously flushed to PostgreSQL every 5 minutes.
 */
router.put('/my-location', async (req: AuthRequest, res: Response) => {
  try {
    const { location, lat, lng } = req.body as {
      location?: string;
      lat?: number;
      lng?: number;
    };

    const hasCoords = typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng);
    const hasLocationStr = typeof location === 'string' && location.trim().length > 0;

    if (!hasCoords && !hasLocationStr) {
      return res.status(400).json({
        error: 'Provide either { lat, lng } for cached location or { location } string for direct save',
      });
    }

    if (hasCoords) {
      // Use Redis cache path with debounce
      const result = await setUserLocation(req.user!.userId, lat, lng);

      // If a location string was also provided, update it directly in DB
      if (hasLocationStr) {
        await prisma.user.update({
          where: { id: req.user!.userId },
          data: { location: location!.trim() },
        });
      }

      return res.json({
        success: true,
        cached: result.cached,
        queued: result.queued,
        skipped: result.skipped,
        lat,
        lng,
      });
    }

    // Backward-compat: only location string provided, write directly to DB
    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { location: location!.trim() },
    });
    res.json({ success: true, location: location!.trim() });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'failed to save location' });
  }
});

export default router;
