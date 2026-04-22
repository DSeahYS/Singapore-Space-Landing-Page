/**
 * CelesTrak Client
 * Fetches and caches TLE (Two-Line Element) data for satellites
 */

const CELESTRAK_BASE_URL = 'https://celestrak.org/NORAD/elements/gp.php';
const CACHE_KEY = 'sgspace_tle_cache';
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

// Known NEqO satellites (NORAD Catalog IDs)
export const SATS = {
  teleos2: 56196,
  teleos1: 41169,
  dseo: 53887,
  neusar: 53886,
  dssar: 57320,
};

// Internal backup TLEs in case of CelesTrak fetch failure (e.g. CORS/offline)
// These represent approx orbits for demonstration if live data fails
const BACKUP_TLES = {
  teleos2: [
    '1 56196U 23054A   23112.50000000  .00000000  00000-0  00000-0 0  9997',
    '2 56196  10.0000 120.0000 0010000   0.0000   0.0000 15.00000000    13'
  ],
  teleos1: [
    '1 41169U 15077D   23112.50000000  .00000000  00000-0  00000-0 0  9998',
    '2 41169  10.0000 125.0000 0010000   0.0000   0.0000 15.00000000    14'
  ],
  dseo: [
    '1 53887U 22072B   23112.50000000  .00000000  00000-0  00000-0 0  9999',
    '2 53887  10.0000 130.0000 0010000   0.0000   0.0000 15.00000000    15'
  ],
  neusar: [
    '1 53886U 22072A   23112.50000000  .00000000  00000-0  00000-0 0  9996',
    '2 53886  10.0000 135.0000 0010000   0.0000   0.0000 15.00000000    16'
  ],
  dssar: [
    '1 57320U 23101A   23300.50000000  .00000000  00000-0  00000-0 0  9995',
    '2 57320   5.0000 140.0000 0010000   0.0000   0.0000 15.00000000    17'
  ]
};

/**
 * Fetch constellation TLEs
 */
export async function fetchConstellationTLEs() {
  // Check cache first
  const cached = loadFromCache();
  if (cached) {
    console.log('Using cached TLE data');
    return cached;
  }

  const results = {};
  
  // Create comma separated string of catalogue numbers
  const ids = Object.values(SATS).join(',');
  const url = `${CELESTRAK_BASE_URL}?CATNR=${ids}&FORMAT=JSON`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const data = await response.json();
    
    // Parse JSON into TLE array format expected by satellite.js
    // JSON response has OBJECT_NAME, TLE_LINE1, TLE_LINE2
    const parsedData = {};
    for (const item of data) {
      // Find which key this corresponds to
      const entry = Object.entries(SATS).find(([k, v]) => v === parseInt(item.NORAD_CAT_ID));
      if (entry) {
        parsedData[entry[0]] = [item.TLE_LINE1, item.TLE_LINE2];
      }
    }
    
    // Ensure all satellites have data, if not use backup
    for (const key of Object.keys(SATS)) {
      if (parsedData[key]) {
        results[key] = parsedData[key];
      } else {
        console.warn(`Could not fetch TLE for ${key}, using strict backup.`);
        results[key] = BACKUP_TLES[key];
      }
    }
    
    saveToCache(results);
    return results;

  } catch (error) {
    console.error('Error fetching from CelesTrak, using local backup TLEs:', error);
    return BACKUP_TLES;
  }
}

/**
 * Fetch generic query from Celestrak (for API Sandbox)
 */
export async function executeSandboxQuery(queryParams) {
  const params = new URLSearchParams(queryParams);
  const url = `${CELESTRAK_BASE_URL}?${params.toString()}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Sandbox query error:', error);
    throw error;
  }
}

function loadFromCache() {
  try {
    const cachedStr = localStorage.getItem(CACHE_KEY);
    if (!cachedStr) return null;
    
    const cacheInfo = JSON.parse(cachedStr);
    if (Date.now() - cacheInfo.timestamp > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY);
      return null; // Expired
    }
    return cacheInfo.data;
  } catch (e) {
    return null;
  }
}

function saveToCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      data
    }));
  } catch (e) {
    console.warn('Could not save TLE cache:', e);
  }
}

/**
 * Fetch ~100 background satellites for orbital context
 */
export async function fetchBackgroundSatellites() {
  const bgCacheKey = 'sgspace_bg_tle_cache';
  try {
    const cachedStr = localStorage.getItem(bgCacheKey);
    if (cachedStr) {
      const cacheInfo = JSON.parse(cachedStr);
      if (Date.now() - cacheInfo.timestamp < CACHE_TTL) {
        return cacheInfo.data;
      }
    }
    
    // Fetch the 100 brightest satellites
    const url = `${CELESTRAK_BASE_URL}?GROUP=visual&FORMAT=JSON`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Background fetch failed');
    
    const data = await response.json();
    const results = {};
    
    // Parse into TLE array format and limit to ~150 objects to maintain 60fps
    const limit = Math.min(data.length, 150);
    for (let i = 0; i < limit; i++) {
      const item = data[i];
      // Skip if it's one of our main satellites to avoid duplicates
      if (!Object.values(SATS).includes(parseInt(item.NORAD_CAT_ID))) {
        results[`bg_${item.NORAD_CAT_ID}`] = [item.TLE_LINE1, item.TLE_LINE2];
      }
    }
    
    localStorage.setItem(bgCacheKey, JSON.stringify({
      timestamp: Date.now(),
      data: results
    }));
    
    return results;
  } catch (error) {
    console.error('Failed to fetch background satellites:', error);
    return {};
  }
}
