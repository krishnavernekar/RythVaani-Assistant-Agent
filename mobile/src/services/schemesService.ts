/**
 * schemesService — EPIC-07 Pro
 * ---------------------------------------------------------------------------
 * Real Andhra Pradesh & Telangana government-scheme decision engine.
 *
 * • 9-input Zero-PII farmer profile (no Aadhaar / OTP / bank numbers)
 * • 6 authentic AP + Central schemes with official rulebooks
 * • 3-tier eligibility verdict: ELIGIBLE / ACTION_REQUIRED / NOT_ELIGIBLE
 * • Dynamic ₹ calculations for the farmer's exact acres, category & crops
 * • Decision priority ranked by financial impact + urgency
 * • Gemini 2.5 Flash advisor with a comprehensive offline rule responder
 *
 * Sources: apagrisnet.gov.in, karshak.ap.gov.in, apmip.ap.gov.in,
 *          ysrrythubharosa.ap.gov.in, pmkisan.gov.in, pmfby.gov.in,
 *          pmkusum.mnre.gov.in, myscheme.gov.in
 */

/* ────────────────────────────── Public types ───────────────────────────── */

export type SchemeCategory = 'income' | 'input' | 'insurance' | 'credit' | 'solar';

export type DistrictId =
  | 'guntur'
  | 'krishna'
  | 'bapatla'
  | 'palnadu'
  | 'prakasam'
  | 'khammam';

export type StateId = 'AP' | 'TG';

export type SocialCategory = 'OC_GENERAL' | 'BC' | 'SC' | 'ST';

export type Ownership =
  | 'PATTADAR'
  | 'TENANT_CCRC'
  | 'TENANT_NO_CCRC'
  | 'ROFR_ASSIGNED';

export type EPantaStatus = 'REGISTERED' | 'NOT_REGISTERED';

export type SchemeCrop = 'paddy' | 'chilli' | 'cotton' | 'turmeric' | 'pulses';

export type Irrigation = 'BOREWELL' | 'CANAL' | 'RAINFED';

export type PriorityNeed =
  | 'ALL'
  | 'INCOME_SUPPORT'
  | 'IRRIGATION_SUBSIDY'
  | 'CROP_INSURANCE'
  | 'INTEREST_FREE_LOAN'
  | 'MACHINERY_SOLAR';

export type LandholdingClass = 'MARGINAL' | 'SMALL' | 'SEMI_MEDIUM' | 'LARGE';

export type EligibilityStatus =
  | 'ELIGIBLE'
  | 'ACTION_REQUIRED'
  | 'NOT_ELIGIBLE';

export interface BilingualText {
  en: string;
  te: string;
}

export interface FarmerSchemeProfile {
  district: DistrictId;
  state: StateId;
  socialCategory: SocialCategory;
  /** true = family has an income-tax payer / govt employee / pension > ₹10,000. */
  excludedByIncomeTax: boolean;
  acres: number;
  ownership: Ownership;
  ePanta: EPantaStatus;
  crops: SchemeCrop[];
  irrigation: Irrigation;
  priorityNeed: PriorityNeed;
}

export interface SchemeDocument {
  key: string;
  en: string;
  te: string;
  whereEn: string;
  whereTe: string;
}

export interface ApplicationStep {
  titleEn: string;
  titleTe: string;
  detailEn: string;
  detailTe: string;
}

export interface SchemeContact {
  roleEn: string;
  roleTe: string;
  detailEn: string;
  detailTe: string;
}

export interface Helpline {
  labelEn: string;
  labelTe: string;
  number: string;
}

export interface Scheme {
  id: string;
  nameEn: string;
  nameTe: string;
  shortNameEn: string;
  shortNameTe: string;
  category: SchemeCategory;
  categoryLabelEn: string;
  categoryLabelTe: string;
  benefitEn: string;
  benefitTe: string;
  descriptionEn: string;
  descriptionTe: string;
  /** Kept as BilingualText[] for saved-bookmark compatibility. */
  docs: BilingualText[];
  /** Modal-only guidance: where to obtain each document in the village. */
  documentGuides: SchemeDocument[];
  portalUrl: string;
  portalLabelEn: string;
  portalLabelTe: string;
  source: string;
  eligibilityNoteEn: string;
  eligibilityNoteTe: string;
  /** Fed verbatim into the Gemini prompt so answers stay inside official rules. */
  rulebookEn: string;
  rulebookTe: string;
  offlineSteps: ApplicationStep[];
  onlineSteps: ApplicationStep[];
  contacts: SchemeContact[];
  helplines: Helpline[];
  followUps: BilingualText[];
}

export interface FinancialRow {
  labelEn: string;
  labelTe: string;
  value: string;
  emphasis?: boolean;
}

export interface SchemeEvaluation {
  scheme: Scheme;
  status: EligibilityStatus;
  matchScore: number;
  calculatedBenefitEn: string;
  calculatedBenefitTe: string;
  verdictReasonEn: string;
  verdictReasonTe: string;
  nextActionEn: string;
  nextActionTe: string;
  /** 1 = apply first, 2 = next … 0 = not ranked (not eligible). */
  decisionPriority: number;
  priorityScore: number;
  financialImpact: number;
  financialBreakdown: FinancialRow[];
}

export interface SchemeAiAnswer {
  answerEn: string;
  answerTe: string;
  source: 'gemini' | 'offline';
}

/* ────────────────────────────── Labels ─────────────────────────────────── */

export const DISTRICTS: {
  id: DistrictId;
  state: StateId;
  en: string;
  te: string;
}[] = [
  { id: 'guntur', state: 'AP', en: 'Guntur', te: 'గుంటూరు' },
  { id: 'krishna', state: 'AP', en: 'Krishna', te: 'కృష్ణా' },
  { id: 'bapatla', state: 'AP', en: 'Bapatla', te: 'బాపట్ల' },
  { id: 'palnadu', state: 'AP', en: 'Palnadu', te: 'పల్నాడు' },
  { id: 'prakasam', state: 'AP', en: 'Prakasam', te: 'ప్రకాశం' },
  { id: 'khammam', state: 'TG', en: 'Khammam', te: 'ఖమ్మం' },
];

export const CATEGORY_LABELS: Record<SchemeCategory, BilingualText> = {
  income: { en: 'Income Support', te: 'ఆదాయ సహాయం' },
  input: { en: 'Input Subsidy', te: 'ఇన్‌పుట్ సబ్సిడీ' },
  insurance: { en: 'Crop Insurance', te: 'పంట బీమా' },
  credit: { en: 'Credit & Interest', te: 'రుణం & వడ్డీ' },
  solar: { en: 'Solar & Machinery', te: 'సోలార్ & యంత్రాలు' },
};

export const SOCIAL_CATEGORY_LABELS: Record<SocialCategory, BilingualText> = {
  OC_GENERAL: { en: 'OC / General', te: 'ఓసీ / జనరల్' },
  BC: { en: 'BC (Backward Class)', te: 'బీసీ (వెనుకబడిన తరగతి)' },
  SC: { en: 'SC (Scheduled Caste)', te: 'ఎస్సీ (షెడ్యూల్డ్ కులం)' },
  ST: { en: 'ST (Scheduled Tribe)', te: 'ఎస్టీ (షెడ్యూల్డ్ తెగ)' },
};

export const OWNERSHIP_LABELS: Record<Ownership, BilingualText> = {
  PATTADAR: {
    en: 'Pattadar / Self-owned (1B ROR)',
    te: 'పట్టాదారు / స్వంత భూమి (1B ROR)',
  },
  TENANT_CCRC: {
    en: 'Tenant with CCRC Card',
    te: 'CCRC కార్డు ఉన్న కౌలు రైతు',
  },
  TENANT_NO_CCRC: {
    en: 'Tenant WITHOUT CCRC Card',
    te: 'CCRC కార్డు లేని కౌలు రైతు',
  },
  ROFR_ASSIGNED: {
    en: 'ROFR / Assigned landholder',
    te: 'ROFR / అసైన్డ్ భూమి కలిగిన రైతు',
  },
};

export const EPANTA_LABELS: Record<EPantaStatus, BilingualText> = {
  REGISTERED: {
    en: 'Registered at RBK / RSK',
    te: 'RBK / RSK లో నమోదు పూర్తయింది',
  },
  NOT_REGISTERED: {
    en: 'Not registered yet',
    te: 'ఇంకా నమోదు చేయలేదు',
  },
};

export const CROP_LABELS: Record<SchemeCrop, BilingualText> = {
  paddy: { en: 'Paddy', te: 'వరి' },
  chilli: { en: 'Chilli', te: 'మిర్చి' },
  cotton: { en: 'Cotton', te: 'పత్తి' },
  turmeric: { en: 'Turmeric', te: 'పసుపు' },
  pulses: { en: 'Pulses', te: 'మినుము / పెసర' },
};

export const IRRIGATION_LABELS: Record<Irrigation, BilingualText> = {
  BOREWELL: { en: 'Borewell', te: 'బోరు బావి' },
  CANAL: { en: 'Canal', te: 'కాలువ' },
  RAINFED: { en: 'Rainfed', te: 'వర్షాధారం' },
};

export const PRIORITY_LABELS: Record<PriorityNeed, BilingualText> = {
  ALL: { en: 'All schemes', te: 'అన్ని పథకాలు' },
  INCOME_SUPPORT: { en: 'Income support', te: 'ఆదాయ సహాయం' },
  IRRIGATION_SUBSIDY: { en: 'Drip / irrigation subsidy', te: 'డ్రిప్ / నీటిపారుదల సబ్సిడీ' },
  CROP_INSURANCE: { en: 'Crop insurance', te: 'పంట బీమా' },
  INTEREST_FREE_LOAN: { en: '0% interest crop loan', te: '0% వడ్డీ పంట రుణం' },
  MACHINERY_SOLAR: { en: 'Solar pump / machinery', te: 'సోలార్ పంపు / యంత్రాలు' },
};

export const LANDHOLDING_CLASS_LABELS: Record<LandholdingClass, BilingualText> = {
  MARGINAL: { en: 'Marginal (≤ 2.5 acres)', te: 'సన్నకారు (≤ 2.5 ఎకరాలు)' },
  SMALL: { en: 'Small (2.5–5 acres)', te: 'చిన్న రైతు (2.5–5 ఎకరాలు)' },
  SEMI_MEDIUM: { en: 'Semi-medium (5–10 acres)', te: 'అర్ధ-మధ్యస్థ (5–10 ఎకరాలు)' },
  LARGE: { en: 'Large (above 10 acres)', te: 'పెద్ద రైతు (10 ఎకరాలకు పైగా)' },
};

/* ────────────────────────────── Helpers ────────────────────────────────── */

export const getStateForDistrict = (district: DistrictId): StateId =>
  district === 'khammam' ? 'TG' : 'AP';

export const landholdingClassOf = (acres: number): LandholdingClass => {
  if (acres <= 2.5) return 'MARGINAL';
  if (acres <= 5) return 'SMALL';
  if (acres <= 10) return 'SEMI_MEDIUM';
  return 'LARGE';
};

const isSmallOrMarginal = (acres: number): boolean =>
  landholdingClassOf(acres) === 'MARGINAL' ||
  landholdingClassOf(acres) === 'SMALL';

const isScSt = (profile: FarmerSchemeProfile): boolean =>
  profile.socialCategory === 'SC' || profile.socialCategory === 'ST';

const districtName = (id: DistrictId, language: 'en' | 'te'): string => {
  const found = DISTRICTS.find((district) => district.id === id);
  return found ? found[language] : id;
};

/** Indian digit grouping (2,02,500) without relying on Intl at runtime. */
export const formatINR = (value: number): string => {
  const rounded = Math.round(Math.abs(value));
  const text = rounded.toString();
  if (text.length <= 3) return `₹${text}`;
  const last3 = text.slice(-3);
  const rest = text.slice(0, -3);
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `₹${grouped},${last3}`;
};

export const formatAcres = (acres: number): string =>
  `${acres % 1 === 0 ? acres.toFixed(0) : acres.toFixed(1)} acres`;

const cropNames = (crops: SchemeCrop[], language: 'en' | 'te'): string =>
  crops.length === 0
    ? language === 'te'
      ? 'పంట ఎంపిక లేదు'
      : 'no crop selected'
    : crops.map((crop) => CROP_LABELS[crop][language]).join(' / ');

/** Maps free-text crops from the saved farmer profile to scheme crop codes. */
export const mapProfileCrops = (crops: string[]): SchemeCrop[] => {
  const mapped = new Set<SchemeCrop>();
  crops.forEach((crop) => {
    const text = String(crop || '').toLowerCase();
    if (/paddy|rice|వరి|ధాన్యం/.test(text)) mapped.add('paddy');
    if (/chilli|chili|mirchi|మిర్చి|మిరప/.test(text)) mapped.add('chilli');
    if (/cotton|పత్తి/.test(text)) mapped.add('cotton');
    if (/turmeric|pasupu|పసుపు/.test(text)) mapped.add('turmeric');
    if (/pulse|gram|dal|మినుము|పెసర|శనగ/.test(text)) mapped.add('pulses');
  });
  return Array.from(mapped);
};

const normalizeDistrict = (value?: string): DistrictId => {
  const text = String(value || '').toLowerCase();
  const found = DISTRICTS.find(
    (district) =>
      text.includes(district.id) ||
      text.includes(district.en.toLowerCase()) ||
      text.includes(district.te),
  );
  return found ? found.id : 'guntur';
};

/** Seeds the wizard from the persisted Zero-PII farmer profile. */
export const createDefaultProfile = (farmer?: {
  district?: string;
  state?: string;
  acres?: number;
  category?: string;
  crops?: string[];
}): FarmerSchemeProfile => {
  const district = normalizeDistrict(farmer?.district);
  const mappedCrops = mapProfileCrops(farmer?.crops ?? []);
  return {
    district,
    state: getStateForDistrict(district),
    socialCategory: 'OC_GENERAL',
    excludedByIncomeTax: false,
    acres: farmer?.acres && farmer.acres > 0 ? farmer.acres : 4.5,
    ownership: farmer?.category === 'Tenant' ? 'TENANT_CCRC' : 'PATTADAR',
    ePanta: 'REGISTERED',
    crops: mappedCrops.length > 0 ? mappedCrops : ['chilli', 'paddy'],
    irrigation: 'BOREWELL',
    priorityNeed: 'ALL',
  };
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const score = (status: EligibilityStatus, boosts: number): number => {
  const raw = status === 'NOT_ELIGIBLE' ? 18 + boosts * 0.4 : 62 + boosts;
  if (status === 'ELIGIBLE') return clamp(Math.round(raw), 80, 100);
  if (status === 'ACTION_REQUIRED') return clamp(Math.round(raw), 55, 88);
  return clamp(Math.round(raw), 8, 45);
};

const step = (
  titleEn: string,
  titleTe: string,
  detailEn: string,
  detailTe: string,
): ApplicationStep => ({ titleEn, titleTe, detailEn, detailTe });

const contact = (
  roleEn: string,
  roleTe: string,
  detailEn: string,
  detailTe: string,
): SchemeContact => ({ roleEn, roleTe, detailEn, detailTe });

const helpline = (
  labelEn: string,
  labelTe: string,
  number: string,
): Helpline => ({ labelEn, labelTe, number });

const docsOf = (guides: SchemeDocument[]): BilingualText[] =>
  guides.map((guide) => ({ en: guide.en, te: guide.te }));

const PATTA_DOC: SchemeDocument = {
  key: 'pattadar',
  en: 'Pattadar Passbook / 1B ROR',
  te: 'పట్టాదారు పాస్‌బుక్ / 1B ROR',
  whereEn: 'MeeSeva centre, Village Secretariat or RBK',
  whereTe: 'మీసేవ కేంద్రం, గ్రామ సచివాలయం లేదా RBK',
};
const CCRC_DOC: SchemeDocument = {
  key: 'ccrc',
  en: 'CCRC card + lease agreement (tenant farmers)',
  te: 'CCRC కార్డు + లీజు ఒప్పందం (కౌలు రైతులు)',
  whereEn: 'Village Secretariat / RBK with the landowner present',
  whereTe: 'భూ యజమాని సమక్షంలో గ్రామ సచివాలయం / RBK',
};
const AADHAAR_DOC: SchemeDocument = {
  key: 'aadhaar',
  en: 'Aadhaar card linked with mobile number',
  te: 'మొబైల్ నంబర్‌తో లింక్ చేసిన ఆధార్ కార్డు',
  whereEn: 'MeeSeva / Aadhaar Seva Kendra',
  whereTe: 'మీసేవ / ఆధార్ సేవా కేంద్రం',
};
const DBT_DOC: SchemeDocument = {
  key: 'dbt',
  en: 'NPCI / DBT-active bank account',
  te: 'NPCI / DBT యాక్టివ్ బ్యాంక్ ఖాతా',
  whereEn: 'Your bank branch — ask for Aadhaar seeding + NPCI mapping',
  whereTe: 'మీ బ్యాంక్ శాఖ — ఆధార్ సీడింగ్ + NPCI మ్యాపింగ్ అడగండి',
};
const EPANTA_DOC: SchemeDocument = {
  key: 'epanta',
  en: 'e-Panta (e-Crop) booking receipt',
  te: 'ఈ-పంట (ఈ-క్రాప్) బుకింగ్ రసీదు',
  whereEn: 'RBK / RSK with your Village Agriculture Assistant (VAA)',
  whereTe: 'మీ గ్రామ వ్యవసాయ సహాయకుడు (VAA)తో RBK / RSK లో',
};
const SOIL_DOC: SchemeDocument = {
  key: 'soil',
  en: 'Soil / water test report',
  te: 'నేల / నీటి పరీక్ష నివేదిక',
  whereEn: 'RBK soil testing lab or ANGRAU district lab',
  whereTe: 'RBK నేల పరీక్ష ప్రయోగశాల లేదా ANGRAU జిల్లా ల్యాబ్',
};

const AP_RYTHU_HELPLINE = helpline(
  'AP Rythu Call Centre',
  'ఏపీ రైతు కాల్ సెంటర్',
  '155251',
);
const ANGRAU_HELPLINE = helpline(
  'ANGRAU Agriculture Helpline',
  'ANGRAU వ్యవసాయ హెల్ప్‌లైన్',
  '1800-425-0430',
);

const VAA_CONTACT = contact(
  'Village Agriculture Assistant (VAA)',
  'గ్రామ వ్యవసాయ సహాయకుడు (VAA)',
  'RBK / RSK, your village — e-Panta, applications and field verification',
  'మీ గ్రామం RBK / RSK — ఈ-పంట, దరఖాస్తులు మరియు క్షేత్ర పరిశీలన',
);
const MAO_CONTACT = contact(
  'Mandal Agriculture Officer (MAO)',
  'మండల వ్యవసాయ అధికారి (MAO)',
  'Mandal Agriculture Office — approvals and grievance redressal',
  'మండల వ్యవసాయ కార్యాలయం — ఆమోదాలు మరియు ఫిర్యాదుల పరిష్కారం',
);
const BANK_CONTACT = contact(
  'Bank Branch Manager',
  'బ్యాంక్ శాఖ మేనేజర్',
  'Your bank branch — KCC, DBT/NPCI seeding and loan disbursal',
  'మీ బ్యాంక్ శాఖ — KCC, DBT/NPCI సీడింగ్ మరియు రుణం disbursal',
);

/* ────────────────────────────── Scheme database ────────────────────────── */

export const SCHEMES: Scheme[] = [
  {
    id: 'annadata-sukhibhava',
    nameEn: 'Annadata Sukhibhava / YSR Rythu Bharosa + PM-KISAN Convergence',
    nameTe: 'అన్నదాత సుఖీభవ / వైఎస్ఆర్ రైతు భరోసా + PM-KISAN కన్వర్జెన్స్',
    shortNameEn: 'Annadata Sukhibhava',
    shortNameTe: 'అన్నదాత సుఖీభవ',
    category: 'income',
    categoryLabelEn: CATEGORY_LABELS.income.en,
    categoryLabelTe: CATEGORY_LABELS.income.te,
    benefitEn: '₹13,500 – ₹20,000 per year in 3 DBT instalments',
    benefitTe: 'సంవత్సరానికి ₹13,500 – ₹20,000, 3 DBT విడతలుగా',
    descriptionEn:
      'Andhra Pradesh income support for Pattadar, ROFR and CCRC-registered tenant farmers, converged with the central PM-KISAN benefit and paid directly into the Aadhaar-linked bank account in three instalments.',
    descriptionTe:
      'పట్టాదారు, ROFR మరియు CCRC నమోదైన కౌలు రైతులకు ఆంధ్రప్రదేశ్ ప్రభుత్వ ఆదాయ సహాయం. కేంద్ర PM-KISAN ప్రయోజనంతో కలిపి, మూడు విడతలుగా ఆధార్ లింక్ బ్యాంక్ ఖాతాలో నేరుగా జమ అవుతుంది.',
    documentGuides: [PATTA_DOC, CCRC_DOC, AADHAAR_DOC, DBT_DOC, EPANTA_DOC],
    docs: docsOf([PATTA_DOC, CCRC_DOC, AADHAAR_DOC, DBT_DOC, EPANTA_DOC]),
    portalUrl: 'https://ysrrythubharosa.ap.gov.in/',
    portalLabelEn: 'Open YSR Rythu Bharosa portal',
    portalLabelTe: 'వైఎస్ఆర్ రైతు భరోసా పోర్టల్ తెరవండి',
    source: 'apagrisnet.gov.in · ysrrythubharosa.ap.gov.in',
    eligibilityNoteEn:
      'AP resident landholding families only. Income-tax payers, government employees and pensioners drawing above ₹10,000/month are excluded.',
    eligibilityNoteTe:
      'ఆంధ్రప్రదేశ్ నివాస భూమి కలిగిన రైతు కుటుంబాలకు మాత్రమే. ఆదాయపు పన్ను చెల్లింపుదారులు, ప్రభుత్వ ఉద్యోగులు మరియు నెలకు ₹10,000కు పైగా పెన్షన్ తీసుకునేవారు అర్హులు కాదు.',
    rulebookEn:
      'Annadata Sukhibhava is the AP income-support scheme converged with PM-KISAN. AP contributes the state top-up and the Centre contributes ₹6,000 through PM-KISAN, for a combined ₹13,500–₹20,000 per year in three instalments. Beneficiaries must be AP resident landholding farmer families with a Pattadar Passbook/1B ROR, ROFR assignment, or a CCRC card for tenants. Income-tax payers, serving/retired government employees and pensioners receiving more than ₹10,000 per month are excluded. e-Panta (e-Crop) booking at the RBK is required to keep the beneficiary active. Payments go through DBT to the Aadhaar-linked, NPCI-mapped bank account.',
    rulebookTe:
      'అన్నదాత సుఖీభవ అనేది PM-KISANతో కలిపిన ఆంధ్రప్రదేశ్ ఆదాయ సహాయ పథకం. రాష్ట్రం అదనపు సహాయం మరియు కేంద్రం PM-KISAN ద్వారా ₹6,000 ఇస్తాయి; మొత్తం సంవత్సరానికి ₹13,500–₹20,000, మూడు విడతలుగా. పట్టాదారు పాస్‌బుక్/1B ROR, ROFR లేదా కౌలు రైతులకు CCRC కార్డు ఉన్న ఆంధ్రప్రదేశ్ నివాస భూమి కలిగిన కుటుంబాలు అర్హులు. ఆదాయపు పన్ను చెల్లింపుదారులు, ప్రభుత్వ ఉద్యోగులు మరియు నెలకు ₹10,000కు పైగా పెన్షన్ పొందేవారు అర్హులు కాదు. ప్రయోజనం కొనసాగాలంటే RBKలో ఈ-పంట నమోదు తప్పనిసరి. చెల్లింపులు ఆధార్ లింక్, NPCI మ్యాపింగ్ ఉన్న బ్యాంక్ ఖాతాకు DBT ద్వారా జమ అవుతాయి.',
    offlineSteps: [
      step(
        'Meet your VAA at the RBK',
        'RBK లో మీ VAA ని కలవండి',
        'Carry your Pattadar Passbook/1B ROR or CCRC card, Aadhaar and bank passbook. Ask the VAA to verify your name in the Annadata beneficiary list.',
        'పట్టాదారు పాస్‌బుక్/1B ROR లేదా CCRC కార్డు, ఆధార్ మరియు బ్యాంక్ పాస్‌బుక్ తీసుకెళ్లండి. అన్నదాత లబ్ధిదారుల జాబితాలో మీ పేరు ఉందో లేదో VAA ని అడగండి.',
      ),
      step(
        'Complete e-Panta booking',
        'ఈ-పంట నమోదు పూర్తి చేయండి',
        'Register the crop, survey number and sowing date at the RBK. This is free and keeps your income support and insurance active.',
        'పంట, సర్వే నంబర్ మరియు విత్తిన తేదీని RBKలో నమోదు చేయండి. ఇది ఉచితం; మీ ఆదాయ సహాయం మరియు బీమా కొనసాగుతుంది.',
      ),
      step(
        'Verify bank DBT mapping',
        'బ్యాంక్ DBT మ్యాపింగ్ నిర్ధారించండి',
        'At your bank branch, confirm Aadhaar seeding and NPCI mapping. Without this the instalment returns unpaid.',
        'మీ బ్యాంక్ శాఖలో ఆధార్ సీడింగ్ మరియు NPCI మ్యాపింగ్ నిర్ధారించుకోండి. ఇది లేకపోతే విడత తిరిగి వస్తుంది.',
      ),
      step(
        'Track the three instalments',
        'మూడు విడతలను ట్రాక్ చేయండి',
        'Instalments normally arrive in April, August and December. If one is missing, call 155251 or ask the MAO to raise a DBT grievance.',
        'సాధారణంగా ఏప్రిల్, ఆగస్టు మరియు డిసెంబర్‌లో విడతలు వస్తాయి. రాకపోతే 155251 కు కాల్ చేయండి లేదా MAO ద్వారా DBT ఫిర్యాదు నమోదు చేయించండి.',
      ),
    ],
    onlineSteps: [
      step(
        'Open the official portal',
        'అధికారిక పోర్టల్ తెరవండి',
        'Visit ysrrythubharosa.ap.gov.in or pmkisan.gov.in from your phone.',
        'మీ ఫోన్ నుండి ysrrythubharosa.ap.gov.in లేదా pmkisan.gov.in తెరవండి.',
      ),
      step(
        'Check beneficiary status',
        'లబ్ధిదారు స్థితి చూడండి',
        'Use "Know Your Status" with your Aadhaar or registered mobile number. Never share an OTP with anyone.',
        'ఆధార్ లేదా నమోదైన మొబైల్ నంబర్‌తో "Know Your Status" ఉపయోగించండి. OTP ఎవరికీ చెప్పవద్దు.',
      ),
      step(
        'Raise an online grievance',
        'ఆన్‌లైన్ ఫిర్యాదు నమోదు చేయండి',
        'If the status shows rejected or payment failed, submit the grievance form and note the reference number.',
        'స్థితి తిరస్కరించబడింది లేదా చెల్లింపు విఫలమైంది అని చూపితే, ఫిర్యాదు ఫారం సమర్పించి రిఫరెన్స్ నంబర్ నమోదు చేసుకోండి.',
      ),
    ],
    contacts: [VAA_CONTACT, MAO_CONTACT, BANK_CONTACT],
    helplines: [AP_RYTHU_HELPLINE, ANGRAU_HELPLINE],
    followUps: [
      {
        en: 'What if my landowner refuses to sign for a CCRC card?',
        te: 'CCRC కార్డు కోసం భూ యజమాని సంతకం చేయడానికి నిరాకరిస్తే ఏమి చేయాలి?',
      },
      {
        en: 'When will the next Annadata instalment be credited?',
        te: 'తదుపరి అన్నదాత విడత ఎప్పుడు జమ అవుతుంది?',
      },
      {
        en: 'How do I check my PM-KISAN beneficiary status?',
        te: 'నా PM-KISAN లబ్ధిదారు స్థితిని ఎలా తనిఖీ చేయాలి?',
      },
      {
        en: 'Is Annadata Sukhibhava available to tenant farmers?',
        te: 'కౌలు రైతులకు అన్నదాత సుఖీభవ అందుబాటులో ఉందా?',
      },
    ],
  },
  {
    id: 'pm-kisan',
    nameEn: 'PM-KISAN Samman Nidhi',
    nameTe: 'పీఎం-కిసాన్ సమ్మాన్ నిధి',
    shortNameEn: 'PM-KISAN',
    shortNameTe: 'పీఎం-కిసాన్',
    category: 'income',
    categoryLabelEn: CATEGORY_LABELS.income.en,
    categoryLabelTe: CATEGORY_LABELS.income.te,
    benefitEn: '₹6,000 per year in 3 instalments of ₹2,000',
    benefitTe: 'సంవత్సరానికి ₹6,000, ₹2,000 చొప్పున 3 విడతలు',
    descriptionEn:
      'Central income support paid directly to landholding farmer families. Three equal instalments of ₹2,000 are transferred every four months through DBT.',
    descriptionTe:
      'భూమి కలిగిన రైతు కుటుంబాలకు కేంద్ర ప్రభుత్వం నేరుగా అందించే ఆదాయ సహాయం. ప్రతి నాలుగు నెలలకు ₹2,000 చొప్పున మూడు విడతలు DBT ద్వారా జమ అవుతాయి.',
    documentGuides: [PATTA_DOC, AADHAAR_DOC, DBT_DOC, EPANTA_DOC],
    docs: docsOf([PATTA_DOC, AADHAAR_DOC, DBT_DOC, EPANTA_DOC]),
    portalUrl: 'https://pmkisan.gov.in/',
    portalLabelEn: 'Open PM-KISAN portal',
    portalLabelTe: 'పీఎం-కిసాన్ పోర్టల్ తెరవండి',
    source: 'pmkisan.gov.in · myscheme.gov.in',
    eligibilityNoteEn:
      'Central scheme for landholding farmer families with a Pattadar Passbook/1B ROR or ROFR land. Tenants are not covered by PM-KISAN.',
    eligibilityNoteTe:
      'పట్టాదారు పాస్‌బుక్/1B ROR లేదా ROFR భూమి ఉన్న రైతు కుటుంబాలకు కేంద్ర పథకం. కౌలు రైతులకు PM-KISAN వర్తించదు.',
    rulebookEn:
      'PM-KISAN gives ₹6,000 per year in three ₹2,000 instalments to landholding farmer families. The applicant must hold cultivable land in the revenue records (Pattadar/1B ROR or ROFR). Institutional landholders, income-tax payers, serving or retired government employees (except Group D/MTS), professionals paying income tax, and pensioners drawing ₹10,000 or more per month are excluded. Aadhaar must be linked to the bank account and NPCI-mapped for DBT. e-KYC on the PM-KISAN portal is mandatory. Tenant farmers and sharecroppers are not eligible under PM-KISAN; AP covers CCRC tenants through its state top-up.',
    rulebookTe:
      'PM-KISAN భూమి కలిగిన రైతు కుటుంబాలకు సంవత్సరానికి ₹6,000, ₹2,000 చొప్పున మూడు విడతలుగా ఇస్తుంది. రెవెన్యూ రికార్డుల్లో సాగు భూమి (పట్టాదారు/1B ROR లేదా ROFR) ఉండాలి. సంస్థాగత భూ యజమానులు, ఆదాయపు పన్ను చెల్లింపుదారులు, ప్రభుత్వ ఉద్యోగులు (Group D/MTS మినహా), ఆదాయపు పన్ను చెల్లించే వృత్తిపరులు మరియు నెలకు ₹10,000కు పైగా పెన్షన్ పొందేవారు అర్హులు కాదు. DBT కోసం ఆధార్ బ్యాంక్ ఖాతాతో లింక్, NPCI మ్యాపింగ్ ఉండాలి. PM-KISAN పోర్టల్‌లో e-KYC తప్పనిసరి. కౌలు మరియు భాగస్వామ్య రైతులకు PM-KISAN వర్తించదు; ఆంధ్రప్రదేశ్ CCRC కౌలు రైతులను రాష్ట్ర అదనపు సహాయంతో కవర్ చేస్తుంది.',
    offlineSteps: [
      step(
        'Ask the VAA to verify land records',
        'VAA తో భూ రికార్డులను ధృవీకరించండి',
        'The VAA cross-checks your 1B ROR/ROFR land record and confirms the survey number.',
        'VAA మీ 1B ROR/ROFR భూ రికార్డును పరిశీలించి సర్వే నంబర్ నిర్ధారిస్తారు.',
      ),
      step(
        'Complete e-KYC',
        'e-KYC పూర్తి చేయండి',
        'Visit the RBK or use the PM-KISAN portal with Aadhaar and mobile OTP. Biometric e-KYC is available at the RBK.',
        'ఆధార్ మరియు మొబైల్ OTPతో RBKకి వెళ్లండి లేదా PM-KISAN పోర్టల్ ఉపయోగించండి. RBKలో బయోమెట్రిక్ e-KYC అందుబాటులో ఉంది.',
      ),
      step(
        'Seed Aadhaar in the bank',
        'బ్యాంకులో ఆధార్ సీడింగ్ చేయించండి',
        'Ask the branch for Aadhaar seeding and NPCI mapping. Keep the acknowledgement slip.',
        'శాఖలో ఆధార్ సీడింగ్ మరియు NPCI మ్యాపింగ్ అడగండి. అక్నాలెడ్జ్‌మెంట్ స్లిప్ ఉంచుకోండి.',
      ),
      step(
        'Track instalments',
        'విడతలను ట్రాక్ చేయండి',
        'Instalments usually arrive in April, August and December. Check the beneficiary status online.',
        'సాధారణంగా ఏప్రిల్, ఆగస్టు, డిసెంబర్‌లో విడతలు వస్తాయి. ఆన్‌లైన్‌లో లబ్ధిదారు స్థితి చూడండి.',
      ),
    ],
    onlineSteps: [
      step(
        'Visit pmkisan.gov.in',
        'pmkisan.gov.in తెరవండి',
        'Open "Farmers Corner" and select "Know Your Status".',
        '"Farmers Corner" తెరిచి "Know Your Status" ఎంచుకోండి.',
      ),
      step(
        'Check e-KYC and land seeding',
        'e-KYC మరియు భూ సీడింగ్ తనిఖీ చేయండి',
        'The status page shows e-KYC, land seeding and bank mapping flags.',
        'స్థితి పేజీ e-KYC, భూ సీడింగ్ మరియు బ్యాంక్ మ్యాపింగ్ వివరాలు చూపిస్తుంది.',
      ),
      step(
        'Raise a grievance',
        'ఫిర్యాదు నమోదు చేయండి',
        'Use the grievance module if an instalment is stuck; save the registration number.',
        'విడత ఆగిపోతే ఫిర్యాదు మాడ్యూల్ ఉపయోగించండి; రిజిస్ట్రేషన్ నంబర్ భద్రపరచుకోండి.',
      ),
    ],
    contacts: [VAA_CONTACT, BANK_CONTACT, MAO_CONTACT],
    helplines: [
      helpline('PM-KISAN Helpline', 'PM-KISAN హెల్ప్‌లైన్', '155261'),
      AP_RYTHU_HELPLINE,
    ],
    followUps: [
      {
        en: 'Why is my PM-KISAN instalment pending?',
        te: 'నా PM-KISAN విడత ఎందుకు పెండింగ్‌లో ఉంది?',
      },
      {
        en: 'How do I complete Aadhaar–bank NPCI seeding?',
        te: 'ఆధార్–బ్యాంక్ NPCI సీడింగ్ ఎలా పూర్తి చేయాలి?',
      },
      {
        en: 'Can tenant farmers get PM-KISAN?',
        te: 'కౌలు రైతులకు PM-KISAN లభిస్తుందా?',
      },
      {
        en: 'What documents are needed for e-KYC?',
        te: 'e-KYC కోసం ఏ పత్రాలు అవసరం?',
      },
    ],
  },
  {
    id: 'apmip-micro-irrigation',
    nameEn: 'APMIP Micro Irrigation (Drip & Sprinkler) Subsidy',
    nameTe: 'APMIP సూక్ష్మ నీటిపారుదల (డ్రిప్ & స్ప్రింక్లర్) సబ్సిడీ',
    shortNameEn: 'APMIP Micro Irrigation',
    shortNameTe: 'APMIP సూక్ష్మ నీటిపారుదల',
    category: 'input',
    categoryLabelEn: CATEGORY_LABELS.input.en,
    categoryLabelTe: CATEGORY_LABELS.input.te,
    benefitEn: 'Up to 90–100% subsidy on drip & sprinkler systems',
    benefitTe: 'డ్రిప్ & స్ప్రింక్లర్ వ్యవస్థలపై 90–100% వరకు సబ్సిడీ',
    descriptionEn:
      'Andhra Pradesh Micro Irrigation Project subsidy for drip and sprinkler systems on chilli, turmeric, cotton, paddy and pulses. The department empanels suppliers and releases the subsidy directly against the installed system.',
    descriptionTe:
      'మిర్చి, పసుపు, పత్తి, వరి మరియు మినుము/పెసర పంటలపై డ్రిప్ మరియు స్ప్రింక్లర్ వ్యవస్థలకు ఆంధ్రప్రదేశ్ సూక్ష్మ నీటిపారుదల ప్రాజెక్ట్ సబ్సిడీ. శాఖ ఎంప్యానెల్డ్ సప్లైయర్లను ఎంపిక చేసి, వ్యవస్థ అమర్చిన తర్వాత సబ్సిడీని నేరుగా విడుదల చేస్తుంది.',
    documentGuides: [
      PATTA_DOC,
      CCRC_DOC,
      EPANTA_DOC,
      DBT_DOC,
      SOIL_DOC,
      {
        key: 'quotation',
        en: 'Empanelled supplier quotation / invoice',
        te: 'ఎంప్యానెల్డ్ సప్లైయర్ కోటేషన్ / ఇన్‌వాయిస్',
        whereEn: 'APMIP-listed drip supplier in your district',
        whereTe: 'మీ జిల్లాలోని APMIP జాబితా డ్రిప్ సప్లైయర్',
      },
      {
        key: 'land-sketch',
        en: 'Land sketch / survey number proof',
        te: 'భూ స్కెచ్ / సర్వే నంబర్ రుజువు',
        whereEn: 'Village Secretariat / MeeSeva',
        whereTe: 'గ్రామ సచివాలయం / మీసేవ',
      },
    ],
    docs: docsOf([
      PATTA_DOC,
      CCRC_DOC,
      EPANTA_DOC,
      DBT_DOC,
      SOIL_DOC,
      {
        key: 'quotation',
        en: 'Empanelled supplier quotation / invoice',
        te: 'ఎంప్యానెల్డ్ సప్లైయర్ కోటేషన్ / ఇన్‌వాయిస్',
        whereEn: 'APMIP-listed drip supplier in your district',
        whereTe: 'మీ జిల్లాలోని APMIP జాబితా డ్రిప్ సప్లైయర్',
      },
    ]),
    portalUrl: 'https://apmip.ap.gov.in/',
    portalLabelEn: 'Open APMIP portal',
    portalLabelTe: 'APMIP పోర్టల్ తెరవండి',
    source: 'apmip.ap.gov.in · apagrisnet.gov.in',
    eligibilityNoteEn:
      'AP farmers with a legal water source. Subsidy is 90% for small & marginal, 80% for semi-medium and 70% for large holdings; SC/ST small & marginal farmers get the 90–100% priority slab.',
    eligibilityNoteTe:
      'చట్టబద్ధమైన నీటి ఆధారం ఉన్న ఆంధ్రప్రదేశ్ రైతులకు. చిన్న & సన్నకారు రైతులకు 90%, అర్ధ-మధ్యస్థులకు 80%, పెద్ద రైతులకు 70% సబ్సిడీ; SC/ST చిన్న & సన్నకారు రైతులకు 90–100% ప్రాధాన్యత స్లాబ్.',
    rulebookEn:
      'APMIP provides capital subsidy for micro-irrigation. Small and marginal farmers (up to 5 acres) receive 90% subsidy; semi-medium (5–10 acres) 80%; large farmers (above 10 acres) 70%. SC/ST small and marginal farmers are placed in the 90–100% priority slab. The farmer must have a legal, functional water source (borewell, canal or farm pond), a Pattadar Passbook/1B ROR or a CCRC card for tenants, an e-Panta booking, and a quotation from an APMIP-empanelled supplier. The department inspects the site, approves the design, and releases subsidy after installation. Rainfed land without a water source is not sanctioned until a source is created. Tenant farmers without CCRC need the landowner NOC and a registered lease.',
    rulebookTe:
      'APMIP సూక్ష్మ నీటిపారుదలకు మూలధన సబ్సిడీ ఇస్తుంది. చిన్న & సన్నకారు రైతులకు (5 ఎకరాల వరకు) 90%, అర్ధ-మధ్యస్థులకు (5–10 ఎకరాలు) 80%, పెద్ద రైతులకు (10 ఎకరాలకు పైగా) 70% సబ్సిడీ. SC/ST చిన్న & సన్నకారు రైతులకు 90–100% ప్రాధాన్యత స్లాబ్. రైతుకు చట్టబద్ధమైన, పనిచేసే నీటి ఆధారం (బోరు బావి, కాలువ లేదా ఫారం పాండ్), పట్టాదారు పాస్‌బుక్/1B ROR లేదా కౌలు రైతులకు CCRC కార్డు, ఈ-పంట నమోదు మరియు APMIP ఎంప్యానెల్డ్ సప్లైయర్ కోటేషన్ ఉండాలి. శాఖ స్థలాన్ని పరిశీలించి, డిజైన్ ఆమోదించి, వ్యవస్థ అమర్చిన తర్వాత సబ్సిడీ విడుదల చేస్తుంది. నీటి ఆధారం లేని వర్షాధార భూమికి ఆధారం ఏర్పడే వరకు ఆమోదం ఉండదు. CCRC లేని కౌలు రైతులకు భూ యజమాని NOC మరియు నమోదైన లీజు అవసరం.',
    offlineSteps: [
      step(
        'Get a soil and water test',
        'నేల మరియు నీటి పరీక్ష చేయించండి',
        'Take a sample to the RBK soil lab. Bring the report and your borewell/canal details to the APMIP office.',
        'RBK నేల ల్యాబ్‌కు నమూనా ఇవ్వండి. నివేదిక మరియు బోరు/కాలువ వివరాలతో APMIP కార్యాలయానికి వెళ్లండి.',
      ),
      step(
        'Choose an empanelled supplier',
        'ఎంప్యానెల్డ్ సప్లైయర్ ఎంచుకోండి',
        'Ask the APMIP/MAO office for the district supplier list. Get a written quotation for your exact acreage and crop.',
        'APMIP/MAO కార్యాలయం నుండి జిల్లా సప్లైయర్ జాబితా తీసుకోండి. మీ ఎకరాలు మరియు పంటకు లిఖిత కోటేషన్ తీసుకోండి.',
      ),
      step(
        'Submit the APMIP application',
        'APMIP దరఖాస్తు సమర్పించండి',
        'Submit land records, CCRC/NOC, e-Panta receipt, soil report and quotation at the APMIP/MAO office. Get an acknowledgement.',
        'భూ రికార్డులు, CCRC/NOC, ఈ-పంట రసీదు, నేల నివేదిక మరియు కోటేషన్‌ను APMIP/MAO కార్యాలయంలో సమర్పించండి. అక్నాలెడ్జ్‌మెంట్ తీసుకోండి.',
      ),
      step(
        'Install after approval',
        'ఆమోదం తర్వాత అమర్చండి',
        'Wait for the site inspection and sanction letter. The supplier installs the system and the subsidy is released to the supplier/your account.',
        'స్థల పరిశీలన మరియు మంజూరు ఉత్తరం కోసం వేచి ఉండండి. సప్లైయర్ వ్యవస్థను అమర్చిన తర్వాత సబ్సిడీ సప్లైయర్/మీ ఖాతాకు విడుదల అవుతుంది.',
      ),
    ],
    onlineSteps: [
      step(
        'Open apmip.ap.gov.in',
        'apmip.ap.gov.in తెరవండి',
        'Check the district supplier list and the micro-irrigation subsidy rates.',
        'జిల్లా సప్లైయర్ జాబితా మరియు సూక్ష్మ నీటిపారుదల సబ్సిడీ రేట్లు చూడండి.',
      ),
      step(
        'Track your application',
        'మీ దరఖాస్తును ట్రాక్ చేయండి',
        'Use the application number from the APMIP/MAO office to check inspection and sanction status.',
        'APMIP/MAO కార్యాలయం ఇచ్చిన దరఖాస్తు నంబర్‌తో పరిశీలన మరియు మంజూరు స్థితి చూడండి.',
      ),
      step(
        'Keep the installation proof',
        'అమరిక రుజువు ఉంచుకోండి',
        'Photograph the installed system and keep the supplier invoice for the subsidy release.',
        'అమర్చిన వ్యవస్థను ఫోటో తీయండి మరియు సబ్సిడీ విడుదల కోసం సప్లైయర్ ఇన్‌వాయిస్ ఉంచుకోండి.',
      ),
    ],
    contacts: [
      contact(
        'APMIP District Officer',
        'APMIP జిల్లా అధికారి',
        'District APMIP office — design approval and subsidy sanction',
        'జిల్లా APMIP కార్యాలయం — డిజైన్ ఆమోదం మరియు సబ్సిడీ మంజూరు',
      ),
      VAA_CONTACT,
      MAO_CONTACT,
    ],
    helplines: [AP_RYTHU_HELPLINE, ANGRAU_HELPLINE],
    followUps: [
      {
        en: 'How much drip subsidy will I get for 4.5 acres of Chilli?',
        te: '4.5 ఎకరాల మిర్చికి ఎంత డ్రిప్ సబ్సిడీ లభిస్తుంది?',
      },
      {
        en: 'Which crops qualify for APMIP drip subsidy?',
        te: 'APMIP డ్రిప్ సబ్సిడీకి ఏ పంటలు అర్హత?',
      },
      {
        en: 'Can a tenant farmer get drip subsidy without CCRC?',
        te: 'CCRC లేని కౌలు రైతు డ్రిప్ సబ్సిడీ పొందవచ్చా?',
      },
      {
        en: 'What is the farmer share for SC/ST small farmers?',
        te: 'SC/ST చిన్న రైతులకు రైతు వాటా ఎంత?',
      },
    ],
  },
  {
    id: 'pmfby-ap-crop-insurance',
    nameEn: 'PMFBY + AP State Crop Insurance',
    nameTe: 'PMFBY + ఆంధ్రప్రదేశ్ రాష్ట్ర పంట బీమా',
    shortNameEn: 'PMFBY Crop Insurance',
    shortNameTe: 'PMFBY పంట బీమా',
    category: 'insurance',
    categoryLabelEn: CATEGORY_LABELS.insurance.en,
    categoryLabelTe: CATEGORY_LABELS.insurance.te,
    benefitEn: 'Low-premium crop cover for cyclone, flood, drought & pest loss',
    benefitTe: 'తుఫాను, వరద, కరువు & పురుగు నష్టాలకు తక్కువ ప్రీమియం పంట కవరేజ్',
    descriptionEn:
      'Pradhan Mantri Fasal Bima Yojana with AP state support. Farmers pay only the notified share of premium (about 2% for paddy and pulses, 5% for chilli, cotton and turmeric); the union and state governments bear the rest of the actuarial premium.',
    descriptionTe:
      'ఆంధ్రప్రదేశ్ రాష్ట్ర మద్దతుతో ప్రధాన మంత్రి ఫసల్ బీమా యోజన. రైతు నోటిఫైడ్ ప్రీమియం వాటా మాత్రమే చెల్లిస్తారు (వరి, మినుము/పెసరకు సుమారు 2%, మిర్చి, పత్తి, పసుపుకు 5%); మిగిలిన యాక్చువరీల్ ప్రీమియంను కేంద్ర, రాష్ట్ర ప్రభుత్వాలు భరిస్తాయి.',
    documentGuides: [
      PATTA_DOC,
      CCRC_DOC,
      EPANTA_DOC,
      DBT_DOC,
      {
        key: 'sowing',
        en: 'Sowing certificate / village surveyor confirmation',
        te: 'విత్తిన ధృవీకరణ పత్రం / గ్రామ సర్వేయర్ నిర్ధారణ',
        whereEn: 'VAA / Village Secretariat after field verification',
        whereTe: 'క్షేత్ర పరిశీలన తర్వాత VAA / గ్రామ సచివాలయం',
      },
    ],
    docs: docsOf([
      PATTA_DOC,
      CCRC_DOC,
      EPANTA_DOC,
      DBT_DOC,
      {
        key: 'sowing',
        en: 'Sowing certificate / village surveyor confirmation',
        te: 'విత్తిన ధృవీకరణ పత్రం / గ్రామ సర్వేయర్ నిర్ధారణ',
        whereEn: 'VAA / Village Secretariat after field verification',
        whereTe: 'క్షేత్ర పరిశీలన తర్వాత VAA / గ్రామ సచివాలయం',
      },
    ]),
    portalUrl: 'https://pmfby.gov.in/',
    portalLabelEn: 'Open PMFBY portal',
    portalLabelTe: 'PMFBY పోర్టల్ తెరవండి',
    source: 'pmfby.gov.in · apagrisnet.gov.in',
    eligibilityNoteEn:
      'All notified Kharif/Rabi crops. e-Panta sowing registration before the season cut-off is mandatory. Tenant farmers need a CCRC card.',
    eligibilityNoteTe:
      'నోటిఫైడ్ ఖరీఫ్/రబీ పంటలన్నీ. సీజన్ చివరి తేదీ లోపు ఈ-పంట విత్తన నమోదు తప్పనిసరి. కౌలు రైతులకు CCRC కార్డు అవసరం.',
    rulebookEn:
      'PMFBY covers notified crops against non-preventable natural risks: drought, flood, cyclone, hailstorm, landslide, lightning, pest attack and post-harvest losses. The farmer premium is capped at 2% of sum insured for Kharif food and oilseed crops, 1.5% for Rabi food and oilseed crops, and 5% for commercial/horticultural crops; the remaining actuarial premium is shared by the Centre and State. Enrolment must be completed before the notified cut-off date, normally through the bank, CSC, RBK or the PMFBY portal. e-Panta/e-Crop sowing registration and field verification by the VAA are mandatory. Tenant farmers must produce a CCRC card. Claims are paid directly to the Aadhaar-linked bank account after crop-cutting experiments and loss assessment.',
    rulebookTe:
      'PMFBY నోటిఫైడ్ పంటలకు కరువు, వరద, తుఫాను, వడగళ్లు, కొండచరియలు, పిడుగులు, పురుగు దాడి మరియు కోత అనంతర నష్టాలకు కవరేజ్ ఇస్తుంది. ఖరీఫ్ ఆహార, నూనెగింజ పంటలకు బీమా మొత్తంలో రైతు ప్రీమియం 2%, రబీ ఆహార, నూనెగింజ పంటలకు 1.5%, వాణిజ్య/ఉద్యాన పంటలకు 5% మాత్రమే; మిగిలిన యాక్చువరీల్ ప్రీమియంను కేంద్ర, రాష్ట్ర ప్రభుత్వాలు పంచుకుంటాయి. నోటిఫైడ్ చివరి తేదీ లోపు బ్యాంక్, CSC, RBK లేదా PMFBY పోర్టల్ ద్వారా నమోదు పూర్తి చేయాలి. ఈ-పంట/ఈ-క్రాప్ విత్తన నమోదు మరియు VAA క్షేత్ర ధృవీకరణ తప్పనిసరి. కౌలు రైతులు CCRC కార్డు చూపాలి. పంట కోత ప్రయోగాలు మరియు నష్ట అంచనా తర్వాత క్లెయిమ్‌లు ఆధార్ లింక్ బ్యాంక్ ఖాతాకు నేరుగా చెల్లిస్తారు.',
    offlineSteps: [
      step(
        'Book e-Panta immediately after sowing',
        'విత్తిన వెంటనే ఈ-పంట నమోదు చేయండి',
        'Give the survey number, crop, variety and sowing date to the VAA at the RBK. This is free and creates the insurance base.',
        'సర్వే నంబర్, పంట, రకం మరియు విత్తిన తేదీని RBKలో VAAకి ఇవ్వండి. ఇది ఉచితం; బీమాకు ఆధారం ఏర్పడుతుంది.',
      ),
      step(
        'Enrol before the cut-off date',
        'చివరి తేదీ లోపు నమోదు చేయండి',
        'Enrol at the bank, RBK or CSC and pay only the notified farmer premium. Keep the receipt and policy number.',
        'బ్యాంక్, RBK లేదా CSCలో నమోదు చేసి నోటిఫైడ్ రైతు ప్రీమియం మాత్రమే చెల్లించండి. రసీదు మరియు పాలసీ నంబర్ ఉంచుకోండి.',
      ),
      step(
        'Report crop loss within 72 hours',
        'పంట నష్టాన్ని 72 గంటల్లో నివేదించండి',
        'Inform the VAA, bank or PMFBY helpline immediately after flood, cyclone or pest damage. Photograph the field with a date stamp.',
        'వరద, తుఫాను లేదా పురుగు నష్టం తర్వాత వెంటనే VAA, బ్యాంక్ లేదా PMFBY హెల్ప్‌లైన్‌కు తెలియజేయండి. తేదీతో పాటు పొలాన్ని ఫోటో తీయండి.',
      ),
      step(
        'Support the loss assessment',
        'నష్ట అంచనాకు సహకరించండి',
        'Be present for the crop-cutting experiment and join survey. Sign the assessment form only after checking the area and crop.',
        'పంట కోత ప్రయోగం మరియు జాయింట్ సర్వేకు హాజరవ్వండి. విస్తీర్ణం మరియు పంట తనిఖీ చేసిన తర్వాతే అంచనా ఫారంపై సంతకం చేయండి.',
      ),
    ],
    onlineSteps: [
      step(
        'Open pmfby.gov.in',
        'pmfby.gov.in తెరవండి',
        'Use "Farmer Corner" to check enrolment and claim status.',
        '"Farmer Corner" ద్వారా నమోదు మరియు క్లెయిమ్ స్థితి చూడండి.',
      ),
      step(
        'Report a claim online',
        'ఆన్‌లైన్‌లో క్లెయిమ్ నివేదించండి',
        'Use the claim intimation module within 72 hours of the loss and upload field photos.',
        'నష్టం జరిగిన 72 గంటల్లో క్లెయిమ్ ఇంటిమేషన్ మాడ్యూల్ ఉపయోగించి పొలం ఫోటోలు అప్‌లోడ్ చేయండి.',
      ),
      step(
        'Track the claim',
        'క్లెయిమ్ ట్రాక్ చేయండి',
        'Keep the claim number and follow up with the bank and MAO until the amount is credited.',
        'క్లెయిమ్ నంబర్ ఉంచుకుని, మొత్తం జమ అయ్యే వరకు బ్యాంక్ మరియు MAOను అనుసరించండి.',
      ),
    ],
    contacts: [VAA_CONTACT, MAO_CONTACT, BANK_CONTACT],
    helplines: [
      helpline('PMFBY National Helpline', 'PMFBY జాతీయ హెల్ప్‌లైన్', '1800-180-1551'),
      AP_RYTHU_HELPLINE,
    ],
    followUps: [
      {
        en: 'When is the last date to enrol for Kharif crop insurance?',
        te: 'ఖరీఫ్ పంట బీమా నమోదుకు చివరి తేదీ ఎప్పుడు?',
      },
      {
        en: 'How do I claim crop insurance after cyclone damage?',
        te: 'తుఫాను నష్టం తర్వాత పంట బీమా క్లెయిమ్ ఎలా పొందాలి?',
      },
      {
        en: 'Is crop insurance free in Andhra Pradesh?',
        te: 'ఆంధ్రప్రదేశ్‌లో పంట బీమా ఉచితమా?',
      },
      {
        en: 'What if my e-Panta booking is not done?',
        te: 'నా ఈ-పంట నమోదు చేయకపోతే ఏమి జరుగుతుంది?',
      },
    ],
  },
  {
    id: 'ysr-sunna-vaddi-kcc',
    nameEn: 'YSR Sunna Vaddi Panta Runalu / Kisan Credit Card (KCC)',
    nameTe: 'వైఎస్ఆర్ సున్నా వడ్డీ పంట రుణాలు / కిసాన్ క్రెడిట్ కార్డ్ (KCC)',
    shortNameEn: 'YSR Sunna Vaddi / KCC',
    shortNameTe: 'వైఎస్ఆర్ సున్నా వడ్డీ / KCC',
    category: 'credit',
    categoryLabelEn: CATEGORY_LABELS.credit.en,
    categoryLabelTe: CATEGORY_LABELS.credit.te,
    benefitEn: '0% interest crop loan up to ₹1,00,000 with timely repayment',
    benefitTe: 'సమయానికి తిరిగి చెల్లిస్తే ₹1,00,000 వరకు 0% వడ్డీ పంట రుణం',
    descriptionEn:
      'Interest-free short-term crop loan through the Kisan Credit Card for e-Panta registered farmers. The state reimburses the interest on loans up to ₹1,00,000 when principal and interest are repaid on time.',
    descriptionTe:
      'ఈ-పంట నమోదు చేసుకున్న రైతులకు కిసాన్ క్రెడిట్ కార్డ్ ద్వారా వడ్డీ లేని స్వల్పకాలిక పంట రుణం. ₹1,00,000 వరకు రుణానికి అసలు మరియు వడ్డీ సమయానికి చెల్లిస్తే రాష్ట్ర ప్రభుత్వం వడ్డీని తిరిగి చెల్లిస్తుంది.',
    documentGuides: [
      PATTA_DOC,
      CCRC_DOC,
      EPANTA_DOC,
      DBT_DOC,
      {
        key: 'kcc-form',
        en: 'KCC application form / existing KCC passbook',
        te: 'KCC దరఖాస్తు ఫారం / ఉన్న KCC పాస్‌బుక్',
        whereEn: 'Your bank branch',
        whereTe: 'మీ బ్యాంక్ శాఖ',
      },
      {
        key: 'no-default',
        en: 'No-default / good repayment certificate',
        te: 'డిఫాల్ట్ లేదు / మంచి తిరిగి చెల్లింపు ధృవీకరణ',
        whereEn: 'Your bank branch',
        whereTe: 'మీ బ్యాంక్ శాఖ',
      },
    ],
    docs: docsOf([
      PATTA_DOC,
      CCRC_DOC,
      EPANTA_DOC,
      DBT_DOC,
      {
        key: 'kcc-form',
        en: 'KCC application form / existing KCC passbook',
        te: 'KCC దరఖాస్తు ఫారం / ఉన్న KCC పాస్‌బుక్',
        whereEn: 'Your bank branch',
        whereTe: 'మీ బ్యాంక్ శాఖ',
      },
    ]),
    portalUrl: 'https://karshak.ap.gov.in/',
    portalLabelEn: 'Open Karshak AP portal',
    portalLabelTe: 'కర్షక్ AP పోర్టల్ తెరవండి',
    source: 'karshak.ap.gov.in · apagrisnet.gov.in',
    eligibilityNoteEn:
      'AP Pattadar, ROFR and CCRC tenant farmers with e-Panta registration and a clean repayment record. Loans above ₹1,00,000 carry normal bank interest.',
    eligibilityNoteTe:
      'ఈ-పంట నమోదు మరియు మంచి తిరిగి చెల్లింపు రికార్డ్ ఉన్న ఆంధ్రప్రదేశ్ పట్టాదారు, ROFR మరియు CCRC కౌలు రైతులకు. ₹1,00,000కు పైగా రుణాలకు సాధారణ బ్యాంక్ వడ్డీ వర్తిస్తుంది.',
    rulebookEn:
      'YSR Sunna Vaddi Panta Runalu reimburses interest on short-term crop loans up to ₹1,00,000 taken through a Kisan Credit Card. The farmer must repay the principal and interest on or before the due date; the state then credits the interest back. The KCC limit is fixed by the bank using the district scale of finance per acre for the notified crop. e-Panta/e-Crop registration is mandatory to prove cultivation. Pattadar, ROFR and CCRC-registered tenant farmers are eligible. A tenant without CCRC may apply through a Joint Liability Group (JLG) or with the landowner NOC and lease deed. Borrowers with a default or overdue are not eligible until the account is regularised. This is an Andhra Pradesh scheme; Telangana follows separate interest-subvention rules.',
    rulebookTe:
      'వైఎస్ఆర్ సున్నా వడ్డీ పంట రుణాలు కిసాన్ క్రెడిట్ కార్డ్ ద్వారా తీసుకున్న ₹1,00,000 వరకు స్వల్పకాలిక పంట రుణాలపై వడ్డీని తిరిగి చెల్లిస్తుంది. రైతు అసలు మరియు వడ్డీని గడువు తేదీ లోపు తిరిగి చెల్లించాలి; తర్వాత రాష్ట్రం వడ్డీని తిరిగి జమ చేస్తుంది. KCC పరిమితిని బ్యాంక్, నోటిఫైడ్ పంటకు జిల్లా స్కేల్ ఆఫ్ ఫైనాన్స్ ఆధారంగా నిర్ణయిస్తుంది. సాగు నిరూపణకు ఈ-పంట/ఈ-క్రాప్ నమోదు తప్పనిసరి. పట్టాదారు, ROFR మరియు CCRC నమోదైన కౌలు రైతులు అర్హులు. CCRC లేని కౌలు రైతు జాయింట్ లయబిలిటీ గ్రూప్ (JLG) లేదా భూ యజమాని NOC, లీజు ఒప్పందంతో దరఖాస్తు చేయవచ్చు. డిఫాల్ట్ లేదా బకాయి ఉన్న రుణగ్రహీతలు ఖాతా క్రమబద్ధీకరణ వరకు అర్హులు కాదు. ఇది ఆంధ్రప్రదేశ్ పథకం; తెలంగాణలో వేరే వడ్డీ సబ్సిడీ నిబంధనలు ఉన్నాయి.',
    offlineSteps: [
      step(
        'Complete e-Panta first',
        'మొదట ఈ-పంట పూర్తి చేయండి',
        'The bank cannot sanction a crop loan without the e-Panta sowing receipt. Get it free at the RBK.',
        'ఈ-పంట విత్తన రసీదు లేకుండా బ్యాంక్ పంట రుణం మంజూరు చేయదు. RBKలో ఉచితంగా తీసుకోండి.',
      ),
      step(
        'Apply at your bank branch',
        'మీ బ్యాంక్ శాఖలో దరఖాస్తు చేయండి',
        'Submit the KCC form with land records/CCRC, Aadhaar and e-Panta receipt. Ask for the scale-of-finance limit for your crop and acres.',
        'భూ రికార్డులు/CCRC, ఆధార్ మరియు ఈ-పంట రసీదుతో KCC ఫారం సమర్పించండి. మీ పంట, ఎకరాలకు స్కేల్ ఆఫ్ ఫైనాన్స్ పరిమితి అడగండి.',
      ),
      step(
        'Get the KCC sanctioned',
        'KCC మంజూరు పొందండి',
        'The branch verifies the land, crop and repayment record, then issues the KCC limit.',
        'శాఖ భూమి, పంట మరియు తిరిగి చెల్లింపు రికార్డును ధృవీకరించి KCC పరిమితిని మంజూరు చేస్తుంది.',
      ),
      step(
        'Repay before the due date',
        'గడువు తేదీ లోపు తిరిగి చెల్లించండి',
        'Repay principal and interest on time to receive the 0% interest benefit. Keep the repayment receipt.',
        '0% వడ్డీ ప్రయోజనం పొందాలంటే అసలు మరియు వడ్డీని సమయానికి తిరిగి చెల్లించండి. చెల్లింపు రసీదు ఉంచుకోండి.',
      ),
    ],
    onlineSteps: [
      step(
        'Open karshak.ap.gov.in',
        'karshak.ap.gov.in తెరవండి',
        'Check the crop loan and interest reimbursement information for your district.',
        'మీ జిల్లాకు సంబంధించిన పంట రుణం మరియు వడ్డీ తిరిగి చెల్లింపు సమాచారం చూడండి.',
      ),
      step(
        'Check e-Panta status',
        'ఈ-పంట స్థితి చూడండి',
        'Confirm the crop booking is approved before the bank files the KCC application.',
        'బ్యాంక్ KCC దరఖాస్తు నమోదు చేయడానికి ముందు పంట బుకింగ్ ఆమోదం పొందిందో నిర్ధారించండి.',
      ),
      step(
        'Track interest reimbursement',
        'వడ్డీ తిరిగి చెల్లింపు ట్రాక్ చేయండి',
        'After repayment, check the Karshak portal or bank statement for the interest credit. Escalate to the MAO if delayed.',
        'తిరిగి చెల్లించిన తర్వాత కర్షక్ పోర్టల్ లేదా బ్యాంక్ స్టేట్‌మెంట్‌లో వడ్డీ జమను చూడండి. ఆలస్యమైతే MAOకు ఫిర్యాదు చేయండి.',
      ),
    ],
    contacts: [BANK_CONTACT, VAA_CONTACT, MAO_CONTACT],
    helplines: [AP_RYTHU_HELPLINE, ANGRAU_HELPLINE],
    followUps: [
      {
        en: 'How much 0% interest crop loan can I get for 4.5 acres?',
        te: '4.5 ఎకరాలకు ఎంత 0% వడ్డీ పంట రుణం లభిస్తుంది?',
      },
      {
        en: 'What happens if I repay the KCC loan late?',
        te: 'KCC రుణాన్ని ఆలస్యంగా తిరిగి చెల్లిస్తే ఏమి జరుగుతుంది?',
      },
      {
        en: 'Can a tenant without CCRC get a crop loan?',
        te: 'CCRC లేని కౌలు రైతు పంట రుణం పొందవచ్చా?',
      },
      {
        en: 'How do I link my KCC to e-Panta?',
        te: 'నా KCCను ఈ-పంటతో ఎలా లింక్ చేయాలి?',
      },
    ],
  },
  {
    id: 'pm-kusum-solar-mechanization',
    nameEn: 'PM-KUSUM Solar Pump & Farm Mechanization Subsidy',
    nameTe: 'PM-KUSUM సోలార్ పంపు & వ్యవసాయ యంత్రాల సబ్సిడీ',
    shortNameEn: 'PM-KUSUM Solar & Machinery',
    shortNameTe: 'PM-KUSUM సోలార్ & యంత్రాలు',
    category: 'solar',
    categoryLabelEn: CATEGORY_LABELS.solar.en,
    categoryLabelTe: CATEGORY_LABELS.solar.te,
    benefitEn: 'Up to 90–95% solar pump subsidy + 40–50% farm machinery subsidy',
    benefitTe: 'సోలార్ పంపుపై 90–95% వరకు + వ్యవసాయ యంత్రాలపై 40–50% సబ్సిడీ',
    descriptionEn:
      'PM-KUSUM Component-B supports standalone solar pumps for irrigation. The Centre pays 60%, the state 30% and the farmer 10% (SC/ST small & marginal farmers pay only 5%). SMAM farm-mechanization subsidy adds 40–50% on tractors, power tillers and implements.',
    descriptionTe:
      'PM-KUSUM కాంపోనెంట్-B నీటిపారుదల కోసం స్వతంత్ర సోలార్ పంపులకు మద్దతు ఇస్తుంది. కేంద్రం 60%, రాష్ట్రం 30%, రైతు 10% (SC/ST చిన్న & సన్నకారు రైతులు 5% మాత్రమే). SMAM వ్యవసాయ యంత్రాంగ సబ్సిడీ ట్రాక్టర్లు, పవర్ టిల్లర్లు మరియు పరికరాలపై 40–50% అదనంగా ఇస్తుంది.',
    documentGuides: [
      PATTA_DOC,
      CCRC_DOC,
      EPANTA_DOC,
      DBT_DOC,
      {
        key: 'electricity',
        en: 'Electricity connection bill / DISCOM feasibility',
        te: 'విద్యుత్ కనెక్షన్ బిల్లు / DISCOM సాధ్యత',
        whereEn: 'APSPDCL / TGSPDCL local office',
        whereTe: 'APSPDCL / TGSPDCL స్థానిక కార్యాలయం',
      },
      {
        key: 'pump-quote',
        en: 'Empanelled solar pump supplier quotation',
        te: 'ఎంప్యానెల్డ్ సోలార్ పంపు సప్లైయర్ కోటేషన్',
        whereEn: 'MNRE/state-empanelled solar vendor',
        whereTe: 'MNRE/రాష్ట్ర ఎంప్యానెల్డ్ సోలార్ వెండర్',
      },
      {
        key: 'land-sketch',
        en: 'Land sketch / survey number proof',
        te: 'భూ స్కెచ్ / సర్వే నంబర్ రుజువు',
        whereEn: 'Village Secretariat / MeeSeva',
        whereTe: 'గ్రామ సచివాలయం / మీసేవ',
      },
    ],
    docs: docsOf([
      PATTA_DOC,
      CCRC_DOC,
      EPANTA_DOC,
      DBT_DOC,
      {
        key: 'electricity',
        en: 'Electricity connection bill / DISCOM feasibility',
        te: 'విద్యుత్ కనెక్షన్ బిల్లు / DISCOM సాధ్యత',
        whereEn: 'APSPDCL / TGSPDCL local office',
        whereTe: 'APSPDCL / TGSPDCL స్థానిక కార్యాలయం',
      },
      {
        key: 'pump-quote',
        en: 'Empanelled solar pump supplier quotation',
        te: 'ఎంప్యానెల్డ్ సోలార్ పంపు సప్లైయర్ కోటేషన్',
        whereEn: 'MNRE/state-empanelled solar vendor',
        whereTe: 'MNRE/రాష్ట్ర ఎంప్యానెల్డ్ సోలార్ వెండర్',
      },
    ]),
    portalUrl: 'https://pmkusum.mnre.gov.in/',
    portalLabelEn: 'Open PM-KUSUM portal',
    portalLabelTe: 'PM-KUSUM పోర్టల్ తెరవండి',
    source: 'pmkusum.mnre.gov.in · apagrisnet.gov.in',
    eligibilityNoteEn:
      'Farmers with own or CCRC land and a borewell/open well. One solar pump per eligible farmer. Farm machinery subsidy follows SMAM landholding and category slabs.',
    eligibilityNoteTe:
      'స్వంత లేదా CCRC భూమి మరియు బోరు/బావి ఉన్న రైతులకు. అర్హుడైన రైతుకు ఒక సోలార్ పంపు. యంత్రాల సబ్సిడీ SMAM భూ విస్తీర్ణం, వర్గం స్లాబుల ప్రకారం.',
    rulebookEn:
      'PM-KUSUM Component-B provides standalone solar pumps to farmers without reliable grid supply. The benchmark cost is shared as 60% Central subsidy, 30% State subsidy and 10% farmer contribution; SC/ST small and marginal farmers contribute 5%. The farmer must own the land or hold a CCRC card, have a borewell/open well, and purchase through an empanelled vendor. One pump is allowed per eligible farmer/landholding. The state DISCOM verifies feasibility and the pump is installed after approval. Separately, SMAM (Sub-Mission on Agricultural Mechanization) gives 40% subsidy to general farmers and 50% to SC/ST, small, marginal and women farmers on tractors, power tillers and implements, subject to ceiling limits.',
    rulebookTe:
      'PM-KUSUM కాంపోనెంట్-B నమ్మకమైన గ్రిడ్ సరఫరా లేని రైతులకు స్వతంత్ర సోలార్ పంపులను ఇస్తుంది. బెంచ్‌మార్క్ వ్యయంలో 60% కేంద్ర సబ్సిడీ, 30% రాష్ట్ర సబ్సిడీ, 10% రైతు వాటా; SC/ST చిన్న & సన్నకారు రైతులు 5% మాత్రమే. రైతు భూమి స్వంతం లేదా CCRC కార్డు కలిగి ఉండాలి, బోరు/బావి ఉండాలి మరియు ఎంప్యానెల్డ్ వెండర్ ద్వారా కొనాలి. అర్హుడైన రైతు/భూమికి ఒక పంపు మాత్రమే. రాష్ట్ర DISCOM సాధ్యతను ధృవీకరించి, ఆమోదం తర్వాత పంపు అమరుస్తారు. విడిగా, SMAM (వ్యవసాయ యంత్రాంగ ఉప మిషన్) సాధారణ రైతులకు 40%, SC/ST, చిన్న, సన్నకారు మరియు మహిళా రైతులకు 50% సబ్సిడీని ట్రాక్టర్లు, పవర్ టిల్లర్లు, పరికరాలపై పరిమితుల లోపు ఇస్తుంది.',
    offlineSteps: [
      step(
        'Check borewell and DISCOM feasibility',
        'బోరు మరియు DISCOM సాధ్యత తనిఖీ చేయండి',
        'Visit the local DISCOM office with your electricity bill and survey number. Ask for a solar-pump feasibility certificate.',
        'విద్యుత్ బిల్లు మరియు సర్వే నంబర్‌తో స్థానిక DISCOM కార్యాలయానికి వెళ్లండి. సోలార్ పంపు సాధ్యత ధృవీకరణ పత్రం అడగండి.',
      ),
      step(
        'Apply through the state nodal agency',
        'రాష్ట్ర నోడల్ ఏజెన్సీ ద్వారా దరఖాస్తు చేయండి',
        'Submit the PM-KUSUM application with land records/CCRC, e-Panta receipt and DISCOM certificate at the AP/TG renewable energy nodal office or RBK.',
        'భూ రికార్డులు/CCRC, ఈ-పంట రసీదు మరియు DISCOM ధృవీకరణతో AP/TG పునరుత్పాదక ఇంధన నోడల్ కార్యాలయం లేదా RBKలో PM-KUSUM దరఖాస్తు సమర్పించండి.',
      ),
      step(
        'Pay only your share',
        'మీ వాటా మాత్రమే చెల్లించండి',
        'After sanction, pay 10% (5% for SC/ST small & marginal) to the empanelled vendor. Never pay the full pump cost in cash.',
        'మంజూరు తర్వాత ఎంప్యానెల్డ్ వెండర్‌కు 10% (SC/ST చిన్న & సన్నకారులకు 5%) మాత్రమే చెల్లించండి. పంపు పూర్తి వ్యయాన్ని నగదుగా ఎప్పుడూ చెల్లించవద్దు.',
      ),
      step(
        'Apply separately for machinery',
        'యంత్రాలకు విడిగా దరఖాస్తు చేయండి',
        'For a tractor, power tiller or implement, submit an SMAM application at the RBK/agriculture office with the dealer quotation.',
        'ట్రాక్టర్, పవర్ టిల్లర్ లేదా పరికరం కోసం డీలర్ కోటేషన్‌తో RBK/వ్యవసాయ కార్యాలయంలో SMAM దరఖాస్తు సమర్పించండి.',
      ),
    ],
    onlineSteps: [
      step(
        'Open pmkusum.mnre.gov.in',
        'pmkusum.mnre.gov.in తెరవండి',
        'Read the Component-B farmer guidelines and check the state vendor list.',
        'కాంపోనెంట్-B రైతు మార్గదర్శకాలు చదవండి మరియు రాష్ట్ర వెండర్ జాబితా చూడండి.',
      ),
      step(
        'Track the application',
        'దరఖాస్తు ట్రాక్ చేయండి',
        'Use the application number to follow DISCOM feasibility, sanction and installation.',
        'దరఖాస్తు నంబర్‌తో DISCOM సాధ్యత, మంజూరు మరియు అమరికను ట్రాక్ చేయండి.',
      ),
      step(
        'Keep installation proof',
        'అమరిక రుజువు ఉంచుకోండి',
        'Photograph the installed pump and keep the vendor invoice and subsidy sanction letter.',
        'అమర్చిన పంపును ఫోటో తీయండి మరియు వెండర్ ఇన్‌వాయిస్, సబ్సిడీ మంజూరు ఉత్తరం ఉంచుకోండి.',
      ),
    ],
    contacts: [
      contact(
        'Renewable Energy Nodal Officer',
        'పునరుత్పాదక ఇంధన నోడల్ అధికారి',
        'State nodal agency — PM-KUSUM sanction and vendor empanelment',
        'రాష్ట్ర నోడల్ ఏజెన్సీ — PM-KUSUM మంజూరు మరియు వెండర్ ఎంప్యానెల్మెంట్',
      ),
      contact(
        'DISCOM Junior Engineer',
        'DISCOM జూనియర్ ఇంజనీర్',
        'Local electricity office — feasibility and net-metering',
        'స్థానిక విద్యుత్ కార్యాలయం — సాధ్యత మరియు నెట్-మీటరింగ్',
      ),
      VAA_CONTACT,
    ],
    helplines: [
      helpline('PM-KUSUM Helpline', 'PM-KUSUM హెల్ప్‌లైన్', '1800-180-3333'),
      AP_RYTHU_HELPLINE,
    ],
    followUps: [
      {
        en: 'How much subsidy will I get for a 5 HP solar pump?',
        te: '5 HP సోలార్ పంపుకు ఎంత సబ్సిడీ లభిస్తుంది?',
      },
      {
        en: 'Can I get a solar pump on rainfed land?',
        te: 'వర్షాధార భూమిపై సోలార్ పంపు పొందవచ్చా?',
      },
      {
        en: 'What is the farm machinery subsidy for SC/ST farmers?',
        te: 'SC/ST రైతులకు వ్యవసాయ యంత్రాల సబ్సిడీ ఎంత?',
      },
      {
        en: 'How long does PM-KUSUM approval take?',
        te: 'PM-KUSUM ఆమోదానికి ఎంత సమయం పడుతుంది?',
      },
    ],
  },
];

/* ─────────────────────────── Evaluation engine ─────────────────────────── */

export const getSchemeById = (id: string): Scheme | undefined =>
  SCHEMES.find((scheme) => scheme.id === id);

interface EvaluationCore {
  status: EligibilityStatus;
  matchScore: number;
  calculatedBenefitEn: string;
  calculatedBenefitTe: string;
  verdictReasonEn: string;
  verdictReasonTe: string;
  nextActionEn: string;
  nextActionTe: string;
  financialImpact: number;
  financialBreakdown: FinancialRow[];
  priorityScore: number;
}

interface CoreInput extends Omit<EvaluationCore, 'priorityScore'> {
  urgency: number;
  priorityBoost: number;
}

const priorityOf = (
  status: EligibilityStatus,
  impact: number,
  urgency: number,
  boost: number,
): number => {
  if (status === 'NOT_ELIGIBLE') return 0;
  const statusBoost = status === 'ACTION_REQUIRED' ? 30 : 20;
  return Math.max(0, Math.round(impact / 1000 + urgency + boost + statusBoost));
};

const makeCore = (input: CoreInput): EvaluationCore => ({
  status: input.status,
  matchScore: input.matchScore,
  calculatedBenefitEn: input.calculatedBenefitEn,
  calculatedBenefitTe: input.calculatedBenefitTe,
  verdictReasonEn: input.verdictReasonEn,
  verdictReasonTe: input.verdictReasonTe,
  nextActionEn: input.nextActionEn,
  nextActionTe: input.nextActionTe,
  financialImpact: input.financialImpact,
  financialBreakdown: input.financialBreakdown,
  priorityScore: priorityOf(
    input.status,
    input.financialImpact,
    input.urgency,
    input.priorityBoost,
  ),
});

const needBoost = (need: PriorityNeed, profile: FarmerSchemeProfile): number =>
  profile.priorityNeed === 'ALL' || profile.priorityNeed === need ? 18 : 0;

const needPriority = (need: PriorityNeed, profile: FarmerSchemeProfile): number =>
  profile.priorityNeed === need ? 30 : profile.priorityNeed === 'ALL' ? 8 : 0;

const ownershipBoost = (profile: FarmerSchemeProfile): number => {
  if (profile.ownership === 'PATTADAR') return 8;
  if (profile.ownership === 'TENANT_CCRC') return 6;
  if (profile.ownership === 'ROFR_ASSIGNED') return 6;
  return 0;
};

const epantaBoost = (profile: FarmerSchemeProfile): number =>
  profile.ePanta === 'REGISTERED' ? 8 : 0;

const smallBoost = (profile: FarmerSchemeProfile): number =>
  isSmallOrMarginal(profile.acres) ? 6 : 0;

const APMIP_COST_PER_ACRE = 45000;

const apmipSubsidyPercent = (profile: FarmerSchemeProfile): number => {
  const landClass = landholdingClassOf(profile.acres);
  const small = landClass === 'MARGINAL' || landClass === 'SMALL';
  if (isScSt(profile)) return small ? 100 : 90;
  if (small) return 90;
  if (landClass === 'SEMI_MEDIUM') return 80;
  return 70;
};

const evaluateAnnadata = (profile: FarmerSchemeProfile): EvaluationCore => {
  const amount = isSmallOrMarginal(profile.acres) ? 20000 : 13500;
  const stateShare = amount - 6000;
  const boosts =
    10 +
    needBoost('INCOME_SUPPORT', profile) +
    ownershipBoost(profile) +
    epantaBoost(profile);
  const benefitEn = `${formatINR(amount)} per year (${formatINR(stateShare)} AP top-up + ${formatINR(6000)} PM-KISAN) paid in 3 DBT instalments.`;
  const benefitTe = `సంవత్సరానికి ${formatINR(amount)} (${formatINR(stateShare)} ఏపీ అదనపు సహాయం + ${formatINR(6000)} PM-KISAN), 3 DBT విడతలుగా.`;
  const breakdown: FinancialRow[] = [
    {
      labelEn: 'AP state top-up',
      labelTe: 'ఏపీ రాష్ట్ర అదనపు సహాయం',
      value: formatINR(stateShare),
    },
    {
      labelEn: 'PM-KISAN central share',
      labelTe: 'PM-KISAN కేంద్ర వాటా',
      value: formatINR(6000),
    },
    {
      labelEn: 'Total per year',
      labelTe: 'సంవత్సరానికి మొత్తం',
      value: formatINR(amount),
      emphasis: true,
    },
    {
      labelEn: 'Instalments',
      labelTe: 'విడతలు',
      value: '3',
    },
  ];

  if (profile.state !== 'AP') {
    return makeCore({
      status: 'NOT_ELIGIBLE',
      matchScore: score('NOT_ELIGIBLE', boosts),
      calculatedBenefitEn: benefitEn,
      calculatedBenefitTe: benefitTe,
      verdictReasonEn:
        'Annadata Sukhibhava is an Andhra Pradesh scheme. Telangana farmers receive Rythu Bandhu investment support instead, so this application cannot be filed in Khammam.',
      verdictReasonTe:
        'అన్నదాత సుఖీభవ ఆంధ్రప్రదేశ్ పథకం. తెలంగాణ రైతులు బదులుగా రైతు బంధు పెట్టుబడి సహాయం పొందుతారు; కాబట్టి ఖమ్మంలో ఈ దరఖాస్తు చేయలేరు.',
      nextActionEn:
        'Apply for Telangana Rythu Bandhu at your Agriculture Extension Officer (AEO) office.',
      nextActionTe:
        'మీ వ్యవసాయ విస్తరణ అధికారి (AEO) కార్యాలయంలో తెలంగాణ రైతు బంధు కోసం దరఖాస్తు చేయండి.',
      financialImpact: 0,
      financialBreakdown: breakdown,
      urgency: 0,
      priorityBoost: 0,
    });
  }

  if (profile.excludedByIncomeTax) {
    return makeCore({
      status: 'NOT_ELIGIBLE',
      matchScore: score('NOT_ELIGIBLE', boosts),
      calculatedBenefitEn: benefitEn,
      calculatedBenefitTe: benefitTe,
      verdictReasonEn:
        'Disqualified under PM-KISAN and Annadata Sukhibhava guidelines because the family has an income-tax payer, a government employee, or a pension above ₹10,000 per month.',
      verdictReasonTe:
        'కుటుంబంలో ఆదాయపు పన్ను చెల్లింపుదారు, ప్రభుత్వ ఉద్యోగి లేదా నెలకు ₹10,000కు పైగా పెన్షన్ ఉన్నందున PM-KISAN మరియు అన్నదాత సుఖీభవ మార్గదర్శకాల ప్రకారం అర్హత లేదు.',
      nextActionEn:
        'If the tax/employment status changed, ask the VAA to re-verify the family eligibility before the next instalment cycle.',
      nextActionTe:
        'పన్ను/ఉద్యోగ స్థితి మారినట్లయితే, తదుపరి విడత చక్రానికి ముందు కుటుంబ అర్హతను VAA ద్వారా మళ్లీ ధృవీకరించుకోండి.',
      financialImpact: 0,
      financialBreakdown: breakdown,
      urgency: 0,
      priorityBoost: 0,
    });
  }

  if (profile.ownership === 'TENANT_NO_CCRC') {
    return makeCore({
      status: 'ACTION_REQUIRED',
      matchScore: score('ACTION_REQUIRED', boosts),
      calculatedBenefitEn: benefitEn,
      calculatedBenefitTe: benefitTe,
      verdictReasonEn:
        `You qualify for ${formatINR(amount)} per year, BUT because you selected "Tenant without CCRC Card", you must first apply for a CCRC card at your Village Secretariat / RBK with the landowner consent, or ask the MAO about the state tenant top-up route.`,
      verdictReasonTe:
        `మీరు సంవత్సరానికి ${formatINR(amount)}కు అర్హులు, కానీ "CCRC కార్డు లేని కౌలు రైతు" ఎంచుకున్నందున మొదట భూ యజమాని అంగీకారంతో గ్రామ సచివాలయం / RBKలో CCRC కార్డు కోసం దరఖాస్తు చేయాలి, లేదా రాష్ట్ర కౌలు రైతు అదనపు సహాయం గురించి MAOని అడగాలి.`,
      nextActionEn:
        'Take the landowner, lease deed, both Aadhaars and the survey number to the Village Secretariat. The VAA uploads the CCRC request and usually issues the card in 15–30 days.',
      nextActionTe:
        'భూ యజమాని, లీజు ఒప్పందం, ఇద్దరి ఆధార్ మరియు సర్వే నంబర్‌తో గ్రామ సచివాలయానికి వెళ్లండి. VAA CCRC అభ్యర్థనను అప్‌లోడ్ చేసి సాధారణంగా 15–30 రోజుల్లో కార్డు ఇస్తారు.',
      financialImpact: amount,
      financialBreakdown: breakdown,
      urgency: 26,
      priorityBoost: needPriority('INCOME_SUPPORT', profile),
    });
  }

  if (profile.ePanta === 'NOT_REGISTERED') {
    return makeCore({
      status: 'ACTION_REQUIRED',
      matchScore: score('ACTION_REQUIRED', boosts),
      calculatedBenefitEn: benefitEn,
      calculatedBenefitTe: benefitTe,
      verdictReasonEn:
        `You are otherwise eligible for ${formatINR(amount)} per year, but the e-Panta (e-Crop) booking is missing. The VAA cannot verify your cultivation without it, so the instalment can be held.`,
      verdictReasonTe:
        `మీరు సంవత్సరానికి ${formatINR(amount)}కు అర్హులు, కానీ ఈ-పంట (ఈ-క్రాప్) నమోదు లేదు. దాని లేకుండా VAA మీ సాగును ధృవీకరించలేరు, కాబట్టి విడత నిలిపివేయబడవచ్చు.`,
      nextActionEn:
        'Complete the free e-Panta booking at the RBK with your Pattadar passbook, Aadhaar, survey number, crop and sowing date before the season cutoff.',
      nextActionTe:
        'పట్టాదారు పాస్‌బుక్, ఆధార్, సర్వే నంబర్, పంట మరియు విత్తిన తేదీతో సీజన్ చివరి తేదీ లోపు RBKలో ఉచిత ఈ-పంట నమోదు పూర్తి చేయండి.',
      financialImpact: amount,
      financialBreakdown: breakdown,
      urgency: 26,
      priorityBoost: needPriority('INCOME_SUPPORT', profile),
    });
  }

  return makeCore({
    status: 'ELIGIBLE',
    matchScore: score('ELIGIBLE', boosts),
    calculatedBenefitEn: benefitEn,
    calculatedBenefitTe: benefitTe,
    verdictReasonEn: `You qualify for ${benefitEn} Your ${formatAcres(profile.acres)} in ${districtName(profile.district, 'en')} and your ${OWNERSHIP_LABELS[profile.ownership].en.toLowerCase()} status meet the AP landholding rules.`,
    verdictReasonTe: `మీరు ${benefitTe} మీ ${formatAcres(profile.acres)} భూమి (${districtName(profile.district, 'te')}) మరియు ${OWNERSHIP_LABELS[profile.ownership].te} స్థితి ఏపీ భూ నిబంధనలకు సరిపోతాయి.`,
    nextActionEn:
      'No action pending — keep e-Panta updated each season and confirm Aadhaar–NPCI DBT mapping at your bank.',
    nextActionTe:
      'పెండింగ్ చర్య లేదు — ప్రతి సీజన్‌లో ఈ-పంట నవీకరించండి మరియు బ్యాంకులో ఆధార్–NPCI DBT మ్యాపింగ్ నిర్ధారించుకోండి.',
    financialImpact: amount,
    financialBreakdown: breakdown,
    urgency: 26,
    priorityBoost: needPriority('INCOME_SUPPORT', profile),
  });
};

const evaluatePmKisan = (profile: FarmerSchemeProfile): EvaluationCore => {
  const amount = 6000;
  const boosts =
    8 +
    needBoost('INCOME_SUPPORT', profile) +
    ownershipBoost(profile) +
    epantaBoost(profile);
  const benefitEn = `${formatINR(amount)} per year in 3 instalments of ${formatINR(2000)} through DBT.`;
  const benefitTe = `సంవత్సరానికి ${formatINR(amount)}, ${formatINR(2000)} చొప్పున 3 విడతలు, DBT ద్వారా.`;
  const breakdown: FinancialRow[] = [
    {
      labelEn: 'Each instalment',
      labelTe: 'ప్రతి విడత',
      value: formatINR(2000),
    },
    {
      labelEn: 'Instalments per year',
      labelTe: 'సంవత్సరానికి విడతలు',
      value: '3',
    },
    {
      labelEn: 'Total per year',
      labelTe: 'సంవత్సరానికి మొత్తం',
      value: formatINR(amount),
      emphasis: true,
    },
  ];

  if (profile.excludedByIncomeTax) {
    return makeCore({
      status: 'NOT_ELIGIBLE',
      matchScore: score('NOT_ELIGIBLE', boosts),
      calculatedBenefitEn: benefitEn,
      calculatedBenefitTe: benefitTe,
      verdictReasonEn:
        'Disqualified under PM-KISAN guidelines due to income-tax / government-employee / pension-above-₹10,000 status in the family.',
      verdictReasonTe:
        'కుటుంబంలో ఆదాయపు పన్ను / ప్రభుత్వ ఉద్యోగి / నెలకు ₹10,000కు పైగా పెన్షన్ ఉన్నందున PM-KISAN మార్గదర్శకాల ప్రకారం అర్హత లేదు.',
      nextActionEn:
        'No application is possible while this exclusion applies. Ask the VAA about state schemes that are not tied to PM-KISAN.',
      nextActionTe:
        'ఈ మినహాయింపు ఉన్నంతవరకు దరఖాస్తు సాధ్యం కాదు. PM-KISANతో సంబంధం లేని రాష్ట్ర పథకాల గురించి VAAని అడగండి.',
      financialImpact: 0,
      financialBreakdown: breakdown,
      urgency: 0,
      priorityBoost: 0,
    });
  }

  if (
    profile.ownership === 'TENANT_CCRC' ||
    profile.ownership === 'TENANT_NO_CCRC'
  ) {
    return makeCore({
      status: 'NOT_ELIGIBLE',
      matchScore: score('NOT_ELIGIBLE', boosts),
      calculatedBenefitEn: benefitEn,
      calculatedBenefitTe: benefitTe,
      verdictReasonEn:
        'PM-KISAN is only for landholding farmer families recorded in the revenue records. Tenant and CCRC farmers are covered by the AP state top-up (Annadata Sukhibhava), not by PM-KISAN.',
      verdictReasonTe:
        'PM-KISAN కేవలం రెవెన్యూ రికార్డుల్లో భూమి కలిగిన రైతు కుటుంబాలకు మాత్రమే. కౌలు మరియు CCRC రైతులు PM-KISAN కాకుండా ఆంధ్రప్రదేశ్ రాష్ట్ర అదనపు సహాయం (అన్నదాత సుఖీభవ) ద్వారా కవర్ అవుతారు.',
      nextActionEn:
        'Apply for Annadata Sukhibhava instead, and keep the CCRC card ready for state-level verification.',
      nextActionTe:
        'బదులుగా అన్నదాత సుఖీభవ కోసం దరఖాస్తు చేయండి మరియు రాష్ట్ర స్థాయి ధృవీకరణ కోసం CCRC కార్డు సిద్ధంగా ఉంచుకోండి.',
      financialImpact: 0,
      financialBreakdown: breakdown,
      urgency: 0,
      priorityBoost: 0,
    });
  }

  if (profile.ePanta === 'NOT_REGISTERED') {
    return makeCore({
      status: 'ACTION_REQUIRED',
      matchScore: score('ACTION_REQUIRED', boosts),
      calculatedBenefitEn: benefitEn,
      calculatedBenefitTe: benefitTe,
      verdictReasonEn:
        `You are otherwise eligible for ${formatINR(amount)} per year, but the VAA cannot link your land record to the current crop without an e-Panta booking.`,
      verdictReasonTe:
        `మీరు సంవత్సరానికి ${formatINR(amount)}కు అర్హులు, కానీ ఈ-పంట నమోదు లేకుండా VAA మీ భూ రికార్డును ప్రస్తుత పంటతో లింక్ చేయలేరు.`,
      nextActionEn:
        'Complete e-Panta at the RBK and then finish PM-KISAN e-KYC on pmkisan.gov.in or at the RBK biometric desk.',
      nextActionTe:
        'RBKలో ఈ-పంట పూర్తి చేసి, ఆ తర్వాత pmkisan.gov.in లేదా RBK బయోమెట్రిక్ డెస్క్‌లో PM-KISAN e-KYC పూర్తి చేయండి.',
      financialImpact: amount,
      financialBreakdown: breakdown,
      urgency: 20,
      priorityBoost: needPriority('INCOME_SUPPORT', profile),
    });
  }

  return makeCore({
    status: 'ELIGIBLE',
    matchScore: score('ELIGIBLE', boosts),
    calculatedBenefitEn: benefitEn,
    calculatedBenefitTe: benefitTe,
    verdictReasonEn:
      'Your landholding status, e-Panta registration and family profile meet the PM-KISAN rules. The money is paid directly to the Aadhaar-linked bank account.',
    verdictReasonTe:
      'మీ భూ యాజమాన్య స్థితి, ఈ-పంట నమోదు మరియు కుటుంబ ప్రొఫైల్ PM-KISAN నిబంధనలకు సరిపోతాయి. డబ్బు ఆధార్ లింక్ బ్యాంక్ ఖాతాకు నేరుగా జమ అవుతుంది.',
    nextActionEn:
      'Keep e-KYC and Aadhaar–NPCI seeding current. Check the beneficiary status online after each instalment date.',
    nextActionTe:
      'e-KYC మరియు ఆధార్–NPCI సీడింగ్ నవీకరించి ఉంచుకోండి. ప్రతి విడత తేదీ తర్వాత ఆన్‌లైన్‌లో లబ్ధిదారు స్థితి చూడండి.',
    financialImpact: amount,
    financialBreakdown: breakdown,
    urgency: 20,
    priorityBoost: needPriority('INCOME_SUPPORT', profile),
  });
};

const evaluateApmip = (profile: FarmerSchemeProfile): EvaluationCore => {
  const acres = Math.max(profile.acres, 0.5);
  const percent = apmipSubsidyPercent(profile);
  const systemCost = Math.round(acres * APMIP_COST_PER_ACRE);
  const subsidy = Math.round((systemCost * percent) / 100);
  const farmerShare = systemCost - subsidy;
  const cropEn = cropNames(profile.crops, 'en');
  const cropTe = cropNames(profile.crops, 'te');
  const boosts =
    12 +
    needBoost('IRRIGATION_SUBSIDY', profile) +
    ownershipBoost(profile) +
    epantaBoost(profile) +
    smallBoost(profile);
  const benefitEn = `${percent}% subsidy — government pays ${formatINR(subsidy)} and your share is ${formatINR(farmerShare)} for ${formatAcres(acres)} of ${cropEn}.`;
  const benefitTe = `${percent}% సబ్సిడీ — ప్రభుత్వం ${formatINR(subsidy)} చెల్లిస్తుంది, ${formatAcres(acres)} ${cropTe} పంటకు మీ వాటా ${formatINR(farmerShare)}.`;
  const breakdown: FinancialRow[] = [
    {
      labelEn: `Estimated system cost (${formatAcres(acres)} × ${formatINR(APMIP_COST_PER_ACRE)})`,
      labelTe: `అంచనా వ్యవస్థ వ్యయం (${formatAcres(acres)} × ${formatINR(APMIP_COST_PER_ACRE)})`,
      value: formatINR(systemCost),
    },
    {
      labelEn: `Government subsidy (${percent}%)`,
      labelTe: `ప్రభుత్వ సబ్సిడీ (${percent}%)`,
      value: formatINR(subsidy),
    },
    {
      labelEn: 'Your farmer share',
      labelTe: 'మీ రైతు వాటా',
      value: formatINR(farmerShare),
      emphasis: true,
    },
    {
      labelEn: 'Subsidy slab',
      labelTe: 'సబ్సిడీ స్లాబ్',
      value:
        isScSt(profile) && isSmallOrMarginal(acres)
          ? 'SC/ST priority 90–100%'
          : `${percent}%`,
    },
  ];

  if (profile.state !== 'AP') {
    return makeCore({
      status: 'NOT_ELIGIBLE',
      matchScore: score('NOT_ELIGIBLE', boosts),
      calculatedBenefitEn: benefitEn,
      calculatedBenefitTe: benefitTe,
      verdictReasonEn:
        'APMIP is an Andhra Pradesh micro-irrigation programme. Telangana farmers should apply under the Telangana Micro Irrigation Project (TGMIP) at the district agriculture office.',
      verdictReasonTe:
        'APMIP ఆంధ్రప్రదేశ్ సూక్ష్మ నీటిపారుదల కార్యక్రమం. తెలంగాణ రైతులు జిల్లా వ్యవసాయ కార్యాలయంలో తెలంగాణ సూక్ష్మ నీటిపారుదల ప్రాజెక్ట్ (TGMIP) కింద దరఖాస్తు చేయాలి.',
      nextActionEn:
        'Ask the Khammam District Agriculture Officer for the TGMIP drip/sprinkler subsidy slab.',
      nextActionTe:
        'ఖమ్మం జిల్లా వ్యవసాయ అధికారిని TGMIP డ్రిప్/స్ప్రింక్లర్ సబ్సిడీ స్లాబ్ గురించి అడగండి.',
      financialImpact: 0,
      financialBreakdown: breakdown,
      urgency: 0,
      priorityBoost: 0,
    });
  }

  if (profile.crops.length === 0) {
    return makeCore({
      status: 'ACTION_REQUIRED',
      matchScore: score('ACTION_REQUIRED', boosts),
      calculatedBenefitEn: benefitEn,
      calculatedBenefitTe: benefitTe,
      verdictReasonEn:
        'Select at least one crop so the APMIP design and per-acre subsidy can be calculated. Micro-irrigation is sanctioned crop-wise.',
      verdictReasonTe:
        'APMIP డిజైన్ మరియు ఎకరాకు సబ్సిడీని లెక్కించడానికి కనీసం ఒక పంటను ఎంచుకోండి. సూక్ష్మ నీటిపారుదల పంటల ప్రకారం మంజూరు అవుతుంది.',
      nextActionEn:
        'Add your crop, then take the soil/water test report and supplier quotation to the APMIP/MAO office.',
      nextActionTe:
        'మీ పంటను జోడించి, నేల/నీటి పరీక్ష నివేదిక మరియు సప్లైయర్ కోటేషన్‌తో APMIP/MAO కార్యాలయానికి వెళ్లండి.',
      financialImpact: subsidy,
      financialBreakdown: breakdown,
      urgency: 18,
      priorityBoost: needPriority('IRRIGATION_SUBSIDY', profile),
    });
  }

  if (profile.ownership === 'TENANT_NO_CCRC') {
    return makeCore({
      status: 'ACTION_REQUIRED',
      matchScore: score('ACTION_REQUIRED', boosts),
      calculatedBenefitEn: benefitEn,
      calculatedBenefitTe: benefitTe,
      verdictReasonEn:
        `You can get a ${percent}% subsidy worth ${formatINR(subsidy)}, BUT a tenant without CCRC cannot be sanctioned. First obtain a CCRC card or a landowner NOC plus registered lease at the Village Secretariat.`,
      verdictReasonTe:
        `మీరు ${formatINR(subsidy)} విలువైన ${percent}% సబ్సిడీ పొందవచ్చు, కానీ CCRC లేని కౌలు రైతుకు మంజూరు కాదు. మొదట గ్రామ సచివాలయంలో CCRC కార్డు లేదా భూ యజమాని NOC + నమోదైన లీజు తీసుకోండి.`,
      nextActionEn:
        'Take the landowner, lease deed and survey number to the Village Secretariat. Then submit the APMIP application with the CCRC card.',
      nextActionTe:
        'భూ యజమాని, లీజు ఒప్పందం మరియు సర్వే నంబర్‌తో గ్రామ సచివాలయానికి వెళ్లండి. తర్వాత CCRC కార్డుతో APMIP దరఖాస్తు సమర్పించండి.',
      financialImpact: subsidy,
      financialBreakdown: breakdown,
      urgency: 22,
      priorityBoost: needPriority('IRRIGATION_SUBSIDY', profile),
    });
  }

  if (profile.irrigation === 'RAINFED') {
    return makeCore({
      status: 'ACTION_REQUIRED',
      matchScore: score('ACTION_REQUIRED', boosts),
      calculatedBenefitEn: benefitEn,
      calculatedBenefitTe: benefitTe,
      verdictReasonEn:
        `The ${percent}% subsidy is available, but APMIP needs a functional water source. Rainfed land is not sanctioned until a borewell, farm pond or canal connection is created.`,
      verdictReasonTe:
        `${percent}% సబ్సిడీ అందుబాటులో ఉంది, కానీ APMIPకి పనిచేసే నీటి ఆధారం అవసరం. బోరు బావి, ఫారం పాండ్ లేదా కాలువ కనెక్షన్ ఏర్పడే వరకు వర్షాధార భూమికి మంజూరు ఉండదు.`,
      nextActionEn:
        'Ask the MAO about a borewell/farm-pond subsidy first, then re-apply for APMIP once water is available.',
      nextActionTe:
        'మొదట బోరు/ఫారం పాండ్ సబ్సిడీ గురించి MAOని అడగండి, నీరు అందుబాటులోకి వచ్చిన తర్వాత APMIPకి మళ్లీ దరఖాస్తు చేయండి.',
      financialImpact: subsidy,
      financialBreakdown: breakdown,
      urgency: 18,
      priorityBoost: needPriority('IRRIGATION_SUBSIDY', profile),
    });
  }

  return makeCore({
    status: 'ELIGIBLE',
    matchScore: score('ELIGIBLE', boosts),
    calculatedBenefitEn: benefitEn,
    calculatedBenefitTe: benefitTe,
    verdictReasonEn: `You qualify for ${percent}% APMIP subsidy worth ${formatINR(subsidy)}. For ${formatAcres(acres)} of ${cropEn} the estimated system cost is ${formatINR(systemCost)}, so your share is only ${formatINR(farmerShare)}.${isScSt(profile) && isSmallOrMarginal(acres) ? ' Your SC/ST small/marginal status places you in the 90–100% priority slab.' : ''}`,
    verdictReasonTe: `మీరు ${formatINR(subsidy)} విలువైన ${percent}% APMIP సబ్సిడీకి అర్హులు. ${formatAcres(acres)} ${cropTe} పంటకు అంచనా వ్యవస్థ వ్యయం ${formatINR(systemCost)}, కాబట్టి మీ వాటా ${formatINR(farmerShare)} మాత్రమే.${isScSt(profile) && isSmallOrMarginal(acres) ? ' మీ SC/ST చిన్న/సన్నకారు స్థితి 90–100% ప్రాధాన్యత స్లాబ్‌లో ఉంది.' : ''}`,
    nextActionEn:
      'Get the soil/water test and an empanelled supplier quotation, then submit the APMIP application at the district office or RBK.',
    nextActionTe:
      'నేల/నీటి పరీక్ష మరియు ఎంప్యానెల్డ్ సప్లైయర్ కోటేషన్ తీసుకుని, జిల్లా కార్యాలయం లేదా RBKలో APMIP దరఖాస్తు సమర్పించండి.',
    financialImpact: subsidy,
    financialBreakdown: breakdown,
    urgency: 18,
    priorityBoost: needPriority('IRRIGATION_SUBSIDY', profile),
  });
};

const CROP_INSURANCE: Record<
  SchemeCrop,
  { sumPerAcre: number; premiumPct: number }
> = {
  paddy: { sumPerAcre: 60000, premiumPct: 2 },
  chilli: { sumPerAcre: 150000, premiumPct: 5 },
  cotton: { sumPerAcre: 80000, premiumPct: 5 },
  turmeric: { sumPerAcre: 120000, premiumPct: 5 },
  pulses: { sumPerAcre: 40000, premiumPct: 2 },
};

const insuranceAverages = (
  crops: SchemeCrop[],
): { sumPerAcre: number; premiumPct: number } => {
  const list = crops.length > 0 ? crops : (['paddy'] as SchemeCrop[]);
  const totals = list.reduce(
    (acc, crop) => ({
      sum: acc.sum + CROP_INSURANCE[crop].sumPerAcre,
      premium: acc.premium + CROP_INSURANCE[crop].premiumPct,
    }),
    { sum: 0, premium: 0 },
  );
  return {
    sumPerAcre: totals.sum / list.length,
    premiumPct: totals.premium / list.length,
  };
};

const SCALE_OF_FINANCE: Record<SchemeCrop, number> = {
  paddy: 35000,
  chilli: 60000,
  cotton: 45000,
  turmeric: 50000,
  pulses: 20000,
};

const averageScaleOfFinance = (crops: SchemeCrop[]): number => {
  const list = crops.length > 0 ? crops : (['paddy'] as SchemeCrop[]);
  return (
    list.reduce((sum, crop) => sum + SCALE_OF_FINANCE[crop], 0) / list.length
  );
};

const evaluatePmfby = (profile: FarmerSchemeProfile): EvaluationCore => {
  const acres = Math.max(profile.acres, 0.5);
  const averages = insuranceAverages(profile.crops);
  const sumInsured = Math.round(averages.sumPerAcre * acres);
  const farmerPremium = Math.round((sumInsured * averages.premiumPct) / 100);
  const actuarialPremium = Math.round(sumInsured * 0.12);
  const govtSubsidy = Math.max(0, actuarialPremium - farmerPremium);
  const cropEn = cropNames(profile.crops, 'en');
  const cropTe = cropNames(profile.crops, 'te');
  const boosts =
    10 +
    needBoost('CROP_INSURANCE', profile) +
    ownershipBoost(profile) +
    epantaBoost(profile) +
    (profile.irrigation === 'RAINFED' ? 6 : 0);
  const benefitEn = `${formatINR(sumInsured)} crop cover for an estimated farmer premium of ${formatINR(farmerPremium)} — the governments bear about ${formatINR(govtSubsidy)} of the actuarial premium.`;
  const benefitTe = `${formatINR(sumInsured)} పంట కవరేజ్, అంచనా రైతు ప్రీమియం ${formatINR(farmerPremium)} — యాక్చువరీల్ ప్రీమియంలో సుమారు ${formatINR(govtSubsidy)} ప్రభుత్వాలు భరిస్తాయి.`;
  const breakdown: FinancialRow[] = [
    {
      labelEn: `Notional sum insured (${formatAcres(acres)})`,
      labelTe: `నామమాత్ర బీమా మొత్తం (${formatAcres(acres)})`,
      value: formatINR(sumInsured),
    },
    {
      labelEn: `Farmer premium (${averages.premiumPct.toFixed(1)}%)`,
      labelTe: `రైతు ప్రీమియం (${averages.premiumPct.toFixed(1)}%)`,
      value: formatINR(farmerPremium),
      emphasis: true,
    },
    {
      labelEn: 'Government premium support',
      labelTe: 'ప్రభుత్వ ప్రీమియం మద్దతు',
      value: formatINR(govtSubsidy),
    },
    {
      labelEn: 'Risk cover',
      labelTe: 'ప్రమాద కవరేజ్',
      value: formatINR(sumInsured),
    },
  ];

  if (profile.crops.length === 0) {
    return makeCore({
      status: 'ACTION_REQUIRED',
      matchScore: score('ACTION_REQUIRED', boosts),
      calculatedBenefitEn: benefitEn,
      calculatedBenefitTe: benefitTe,
      verdictReasonEn:
        'Select at least one notified crop so the sum insured and premium can be calculated. PMFBY enrolment is crop-specific.',
      verdictReasonTe:
        'బీమా మొత్తం మరియు ప్రీమియం లెక్కించడానికి కనీసం ఒక నోటిఫైడ్ పంటను ఎంచుకోండి. PMFBY నమోదు పంట ఆధారితం.',
      nextActionEn:
        'Add your crop, then complete e-Panta sowing registration before the season cut-off.',
      nextActionTe:
        'మీ పంటను జోడించి, సీజన్ చివరి తేదీ లోపు ఈ-పంట విత్తన నమోదు పూర్తి చేయండి.',
      financialImpact: sumInsured * 0.1,
      financialBreakdown: breakdown,
      urgency: 30,
      priorityBoost: needPriority('CROP_INSURANCE', profile),
    });
  }

  if (profile.ownership === 'TENANT_NO_CCRC') {
    return makeCore({
      status: 'ACTION_REQUIRED',
      matchScore: score('ACTION_REQUIRED', boosts),
      calculatedBenefitEn: benefitEn,
      calculatedBenefitTe: benefitTe,
      verdictReasonEn:
        `You can insure ${cropEn}, BUT a tenant without CCRC cannot be enrolled. Obtain the CCRC card or a landowner NOC plus registered lease before the cut-off date.`,
      verdictReasonTe:
        `మీరు ${cropTe} పంటకు బీమా తీసుకోవచ్చు, కానీ CCRC లేని కౌలు రైతును నమోదు చేయరు. చివరి తేదీ లోపు CCRC కార్డు లేదా భూ యజమాని NOC + నమోదైన లీజు తీసుకోండి.`,
      nextActionEn:
        'Apply for CCRC at the Village Secretariat immediately, then enroll for PMFBY at the bank/RBK with the CCRC card and e-Panta receipt.',
      nextActionTe:
        'వెంటనే గ్రామ సచివాలయంలో CCRC కోసం దరఖాస్తు చేయండి, తర్వాత CCRC కార్డు మరియు ఈ-పంట రసీదుతో బ్యాంక్/RBKలో PMFBY నమోదు చేయండి.',
      financialImpact: sumInsured * 0.1,
      financialBreakdown: breakdown,
      urgency: 34,
      priorityBoost: needPriority('CROP_INSURANCE', profile),
    });
  }

  if (profile.ePanta === 'NOT_REGISTERED') {
    return makeCore({
      status: 'ACTION_REQUIRED',
      matchScore: score('ACTION_REQUIRED', boosts),
      calculatedBenefitEn: benefitEn,
      calculatedBenefitTe: benefitTe,
      verdictReasonEn:
        `You must complete free e-Panta booking with your VAA before the cutoff date to activate ${formatINR(sumInsured)} crop insurance and the 0% interest loan.`,
      verdictReasonTe:
        `${formatINR(sumInsured)} పంట బీమా మరియు 0% వడ్డీ రుణం యాక్టివ్ కావాలంటే చివరి తేదీ లోపు VAAతో ఉచిత ఈ-పంట నమోదు పూర్తి చేయాలి.`,
      nextActionEn:
        'Go to the RBK with the pattadar passbook/CCRC, Aadhaar, survey number, crop and sowing date. Get the e-Panta receipt the same day.',
      nextActionTe:
        'పట్టాదారు పాస్‌బుక్/CCRC, ఆధార్, సర్వే నంబర్, పంట మరియు విత్తిన తేదీతో RBKకి వెళ్లండి. అదే రోజు ఈ-పంట రసీదు తీసుకోండి.',
      financialImpact: sumInsured * 0.1,
      financialBreakdown: breakdown,
      urgency: 34,
      priorityBoost: needPriority('CROP_INSURANCE', profile),
    });
  }

  return makeCore({
    status: 'ELIGIBLE',
    matchScore: score('ELIGIBLE', boosts),
    calculatedBenefitEn: benefitEn,
    calculatedBenefitTe: benefitTe,
    verdictReasonEn: `You qualify to insure ${formatAcres(acres)} of ${cropEn} for ${formatINR(sumInsured)}. Your premium is only ${formatINR(farmerPremium)} because the Centre and State share the actuarial cost.${profile.irrigation === 'RAINFED' ? ' Rainfed fields are prioritised in loss assessment.' : ''}`,
    verdictReasonTe: `${formatAcres(acres)} ${cropTe} పంటను ${formatINR(sumInsured)}కు బీమా చేసుకోవడానికి అర్హులు. యాక్చువరీల్ వ్యయాన్ని కేంద్ర, రాష్ట్ర ప్రభుత్వాలు పంచుకున్నందున మీ ప్రీమియం ${formatINR(farmerPremium)} మాత్రమే.${profile.irrigation === 'RAINFED' ? ' వర్షాధార పొలాలకు నష్ట అంచనాలో ప్రాధాన్యత ఉంటుంది.' : ''}`,
    nextActionEn:
      'Enrol at your bank/RBK or on pmfby.gov.in before the notified cut-off. Keep the policy number and report any loss within 72 hours.',
    nextActionTe:
      'నోటిఫైడ్ చివరి తేదీ లోపు బ్యాంక్/RBK లేదా pmfby.gov.inలో నమోదు చేయండి. పాలసీ నంబర్ ఉంచుకుని, నష్టం జరిగితే 72 గంటల్లో నివేదించండి.',
    financialImpact: sumInsured * 0.1,
    financialBreakdown: breakdown,
    urgency: 30,
    priorityBoost: needPriority('CROP_INSURANCE', profile),
  });
};

const evaluateKcc = (profile: FarmerSchemeProfile): EvaluationCore => {
  const acres = Math.max(profile.acres, 0.5);
  const scale = Math.round(averageScaleOfFinance(profile.crops) * acres);
  const interestFree = Math.min(scale, 100000);
  const interestSaved = Math.round(interestFree * 0.09);
  const cropEn = cropNames(profile.crops, 'en');
  const cropTe = cropNames(profile.crops, 'te');
  const boosts =
    10 +
    needBoost('INTEREST_FREE_LOAN', profile) +
    ownershipBoost(profile) +
    epantaBoost(profile);
  const benefitEn = `Up to ${formatINR(scale)} crop loan; the first ${formatINR(interestFree)} is interest-free on time repayment, saving about ${formatINR(interestSaved)} per year.`;
  const benefitTe = `${formatINR(scale)} వరకు పంట రుణం; సమయానికి తిరిగి చెల్లిస్తే మొదటి ${formatINR(interestFree)}పై వడ్డీ లేదు, సంవత్సరానికి సుమారు ${formatINR(interestSaved)} ఆదా.`;
  const breakdown: FinancialRow[] = [
    {
      labelEn: `Crop loan eligibility (scale of finance for ${cropEn})`,
      labelTe: `పంట రుణ అర్హత (${cropTe} స్కేల్ ఆఫ్ ఫైనాన్స్)`,
      value: formatINR(scale),
    },
    {
      labelEn: '0% interest-free portion',
      labelTe: '0% వడ్డీ లేని భాగం',
      value: formatINR(interestFree),
      emphasis: true,
    },
    {
      labelEn: 'Estimated interest saved per year',
      labelTe: 'సంవత్సరానికి అంచనా వడ్డీ ఆదా',
      value: formatINR(interestSaved),
    },
    {
      labelEn: 'Repayment condition',
      labelTe: 'తిరిగి చెల్లింపు నిబంధన',
      value: 'On time / సమయానికి',
    },
  ];

  if (profile.state !== 'AP') {
    return makeCore({
      status: 'NOT_ELIGIBLE',
      matchScore: score('NOT_ELIGIBLE', boosts),
      calculatedBenefitEn: benefitEn,
      calculatedBenefitTe: benefitTe,
      verdictReasonEn:
        'YSR Sunna Vaddi is an Andhra Pradesh interest-reimbursement scheme. Telangana farmers can still take a KCC crop loan under the central interest-subvention rules at their bank.',
      verdictReasonTe:
        'వైఎస్ఆర్ సున్నా వడ్డీ ఆంధ్రప్రదేశ్ వడ్డీ తిరిగి చెల్లింపు పథకం. తెలంగాణ రైతులు తమ బ్యాంకులో కేంద్ర వడ్డీ సబ్సిడీ నిబంధనల ప్రకారం KCC పంట రుణం తీసుకోవచ్చు.',
      nextActionEn:
        'Ask your bank branch for the KCC limit and the Telangana interest-subvention slab.',
      nextActionTe:
        'మీ బ్యాంక్ శాఖను KCC పరిమితి మరియు తెలంగాణ వడ్డీ సబ్సిడీ స్లాబ్ గురించి అడగండి.',
      financialImpact: 0,
      financialBreakdown: breakdown,
      urgency: 0,
      priorityBoost: 0,
    });
  }

  if (profile.ownership === 'TENANT_NO_CCRC') {
    return makeCore({
      status: 'ACTION_REQUIRED',
      matchScore: score('ACTION_REQUIRED', boosts),
      calculatedBenefitEn: benefitEn,
      calculatedBenefitTe: benefitTe,
      verdictReasonEn:
        `You can get a ${formatINR(scale)} crop loan, BUT a tenant without CCRC cannot get a normal KCC. Apply for a Joint Liability Group (JLG) tenant loan or obtain a CCRC card first.`,
      verdictReasonTe:
        `మీరు ${formatINR(scale)} పంట రుణం పొందవచ్చు, కానీ CCRC లేని కౌలు రైతుకు సాధారణ KCC లభించదు. జాయింట్ లయబిలిటీ గ్రూప్ (JLG) కౌలు రుణం కోసం దరఖాస్తు చేయండి లేదా మొదట CCRC కార్డు తీసుకోండి.`,
      nextActionEn:
        'Meet the bank branch manager with the lease deed and ask about the JLG tenant loan, or apply for CCRC at the Village Secretariat.',
      nextActionTe:
        'లీజు ఒప్పందంతో బ్యాంక్ శాఖ మేనేజర్‌ను కలిసి JLG కౌలు రుణం గురించి అడగండి, లేదా గ్రామ సచివాలయంలో CCRC కోసం దరఖాస్తు చేయండి.',
      financialImpact: interestSaved + interestFree * 0.01,
      financialBreakdown: breakdown,
      urgency: 24,
      priorityBoost: needPriority('INTEREST_FREE_LOAN', profile),
    });
  }

  if (profile.ePanta === 'NOT_REGISTERED') {
    return makeCore({
      status: 'ACTION_REQUIRED',
      matchScore: score('ACTION_REQUIRED', boosts),
      calculatedBenefitEn: benefitEn,
      calculatedBenefitTe: benefitTe,
      verdictReasonEn:
        `The bank can sanction ${formatINR(scale)}, but the 0% interest benefit needs an e-Panta booking to prove cultivation. Complete it before applying for the KCC.`,
      verdictReasonTe:
        `బ్యాంక్ ${formatINR(scale)} మంజూరు చేయవచ్చు, కానీ 0% వడ్డీ ప్రయోజనానికి సాగు నిరూపణ కోసం ఈ-పంట నమోదు అవసరం. KCC దరఖాస్తుకు ముందు పూర్తి చేయండి.`,
      nextActionEn:
        'Complete e-Panta at the RBK, then submit the KCC form with the receipt, land record/CCRC and Aadhaar.',
      nextActionTe:
        'RBKలో ఈ-పంట పూర్తి చేసి, రసీదు, భూ రికార్డు/CCRC మరియు ఆధార్‌తో KCC ఫారం సమర్పించండి.',
      financialImpact: interestSaved + interestFree * 0.01,
      financialBreakdown: breakdown,
      urgency: 24,
      priorityBoost: needPriority('INTEREST_FREE_LOAN', profile),
    });
  }

  return makeCore({
    status: 'ELIGIBLE',
    matchScore: score('ELIGIBLE', boosts),
    calculatedBenefitEn: benefitEn,
    calculatedBenefitTe: benefitTe,
    verdictReasonEn: `You qualify for a KCC crop loan of about ${formatINR(scale)} based on ${formatAcres(acres)} of ${cropEn}. Repay on time and the state reimburses interest on the first ${formatINR(interestFree)}, saving about ${formatINR(interestSaved)}.`,
    verdictReasonTe: `${formatAcres(acres)} ${cropTe} ఆధారంగా సుమారు ${formatINR(scale)} KCC పంట రుణానికి అర్హులు. సమయానికి తిరిగి చెల్లిస్తే మొదటి ${formatINR(interestFree)}పై రాష్ట్రం వడ్డీని తిరిగి చెల్లిస్తుంది, సుమారు ${formatINR(interestSaved)} ఆదా అవుతుంది.`,
    nextActionEn:
      'Apply at your bank with the e-Panta receipt, land record/CCRC and Aadhaar. Repay before the due date to receive the interest reimbursement.',
    nextActionTe:
      'ఈ-పంట రసీదు, భూ రికార్డు/CCRC మరియు ఆధార్‌తో మీ బ్యాంకులో దరఖాస్తు చేయండి. వడ్డీ తిరిగి పొందాలంటే గడువు తేదీ లోపు తిరిగి చెల్లించండి.',
    financialImpact: interestSaved + interestFree * 0.01,
    financialBreakdown: breakdown,
    urgency: 24,
    priorityBoost: needPriority('INTEREST_FREE_LOAN', profile),
  });
};

const evaluateKusum = (profile: FarmerSchemeProfile): EvaluationCore => {
  const acres = Math.max(profile.acres, 0.5);
  const pump =
    acres <= 5
      ? { hp: 5, cost: 350000 }
      : acres <= 10
        ? { hp: 7.5, cost: 450000 }
        : { hp: 10, cost: 550000 };
  const percent =
    isScSt(profile) && isSmallOrMarginal(acres) ? 95 : 90;
  const subsidy = Math.round((pump.cost * percent) / 100);
  const farmerShare = pump.cost - subsidy;
  const machineryPercent =
    isScSt(profile) || isSmallOrMarginal(acres) ? 50 : 40;
  const machineryCap =
    isScSt(profile) || isSmallOrMarginal(acres) ? 125000 : 100000;
  const boosts =
    8 +
    needBoost('MACHINERY_SOLAR', profile) +
    ownershipBoost(profile) +
    epantaBoost(profile) +
    smallBoost(profile);
  const benefitEn = `${percent}% subsidy on a ${pump.hp} HP solar pump — government support ${formatINR(subsidy)}, your share ${formatINR(farmerShare)}. Farm machinery: ${machineryPercent}% up to ${formatINR(machineryCap)}.`;
  const benefitTe = `${pump.hp} HP సోలార్ పంపుపై ${percent}% సబ్సిడీ — ప్రభుత్వ మద్దతు ${formatINR(subsidy)}, మీ వాటా ${formatINR(farmerShare)}. వ్యవసాయ యంత్రాలు: ${machineryPercent}% వరకు ${formatINR(machineryCap)}.`;
  const breakdown: FinancialRow[] = [
    {
      labelEn: `${pump.hp} HP solar pump benchmark cost`,
      labelTe: `${pump.hp} HP సోలార్ పంపు బెంచ్‌మార్క్ వ్యయం`,
      value: formatINR(pump.cost),
    },
    {
      labelEn: `Solar pump subsidy (${percent}%)`,
      labelTe: `సోలార్ పంపు సబ్సిడీ (${percent}%)`,
      value: formatINR(subsidy),
    },
    {
      labelEn: 'Your pump share',
      labelTe: 'మీ పంపు వాటా',
      value: formatINR(farmerShare),
      emphasis: true,
    },
    {
      labelEn: `Machinery subsidy (${machineryPercent}%, up to ${formatINR(machineryCap)})`,
      labelTe: `యంత్రాల సబ్సిడీ (${machineryPercent}%, ${formatINR(machineryCap)} వరకు)`,
      value: `${machineryPercent}%`,
    },
  ];

  if (profile.ownership === 'TENANT_NO_CCRC') {
    return makeCore({
      status: 'ACTION_REQUIRED',
      matchScore: score('ACTION_REQUIRED', boosts),
      calculatedBenefitEn: benefitEn,
      calculatedBenefitTe: benefitTe,
      verdictReasonEn:
        `You can get ${formatINR(subsidy)} solar-pump support, BUT the pump is installed on the land record, so a tenant without CCRC needs the landowner NOC plus registered lease first.`,
      verdictReasonTe:
        `మీరు ${formatINR(subsidy)} సోలార్ పంపు మద్దతు పొందవచ్చు, కానీ పంపు భూ రికార్డుపై అమరుతుంది, కాబట్టి CCRC లేని కౌలు రైతుకు మొదట భూ యజమాని NOC + నమోదైన లీజు అవసరం.`,
      nextActionEn:
        'Get the CCRC card/NOC at the Village Secretariat, then apply through the state renewable-energy nodal agency with the DISCOM feasibility.',
      nextActionTe:
        'గ్రామ సచివాలయంలో CCRC కార్డు/NOC తీసుకుని, DISCOM సాధ్యతతో రాష్ట్ర పునరుత్పాదక ఇంధన నోడల్ ఏజెన్సీ ద్వారా దరఖాస్తు చేయండి.',
      financialImpact: subsidy * 0.35 + machineryCap * 0.2,
      financialBreakdown: breakdown,
      urgency: 18,
      priorityBoost: needPriority('MACHINERY_SOLAR', profile),
    });
  }

  return makeCore({
    status: 'ELIGIBLE',
    matchScore: score('ELIGIBLE', boosts),
    calculatedBenefitEn: benefitEn,
    calculatedBenefitTe: benefitTe,
    verdictReasonEn: `You qualify for ${formatINR(subsidy)} solar-pump support on a ${pump.hp} HP pump (${percent}% subsidy) and ${machineryPercent}% machinery subsidy up to ${formatINR(machineryCap)}.${profile.irrigation === 'CANAL' ? ' A solar pump can supplement canal supply during rotation gaps.' : ''}`,
    verdictReasonTe: `${pump.hp} HP పంపుపై ${formatINR(subsidy)} సోలార్ మద్దతు (${percent}% సబ్సిడీ) మరియు ${formatINR(machineryCap)} వరకు ${machineryPercent}% యంత్రాల సబ్సిడీకి అర్హులు.${profile.irrigation === 'CANAL' ? ' కాలువ నీటి విరామ సమయంలో సోలార్ పంపు ఉపయోగపడుతుంది.' : ''}`,
    nextActionEn:
      'Get the DISCOM feasibility certificate and an empanelled vendor quotation, then apply at the state nodal agency or RBK.',
    nextActionTe:
      'DISCOM సాధ్యత ధృవీకరణ పత్రం మరియు ఎంప్యానెల్డ్ వెండర్ కోటేషన్ తీసుకుని, రాష్ట్ర నోడల్ ఏజెన్సీ లేదా RBKలో దరఖాస్తు చేయండి.',
    financialImpact: subsidy * 0.35 + machineryCap * 0.2,
    financialBreakdown: breakdown,
    urgency: 14,
    priorityBoost: needPriority('MACHINERY_SOLAR', profile),
  });
};

const EVALUATORS: Record<
  string,
  (profile: FarmerSchemeProfile) => EvaluationCore
> = {
  'annadata-sukhibhava': evaluateAnnadata,
  'pm-kisan': evaluatePmKisan,
  'apmip-micro-irrigation': evaluateApmip,
  'pmfby-ap-crop-insurance': evaluatePmfby,
  'ysr-sunna-vaddi-kcc': evaluateKcc,
  'pm-kusum-solar-mechanization': evaluateKusum,
};

/** Evaluates one scheme against the 9-input profile. */
export const evaluateSchemeEligibility = (
  scheme: Scheme,
  profile: FarmerSchemeProfile,
): SchemeEvaluation => {
  const evaluator = EVALUATORS[scheme.id];
  const core = evaluator
    ? evaluator(profile)
    : EVALUATORS['pm-kisan'](profile);
  return {
    scheme,
    decisionPriority: 0,
    ...core,
  };
};

/**
 * Evaluates all six schemes, ranks the actionable ones by financial impact and
 * urgency, and stamps decisionPriority (1 = apply first).
 */
export const evaluateSchemes = (
  profile: FarmerSchemeProfile,
): SchemeEvaluation[] => {
  const evaluations = SCHEMES.map((scheme) =>
    evaluateSchemeEligibility(scheme, profile),
  );

  const ranked = evaluations
    .filter((evaluation) => evaluation.status !== 'NOT_ELIGIBLE')
    .sort(
      (a, b) =>
        b.priorityScore - a.priorityScore || b.matchScore - a.matchScore,
    );

  ranked.forEach((evaluation, index) => {
    evaluation.decisionPriority = index + 1;
  });

  return evaluations;
};

/* ───────────────────────── AI decision advisor ─────────────────────────── */

const GEMINI_SCHEME_MODEL = (
  process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-2.5-flash'
).trim();

export const profileSummaryEn = (profile: FarmerSchemeProfile): string =>
  `${districtName(profile.district, 'en')}, ${profile.state === 'AP' ? 'Andhra Pradesh' : 'Telangana'}; ${formatAcres(profile.acres)}; ${SOCIAL_CATEGORY_LABELS[profile.socialCategory].en}; ${OWNERSHIP_LABELS[profile.ownership].en}; e-Panta ${profile.ePanta === 'REGISTERED' ? 'registered' : 'not registered'}; crops ${cropNames(profile.crops, 'en')}; irrigation ${IRRIGATION_LABELS[profile.irrigation].en}; priority ${PRIORITY_LABELS[profile.priorityNeed].en}`;

export const profileSummaryTe = (profile: FarmerSchemeProfile): string =>
  `${districtName(profile.district, 'te')}, ${profile.state === 'AP' ? 'ఆంధ్రప్రదేశ్' : 'తెలంగాణ'}; ${formatAcres(profile.acres)}; ${SOCIAL_CATEGORY_LABELS[profile.socialCategory].te}; ${OWNERSHIP_LABELS[profile.ownership].te}; ఈ-పంట ${profile.ePanta === 'REGISTERED' ? 'నమోదైంది' : 'నమోదు కాలేదు'}; పంటలు ${cropNames(profile.crops, 'te')}; నీటి ఆధారం ${IRRIGATION_LABELS[profile.irrigation].te}; ప్రధాన అవసరం ${PRIORITY_LABELS[profile.priorityNeed].te}`;

const statusEn = (status: EligibilityStatus): string => {
  if (status === 'ELIGIBLE') return 'ELIGIBLE';
  if (status === 'ACTION_REQUIRED') return 'ACTION REQUIRED';
  return 'NOT ELIGIBLE';
};

const statusTe = (status: EligibilityStatus): string => {
  if (status === 'ELIGIBLE') return 'అర్హత ఉంది';
  if (status === 'ACTION_REQUIRED') return 'చర్య అవసరం';
  return 'అర్హత లేదు';
};

const breakdownEn = (evaluation: SchemeEvaluation): string =>
  evaluation.financialBreakdown
    .map((row) => `${row.labelEn}: ${row.value}`)
    .join('; ');

const breakdownTe = (evaluation: SchemeEvaluation): string =>
  evaluation.financialBreakdown
    .map((row) => `${row.labelTe}: ${row.value}`)
    .join('; ');

const docListEn = (scheme: Scheme): string =>
  scheme.documentGuides
    .map(
      (guide, index) =>
        `${index + 1}. ${guide.en} — get it at ${guide.whereEn}`,
    )
    .join(' ');

const docListTe = (scheme: Scheme): string =>
  scheme.documentGuides
    .map(
      (guide, index) =>
        `${index + 1}. ${guide.te} — ${guide.whereTe} నుండి పొందండి`,
    )
    .join(' ');

const stepListEn = (steps: ApplicationStep[]): string =>
  steps
    .map(
      (item, index) =>
        `${index + 1}. ${item.titleEn}: ${item.detailEn}`,
    )
    .join(' ');

const stepListTe = (steps: ApplicationStep[]): string =>
  steps
    .map(
      (item, index) =>
        `${index + 1}. ${item.titleTe}: ${item.detailTe}`,
    )
    .join(' ');

const contactListEn = (scheme: Scheme): string =>
  scheme.contacts
    .map((item) => `${item.roleEn} (${item.detailEn})`)
    .join('; ');

const contactListTe = (scheme: Scheme): string =>
  scheme.contacts
    .map((item) => `${item.roleTe} (${item.detailTe})`)
    .join('; ');

interface GeminiResponse {
  candidates?: {
    content?: {
      parts?: { text?: string }[];
    };
  }[];
}

const safeParseJson = (
  text: string,
): { answer_en?: string; answer_te?: string } | null => {
  try {
    const cleaned = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();
    const parsed = JSON.parse(cleaned) as {
      answer_en?: string;
      answer_te?: string;
    };
    return parsed ?? null;
  } catch {
    return null;
  }
};

const callGeminiAdvisor = async (
  scheme: Scheme,
  profile: FarmerSchemeProfile,
  question: string,
  language: 'en' | 'te' | 'hi',
  evaluation: SchemeEvaluation,
): Promise<{ answerEn: string; answerTe: string } | null> => {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY?.trim();
  if (!apiKey) return null;

  const prompt = [
    'You are RythuVaani, a careful government-scheme advisor for Andhra Pradesh and Telangana farmers.',
    'Answer in both English and natural Telugu script. Use ONLY the official rulebook and the calculated evaluation below.',
    'Never invent rupee amounts, dates or eligibility rules. Keep each answer under 120 words.',
    'Be practical: name the exact office, document or next step the farmer should use.',
    'If the question is outside this scheme, say so briefly and redirect to the correct scheme.',
    `FARMER PROFILE: ${profileSummaryEn(profile)}`,
    `SCHEME: ${scheme.nameEn}`,
    `EVALUATION: status=${evaluation.status}; match=${evaluation.matchScore}%; benefit=${evaluation.calculatedBenefitEn}; reason=${evaluation.verdictReasonEn}; next=${evaluation.nextActionEn}; breakdown=${breakdownEn(evaluation)}`,
    `OFFICIAL RULEBOOK: ${scheme.rulebookEn}`,
    `FARMER QUESTION: ${question}`,
    `Preferred answer language: ${language}. Return STRICT JSON only: {"answer_en":"...","answer_te":"..."}`,
  ].join('\n');

  const controller =
    typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutHandle = controller
    ? setTimeout(() => controller.abort(), 25000)
    : null;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_SCHEME_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller ? controller.signal : undefined,
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.25,
            responseMimeType: 'application/json',
          },
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.warn(
        `[SchemeAI] Gemini HTTP ${response.status}:`,
        body.slice(0, 250),
      );
      return null;
    }

    const result = (await response.json()) as GeminiResponse;
    const text = result.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('')
      .trim();

    if (!text) return null;

    const parsed = safeParseJson(text);
    if (
      parsed &&
      typeof parsed.answer_en === 'string' &&
      typeof parsed.answer_te === 'string' &&
      parsed.answer_en.trim().length > 0 &&
      parsed.answer_te.trim().length > 0
    ) {
      return {
        answerEn: parsed.answer_en.trim(),
        answerTe: parsed.answer_te.trim(),
      };
    }

    return null;
  } catch (error) {
    console.warn('[SchemeAI] Gemini request failed:', error);
    return null;
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
};

const callFreeLlmAdvisor = async (
  scheme: Scheme,
  profile: FarmerSchemeProfile,
  question: string,
  language: 'en' | 'te' | 'hi',
  evaluation: SchemeEvaluation,
): Promise<{ answerEn: string; answerTe: string } | null> => {
  const baseUrl = process.env.EXPO_PUBLIC_FREELLM_BASE_URL?.trim();
  const apiKey = process.env.EXPO_PUBLIC_FREELLM_API_KEY?.trim();
  const model = (process.env.EXPO_PUBLIC_FREELLM_MODEL || 'auto').trim();

  if (!baseUrl) return null;

  const prompt = [
    'You are RythuVaani, a careful government-scheme advisor for Andhra Pradesh and Telangana farmers.',
    'Answer in both English and natural Telugu script. Use ONLY the official rulebook and the calculated evaluation below.',
    'Never invent rupee amounts, dates or eligibility rules. Keep each answer under 120 words.',
    'Be practical: name the exact office, document or next step the farmer should use.',
    'If the question is outside this scheme, say so briefly and redirect to the correct scheme.',
    `FARMER PROFILE: ${profileSummaryEn(profile)}`,
    `SCHEME: ${scheme.nameEn}`,
    `EVALUATION: status=${evaluation.status}; match=${evaluation.matchScore}%; benefit=${evaluation.calculatedBenefitEn}; reason=${evaluation.verdictReasonEn}; next=${evaluation.nextActionEn}; breakdown=${breakdownEn(evaluation)}`,
    `OFFICIAL RULEBOOK: ${scheme.rulebookEn}`,
    `FARMER QUESTION: ${question}`,
    `Preferred answer language: ${language}. Return STRICT JSON only: {"answer_en":"...","answer_te":"..."}`,
  ].join('\n');

  const controller =
    typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutHandle = controller
    ? setTimeout(() => controller.abort(), 25000)
    : null;

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      signal: controller ? controller.signal : undefined,
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.25,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.warn(
        `[SchemeAI] FreeLLM HTTP ${response.status}:`,
        body.slice(0, 250),
      );
      return null;
    }

    const result = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = result.choices?.[0]?.message?.content?.trim();
    if (!text) return null;

    const parsed = safeParseJson(text);
    if (
      parsed &&
      typeof parsed.answer_en === 'string' &&
      typeof parsed.answer_te === 'string' &&
      parsed.answer_en.trim().length > 0 &&
      parsed.answer_te.trim().length > 0
    ) {
      return {
        answerEn: parsed.answer_en.trim(),
        answerTe: parsed.answer_te.trim(),
      };
    }

    return null;
  } catch (error) {
    console.warn('[SchemeAI] FreeLLM request failed:', error);
    return null;
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
};

const buildOfflineAnswer = (
  scheme: Scheme,
  profile: FarmerSchemeProfile,
  question: string,
  evaluation: SchemeEvaluation,
): { answerEn: string; answerTe: string } => {
  const q = question.toLowerCase();
  const has = (...terms: string[]): boolean =>
    terms.some((term) => q.includes(term));
  const acres = formatAcres(profile.acres);
  const cropEn = cropNames(profile.crops, 'en');
  const cropTe = cropNames(profile.crops, 'te');
  const statusTextEn = statusEn(evaluation.status);
  const statusTextTe = statusTe(evaluation.status);

  const ranked = evaluateSchemes(profile)
    .filter((item) => item.decisionPriority > 0)
    .sort((a, b) => a.decisionPriority - b.decisionPriority)
    .slice(0, 3);
  const topEn = ranked
    .map(
      (item, index) =>
        `${index + 1}. ${item.scheme.shortNameEn} — ${item.calculatedBenefitEn}`,
    )
    .join('\n');
  const topTe = ranked
    .map(
      (item, index) =>
        `${index + 1}. ${item.scheme.shortNameTe} — ${item.calculatedBenefitTe}`,
    )
    .join('\n');

  if (
    has(
      'fastest',
      'first',
      'priority',
      'urgent',
      'immediate',
      'right now',
      'which scheme',
      'ఇప్పుడు',
      'మొదట',
      'ప్రాధాన్య',
      'త్వరగా',
      'ఏ పథకం',
    )
  ) {
    return {
      answerEn: `Based on your ${acres}, ${cropEn} and ${PRIORITY_LABELS[profile.priorityNeed].en} priority, apply in this order:\n${topEn}\nStart with #1 because it gives the highest net financial impact for your profile. If it shows ACTION REQUIRED, finish that one step first — the money cannot move until the document/registration is fixed.`,
      answerTe: `మీ ${acres}, ${cropTe} పంట మరియు ${PRIORITY_LABELS[profile.priorityNeed].te} ప్రాధాన్యత ఆధారంగా ఈ క్రమంలో దరఖాస్తు చేయండి:\n${topTe}\nమీ ప్రొఫైల్‌కు అత్యధిక ఆర్థిక ప్రయోజనం ఇచ్చే #1తో ప్రారంభించండి. అందులో "చర్య అవసరం" ఉంటే మొదట ఆ ఒక్క అడుగు పూర్తి చేయండి — పత్రం/నమోదు సరిచేయకుండా డబ్బు కదలదు.`,
    };
  }

  if (
    has(
      'ccrc',
      'tenant',
      'landowner',
      'lease',
      'కౌలు',
      'లీజు',
      'యజమాని',
      'ఒప్పందం',
    )
  ) {
    return {
      answerEn: `For ${scheme.shortNameEn} your status is ${statusTextEn}: ${evaluation.verdictReasonEn}\nA CCRC card is issued at the Village Secretariat/RBK when the landowner appears with Aadhaar, the lease deed, survey number and photos of both parties. The VAA uploads the request to the CCRC portal; most cards arrive in 15–30 days. If the landowner refuses, ask the MAO about the Joint Liability Group (JLG) tenant-loan route and keep your lease and payment proof.\nNext step: ${evaluation.nextActionEn}`,
      answerTe: `${scheme.shortNameTe} కోసం మీ స్థితి ${statusTextTe}: ${evaluation.verdictReasonTe}\nభూ యజమాని ఆధార్, లీజు ఒప్పందం, సర్వే నంబర్ మరియు ఇద్దరి ఫోటోలతో గ్రామ సచివాలయం/RBKకి వస్తే CCRC కార్డు జారీ అవుతుంది. VAA CCRC పోర్టల్‌లో అభ్యర్థన అప్‌లోడ్ చేస్తారు; సాధారణంగా 15–30 రోజుల్లో కార్డు వస్తుంది. భూ యజమాని నిరాకరిస్తే, జాయింట్ లయబిలిటీ గ్రూప్ (JLG) కౌలు రుణ మార్గం గురించి MAOని అడగండి మరియు లీజు, చెల్లింపు రుజువు ఉంచుకోండి.\nతదుపరి చర్య: ${evaluation.nextActionTe}`,
    };
  }

  if (has('e-panta', 'epanta', 'e-crop', 'ecrop', 'crop booking', 'ఈ-పంట', 'క్రాప్', 'నమోదు')) {
    return {
      answerEn: `e-Panta (e-Crop) booking is free. Go to the RBK with your Pattadar passbook/CCRC, Aadhaar, survey number, crop, variety and sowing date. The VAA books the crop and gives you a receipt the same day. Do it inside the notified window, normally before the season cut-off. Without e-Panta, PMFBY insurance and the 0% KCC loan cannot be activated, and income-support instalments can be held.\nFor ${scheme.shortNameEn}: ${evaluation.nextActionEn}`,
      answerTe: `ఈ-పంట (ఈ-క్రాప్) నమోదు ఉచితం. పట్టాదారు పాస్‌బుక్/CCRC, ఆధార్, సర్వే నంబర్, పంట, రకం మరియు విత్తిన తేదీతో RBKకి వెళ్లండి. VAA పంటను నమోదు చేసి అదే రోజు రసీదు ఇస్తారు. నోటిఫైడ్ విండోలో, సాధారణంగా సీజన్ చివరి తేదీ లోపు చేయండి. ఈ-పంట లేకుండా PMFBY బీమా మరియు 0% KCC రుణం యాక్టివ్ కావు, ఆదాయ సహాయ విడతలు నిలిపివేయబడవచ్చు.\n${scheme.shortNameTe} కోసం: ${evaluation.nextActionTe}`,
    };
  }

  if (
    has(
      'npci',
      'dbt',
      'aadhaar seeding',
      'bank account',
      'account',
      'క్షేమ',
      'డిబిటి',
      'బ్యాంక్',
      'ఖాతా',
      'ఆధార్',
    )
  ) {
    return {
      answerEn: `Take your Aadhaar and bank passbook to your branch and ask for "Aadhaar seeding + NPCI mapper". Confirm the account is active (not dormant) and that the farmer is the first holder. For PM-KISAN, also finish e-KYC on pmkisan.gov.in or at the RBK biometric desk. Then check the beneficiary status or call 155251.\nFor ${scheme.shortNameEn}, the DBT condition is: ${evaluation.nextActionEn}`,
      answerTe: `ఆధార్ మరియు బ్యాంక్ పాస్‌బుక్‌తో మీ శాఖకు వెళ్లి "ఆధార్ సీడింగ్ + NPCI మ్యాపర్" అడగండి. ఖాతా యాక్టివ్‌గా (డార్మెంట్ కాకుండా) ఉందో, రైతు మొదటి ఖాతాదారుడో నిర్ధారించుకోండి. PM-KISAN కోసం pmkisan.gov.in లేదా RBK బయోమెట్రిక్ డెస్క్‌లో e-KYC పూర్తి చేయండి. తర్వాత లబ్ధిదారు స్థితి చూడండి లేదా 155251కు కాల్ చేయండి.\n${scheme.shortNameTe} కోసం DBT నిబంధన: ${evaluation.nextActionTe}`,
    };
  }

  if (
    has(
      'document',
      'documents',
      'paper',
      'papers',
      'certificate',
      'పత్రాలు',
      'రుజువు',
      'సర్టిఫికెట్',
    )
  ) {
    return {
      answerEn: `For ${scheme.shortNameEn}, keep these ready:\n${docListEn(scheme)}\nCarry originals plus one photocopy set. The VAA at the RBK can verify most documents on the spot. Missing a document does not cancel your eligibility — it only delays the application until you obtain it.`,
      answerTe: `${scheme.shortNameTe} కోసం ఇవి సిద్ధంగా ఉంచుకోండి:\n${docListTe(scheme)}\nఅసలు పత్రాలు మరియు ఒక జిరాక్స్ సెట్ తీసుకెళ్లండి. RBKలోని VAA చాలా పత్రాలను అక్కడికక్కడే ధృవీకరించగలరు. పత్రం లేకపోవడం అర్హతను రద్దు చేయదు — దాన్ని పొందే వరకు దరఖాస్తు ఆలస్యం మాత్రమే అవుతుంది.`,
    };
  }

  if (
    has(
      'apply',
      'application',
      'how to',
      'process',
      'step',
      'దరఖాస్తు',
      'ఎలా',
      'ప్రక్రియ',
      'దశ',
    )
  ) {
    return {
      answerEn: `Offline route for ${scheme.shortNameEn}:\n${stepListEn(scheme.offlineSteps)}\nOnline route:\n${stepListEn(scheme.onlineSteps)}\nWho to meet: ${contactListEn(scheme)}\nHelplines: ${scheme.helplines.map((item) => `${item.number} (${item.labelEn})`).join(', ')}.`,
      answerTe: `${scheme.shortNameTe} కోసం ఆఫ్‌లైన్ మార్గం:\n${stepListTe(scheme.offlineSteps)}\nఆన్‌లైన్ మార్గం:\n${stepListTe(scheme.onlineSteps)}\nఎవరిని కలవాలి: ${contactListTe(scheme)}\nహెల్ప్‌లైన్‌లు: ${scheme.helplines.map((item) => `${item.number} (${item.labelTe})`).join(', ')}.`,
    };
  }

  if (
    scheme.id === 'pmfby-ap-crop-insurance' ||
    has('insurance', 'premium', 'claim', 'బీమా', 'ప్రీమియం', 'క్లెయిమ్')
  ) {
    return {
      answerEn: `PMFBY premium is capped at 2% for paddy/pulses and 5% for chilli, cotton and turmeric; the governments pay the rest of the actuarial premium. For your profile: ${evaluation.calculatedBenefitEn}\nEnrol before the notified cut-off through your bank, RBK or pmfby.gov.in. Report any flood, cyclone or pest loss to the VAA/bank within 72 hours and keep dated field photos. Claims are paid to the Aadhaar-linked bank account after the crop-cutting experiment.`,
      answerTe: `PMFBY ప్రీమియం వరి/మినుము-పెసరకు 2%, మిర్చి, పత్తి, పసుపుకు 5% మాత్రమే; మిగిలిన యాక్చువరీల్ ప్రీమియంను ప్రభుత్వాలు భరిస్తాయి. మీ ప్రొఫైల్‌కు: ${evaluation.calculatedBenefitTe}\nనోటిఫైడ్ చివరి తేదీ లోపు బ్యాంక్, RBK లేదా pmfby.gov.in ద్వారా నమోదు చేయండి. వరద, తుఫాను లేదా పురుగు నష్టాన్ని 72 గంటల్లో VAA/బ్యాంక్‌కు తెలియజేయండి మరియు తేదీతో పొలం ఫోటోలు ఉంచుకోండి. పంట కోత ప్రయోగం తర్వాత క్లెయిమ్ ఆధార్ లింక్ బ్యాంక్ ఖాతాకు చెల్లిస్తారు.`,
    };
  }

  if (
    scheme.id === 'pm-kusum-solar-mechanization' ||
    has('solar', 'pump', 'machinery', 'tractor', 'సోలార్', 'పంపు', 'యంత్ర', 'ట్రాక్టర్')
  ) {
    return {
      answerEn: `PM-KUSUM Component-B shares the solar pump cost as 60% Central + 30% State + 10% farmer (5% for SC/ST small & marginal). For your profile: ${evaluation.calculatedBenefitEn}\nThe pump must be bought from an empanelled vendor after DISCOM feasibility approval. SMAM machinery subsidy is a separate application at the RBK/agriculture office. Never pay the full pump cost in cash.`,
      answerTe: `PM-KUSUM కాంపోనెంట్-B సోలార్ పంపు వ్యయాన్ని 60% కేంద్రం + 30% రాష్ట్రం + 10% రైతు (SC/ST చిన్న & సన్నకారులకు 5%)గా పంచుతుంది. మీ ప్రొఫైల్‌కు: ${evaluation.calculatedBenefitTe}\nDISCOM సాధ్యత ఆమోదం తర్వాత ఎంప్యానెల్డ్ వెండర్ నుండి మాత్రమే పంపు కొనాలి. SMAM యంత్రాల సబ్సిడీకి RBK/వ్యవసాయ కార్యాలయంలో విడిగా దరఖాస్తు చేయాలి. పంపు పూర్తి వ్యయాన్ని నగదుగా ఎప్పుడూ చెల్లించవద్దు.`,
    };
  }

  if (
    has(
      'amount',
      'much',
      'subsidy',
      'rupee',
      'loan',
      'benefit',
      'how many',
      'ఎంత',
      'సబ్సిడీ',
      'రుణం',
      'ప్రయోజనం',
      'డబ్బు',
    )
  ) {
    return {
      answerEn: `Your personalised ${scheme.shortNameEn} calculation:\n${evaluation.calculatedBenefitEn}\nBreakdown: ${breakdownEn(evaluation)}\nWhy: ${evaluation.verdictReasonEn}\nNext step: ${evaluation.nextActionEn}`,
      answerTe: `మీ వ్యక్తిగత ${scheme.shortNameTe} లెక్కింపు:\n${evaluation.calculatedBenefitTe}\nవివరాలు: ${breakdownTe(evaluation)}\nకారణం: ${evaluation.verdictReasonTe}\nతదుపరి చర్య: ${evaluation.nextActionTe}`,
    };
  }

  if (
    has(
      'helpline',
      'contact',
      'phone',
      'number',
      'call',
      'ఫోన్',
      'సంప్రదించ',
      'నంబర్',
      'కాల్',
    )
  ) {
    return {
      answerEn: `Helplines for ${scheme.shortNameEn}: ${scheme.helplines.map((item) => `${item.number} — ${item.labelEn}`).join('; ')}.\nWho to meet: ${contactListEn(scheme)}.\nCall 155251 for AP Rythu Call Centre support in Telugu, or 1800-425-0430 for ANGRAU agriculture guidance.`,
      answerTe: `${scheme.shortNameTe} హెల్ప్‌లైన్‌లు: ${scheme.helplines.map((item) => `${item.number} — ${item.labelTe}`).join('; ')}.\nఎవరిని కలవాలి: ${contactListTe(scheme)}.\nతెలుగులో ఏపీ రైతు కాల్ సెంటర్ సహాయం కోసం 155251, ANGRAU వ్యవసాయ మార్గదర్శకత్వం కోసం 1800-425-0430కు కాల్ చేయండి.`,
    };
  }

  if (
    has(
      'eligible',
      'eligibility',
      'qualify',
      'why not',
      'అర్హత',
      'అర్హులు',
      'ఎందుకు',
    )
  ) {
    return {
      answerEn: `Your ${scheme.shortNameEn} status is ${statusTextEn} with a ${evaluation.matchScore}% match score.\n${evaluation.verdictReasonEn}\nNext step: ${evaluation.nextActionEn}`,
      answerTe: `${scheme.shortNameTe} స్థితి ${statusTextTe}, ${evaluation.matchScore}% మ్యాచ్ స్కోర్.\n${evaluation.verdictReasonTe}\nతదుపరి చర్య: ${evaluation.nextActionTe}`,
    };
  }

  return {
    answerEn: `${scheme.shortNameEn} — status ${statusTextEn} (${evaluation.matchScore}% match). ${evaluation.calculatedBenefitEn}\n${evaluation.verdictReasonEn}\nNext step: ${evaluation.nextActionEn}\nYou can also ask me about documents, e-Panta, CCRC cards, DBT/NPCI linking, subsidy amounts or the exact application process.`,
    answerTe: `${scheme.shortNameTe} — స్థితి ${statusTextTe} (${evaluation.matchScore}% మ్యాచ్). ${evaluation.calculatedBenefitTe}\n${evaluation.verdictReasonTe}\nతదుపరి చర్య: ${evaluation.nextActionTe}\nపత్రాలు, ఈ-పంట, CCRC కార్డు, DBT/NPCI లింకింగ్, సబ్సిడీ మొత్తాలు లేదా దరఖాస్తు ప్రక్రియ గురించి కూడా అడగవచ్చు.`,
  };
};

/**
 * Answers a scheme-specific farmer question.
 *
 * Tries Gemini 2.5 Flash with the full 9-input profile, the calculated
 * evaluation and the official rulebook. Falls back to a comprehensive
 * rule-based responder so the advisor always works offline / without a key.
 */
export const askSchemeAiAdvisor = async (
  scheme: Scheme,
  farmerProfile: FarmerSchemeProfile,
  userQuestion: string,
  language: 'en' | 'te' | 'hi',
): Promise<SchemeAiAnswer> => {
  const question = userQuestion.trim();
  const evaluation = evaluateSchemeEligibility(scheme, farmerProfile);

  if (question.length === 0) {
    return {
      ...buildOfflineAnswer(
        scheme,
        farmerProfile,
        'Tell me about this scheme',
        evaluation,
      ),
      source: 'offline',
    };
  }

  const gemini = await callGeminiAdvisor(
    scheme,
    farmerProfile,
    question,
    language,
    evaluation,
  );

  if (gemini) {
    return { ...gemini, source: 'gemini' };
  }

  // Fallback to FreeLLMAPI when Gemini key is absent or fails
  const freeLlm = await callFreeLlmAdvisor(
    scheme,
    farmerProfile,
    question,
    language,
    evaluation,
  );

  if (freeLlm) {
    return { ...freeLlm, source: 'gemini' };
  }

  return {
    ...buildOfflineAnswer(scheme, farmerProfile, question, evaluation),
    source: 'offline',
  };
};
