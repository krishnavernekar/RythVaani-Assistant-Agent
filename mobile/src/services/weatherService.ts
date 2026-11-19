import { Language } from '../store/useAppStore';

export interface WeatherData {
  temp: number;
  feelsLike: number;
  humidity: number;
  rainProb: number;
  windSpeed: number;
  windDir: number;
  /** Volumetric soil moisture (3–9 cm) expressed as a percentage (0–100). */
  soilMoisture: number;
  /** True when wind_speed_10m < 18 km/h → pesticide spraying is safe. */
  isSafeSpray: boolean;
  timestamp: string;
  isOffline: boolean;
}

/** Agronomy rule of thumb: spraying is unsafe above 18 km/h surface wind. */
export const SAFE_SPRAY_WIND_KMH = 18;

// Stitch benchmark fallback values per DESIGN.md / PRD.md
export const FALLBACK_WEATHER: WeatherData = {
  temp: 32,
  feelsLike: 36,
  humidity: 68,
  rainProb: 15,
  windSpeed: 14,
  windDir: 225, // SW
  soilMoisture: 24,
  isSafeSpray: true,
  timestamp: 'Just now (Offline Cache)',
  isOffline: true,
};

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const LAT = '16.3067'; // Lam / Guntur
const LNG = '80.4365';
const REQUEST_TIMEOUT_MS = 10000;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const toFiniteNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Open-Meteo returns `current.time` (e.g. "2026-11-06T14:30") and an hourly
 * array. Using the device-local hour breaks whenever the phone clock is not
 * IST, so align on the ISO hour returned by the API instead.
 */
const findHourlyIndex = (times: unknown, currentTime: unknown): number => {
  if (!Array.isArray(times) || times.length === 0) return -1;
  const isoTimes = times.filter((t): t is string => typeof t === 'string');
  if (isoTimes.length === 0) return -1;

  if (typeof currentTime === 'string' && currentTime.length >= 13) {
    const hourKey = currentTime.slice(0, 13);
    const exact = isoTimes.findIndex((t) => t.slice(0, 13) === hourKey);
    if (exact >= 0) return exact;

    // Fall back to the latest hourly slot at or before the current time.
    let latest = -1;
    for (let i = 0; i < isoTimes.length; i += 1) {
      if (isoTimes[i] <= currentTime) latest = i;
      else break;
    }
    if (latest >= 0) return latest;
  }

  // Last resort: device local hour clamped to the array bounds.
  return clamp(new Date().getHours(), 0, isoTimes.length - 1);
};

const formatLiveTimestamp = (currentTime: unknown): string => {
  if (typeof currentTime === 'string' && currentTime.length >= 16) {
    return `${currentTime.slice(11, 16)} IST`;
  }
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatOfflineTimestamp = (): string =>
  `${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (Cached)`;

/**
 * Fetches the live Guntur agromet feed. Never throws: any network/parse failure
 * degrades to the Stitch benchmark values (offline mode).
 */
export const fetchWeather = async (): Promise<WeatherData> => {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  try {
    const controller =
      typeof AbortController !== 'undefined' ? new AbortController() : null;
    if (controller) {
      timeoutHandle = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    }

    const url =
      `${BASE_URL}?latitude=${LAT}&longitude=${LNG}` +
      '&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m' +
      '&hourly=soil_moisture_3_to_9cm,precipitation_probability' +
      '&timezone=Asia%2FKolkata&forecast_days=3';

    const response = await fetch(url, controller ? { signal: controller.signal } : undefined);
    if (!response.ok) throw new Error(`Open-Meteo HTTP ${response.status}`);

    const data: any = await response.json();
    const current = data?.current;
    if (!current) throw new Error('Open-Meteo response missing `current` block');

    const temp = toFiniteNumber(current.temperature_2m);
    const feelsLike = toFiniteNumber(current.apparent_temperature);
    const humidity = toFiniteNumber(current.relative_humidity_2m);
    const windSpeed = toFiniteNumber(current.wind_speed_10m);
    const windDir = toFiniteNumber(current.wind_direction_10m);

    if (
      temp === null ||
      feelsLike === null ||
      humidity === null ||
      windSpeed === null ||
      windDir === null
    ) {
      throw new Error('Open-Meteo response missing current weather fields');
    }

    const hourly = data?.hourly;
    const hourlyIndex = findHourlyIndex(hourly?.time, current.time);

    const rainRaw =
      hourlyIndex >= 0
        ? toFiniteNumber(hourly?.precipitation_probability?.[hourlyIndex])
        : null;
    const soilRaw =
      hourlyIndex >= 0
        ? toFiniteNumber(hourly?.soil_moisture_3_to_9cm?.[hourlyIndex])
        : null;

    // Open-Meteo returns m³/m³ (0.00–1.00). Convert to a readable percentage.
    // Tolerate already-percent payloads just in case the API unit changes.
    const soilPercent =
      soilRaw === null
        ? FALLBACK_WEATHER.soilMoisture
        : Math.round(clamp(Math.abs(soilRaw) <= 1 ? soilRaw * 100 : soilRaw, 0, 100));

    const roundedWind = Math.round(windSpeed);

    return {
      temp: Math.round(temp),
      feelsLike: Math.round(feelsLike),
      humidity: Math.round(clamp(humidity, 0, 100)),
      rainProb:
        rainRaw === null ? 0 : Math.round(clamp(rainRaw, 0, 100)),
      windSpeed: roundedWind,
      windDir: Math.round(windDir),
      soilMoisture: soilPercent,
      isSafeSpray: roundedWind < SAFE_SPRAY_WIND_KMH,
      timestamp: formatLiveTimestamp(current.time),
      isOffline: false,
    };
  } catch (error) {
    console.warn('[WeatherService] Live fetch failed, using benchmark fallbacks:', error);
    return {
      ...FALLBACK_WEATHER,
      timestamp: formatOfflineTimestamp(),
      isOffline: true,
    };
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
};

/**
 * Maps wind direction degree to Telugu/English cardinal points
 */
export const getWindDirection = (deg: number, lang: Language): string => {
  if (deg >= 202.5 && deg <= 247.5) return lang === 'te' ? 'నైరుతి (SW)' : 'SW';
  if (deg > 247.5 && deg <= 292.5) return lang === 'te' ? 'పడమర (W)' : 'W';
  if (deg > 292.5 && deg <= 337.5) return lang === 'te' ? 'వాయువ్యం (NW)' : 'NW';
  if (deg > 337.5 || deg <= 22.5) return lang === 'te' ? 'ఉత్తరం (N)' : 'N';
  if (deg > 22.5 && deg <= 67.5) return lang === 'te' ? 'ఈశాన్యం (NE)' : 'NE';
  if (deg > 67.5 && deg <= 112.5) return lang === 'te' ? 'తూర్పు (E)' : 'E';
  if (deg > 112.5 && deg <= 157.5) return lang === 'te' ? 'ఆగ్నేయం (SE)' : 'SE';
  if (deg > 157.5 && deg <= 202.5) return lang === 'te' ? 'దక్షిణం (S)' : 'S';
  return 'SW';
};
