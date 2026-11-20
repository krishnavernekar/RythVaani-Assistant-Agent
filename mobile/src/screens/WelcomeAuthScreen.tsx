import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Colors, spacing, tokens } from '../theme/tokens';
import Msg91WidgetBridge from '../components/Msg91WidgetBridge';
import { speak, stopSpeaking } from '../utils/voice';
import { Language, useAppStore } from '../store/useAppStore';
import { getDict, getLineHeight } from '../i18n/translations';
import {
  isValidIndianMobile,
  sendMsg91Otp,
  verifyMsg91Otp,
  resendMsg91Otp,
  OTP_LENGTH,
  type SendOtpResult,
  type VerifyOtpResult,
} from '../services/msg91AuthService';

export default function WelcomeAuthScreen() {
  const { language, setLanguage, setIsGuest, login } = useAppStore();
  const dict = getDict(language);
  const isTe = language === 'te';
  const sarvamLang = language === 'en' ? 'en-IN' : language === 'hi' ? 'hi-IN' : 'te-IN';

  const [mobileNumber, setMobileNumber] = useState('');
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpResult, setOtpResult] = useState<SendOtpResult | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyOtpResult | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState<'text' | 'voice' | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The selector mirrors the global language, so no state sync effect is needed.
  const selectedLang = language;

  useEffect(() => () => stopSpeaking(), []);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      countdownRef.current = setTimeout(() => {
        setCountdown((c) => c - 1);
      }, 1000);
    }
    return () => {
      if (countdownRef.current) {
        clearTimeout(countdownRef.current);
      }
    };
  }, [countdown]);

  const handleLangSelect = (lang: Language) => {
    setLanguage(lang);
  };

  const handleGetOtp = async () => {
    if (sending) return;
    const cleaned = mobileNumber.replace(/[\s\-+]/g, '');
    if (!isValidIndianMobile(cleaned)) {
      setOtpResult({
        success: false,
        isLiveMsg91: false,
        messageEn: dict.welcome.phoneValidation,
        messageTe: dict.welcome.phoneValidation,
      });
      return;
    }

    setSending(true);
    setOtpResult(null);
    setVerifyResult(null);
    setResendError(null);
    setOtp('');

    const result = await sendMsg91Otp(cleaned);
    setOtpResult(result);
    setSending(false);

    if (result.success) {
      setShowOtpModal(true);
      // Start 30-second countdown
      setCountdown(30);

      // Speak instructions
      const voiceText = isTe
        ? result.isLiveMsg91
          ? `${dict.welcome.liveSmsBadge}. ${result.messageTe}`
          : `${dict.welcome.sandboxBadge}. ${result.messageTe}`
        : result.isLiveMsg91
          ? `${dict.welcome.liveSmsBadge}. ${result.messageEn}`
          : `${dict.welcome.sandboxBadge}. ${result.messageEn}`;
      speak(voiceText, { language: sarvamLang });
    }
  };

  const handleVerifyOtp = async () => {
    const cleaned = mobileNumber.replace(/[\s\-+]/g, '');
    if (otp.length !== OTP_LENGTH) {
      setVerifyResult({
        success: false,
        messageEn: dict.welcome.verifyError,
        messageTe: dict.welcome.verifyError,
      });
      return;
    }

    setVerifying(true);
    setVerifyResult(null);

    const result = await verifyMsg91Otp(cleaned, otp);
    setVerifyResult(result);
    setVerifying(false);

    if (result.success) {
      stopSpeaking();
      const cleaned = mobileNumber.replace(/[\s\-+]/g, '');
      await login(cleaned);
      setShowOtpModal(false);
      setOtp('');
      setOtpResult(null);
      setVerifyResult(null);
      setCountdown(0);
    }
  };

  const handleResendOtp = async (channel: 'text' | 'voice') => {
    const cleaned = mobileNumber.replace(/[\s\-+]/g, '');
    if (!isValidIndianMobile(cleaned)) return;

    setResending(channel);
    setResendError(null);
    const result = await resendMsg91Otp(cleaned, channel);
    setResending(null);

    if (result.success) {
      setCountdown(30);
      setVerifyResult(null);
      setOtp('');
      speak(isTe ? result.messageTe : result.messageEn, { language: sarvamLang });
    } else {
      // Surface delivery errors (invalid template, no balance, rate limit...).
      setResendError(isTe ? result.messageTe : result.messageEn);
    }
  };

  const handleVoiceLogin = async () => {
    if (sending || resending) return;
    stopSpeaking();
    const cleaned = mobileNumber.replace(/[\s\-+]/g, '');
    if (!isValidIndianMobile(cleaned)) {
      setResendError(dict.welcome.phoneValidation);
      speak(dict.welcome.phoneValidation, { language: sarvamLang });
      return;
    }

    // MSG91 can only "retry as voice" after an OTP has been created.
    setSending(true);
    setResendError(null);
    const sendResult = await sendMsg91Otp(cleaned);
    setSending(false);

    if (!sendResult.success) {
      setOtpResult(sendResult);
      return;
    }

    const voiceResult = await resendMsg91Otp(cleaned, 'voice');
    setOtpResult(
      voiceResult.success
        ? {
            ...sendResult,
            messageEn: `${sendResult.messageEn} ${voiceResult.messageEn}`,
            messageTe: `${sendResult.messageTe} ${voiceResult.messageTe}`,
          }
        : sendResult,
    );
    if (!voiceResult.success) {
      setResendError(isTe ? voiceResult.messageTe : voiceResult.messageEn);
    }
    setShowOtpModal(true);
    setCountdown(30);
    speak(isTe ? voiceResult.messageTe : voiceResult.messageEn, { language: sarvamLang });
  };

  const handleGuestMode = () => {
    stopSpeaking();
    setIsGuest(true);
  };

  const playWelcomeAudio = () => {
    const text = isTe
      ? 'रైतुवाणीకి స்வాగతం. మీ భాషన ఎంచుకోండి, మొబైల్ నంబర్‌తో లాగిన్ అవ్వండి.'
      : 'Welcome to RythuVaani. Select your language and login with your mobile number.';
    speak(text, { language: sarvamLang });
  };

  return (
    <KeyboardAvoidingView
      style={tokens.screenWrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Loads the official MSG91 SDK (invisible hCaptcha) before OTP is requested. */}
      <Msg91WidgetBridge />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* KVK Context Header */}
        <View style={styles.kvkHeader}>
          <Text style={styles.kvkText}>📍 {dict.app.kvkHeader}</Text>
          <TouchableOpacity
            style={styles.listenGuideBtn}
            onPress={playWelcomeAudio}
            activeOpacity={0.7}
          >
            <Text style={styles.listenGuideText}>
              🔊 {isTe ? 'వినండి' : 'Listen'} Guide
            </Text>
          </TouchableOpacity>
        </View>

        {/* Language Selector Card */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              🌐 {dict.welcome.selectLanguage}
            </Text>
            <View style={styles.instantSwitchBadge}>
              <Text style={styles.instantSwitchText}>
                {dict.welcome.instantSwitch}
              </Text>
            </View>
          </View>

          <View style={styles.langGrid}>
            {([
              { lang: 'te' as Language, label: 'తెలుగు', sub: 'Telugu' },
              { lang: 'en' as Language, label: 'English', sub: 'ఆంగ్లం' },
              { lang: 'hi' as Language, label: 'हिन्दी', sub: 'Hindi' },
            ] as const).map(({ lang, label, sub }) => {
              const isSelected = selectedLang === lang;
              return (
                <TouchableOpacity
                  key={lang}
                  style={[
                    styles.langCard,
                    isSelected && styles.langCardSelected,
                  ]}
                  onPress={() => handleLangSelect(lang)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.langLabel,
                      isSelected && styles.langLabelSelected,
                    ]}
                  >
                    {label}
                  </Text>
                  <Text style={styles.langSub}>{sub}</Text>
                  {isSelected && <Text style={styles.langCheck}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Brand Card */}
        <View style={styles.brandCard}>
          <View style={styles.brandIconWrap}>
            <Text style={styles.brandIcon}>🌿</Text>
          </View>
          <View style={styles.brandTextWrap}>
            <Text style={styles.brandName}>
              {dict.app.name}{' '}
              <Text style={styles.brandSubName}>AI Kisan</Text>
            </Text>
            <Text
              style={[
                styles.brandTagline,
                { lineHeight: getLineHeight(12, language) },
              ]}
            >
              {isTe ? 'రైతువాణి - స్మార్ట్ వ్యవసాయ సలహాదారు' : dict.app.tagline}
            </Text>
          </View>
          <View style={styles.supportedBadge}>
            <Text style={styles.supportedBadgeText}>
              ✅ {isTe
                ? 'డిజిటల్ వ్యవసాయ మిషన్ & ANGRAU డేటా ద్వారా మద్దతు'
                : 'Supported by Digital Agriculture Mission & ANGRAU Agronomy Data'}
            </Text>
          </View>
        </View>

        {/* Mobile OTP Login Card */}
        <View style={styles.card}>
          <Text style={styles.inputLabel}>
            {isTe ? 'మొబైల్ నంబర్ నమోదు చేయండి' : dict.welcome.mobileLogin}
          </Text>
          <Text style={styles.inputHint}>{dict.welcome.otpSubtitle}</Text>

          <View style={styles.inputRow}>
            <View style={styles.countryCode}>
              <Text style={styles.countryCodeText}>IN +91</Text>
            </View>
            <TextInput
              style={styles.textInput}
              placeholder="98480 54321"
              placeholderTextColor={Colors.slateLight}
              keyboardType="phone-pad"
              value={mobileNumber}
              onChangeText={setMobileNumber}
              maxLength={10}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.primaryBtn,
              (!isValidIndianMobile(mobileNumber) || sending) && styles.primaryBtnDisabled,
            ]}
            onPress={handleGetOtp}
            activeOpacity={0.85}
          >
            {sending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryBtnText}>
                ➤ {isTe ? 'OTP పొందండి' : dict.welcome.getOtp}
              </Text>
            )}
          </TouchableOpacity>

          {otpResult && !otpResult.success && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>
                {isTe ? otpResult.messageTe : otpResult.messageEn}
              </Text>
            </View>
          )}

          <Text style={styles.orDivider}>{dict.welcome.orDivider}</Text>

          <TouchableOpacity
            style={styles.voiceBtn}
            onPress={handleVoiceLogin}
            activeOpacity={0.85}
          >
            <Text style={styles.voiceBtnText}>
              🎙️ {dict.welcome.voiceLogin} →
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.guestBtn}
            onPress={handleGuestMode}
            activeOpacity={0.85}
          >
            <Text style={styles.guestBtnText}>
              🧭 {dict.welcome.guestMode}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* OTP Verification Modal */}
      <Modal
        visible={showOtpModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!verifying) {
            setShowOtpModal(false);
            setOtp('');
            setOtpResult(null);
            setVerifyResult(null);
            setCountdown(0);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {isTe ? 'OTP ధృవీకరణ' : 'OTP Verification'}
            </Text>

            {/* Status badge */}
            {otpResult && (
              <View style={[
                styles.statusBadge,
                otpResult.isLiveMsg91 ? styles.statusLive : styles.statusSandbox,
              ]}>
                <Text style={styles.statusBadgeText}>
                  {otpResult.isLiveMsg91 ? dict.welcome.liveSmsBadge : dict.welcome.sandboxBadge}
                </Text>
              </View>
            )}

            <Text style={styles.modalSubtitle}>
              {isTe ? dict.welcome.otpHelp : dict.welcome.otpSubtitle}
            </Text>

            {/* Show the real MSG91 delivery status / request id to the farmer. */}
            {otpResult && (
              <View style={[
                styles.verifyResultBox,
                otpResult.success ? styles.verifySuccess : styles.verifyError,
              ]}>
                <Text style={styles.verifyResultText}>
                  {isTe ? otpResult.messageTe : otpResult.messageEn}
                </Text>
              </View>
            )}

            {resendError && (
              <View style={[styles.verifyResultBox, styles.verifyError]}>
                <Text style={styles.verifyResultText}>⚠️ {resendError}</Text>
              </View>
            )}

            <TextInput
              style={styles.otpInput}
              placeholder="1234"
              placeholderTextColor={Colors.slateLight}
              keyboardType="number-pad"
              value={otp}
              onChangeText={setOtp}
              maxLength={OTP_LENGTH}
              autoFocus
            />

            {verifyResult && (
              <View style={[
                styles.verifyResultBox,
                verifyResult.success ? styles.verifySuccess : styles.verifyError,
              ]}>
                <Text style={styles.verifyResultText}>
                  {isTe ? verifyResult.messageTe : verifyResult.messageEn}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.modalBtn,
                (otp.length !== OTP_LENGTH || verifying) && styles.modalBtnDisabled,
              ]}
              onPress={handleVerifyOtp}
              disabled={otp.length !== OTP_LENGTH || verifying}
              activeOpacity={0.85}
            >
              {verifying ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.modalBtnText}>
                  {isTe ? 'ధృవీకరించు & లాగిన్' : 'Verify & Login'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Resend options */}
            {countdown === 0 && (
              <View style={styles.resendContainer}>
                <Text style={styles.resendLabel}>
                  {isTe ? 'మళ్లీ పంపండి' : 'Resend OTP'}
                </Text>
                <View style={styles.resendButtons}>
                  <TouchableOpacity
                    style={styles.resendBtn}
                    onPress={() => handleResendOtp('text')}
                    disabled={!!resending}
                  >
                    {resending === 'text' ? (
                      <ActivityIndicator size="small" color={Colors.primary} />
                    ) : (
                      <Text style={styles.resendBtnText}>
                        {dict.welcome.resendSms}
                      </Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.resendBtn}
                    onPress={() => handleResendOtp('voice')}
                    disabled={!!resending}
                  >
                    {resending === 'voice' ? (
                      <ActivityIndicator size="small" color={Colors.primary} />
                    ) : (
                      <Text style={styles.resendBtnText}>
                        {dict.welcome.resendVoice}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {countdown > 0 && (
              <Text style={styles.countdownText}>
                {dict.welcome.countdownResend} {countdown}s...
              </Text>
            )}

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => {
                setShowOtpModal(false);
                setOtp('');
                setOtpResult(null);
                setVerifyResult(null);
                setCountdown(0);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.modalCancelText}>
                {isTe ? 'రద్దు చేయి' : 'Cancel'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  kvkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...tokens.card,
  },
  kvkText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.slate,
    flex: 1,
  },
  listenGuideBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 9999,
    backgroundColor: Colors.primarySoft,
    borderWidth: 1,
    borderColor: '#A5D6A7',
  },
  listenGuideText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
  },
  card: {
    padding: spacing.lg,
    gap: spacing.md,
    ...tokens.card,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.ink,
  },
  instantSwitchBadge: {
    backgroundColor: Colors.warning,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  instantSwitchText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.warningText,
  },
  langGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  langCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Colors.cardBorder,
    gap: 4,
    backgroundColor: Colors.cardWhite,
  },
  langCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  langLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.ink,
  },
  langLabelSelected: {
    color: Colors.primary,
    fontWeight: '800',
  },
  langSub: {
    fontSize: 10,
    color: Colors.slateLight,
  },
  langCheck: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '800',
  },
  brandCard: {
    padding: spacing.lg,
    gap: spacing.md,
    ...tokens.card,
  },
  brandIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandIcon: {
    fontSize: 28,
  },
  brandTextWrap: {
    gap: 2,
  },
  brandName: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.primary,
  },
  brandSubName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.slate,
  },
  brandTagline: {
    fontSize: 12,
    color: Colors.slate,
  },
  supportedBadge: {
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 9999,
    alignSelf: 'flex-start',
  },
  supportedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.ink,
  },
  inputHint: {
    fontSize: 11,
    color: Colors.slate,
    marginBottom: spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.slateLight,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    backgroundColor: '#F8FAFC',
    height: 52,
  },
  countryCode: {
    paddingRight: spacing.sm,
    borderRightWidth: 1,
    borderRightColor: Colors.cardBorder,
  },
  countryCodeText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.slate,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.ink,
    paddingLeft: spacing.sm,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    backgroundColor: Colors.slateLight,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  errorBanner: {
    backgroundColor: Colors.alert,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  errorText: {
    fontSize: 12,
    color: Colors.alertText,
  },
  orDivider: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: Colors.slateLight,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginVertical: spacing.sm,
  },
  voiceBtn: {
    borderWidth: 1.5,
    borderColor: '#FCD34D',
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  voiceBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.ink,
  },
  guestBtn: {
    backgroundColor: 'transparent',
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    backgroundColor: Colors.cardWhite,
    borderRadius: 20,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
    gap: spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.primary,
    textAlign: 'center',
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 9999,
    alignSelf: 'center',
  },
  statusLive: {
    backgroundColor: '#DCFCE7',
  },
  statusSandbox: {
    backgroundColor: '#FEF3C7',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.ink,
  },
  modalSubtitle: {
    fontSize: 13,
    color: Colors.slate,
    textAlign: 'center',
    lineHeight: getLineHeight(13, 'te'),
  },
  otpInput: {
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: 14,
    padding: spacing.md,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    color: Colors.ink,
    letterSpacing: 8,
  },
  verifyResultBox: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 10,
  },
  verifySuccess: {
    backgroundColor: Colors.successBg,
  },
  verifyError: {
    backgroundColor: Colors.alert,
  },
  verifyResultText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  modalBtnDisabled: {
    backgroundColor: Colors.slateLight,
  },
  modalBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  resendContainer: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  resendLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.slate,
    textAlign: 'center',
  },
  resendButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  resendBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    backgroundColor: Colors.primarySoft,
    borderWidth: 1,
    borderColor: Colors.primary,
    minWidth: 140,
    alignItems: 'center',
  },
  resendBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
    textAlign: 'center',
  },
  countdownText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.slate,
    textAlign: 'center',
  },
  modalCancelBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.slate,
  },
});
