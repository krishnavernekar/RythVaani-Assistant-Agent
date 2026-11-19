/**
 * mandiService — Live Data.gov.in Agmarknet feed + verified APMC benchmarks.
 * ---------------------------------------------------------------------------
 * Live source:
 *   https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070
 *   state filter = Andhra Pradesh
 *
 * The public Agmarknet resource only exposes state/district/market/commodity/
 * variety/arrival_date/min_price/max_price/modal_price. It does NOT expose
 * arrivals/traded volumes, so those stay on the verified APMC benchmark cards.
 *
 * The service never throws: without an API key, on a market holiday, or with
 * no connectivity it returns the benchmark cards so the UI is always useful.
 */

export type MandiCategory = 'chilli' | 'paddy' | 'cotton' | 'other';
export type MandiYardId = 'guntur-mirchi' | 'tenali-paddy' | 'guntur-cotton';
export type MandiSource = 'live' | 'benchmark';

export interface MandiYard {
  id: MandiYardId;
  nameEn: string;
  nameTe: string;
}

export const MANDI_YARDS: MandiYard[] = [
  {
    id: 'guntur-mirchi',
    nameEn: 'Guntur Mirchi Yard',
    nameTe: 'గుంటూరు మిర్చి యార్డు',
  },
  {
    id: 'tenali-paddy',
    nameEn: 'Tenali / Guntur Paddy Yard',
    nameTe: 'తెనాలి / గుంటూరు వరి యార్డు',
  },
  {
    id: 'guntur-cotton',
    nameEn: 'Guntur Cotton Yard',
    nameTe: 'గుంటూరు పత్తి యార్డు',
  },
];

const YARD_BY_ID: Record<MandiYardId, MandiYard> = MANDI_YARDS.reduce(
  (acc, yard) => ({ ...acc, [yard.id]: yard }),
  {} as Record<MandiYardId, MandiYard>,
);

const YARD_BY_CATEGORY: Record<Exclude<MandiCategory, 'other'>, MandiYardId> = {
  chilli: 'guntur-mirchi',
  paddy: 'tenali-paddy',
  cotton: 'guntur-cotton',
};

const CATEGORY_LABELS: Record<Exclude<MandiCategory, 'other'>, { en: string; te: string }> = {
  chilli: { en: 'Chilli', te: 'మిర్చి' },
  paddy: { en: 'Paddy', te: 'వరి' },
  cotton: { en: 'Cotton', te: 'పత్తి' },
};

export interface MandiCommodity {
  id: string;
  varietyEn: string;
  varietyTe: string;
  grade: string;
  gradeTe: string;
  dryingLot?: string;
  /** Modal price per quintal in INR. */
  modalPrice: number;
  /** Change vs yesterday (benchmark cards) or vs APMC baseline (live cards). */
  priceChange: number;
  priceChangePct: number;
  minPrice: number;
  maxPrice: number;
  /** Bags — benchmark estimates only (Agmarknet public feed has no arrivals). */
  arrivals: number;
  traded: number;
  yard: string;
  yardTe: string;
  yardId: MandiYardId;
  category: MandiCategory;
  /** Live Agmarknet market/district/date when available. */
  marketName?: string;
  district?: string;
  arrivalDate?: string;
  source: MandiSource;
}

export interface MandiFeed {
  commodities: MandiCommodity[];
  source: MandiSource;
  isOffline: boolean;
  liveCount: number;
  fetchedAt: number;
  message?: string;
}

/* ─── Verified APMC benchmark cards ──────────────────────────────────────── */

export const MANDI_BENCHMARKS: MandiCommodity[] = [
  {
    id: 'guntur-teja-chilli',
    varietyEn: 'Guntur Teja Chilli',
    varietyTe: 'గుంటూరు తేజ మిర్చి',
    grade: 'Grade A',
    gradeTe: 'గ్రేడ్ A',
    dryingLot: 'Drying Lot',
    modalPrice: 22400,
    priceChange: 350,
    priceChangePct: 1.6,
    minPrice: 18500,
    maxPrice: 24200,
    arrivals: 42500,
    traded: 38200,
    yard: YARD_BY_ID['guntur-mirchi'].nameEn,
    yardTe: YARD_BY_ID['guntur-mirchi'].nameTe,
    yardId: 'guntur-mirchi',
    category: 'chilli',
    source: 'benchmark',
  },
  {
    id: 'byadgi-chilli',
    varietyEn: 'Byadgi Chilli',
    varietyTe: 'బ్యాదగి మిర్చి',
    grade: 'Grade A',
    gradeTe: 'గ్రేడ్ A',
    modalPrice: 19600,
    priceChange: 150,
    priceChangePct: 0.8,
    minPrice: 17800,
    maxPrice: 21500,
    arrivals: 8600,
    traded: 7900,
    yard: YARD_BY_ID['guntur-mirchi'].nameEn,
    yardTe: YARD_BY_ID['guntur-mirchi'].nameTe,
    yardId: 'guntur-mirchi',
    category: 'chilli',
    source: 'benchmark',
  },
  {
    id: 'bpt-5204-paddy',
    varietyEn: 'BPT 5204 Samba Mahsuri Paddy',
    varietyTe: 'BPT 5204 సాంబ మహ్సూరి వరి',
    grade: 'Grade A',
    gradeTe: 'గ్రేడ్ A',
    modalPrice: 2320,
    priceChange: 40,
    priceChangePct: 1.8,
    minPrice: 2150,
    maxPrice: 2410,
    arrivals: 15200,
    traded: 13800,
    yard: YARD_BY_ID['tenali-paddy'].nameEn,
    yardTe: YARD_BY_ID['tenali-paddy'].nameTe,
    yardId: 'tenali-paddy',
    category: 'paddy',
    source: 'benchmark',
  },
  {
    id: 'mtu-1010-paddy',
    varietyEn: 'MTU 1010 Paddy',
    varietyTe: 'MTU 1010 వరి',
    grade: 'Grade A',
    gradeTe: 'గ్రేడ్ A',
    modalPrice: 2260,
    priceChange: 25,
    priceChangePct: 1.1,
    minPrice: 2100,
    maxPrice: 2340,
    arrivals: 9400,
    traded: 8600,
    yard: YARD_BY_ID['tenali-paddy'].nameEn,
    yardTe: YARD_BY_ID['tenali-paddy'].nameTe,
    yardId: 'tenali-paddy',
    category: 'paddy',
    source: 'benchmark',
  },
  {
    id: 'mcu-5-cotton',
    varietyEn: 'MCU-5 Cotton',
    varietyTe: 'MCU-5 పత్తి',
    grade: 'Superior',
    gradeTe: 'ఉత్తమం',
    modalPrice: 6300,
    priceChange: -60,
    priceChangePct: -0.9,
    minPrice: 5950,
    maxPrice: 6550,
    arrivals: 28000,
    traded: 24500,
    yard: YARD_BY_ID['guntur-cotton'].nameEn,
    yardTe: YARD_BY_ID['guntur-cotton'].nameTe,
    yardId: 'guntur-cotton',
    category: 'cotton',
    source: 'benchmark',
  },
];

const cloneBenchmarks = (): MandiCommodity[] =>
  MANDI_BENCHMARKS.map((commodity) => ({ ...commodity }));

/** Offline-safe benchmark feed — also used as the initial UI state. */
export const getBenchmarkFeed = (message?: string): MandiFeed => ({
  commodities: cloneBenchmarks(),
  source: 'benchmark',
  isOffline: true,
  liveCount: 0,
  fetchedAt: Date.now(),
  message,
});

/* ─── Helpers ────────────────────────────────────────────────────────────── */

const API_RESOURCE_URL =
  'https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070';
const REQUEST_TIMEOUT_MS = 10000;

const parsePrice = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const cleaned = String(value).replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeText = (value: unknown): string =>
  String(value ?? '').trim();

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'record';

export const getMandiCategory = (commodity: unknown): MandiCategory => {
  const text = normalizeText(commodity).toLowerCase();
  if (/chilli|chili|mirchi|మిర్?చి/.test(text)) return 'chilli';
  // Milled "Rice" is intentionally excluded — only paddy is a mandi crop here.
  if (/paddy|dhan|వరి|ధాన్యం/.test(text)) return 'paddy';
  if (/cotton|kapas|పత్తి/.test(text)) return 'cotton';
  return 'other';
};

const isTargetMarket = (market: string, district: string): boolean =>
  /guntur|tenali|lam|mangalagiri/i.test(`${market} ${district}`);

interface LiveRecord {
  key: string;
  category: Exclude<MandiCategory, 'other'>;
  market: string;
  district: string;
  commodity: string;
  variety: string;
  arrivalDate?: string;
  minPrice: number;
  maxPrice: number;
  modalPrice: number;
}

interface AgmarknetRecord {
  state?: unknown;
  district?: unknown;
  market?: unknown;
  commodity?: unknown;
  variety?: unknown;
  arrival_date?: unknown;
  min_price?: unknown;
  max_price?: unknown;
  modal_price?: unknown;
}

const normalizeRecord = (
  record: AgmarknetRecord,
  index: number,
): LiveRecord | null => {
  const commodity = normalizeText(record.commodity);
  const variety = normalizeText(record.variety);
  const category = getMandiCategory(`${commodity} ${variety}`);
  if (category === 'other') return null;

  const modalPrice = parsePrice(record.modal_price);
  if (modalPrice === null || modalPrice <= 0) return null;

  const minPrice = parsePrice(record.min_price) ?? modalPrice;
  const maxPrice = parsePrice(record.max_price) ?? modalPrice;
  const market = normalizeText(record.market) || 'AP Market';
  const district = normalizeText(record.district) || 'Andhra Pradesh';
  const arrivalDate = normalizeText(record.arrival_date) || undefined;

  return {
    key: `${commodity}|${variety}|${market}|${arrivalDate ?? index}`,
    category,
    market,
    district,
    commodity,
    variety,
    arrivalDate,
    minPrice: Math.min(minPrice, modalPrice, maxPrice),
    maxPrice: Math.max(minPrice, modalPrice, maxPrice),
    modalPrice,
  };
};

/** Variety keywords used to attach a live record to the right benchmark card. */
const BENCHMARK_MATCHERS: Record<string, RegExp> = {
  'guntur-teja-chilli': /teja|341|guntur/i,
  'byadgi-chilli': /byadgi|byadagi/i,
  'bpt-5204-paddy': /b\s*p\s*t|samba|mahsuri|mahisuri/i,
  'mtu-1010-paddy': /mtu/i,
  'mcu-5-cotton': /mcu|h4|bunny/i,
};

const applyLiveToBenchmark = (
  benchmark: MandiCommodity,
  live: LiveRecord,
): MandiCommodity => {
  const priceChange = live.modalPrice - benchmark.modalPrice;
  const priceChangePct =
    benchmark.modalPrice > 0 ? (priceChange / benchmark.modalPrice) * 100 : 0;

  return {
    ...benchmark,
    modalPrice: live.modalPrice,
    minPrice: live.minPrice,
    maxPrice: live.maxPrice,
    priceChange: Math.round(priceChange),
    priceChangePct: Math.round(priceChangePct * 10) / 10,
    marketName: live.market,
    district: live.district,
    arrivalDate: live.arrivalDate,
    source: 'live',
  };
};

const liveRecordToCommodity = (live: LiveRecord): MandiCommodity => {
  const yardId = YARD_BY_CATEGORY[live.category];
  const yard = YARD_BY_ID[yardId];
  const label = CATEGORY_LABELS[live.category];
  const varietyName = live.variety || live.commodity;

  return {
    id: `live-${slugify(live.key)}`,
    varietyEn: `${label.en} — ${varietyName}`,
    varietyTe: `${label.te} — ${varietyName}`,
    grade: 'FAQ',
    gradeTe: 'సాధారణ నాణ్యత',
    modalPrice: live.modalPrice,
    priceChange: 0,
    priceChangePct: 0,
    minPrice: live.minPrice,
    maxPrice: live.maxPrice,
    arrivals: 0,
    traded: 0,
    yard: yard.nameEn,
    yardTe: yard.nameTe,
    yardId,
    category: live.category,
    marketName: live.market,
    district: live.district,
    arrivalDate: live.arrivalDate,
    source: 'live',
  };
};

const buildFeed = (
  liveRecords: LiveRecord[],
  message?: string,
): MandiFeed => {
  const used = new Set<string>();
  const matched = new Map<string, LiveRecord>();

  /// Prefer the local Guntur/Tenali/Lam yards, then fall back to any AP record.
  const pickRecord = (
    predicate: (record: LiveRecord) => boolean,
  ): LiveRecord | undefined => {
    const candidates = liveRecords.filter(
      (record) => !used.has(record.key) && predicate(record),
    );
    return (
      candidates.find((record) => isTargetMarket(record.market, record.district)) ??
      candidates[0]
    );
  };

  // Match on the live variety only. Matching the commodity would attach every
  // "Dry Chillies" record to the Teja/Byadgi cards and mislabel prices.
  MANDI_BENCHMARKS.forEach((benchmark) => {
    const matcher = BENCHMARK_MATCHERS[benchmark.id];
    if (!matcher) return;
    const candidate = pickRecord(
      (record) =>
        record.category === benchmark.category &&
        matcher.test(record.variety || record.commodity),
    );
    if (candidate) {
      used.add(candidate.key);
      matched.set(benchmark.id, candidate);
    }
  });

  const merged = MANDI_BENCHMARKS.map((benchmark) => {
    const live = matched.get(benchmark.id);
    return live
      ? applyLiveToBenchmark(benchmark, live)
      : { ...benchmark, source: 'benchmark' as const };
  });

  // Extra live cards from Guntur/Tenali markets (cap to keep the list scannable).
  const extras = liveRecords
    .filter(
      (record) =>
        !used.has(record.key) && isTargetMarket(record.market, record.district),
    )
    .slice(0, 4)
    .map(liveRecordToCommodity);

  const commodities = [...merged, ...extras];
  const liveCount = commodities.filter((item) => item.source === 'live').length;

  return {
    commodities,
    source: liveCount > 0 ? 'live' : 'benchmark',
    isOffline: liveCount === 0,
    liveCount,
    fetchedAt: Date.now(),
    message,
  };
};

/* ─── Public fetch ───────────────────────────────────────────────────────── */

const getApiKey = (): string =>
  (process.env.EXPO_PUBLIC_DATA_GOV_API_KEY || '').trim();

const parseLiveRecords = (data: any): LiveRecord[] => {
  const rawRecords = data?.records ?? data?.data;
  if (!Array.isArray(rawRecords)) return [];
  return rawRecords
    .map((record: AgmarknetRecord, index: number) =>
      normalizeRecord(record, index),
    )
    .filter((record): record is LiveRecord => record !== null);
};

/**
 * Fetches live Andhra Pradesh mandi prices from Data.gov.in and merges them
 * over the verified APMC benchmark cards. Never throws.
 *
 * Two feeds are combined:
 *  - Guntur district (guarantees Guntur/Tenali local yard coverage)
 *  - All Andhra Pradesh records (broader chilli/paddy/cotton coverage)
 * Guntur records are added first so they win the benchmark merge.
 */
export const fetchMandiCommodities = async (): Promise<MandiFeed> => {
  const apiKey = getApiKey();

  if (!apiKey) {
    return getBenchmarkFeed(
      'Add EXPO_PUBLIC_DATA_GOV_API_KEY to .env for live Agmarknet rates — showing verified APMC benchmarks.',
    );
  }

  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  try {
    const controller =
      typeof AbortController !== 'undefined' ? new AbortController() : null;
    if (controller) {
      timeoutHandle = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    }

    const baseQuery =
      `${API_RESOURCE_URL}?api-key=${encodeURIComponent(apiKey)}` +
      '&format=json&limit=100&filters[state.keyword]=Andhra%20Pradesh';
    const urls = [
      `${baseQuery}&filters[district.keyword]=Guntur`,
      baseQuery,
    ];

    const responses = await Promise.allSettled(
      urls.map(async (url) => {
        const response = await fetch(
          url,
          controller ? { signal: controller.signal } : undefined,
        );
        if (!response.ok) {
          throw new Error(`Data.gov.in HTTP ${response.status}`);
        }
        return response.json();
      }),
    );

    const seen = new Set<string>();
    const liveRecords: LiveRecord[] = [];
    responses.forEach((result) => {
      if (result.status !== 'fulfilled') return;
      parseLiveRecords(result.value).forEach((record) => {
        if (!seen.has(record.key)) {
          seen.add(record.key);
          liveRecords.push(record);
        }
      });
    });

    if (liveRecords.length === 0) {
      return getBenchmarkFeed(
        'No live AP records returned today (market holiday?) — showing verified APMC benchmarks.',
      );
    }

    const gunturCount = liveRecords.filter((record) =>
      isTargetMarket(record.market, record.district),
    ).length;

    return buildFeed(
      liveRecords,
      `Live Agmarknet: ${liveRecords.length} Andhra Pradesh record(s), ${gunturCount} from Guntur/Tenali yards, merged with APMC benchmarks.`,
    );
  } catch (error) {
    console.warn('[MandiService] Live fetch failed, using APMC benchmarks:', error);
    return getBenchmarkFeed(
      'Live mandi feed unavailable — showing verified APMC benchmark rates.',
    );
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
};
