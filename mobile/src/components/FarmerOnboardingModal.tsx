/**
 * FarmerOnboardingModal
 * ----------------------
 * First-time farmer profile setup plus "Edit Profile / ప్రాధాన్యతలు".
 * The modal is globally mounted and reads its visibility from the store:
 *   authenticated && !guest && (needsProfileSetup || isProfileSetupOpen)
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors, shadows, spacing } from '../theme/tokens';
import { Language, useAppStore } from '../store/useAppStore';
import { getLineHeight } from '../i18n/translations';
import { stopSpeaking } from '../utils/voice';

const LANGUAGE_CARDS: { key: Language; label: string; sub: string }[] = [
  { key: 'te', label: 'తెలుగు', sub: 'Telugu' },
  { key: 'en', label: 'English', sub: 'ఆంగ్లం' },
  { key: 'hi', label: 'हिन्दी', sub: 'Hindi' },
];

const MANDAL_CHIPS = [
  'Guntur Mandal',
  'Tenali Mandal',
  'Mangalagiri',
  'Bapatla',
  'Vijayawada',
];

const ACRE_CHIPS = ['1.5', '3.0', '4.5', '6.0'];

const CROP_CHIPS = [
  { key: 'Chilli', label: '🌶️ Chilli' },
  { key: 'Paddy', label: '🌾 Paddy' },
  { key: 'Cotton', label: '☁️ Cotton' },
  { key: 'Pulses', label: '🌱 Pulses' },
  { key: 'Turmeric', label: '🟡 Turmeric' },
];

export default function FarmerOnboardingModal() {
  const {
    isAuthenticated,
    isGuest,
    needsProfileSetup,
    isProfileSetupOpen,
    farmer,
    language,
    setLanguage,
    completeProfileSetup,
    closeProfileSetup,
  } = useAppStore();

  const visible =
    isAuthenticated && !isGuest && (needsProfileSetup || isProfileSetupOpen);

  const [fullName, setFullName] = useState('');
  const [address, setAddress] = useState('');
  const [mandal, setMandal] = useState('');
  const [district, setDistrict] = useState('');
  const [acres, setAcres] = useState('');
  const [category, setCategory] = useState<'Pattadar' | 'Tenant'>('Pattadar');
  const [crops, setCrops] = useState<string[]>([]);
  const [draftLanguage, setDraftLanguage] = useState<Language>(language);
  const [error, setError] = useState('');
  const wasVisible = useRef(false);

  // Seed draft values only when the modal opens, so live language switching
  // and typing do not reset partially entered details.
  useEffect(() => {
    if (visible && !wasVisible.current) {
      setFullName(farmer.nameEn ?? farmer.name ?? '');
      setAddress(farmer.address ?? '');
      setMandal(farmer.mandal ?? '');
      setDistrict(farmer.district ?? '');
      setAcres(farmer.acres ? String(farmer.acres) : '');
      setCategory(farmer.category ?? 'Pattadar');
      setCrops(farmer.crops ?? []);
      setDraftLanguage(language);
      setError('');
    }
    wasVisible.current = visible;
  }, [visible, farmer, language]);

  const tr = (te: string, en: string, hi: string): string =>
    language === 'te' ? te : language === 'hi' ? hi : en;

  const handleLanguage = (lang: Language) => {
    setDraftLanguage(lang);
    if (lang !== language) {
      stopSpeaking();
      setLanguage(lang);
    }
  };

  const toggleCrop = (crop: string) => {
    setCrops((current) =>
      current.includes(crop)
        ? current.filter((item) => item !== crop)
        : [...current, crop],
    );
  };

  const handleClose = () => {
    // First-time setup cannot be skipped; edit mode can be dismissed.
    if (!needsProfileSetup) closeProfileSetup();
  };

  const handleSave = () => {
    const cleanName = fullName.trim();
    if (!cleanName) {
      setError(
        tr(
          'దయచేసి మీ పూర్తి పేరు నమోదు చేయండి',
          'Please enter your full name',
          'कृपया अपना पूरा नाम दर्ज करें',
        ),
      );
      return;
    }

    const parsedAcres = Number(acres);
    completeProfileSetup({
      fullName: cleanName,
      address: address.trim(),
      mandal: mandal.trim(),
      district: district.trim() || 'Guntur',
      acres: Number.isFinite(parsedAcres) ? parsedAcres : 0,
      category,
      crops,
      preferredLanguage: draftLanguage,
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
        />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.title, { lineHeight: getLineHeight(21, language) }]}>
              {tr(
                'రైతు ప్రొఫైల్ సెటప్',
                'Farmer Profile Setup',
                'किसान प्रोफाइल सेटअप',
              )}
            </Text>
            <Text
              style={[
                styles.subtitle,
                { lineHeight: getLineHeight(13, language) },
              ]}
            >
              {tr(
                'మీ భాష, గ్రామం మరియు పంటలు భద్రపరచబడతాయి — ప్రతి లాగిన్‍లో తిరిగి చూపబడతాయి.',
                'Your language, village and crops are saved — restored on every login.',
                'आपकी भाषा, गाँव और फसलें सहेजी जती हैं — हर लॉगिन पर वापस दिखती हैं।',
              )}
            </Text>

            {error ? (
              <Text
                style={[styles.error, { lineHeight: getLineHeight(12, language) }]}
              >
                {error}
              </Text>
            ) : null}

            <Field
              label={tr('భాష / Language', 'Preferred Language', 'पसंदीदा भाषा')}
              language={language}
            >
              <View style={styles.languageRow}>
                {LANGUAGE_CARDS.map((item) => (
                  <TouchableOpacity
                    key={item.key}
                    style={[
                      styles.languageCard,
                      draftLanguage === item.key && styles.languageCardActive,
                    ]}
                    onPress={() => handleLanguage(item.key)}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.languageLabel,
                        draftLanguage === item.key && styles.languageLabelActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                    <Text style={styles.languageSub}>{item.sub}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Field>

            <Field
              label={tr(
                'మీ పూర్తి పేరు / Your Full Name',
                'Your Full Name',
                'आपका पूरा नाम',
              )}
              language={language}
            >
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={(text) => {
                  setFullName(text);
                  setError('');
                }}
                placeholder={tr(
                  'ఉదా: రామా రావు గారు',
                  'e.g. Rama Rao Garu',
                  'उदा: रामा राव गारु',
                )}
                placeholderTextColor={Colors.slateLight}
                autoCapitalize="words"
              />
            </Field>

            <Field
              label={tr('గ్రామం / చిరునామా', 'Village / Address', 'गाँव / पता')}
              language={language}
            >
              <TextInput
                style={styles.input}
                value={address}
                onChangeText={setAddress}
                placeholder={tr(
                  'ఉదా: లామ్ గ్రామం, ఇంటి నం 4-12',
                  'e.g. Lam Village, Door No 4-12',
                  'उदा: लाम गाँव, घर नं 4-12',
                )}
                placeholderTextColor={Colors.slateLight}
              />
            </Field>

            <Field
              label={tr('మండలం & జిల్లా', 'Mandal & District', 'मंडल और ज़िला')}
              language={language}
            >
              <TextInput
                style={styles.input}
                value={mandal}
                onChangeText={setMandal}
                placeholder={tr(
                  'మండలం',
                  'Mandal (e.g. Guntur Mandal)',
                  'मंडल',
                )}
                placeholderTextColor={Colors.slateLight}
              />
              <View style={styles.chipRow}>
                {MANDAL_CHIPS.map((item) => (
                  <Chip
                    key={item}
                    label={item}
                    active={mandal === item}
                    onPress={() => setMandal(item)}
                  />
                ))}
              </View>
              <TextInput
                style={[styles.input, styles.spacedInput]}
                value={district}
                onChangeText={setDistrict}
                placeholder={tr('జిల్లా', 'District', 'ज़िला')}
                placeholderTextColor={Colors.slateLight}
              />
            </Field>

            <Field
              label={tr(
                'భూమి విస్తీర్ణం - ఎకరాలు',
                'Landholding in Acres',
                'भूमि क्षेत्रफल - एकड़',
              )}
              language={language}
            >
              <View style={styles.acreRow}>
                <TextInput
                  style={[styles.input, styles.acreInput]}
                  value={acres}
                  onChangeText={(text) => setAcres(text.replace(/[^\d.]/g, ''))}
                  placeholder="0.0"
                  placeholderTextColor={Colors.slateLight}
                  keyboardType="decimal-pad"
                />
                <View style={styles.chipRow}>
                  {ACRE_CHIPS.map((item) => (
                    <Chip
                      key={item}
                      label={item}
                      active={acres === item}
                      onPress={() => setAcres(item)}
                    />
                  ))}
                </View>
              </View>
              <Text
                style={[styles.miniLabel, { lineHeight: getLineHeight(12, language) }]}
              >
                {tr('భూమి యాజమాన్యం', 'Ownership Type', 'भूमि स्वामित्व')}
              </Text>
              <View style={styles.chipRow}>
                <Chip
                  label={tr('పట్టాదారు • Pattadar', 'Pattadar', 'पट्टादार')}
                  active={category === 'Pattadar'}
                  onPress={() => setCategory('Pattadar')}
                />
                <Chip
                  label={tr('కౌలు రైతు • Tenant', 'Tenant', 'किरायेदार')}
                  active={category === 'Tenant'}
                  onPress={() => setCategory('Tenant')}
                />
              </View>
            </Field>

            <Field
              label={tr('ప్రధాన పంటలు', 'Primary Crops', 'मुख्य फसलें')}
              language={language}
            >
              <View style={styles.chipRow}>
                {CROP_CHIPS.map((item) => (
                  <Chip
                    key={item.key}
                    label={item.label}
                    active={crops.includes(item.key)}
                    onPress={() => toggleCrop(item.key)}
                  />
                ))}
              </View>
            </Field>

            <View style={styles.actions}>
              {!needsProfileSetup ? (
                <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
                  <Text style={styles.cancelText}>
                    {tr('రద్దు', 'Cancel', 'रद्द करें')}
                  </Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveText}>
                  {tr(
                    'భద్రపరచి కొనసాగించండి',
                    'Save & Continue',
                    'सहेजें और जारी रखें',
                  )}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({
  label,
  language,
  children,
}: {
  label: string;
  language: Language;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { lineHeight: getLineHeight(13, language) }]}>
        {label}
      </Text>
      {children}
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Colors.overlay,
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: Colors.cardWhite,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    ...shadows.elevated,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.cardBorder,
    marginTop: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  title: {
    fontSize: 21,
    fontWeight: '900',
    color: Colors.primary,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.slate,
  },
  error: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.danger,
    backgroundColor: Colors.dangerBg,
    padding: spacing.sm,
    borderRadius: 8,
  },
  field: { gap: spacing.sm },
  label: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.ink,
  },
  miniLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.slate,
    marginTop: spacing.xs,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 12,
    backgroundColor: '#FCFDFC',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: Colors.ink,
  },
  spacedInput: { marginTop: spacing.sm },
  acreRow: { gap: spacing.sm },
  acreInput: { width: 110 },
  languageRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  languageCard: {
    flex: 1,
    minHeight: 70,
    paddingVertical: spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  languageCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  languageLabel: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.ink,
  },
  languageLabelActive: { color: Colors.primary },
  languageSub: {
    fontSize: 11,
    color: Colors.slate,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: '#F8FAFC',
  },
  chipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.slate,
  },
  chipTextActive: { color: Colors.primary, fontWeight: '800' },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.slate,
  },
  saveBtn: {
    flex: 2,
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },
});
