/**
 * RythuVaani Bilingual (trilingual) i18n Dictionary
 * Every UI label is sourced here — no hardcoded strings in components.
 * Languages: en (English), te (తెలుగు), hi (हिन्दी)
 */

import { TELUGU_LINE_HEIGHT_MULTIPLIER, EN_LINE_HEIGHT_MULTIPLIER } from '../theme/tokens';

// ─── Type ─────────────────────────────────────────────────────────────────────
export type Lang = 'en' | 'te' | 'hi';

export interface TranslationDict {
  app: {
    name: string;
    tagline: string;
    kvkHeader: string;
  };
  welcome: {
    selectLanguage: string;
    instantSwitch: string;
    mobileLogin: string;
    otpSubtitle: string;
    getOtp: string;
    orDivider: string;
    voiceLogin: string;
    guestMode: string;
    sandboxBadge: string;
    liveSmsBadge: string;
    resendSms: string;
    resendVoice: string;
    countdownResend: string;
    verifyError: string;
    networkError: string;
    otpHelp: string;
    phoneValidation: string;
  };
  home: {
    subtitle: string;
    greetingPrefix: string;
    kharifBadge: string;
    todayAdvisory: string;
    advisorySubtitle: string;
    weatherOutlook: string;
    temp: string;
    sunny: string;
    rain: string;
    rainLow: string;
    humidity: string;
    wind: string;
    farmerAdvice: string;
    adviceText: string;
    quickTools: string;
    aiPowered: string;
  };
  quickTools: {
    cropScanner: string;
    cropScannerTe: string;
    askAi: string;
    askAiTe: string;
    mandiRates: string;
    mandiRatesTe: string;
    govtSchemes: string;
    govtSchemesTe: string;
  };
  askAi: {
    subtitle: string;
    maDisclaimerTitle: string;
    maDisclaimerBody: string;
    quickInquiries: string;
    recording: string;
    editTranscript: string;
    liveTranscript: string;
    cancelRetry: string;
    stopAndAsk: string;
  };
  schemes: {
    subtitle: string;
    searchPlaceholder: string;
    audioGuide: string;
    audioGuideSub: string;
    eligibilityChecker: string;
    eligibilitySub: string;
    privacyNote: string;
    stepDone: string;
    viewMatch: string;
    allSchemes: string;
    incomeSupport: string;
    cropInsurance: string;
  };
  market: {
    subtitle: string;
    selectYard: string;
    changeYard: string;
    state: string;
    district: string;
    liveStatus: string;
    liveStatusSub: string;
    modalPrice: string;
    modalPriceTe: string;
    minPrice: string;
    minPriceTe: string;
    maxPrice: string;
    maxPriceTe: string;
    arrivals: string;
    traded: string;
    audioBulletin: string;
    audioBulletinSub: string;
  };
  profile: {
    subtitle: string;
    questions: string;
    questionsTe: string;
    saved: string;
    savedTe: string;
    season: string;
    primaryCrops: string;
    nextInstallment: string;
    eligible: string;
    validTill: string;
    paddy: string;
    chilli: string;
  };
  weather: {
    subtitle: string;
    hub: string;
    liveNow: string;
    todayWeather: string;
    todayWeatherTe: string;
    feelsLike: string;
    rainForecast: string;
    rainForecastTe: string;
    lowToday: string;
    highTomorrow: string;
    rh: string;
    rhTe: string;
    windSpeed: string;
    windSpeedTe: string;
    safeSpray: string;
    soilMoisture: string;
    soilMoistureTe: string;
    adequateForPaddy: string;
    listenBulletin: string;
    listenBulletinTe: string;
    severeAlert: string;
    severeAlertTe: string;
    urgentAction: string;
    urgentActionTe: string;
  };
  bottomNav: {
    home: string;
    homeTe: string;
    askAi: string;
    askAiTe: string;
    schemes: string;
    schemesTe: string;
    market: string;
    marketTe: string;
    profile: string;
    profileTe: string;
  };
  common: {
    listen: string;
    listenTe: string;
    minutes: string;
    back: string;
    yes: string;
    no: string;
    loading: string;
    error: string;
    retry: string;
    close: string;
    save: string;
    delete: string;
    edit: string;
    viewAll: string;
  };
}

// ─── English ──────────────────────────────────────────────────────────────────
export const en: TranslationDict = {
  app: {
    name: 'RythuVaani AI',
    tagline: 'AI Smart Agronomy Companion',
    kvkHeader: 'AP/Telangana • Krishi Vigyan Kendra',
  },
  welcome: {
    selectLanguage: 'Select Your Language',
    instantSwitch: 'Instant Switch',
    mobileLogin: 'Mobile Number Login',
    otpSubtitle: 'A 4-digit OTP code will be sent to your phone',
    getOtp: 'Get Verification OTP',
    orDivider: 'OR',
    voiceLogin: 'Login Using Voice Assistant',
    guestMode: 'Explore Without Login (Guest Mode)',
    sandboxBadge: '🟡 Sandbox Mode — Dev Only',
    liveSmsBadge: '🟢 Live MSG91 SMS Sent',
    resendSms: '📩 Resend via SMS',
    resendVoice: '📞 Get OTP via Voice Call',
    countdownResend: 'Resend OTP in',
    verifyError: 'Incorrect OTP. Try again.',
    networkError: 'Network error. Check connection.',
    otpHelp: 'Enter the 4-digit code sent to your phone.',
    phoneValidation: 'Enter a valid 10-digit mobile number starting with 6–9.',
  },
  home: {
    subtitle: 'RythuVaani AI • Home',
    greetingPrefix: 'Welcome',
    kharifBadge: 'Kharif Season',
    todayAdvisory: "Today's Advisory",
    advisorySubtitle: 'Paddy stem borer alert & irrigation timing',
    weatherOutlook: 'Weather Outlook',
    temp: 'Temp',
    sunny: 'Sunny',
    rain: 'Rain',
    rainLow: 'Low Rain',
    humidity: 'Humidity',
    wind: 'Wind',
    farmerAdvice: 'Farmer Advice',
    adviceText:
      'Suitable weather for fertilizer spraying on Paddy crops before 4:00 PM today.',
    quickTools: 'Quick Tools',
    aiPowered: 'AI Powered',
  },
  quickTools: {
    cropScanner: 'Crop Health Scanner',
    cropScannerTe: 'పంట తెగుళ్ళ గుర్తింపు',
    askAi: 'Ask Agronomist AI',
    askAiTe: 'సందేహాలు అడగండి',
    mandiRates: "Today's Mandi Rate",
    mandiRatesTe: 'మార్కెట్ ధరల సమాచారం',
    govtSchemes: 'Govt Schemes 2025',
    govtSchemesTe: 'రైతు భరోసా & సబ్సిడీలు',
  },
  askAi: {
    subtitle: 'Ask Agronomist AI',
    maDisclaimerTitle: 'Preliminary AI Agronomist Advisory',
    maDisclaimerBody:
      'Preliminary AI agronomist advisory. Always consult your local Mandal Agriculture Officer (MAO) for severe infections or seed blight.',
    quickInquiries: 'Quick Inquiries',
    recording: 'Recording Voice…',
    editTranscript: 'Edit Transcript',
    liveTranscript: 'Live Speech-to-Text (Telugu / English)',
    cancelRetry: 'Cancel / Retry',
    stopAndAsk: 'Stop & Ask AI',
  },
  schemes: {
    subtitle: 'RythuVaani Schemes',
    searchPlaceholder: 'Search schemes (PM-KISAN, Rythu Bharosa…)',
    audioGuide: 'Scheme Help Audio Guide',
    audioGuideSub: 'Listen: How to check scheme eligibility in 1 min',
    eligibilityChecker: 'AI Scheme Eligibility Checker',
    eligibilitySub: 'పథకాల అర్హత తనిఖీ యంత్రం',
    privacyNote:
      'Check qualifying government schemes in 3 simple questions without entering your Aadhaar, OTP, or bank details.',
    stepDone: 'Step Done',
    viewMatch: 'View Match',
    allSchemes: 'All Schemes',
    incomeSupport: 'Income Support',
    cropInsurance: 'Crop Insurance',
  },
  market: {
    subtitle: 'Mandi Market Rates',
    selectYard: 'Select Market Yard',
    changeYard: 'Change Yard',
    state: 'STATE',
    district: 'DISTRICT',
    liveStatus: 'Live Market Status',
    liveStatusSub: 'Open (E-NAM Linked)',
    modalPrice: 'MODAL PRICE',
    modalPriceTe: 'సగటు ధర',
    minPrice: 'Min Price',
    minPriceTe: 'కనిష్ట',
    maxPrice: 'Max Price',
    maxPriceTe: 'గరిష్ట',
    arrivals: 'Arrivals',
    traded: 'Traded',
    audioBulletin: 'Daily Mandi Audio Bulletin',
    audioBulletinSub: 'Listen • 1 Min Telugu Voice Report',
  },
  profile: {
    subtitle: 'Farmer Profile',
    questions: 'Questions Asked',
    questionsTe: 'ప్రశ్నలు',
    saved: 'Saved Items',
    savedTe: 'దాచినవి',
    season: "Kharif '25",
    primaryCrops: 'Primary Crops',
    nextInstallment: 'Next Installment',
    eligible: 'Eligible',
    validTill: 'Valid till',
    paddy: 'Paddy',
    chilli: 'Chilli',
  },
  weather: {
    subtitle: 'Agromet Weather Advisory',
    hub: 'Tenali & Lam Mandal Hub',
    liveNow: 'Live Now',
    todayWeather: "Today's Weather",
    todayWeatherTe: 'నేటి వాతావరణం',
    feelsLike: 'Feels like',
    rainForecast: 'Rain Forecast',
    rainForecastTe: 'వర్ష సూచన',
    lowToday: 'Low Today',
    highTomorrow: 'Heavy Tomorrow',
    rh: 'Humidity',
    rhTe: 'తేమ శాతం',
    windSpeed: 'Wind Speed',
    windSpeedTe: 'గాలి వేగం',
    safeSpray: 'Safe spray',
    soilMoisture: 'Soil Moisture (10cm)',
    soilMoistureTe: 'నేల తేమ 10cm',
    adequateForPaddy: 'Adequate for Paddy',
    listenBulletin: 'Listen Bulletin',
    listenBulletinTe: 'వాతావరణ బులెటిన్ వినండి',
    severeAlert: 'Severe Rain Alert',
    severeAlertTe: 'భారీ వర్ష హెచ్చరిక',
    urgentAction: 'Urgent Action',
    urgentActionTe: 'తక్షణ చర్య',
  },
  bottomNav: {
    home: 'Home',
    homeTe: 'హోమ్',
    askAi: 'Ask AI',
    askAiTe: 'AI ని అడగండి',
    schemes: 'Schemes',
    schemesTe: 'పథకాలు',
    market: 'Market',
    marketTe: 'మార్కెట్',
    profile: 'Profile',
    profileTe: 'ప్రొఫైల్',
  },
  common: {
    listen: 'Listen',
    listenTe: 'వినండి',
    minutes: 'min',
    back: 'Back',
    yes: 'Yes',
    no: 'No',
    loading: 'Loading…',
    error: 'Error',
    retry: 'Retry',
    close: 'Close',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    viewAll: 'View all',
  },
};

// ─── Telugu ───────────────────────────────────────────────────────────────────
export const te: TranslationDict = {
  app: {
    name: 'రైతావాణి AI',
    tagline: 'AI స్మార్ట్ వ్యవసాయ సలహాదారు',
    kvkHeader: 'ఆంధ్రప్రదేశ్/తెలంగాణ • కృషి విజ్ఞాన కేంద్రం',
  },
  welcome: {
    selectLanguage: 'మీ భాషను ఎంచుకోండి',
    instantSwitch: 'తక్షణ మార్పు',
    mobileLogin: 'మొబైల్ నంబర్ లాగిన్',
    otpSubtitle: 'మీ ఫోన్‌కు 4 అంకెల OTP కోడ్ పంపబడుతుంది',
    getOtp: 'OTP పొందండి',
    orDivider: 'లేదా',
    voiceLogin: 'వాయిస్ అసిస్టెంట్‌తో లాగిన్',
    guestMode: 'లాగిన్ లేకుండా అన్వేషించండి (గెస్ట్ మోడ్)',
    sandboxBadge: '🟡 సాండ్‌బాక్స్ మోడ్ — డెవ్ మాత్రమే',
    liveSmsBadge: '🟢 MSG91 లైవ్ SMS పంపబడింది',
    resendSms: '📩 SMS ద్వారా మళ్ళీ పంపండి',
    resendVoice: '📞 ఫోన్ కాల్ ద్వారా OTP విన్నండి',
    countdownResend: 'OTP మళ్ళీ పంపడం',
    verifyError: 'సరైన OTP కాదు. మళ్ళీ ప్రయత్నించండి.',
    networkError: 'నెట్‌వర్క్ లోపం. కనెక్షన్ తనిఖీ చేయండి.',
    otpHelp: 'మీ ఫోన్‌కు పంపిన 4 అంకెల కోడ్ నమోదు చేయండి.',
    phoneValidation: '6–9 తో ప్రారంభమైన 10 అంకెల సరైన మొబైల్ నంబర్ నమోదు చేయండి.',
  },
  home: {
    subtitle: 'రైతావాణి AI • హోమ్',
    greetingPrefix: 'నమస్కారం',
    kharifBadge: 'ఖరీఫ్ రితు',
    todayAdvisory: 'ఈరోజు వ్యవసాయ సలహా',
    advisorySubtitle: 'బిపిటి 5204 వరిలో కాండం తొలచు పురుగు అప్‌డేట్',
    weatherOutlook: 'వాతావరణ సూచన',
    temp: 'ఉష్ణోగ్రత',
    sunny: 'ఎండ',
    rain: 'మழ',
    rainLow: 'తక్కువ మഴ',
    humidity: 'తేమ',
    wind: 'గాలి',
    farmerAdvice: 'రైతు సలహా',
    adviceText:
      'ఈరోజు సాయంత్రం 4 గంటల లోపు వరి పంటలకు ఎరువు పిచికారీ చేయడానికి అనుకూల వాతావరణం ఉంది.',
    quickTools: 'త్వరిత సేవలు',
    aiPowered: 'AI శక్తితో',
  },
  quickTools: {
    cropScanner: 'పంట తెగుళ్ళ గుర్తింపు',
    cropScannerTe: 'పంట తెగుళ్ళ గుర్తింపు',
    askAi: 'వ్యవసాయ నిపుణుడిని అడగండి',
    askAiTe: 'సందేహాలు అడగండి',
    mandiRates: 'మార్కెట్ ధరల సమాచారం',
    mandiRatesTe: 'మార్కెట్ ధరల సమాచారం',
    govtSchemes: 'ప్రభుత్వ పథకాలు 2025',
    govtSchemesTe: 'రైతు భరోసా & సబ్సిడీలు',
  },
  askAi: {
    subtitle: 'వ్యవసాయ AI సలహాదారు',
    maDisclaimerTitle: 'ప్రాథమిక AI వ్యవసాయ సలహా',
    maDisclaimerBody:
      'ప్రాథమిక AI వ్యవసాయ సలహాదారు. గంభీరమైన సంక్రమణలు లేదా విత్తన వ్యాధుల కోసం ఎప్పుడూ మీ స్థానిక మండల వ్యవసాయ అధికారిని (MAO) సంప్రదించండి.',
    quickInquiries: 'త్వరిత ప్రశ్నలు',
    recording: 'మாట్లాడండం / రికార్డింగ్…',
    editTranscript: 'ట్రాన్స్‌క్రిప్ట్ సవరించండి',
    liveTranscript: 'లైవ్ స్పీచ్-టు-టెక్ట్ (తెలుగు / ఇంగ్లీష్)',
    cancelRetry: 'రద్దు / మళ్లీ ప్రయత్నించండి',
    stopAndAsk: 'ఆపి AI ను అడగండి',
  },
  schemes: {
    subtitle: 'రైతావాణి పథకాలు',
    searchPlaceholder: 'పథకాలను వెతకండి (PM-KISAN, రైతు భరోసా…)',
    audioGuide: 'పథకాల సహాయ ఆడియో గైడ్',
    audioGuideSub: 'వినండి: 1 నిమిషాల్లో పథక అర్హతను ఎలా తనిఖీ చేయాలి',
    eligibilityChecker: 'AI పథక అర్హత తనిఖీ',
    eligibilitySub: 'పథకాల అర్హత తనిఖీ యంత్రం',
    privacyNote:
      'ఆధార్, OTP లేదా బ్యాంక్ వివరాలు ఎంటర్ చేయకుండా 3 సులభమైన ప్రశ్నలతో ప్రభుత్వ పథకాల అర్హతను తనిఖీ చేయండి.',
    stepDone: 'దశ పూర్తయింది',
    viewMatch: 'పోలికను చూడండి',
    allSchemes: 'అన్ని పథకాలు',
    incomeSupport: 'ఆదాయ సహాయం',
    cropInsurance: 'పంట బీమా',
  },
  market: {
    subtitle: 'మార్కెట్ ధరలు',
    selectYard: 'మార్కెట్ యార్డ్ ఎంచుకోండి',
    changeYard: 'యార్డ్ మార్చండి',
    state: 'రాష్ట్రం',
    district: 'జిల్లా',
    liveStatus: 'లైవ్ మార్కెట్ స్థితి',
    liveStatusSub: 'తెరిచి ఉంది (E-NAM లింక్)',
    modalPrice: 'సగటు ధర',
    modalPriceTe: 'సగటు ధర',
    minPrice: 'కనిష్ట ధర',
    minPriceTe: 'కనిష్ట',
    maxPrice: 'గరిష్ట ధర',
    maxPriceTe: 'గరిష్ట',
    arrivals: 'ఆసింగ్‌లు',
    traded: 'వ్యాపారం',
    audioBulletin: 'రోజువారీ మార్కెట్ ఆడియో బులెటిన్',
    audioBulletinSub: 'వినండి • 1 నిమిషం తెలుగు వాయిస్ రిపోర్ట్',
  },
  profile: {
    subtitle: 'రైతు ప్రొఫైల్',
    questions: 'ప్రశ్నలు',
    questionsTe: 'ప్రశ్నలు',
    saved: 'దాచినవి',
    savedTe: 'దాచినవి',
    season: "ఖరీఫ్ '25",
    primaryCrops: 'ప్రధాన పంటలు',
    nextInstallment: 'తర్వాత కిస్తీ',
    eligible: 'అర్హ',
    validTill: 'ముగిసే తేదీ',
    paddy: 'వరి',
    chilli: 'మిర్చి',
  },
  weather: {
    subtitle: 'అగ్రీమెట్ వాతావరణ సలహాలు',
    hub: 'తెనాలి & లాం మండల హబ్',
    liveNow: 'లైవ్',
    todayWeather: 'నేటి వాతావరణం',
    todayWeatherTe: 'నేటి వాతావరణం',
    feelsLike: 'అనిపించే ఉష్ణోగ్రత',
    rainForecast: 'వర్ష సూచన',
    rainForecastTe: 'వర్ష సూచన',
    lowToday: 'నేడు తక్కువ',
    highTomorrow: 'రేపు ఎక్కువ',
    rh: 'తేమ శాతం',
    rhTe: 'తేమ శాతం',
    windSpeed: 'గాలి వేగం',
    windSpeedTe: 'గాలి వేగం',
    safeSpray: 'సురక్షిత పిచికారీ',
    soilMoisture: 'నేల తేమ (10cm)',
    soilMoistureTe: 'నేల తేమ 10cm',
    adequateForPaddy: 'వరికి సరిపోతూ',
    listenBulletin: 'వాతావరణ బులెటిన్ వినండి',
    listenBulletinTe: 'వాతావరణ బులెటిన్ వినండి',
    severeAlert: 'భారీ వర్ష హెచ్చరిక',
    severeAlertTe: 'భారీ వర్ష హెచ్చరిక',
    urgentAction: 'తక్షణ చర్య',
    urgentActionTe: 'తక్షణ చర్య',
  },
  bottomNav: {
    home: 'హోమ్',
    homeTe: 'హోమ్',
    askAi: 'AI ని అడగండి',
    askAiTe: 'AI ని అడగండి',
    schemes: 'పథకాలు',
    schemesTe: 'పథకాలు',
    market: 'మార్కెట్',
    marketTe: 'మార్కెట్',
    profile: 'ప్రొఫైల్',
    profileTe: 'ప్రొఫైల్',
  },
  common: {
    listen: 'వినండి',
    listenTe: 'వినండి',
    minutes: 'ని',
    back: 'వెనుకకు',
    yes: 'అవును',
    no: 'కాదు',
    loading: 'లోడ్ అవుతోంది…',
    error: 'పొరపాటు',
    retry: 'మళ్లీ ప్రయత్నించండి',
    close: 'మూసివేయి',
    save: 'సేవ్ చేయి',
    delete: 'తొలగించు',
    edit: 'సవరించు',
    viewAll: 'అన్నీ చూడండి',
  },
};

// ─── Hindi ────────────────────────────────────────────────────────────────────
export const hi: TranslationDict = {
  app: {
    name: 'रिथुवाणी AI',
    tagline: 'AI स्मार्ट एग्रोनॉमी सहायक',
    kvkHeader: 'आंध्रप्रदेश/तेलंगाना • कृषि विज्ञान केन्द्र',
  },
  welcome: {
    selectLanguage: 'अपनी भाषा चुनें',
    instantSwitch: 'तत्काल बदलें',
    mobileLogin: 'मोबाइल नंबर लॉगिन',
    otpSubtitle: 'आपके फ़ोन पर 4 अंकों का OTP कोड भेजा जाएगा',
    getOtp: 'OTP प्राप्त करें',
    orDivider: 'या',
    voiceLogin: 'वॉइस असिस्टेंट से लॉगिन',
    guestMode: 'लॉगिन के बिना अन्वेषण करें (गैस्ट मोड)',
    sandboxBadge: '🟡 सैंडबॉक्स मोड — केवल डेवलपर',
    liveSmsBadge: '🟢 MSG91 लाइव SMS भेजया गया',
    resendSms: '📩 SMS से पुनः भेजें',
    resendVoice: '📞 फ़ोन कॉल से OTP पाएं',
    countdownResend: 'OTP पुनः भेजें',
    verifyError: 'गलत OTP. पुनः प्रयास करें।' ,
    networkError: 'नेटवरक त्रुटि. कनेक्शन जांचें।' ,
    otpHelp: 'अपने फ़ोन पर भेजया गया 4 अंकीय कोड दर्ज करें।' ,
    phoneValidation: '6–9 से शुरु होने वाला 10 अंकीय सही मोबाइल नंबर दर्ज करें।' ,
  },
  home: {
    subtitle: 'रिथुवाणी AI • होम',
    greetingPrefix: 'नमस्ते',
    kharifBadge: 'खरीफ़ ऋतु',
    todayAdvisory: 'आज की खेती सलाह',
    advisorySubtitle: 'धान की कांड छेदक की चेतावनी',
    weatherOutlook: 'मौसम पूर्वानुमान',
    temp: 'तापमान',
    sunny: 'धूप',
    rain: 'बारिश',
    rainLow: 'कम बारिश',
    humidity: 'आर्द्रता',
    wind: 'हवा',
    farmerAdvice: 'किसान सलाह',
    adviceText:
      'आज शाम 4 बजे से पहले धान की फसलों में उर्वरक छिड़काव के लिए उपयुक्त मौसम।',
    quickTools: 'त्वरित सेवाएँ',
    aiPowered: 'AI संचालित',
  },
  quickTools: {
    cropScanner: 'फसल स्वास्थ्य स्कैनर',
    cropScannerTe: 'फसल स्वास्थ्य स्कैनर',
    askAi: 'कृषि विशेषज्ञ से पूछें',
    askAiTe: 'संदेह पूछें',
    mandiRates: 'आज का मंडी भाव',
    mandiRatesTe: 'आज का मंडी भाव',
    govtSchemes: 'सरकारी योजनाएँ 2025',
    govtSchemesTe: 'सरकारी योजनाएँ 2025',
  },
  askAi: {
    subtitle: 'कृषि AI सलाहकार',
    maDisclaimerTitle: 'प्रारंभिक AI कृषि सलाह',
    maDisclaimerBody:
      'प्रारंभिक AI कृषि सलाह। गंभीर संक्रमण या बीज रोग के लिए हमेशा अपने स्थानीय मण्डल कृषि अधिकारी (MAO) से परामर्श लें।',
    quickInquiries: 'त्वरित पूछताछ',
    recording: 'रिकॉर्डिंग…',
    editTranscript: 'ट्रांसक्रिप्ट संपादित करें',
    liveTranscript: 'लाइव speech-to-text (तेलुगू / अंग्रेज़ी)',
    cancelRetry: 'रद्द करें / पुनः प्रयास',
    stopAndAsk: 'बंद करें और AI से पूछें',
  },
  schemes: {
    subtitle: 'रिथुवाणी योजनाएँ',
    searchPlaceholder: 'योजनाएँ खोजें (PM-KISAN, ऋतु भरोसा…)',
    audioGuide: 'योजना सहायता ऑडियो गाइड',
    audioGuideSub: 'सुनें: 1 मिनट में योजना पात्रता कैसे जाँचें',
    eligibilityChecker: 'AI योजना पात्रता जाँच',
    eligibilitySub: 'योजना पात्रता जाँच यंत्र',
    privacyNote:
      'आधार, OTP या बैंक विवरण दर्ज किए बिना 3 सरल प्रश्नों में सरकारी योजनाओं की पात्रता जाँचें।',
    stepDone: 'चरण पूर्ण',
    viewMatch: 'मिलान देखें',
    allSchemes: 'सभी योजनाएँ',
    incomeSupport: 'आय सहायता',
    cropInsurance: 'फसल बीमा',
  },
  market: {
    subtitle: 'मंडी भाव',
    selectYard: 'मंडी यार्ड चुनें',
    changeYard: 'यार्ड बदलें',
    state: 'राज्य',
    district: 'जिला',
    liveStatus: 'लाइव मंडी स्थिति',
    liveStatusSub: 'खुला (E-NAM लिंक)',
    modalPrice: 'मॉडल भाव',
    modalPriceTe: 'मॉडल भाव',
    minPrice: 'न्यूनतम भाव',
    minPriceTe: 'न्यूनतम',
    maxPrice: 'अधिकतम भाव',
    maxPriceTe: 'अधिकतम',
    arrivals: 'आगमन',
    traded: 'व्यापार',
    audioBulletin: 'दैनिक मंडी ऑडियो बुलेटिन',
    audioBulletinSub: 'सुनें • 1 मिनट तेलुगू वॉयस रिपोर्ट',
  },
  profile: {
    subtitle: 'किसान प्रोफ़ाइल',
    questions: 'प्रश्न',
    questionsTe: 'प्रश्न',
    saved: 'सहेजे गए',
    savedTe: 'सहेजे गए',
    season: "खरीफ़ '25",
    primaryCrops: 'मुख्य फसलें',
    nextInstallment: 'अगला किस्त',
    eligible: 'पात्र',
    validTill: 'मान्य तक',
    paddy: 'धान',
    chilli: 'मिरच',
  },
  weather: {
    subtitle: 'एग्रोमेट मौसम सलाह',
    hub: 'तेनाली & लाम मण्डल हब',
    liveNow: 'लाइव',
    todayWeather: 'आज का मौसम',
    todayWeatherTe: 'आज का मौसम',
    feelsLike: 'अनुभव',
    rainForecast: 'बारिश पूर्वानुमान',
    rainForecastTe: 'बारिश पूर्वानुमान',
    lowToday: 'आज कम',
    highTomorrow: 'कल अधिक',
    rh: 'आर्द्रता',
    rhTe: 'आर्द्रता',
    windSpeed: 'हवा की गति',
    windSpeedTe: 'हवा की गति',
    safeSpray: 'सुरक्षित छिड़काव',
    soilMoisture: 'मिट्टी की नमी (10cm)',
    soilMoistureTe: 'मिट्टी की नमी 10cm',
    adequateForPaddy: 'धान के लिए पर्याप्त',
    listenBulletin: 'मौसम बुलेटिन सुनें',
    listenBulletinTe: 'मौसम बुलेटिन सुनें',
    severeAlert: 'भारी बारिश चेतावनी',
    severeAlertTe: 'भारी बारिश चेतावनी',
    urgentAction: 'तत्काल कार्य',
    urgentActionTe: 'तत्काल कार्य',
  },
  bottomNav: {
    home: 'होम',
    homeTe: 'होम',
    askAi: 'AI से पूछें',
    askAiTe: 'AI से पूछें',
    schemes: 'योजनाएँ',
    schemesTe: 'योजनाएँ',
    market: 'मंडी',
    marketTe: 'मंडी',
    profile: 'प्रोफ़ाइल',
    profileTe: 'प्रोफ़ाइल',
  },
  common: {
    listen: 'सुनें',
    listenTe: 'सुनें',
    minutes: 'मि',
    back: 'वापस',
    yes: 'हाँ',
    no: 'नहीं',
    loading: 'लोड हो रहा है…',
    error: 'त्रुटि',
    retry: 'पुनः प्रयास',
    close: 'बंद करें',
    save: 'सहेजें',
    delete: 'हटाएँ',
    edit: 'संपादित करें',
    viewAll: 'सभी देखें',
  },
};

// ─── Dictionary lookup ────────────────────────────────────────────────────────
export const dictionaries: Record<Lang, TranslationDict> = { en, te, hi };

export function getDict(lang: Lang): TranslationDict {
  return dictionaries[lang] ?? en;
}

/**
 * Compute the correct lineHeight for a given fontSize and language.
 * Telugu text must use >= 1.55x multiplier per DESIGN.md spec.
 */
export function getLineHeight(fontSize: number, lang: Lang): number {
  if (lang === 'te') return Math.round(fontSize * TELUGU_LINE_HEIGHT_MULTIPLIER * 10) / 10;
  if (lang === 'hi') return Math.round(fontSize * TELUGU_LINE_HEIGHT_MULTIPLIER * 10) / 10; // Hindi also uses Devanagari
  return Math.round(fontSize * EN_LINE_HEIGHT_MULTIPLIER * 10) / 10;
}
