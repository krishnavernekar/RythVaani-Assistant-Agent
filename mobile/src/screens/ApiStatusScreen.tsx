/**
 * ApiStatusScreen — Live diagnostic panel for AI service connectivity.
 * Shows Gemini & Sarvam status, API key format, and step-by-step fix instructions.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { TopHeader } from '../components/TopHeader';
import { Colors, spacing, tokens } from '../theme/tokens';
import { diagnoseApiConnections, ApiStatus } from '../services/apiDiagnostics';

export default function ApiStatusScreen() {
  const navigation = useNavigation<any>();
  const [status, setStatus] = useState<ApiStatus | null>(null);
  const [testing, setTesting] = useState(true);

  useEffect(() => {
    diagnoseApiConnections().then((s) => {
      setStatus(s);
      setTesting(false);
    });
  }, []);

  const handleRefresh = () => {
    setTesting(true);
    setStatus(null);
    diagnoseApiConnections().then((s) => {
      setStatus(s);
      setTesting(false);
    });
  };

  const provider = status?.ai.provider ?? 'openrouter';
  const aiLabel =
    provider === 'gemini'
      ? 'Google Gemini AI'
      : provider === 'freellm'
        ? 'FreeLLMAPI (self-hosted)'
        : provider === 'openai'
          ? 'OpenAI'
          : provider === 'claude'
            ? 'Anthropic Claude'
            : provider === 'deepseek'
              ? 'DeepSeek'
              : provider === 'custom'
                ? 'Custom AI'
                : provider === 'offline'
                  ? 'Offline ANGRAU KB'
                  : 'OpenRouter AI';

  const openAiSetup = () =>
    Linking.openURL(
      provider === 'gemini'
        ? 'https://aistudio.google.com/apikey'
        : provider === 'freellm'
          ? 'https://github.com/tashfeenahmed/freellmapi'
          : provider === 'openai'
            ? 'https://platform.openai.com/api-keys'
            : 'https://openrouter.ai/keys',
    );
  const openSarvamSetup = () => Linking.openURL('https://indus.sarvam.ai/key-management');
  const openMsg91Setup = () => Linking.openURL('https://control.msg91.com/app/');

  const aiOk = provider === 'offline' || !!status?.ai.connected;
  const sarvamOk = !!status?.sarvam.connected;
  const msg91Ok = !!status?.msg91.connected;
  const allOk = aiOk && sarvamOk && msg91Ok;
  const nextStep = [aiOk, sarvamOk, msg91Ok].filter(Boolean).length + 1;

  return (
    <View style={tokens.screenWrapper}>
      <TopHeader subtitle="AI Service Diagnostics" showBack onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Status header */}
        <View style={styles.statusHeader}>
          <Text style={styles.statusTitle}>
            {allOk ? '✅ All Services Connected' : '⚠️ Services Need Attention'}
          </Text>
          <Text style={styles.statusSub}>
            {allOk
              ? 'AI, Sarvam voice and MSG91 OTP are working. Live features are enabled.'
              : 'Fix the issues below to enable live AI and OTP login.'}
          </Text>
        </View>

        {testing ? (
          <View style={styles.testingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.testingText}>Testing API connections...</Text>
          </View>
        ) : status ? (
          <>
            {/* AI provider section */}
            <ApiCard
              title={aiLabel}
              ok={aiOk}
              error={status.ai.error}
              details={[
                `Provider: ${provider}`,
                `Configured: ${status.ai.configured ? 'Yes' : 'No'}`,
                `Model: ${status.ai.model}`,
              ]}
              onFix={openAiSetup}
              fixLabel="Get an API Key"
            />

            {/* Sarvam Section */}
            <ApiCard
              title="Sarvam AI (Voice)"
              ok={sarvamOk}
              error={status.sarvam.error}
              details={[
                `Key configured: ${status.sarvam.configured ? 'Yes' : 'No'}`,
                `Key format: ${status.sarvam.keyFormatOk ? 'Valid (sk_...)' : 'Invalid format'}`,
                `Models: Saaras v4 (STT), Bulbul v3 (TTS)`,
              ]}
              onFix={openSarvamSetup}
              fixLabel="Get Sarvam API Key"
            />

            {/* MSG91 OTP Section */}
            <ApiCard
              title="MSG91 (SMS / Voice OTP)"
              ok={msg91Ok}
              error={status.msg91.error}
              details={[
                `Key configured: ${status.msg91.configured ? 'Yes' : 'No'}`,
                `Mode: ${status.msg91.mode === 'widget' ? 'OTP Widget' : 'Classic OTP template'}`,
                `Template / Widget ID: ${status.msg91.templateIdOk ? 'OK' : 'Check dashboard'}`,
                `SMS balance: ${status.msg91.smsBalance ?? 'unknown'}`,
                `Voice balance: ${status.msg91.voiceBalance ?? 'unknown'}`,
              ]}
              onFix={openMsg91Setup}
              fixLabel="Open MSG91 Dashboard"
            />

            {/* Fix Instructions */}
            {!allOk && (
              <View style={styles.instructionsCard}>
                <Text style={styles.instructionsTitle}>📋 How to Fix</Text>
                {!aiOk && (
                  <InstructionStep
                    num="1"
                    title={`Configure ${aiLabel}`}
                    body="Add the key to mobile/.env, then restart with: npx expo start -c. FreeLLMAPI also needs EXPO_PUBLIC_FREELLM_BASE_URL pointing at your gateway (e.g. http://192.168.1.5:3001/v1)."
                    onOpen={openAiSetup}
                  />
                )}
                {!sarvamOk && (
                  <InstructionStep
                    num={aiOk ? '1' : '2'}
                    title="Get a Sarvam API Key"
                    body="Go to https://indus.sarvam.ai/key-management and create a new key. Copy the key (starts with sk_) and add it: EXPO_PUBLIC_SARVAM_API_KEY=sk_..."
                    onOpen={openSarvamSetup}
                  />
                )}
                {!msg91Ok && (
                  <InstructionStep
                    num={String([aiOk, sarvamOk].filter(Boolean).length + 1)}
                    title="Fix MSG91 OTP"
                    body="Use only EXPO_PUBLIC_MSG91_WIDGET_ID and EXPO_PUBLIC_MSG91_TOKEN_AUTH in widget mode. Recharge the MSG91 wallets and disable captcha on the widget if MSG91 asks for a captcha token. Restart with npx expo start -c."
                    onOpen={openMsg91Setup}
                  />
                )}
                <InstructionStep
                  num={String(nextStep)}
                  title="Restart the App"
                  body="After updating .env, run: npx expo start -c (clears cache). The app will read the new keys on next launch."
                  onOpen={() => {}}
                />
              </View>
            )}

            {/* Info: offline fallback */}
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>ℹ️ Offline Fallback Active</Text>
              <Text style={styles.infoBody}>
                Even without API keys, the app works with built-in ANGRAU knowledge base
                containing verified pesticide recommendations for Paddy, Chilli, and other
                common crops in Guntur district.
              </Text>
            </View>
          </>
        ) : null}

        <TouchableOpacity style={styles.refreshBtn} onPress={handleRefresh}>
          <Text style={styles.refreshText}>🔄 Refresh Status</Text>
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

function ApiCard({
  title,
  ok,
  error,
  details,
  onFix,
  fixLabel,
}: {
  title: string;
  ok: boolean;
  error?: string;
  details: string[];
  onFix: () => void;
  fixLabel: string;
}) {
  return (
    <View style={[styles.card, ok ? styles.cardOk : styles.cardError]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={ok ? styles.cardStatusOk : styles.cardStatusError}>
          {ok ? '● Connected' : '● Not Connected'}
        </Text>
      </View>
      {details.map((d, i) => (
        <Text key={i} style={styles.cardDetail}>
          • {d}
        </Text>
      ))}
      {error && (
        <Text style={styles.cardErrorText}>⚠️ {error}</Text>
      )}
      {!ok && (
        <TouchableOpacity style={styles.fixBtn} onPress={onFix}>
          <Text style={styles.fixBtnText}>{fixLabel} →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function InstructionStep({
  num,
  title,
  body,
  onOpen,
}: {
  num: string;
  title: string;
  body: string;
  onOpen: () => void;
}) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNum}>{<Text style={styles.stepNumText}>{num}</Text>}</View>
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepBody}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  statusHeader: {
    backgroundColor: Colors.cardWhite,
    padding: spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.primary,
    marginBottom: 4,
  },
  statusSub: {
    fontSize: 12,
    color: Colors.slate,
    lineHeight: 18,
  },
  testingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: Colors.cardWhite,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  testingText: {
    fontSize: 13,
    color: Colors.slate,
  },
  card: {
    backgroundColor: Colors.cardWhite,
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  cardOk: {
    borderColor: '#86EFAC',
  },
  cardError: {
    borderColor: '#FCA5A5',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.ink,
  },
  cardStatusOk: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },
  cardStatusError: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  cardDetail: {
    fontSize: 11,
    color: Colors.slate,
    paddingLeft: 4,
  },
  cardErrorText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '600',
    marginTop: 4,
  },
  fixBtn: {
    marginTop: 8,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    padding: spacing.sm,
    alignItems: 'center',
  },
  fixBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  instructionsCard: {
    backgroundColor: Colors.cardWhite,
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: spacing.md,
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.primary,
  },
  step: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepNumText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.ink,
  },
  stepBody: {
    fontSize: 11,
    color: Colors.slate,
    lineHeight: 16,
    marginTop: 2,
  },
  infoCard: {
    backgroundColor: '#FEF3C7',
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 4,
  },
  infoBody: {
    fontSize: 11,
    color: '#78350F',
    lineHeight: 16,
  },
  refreshBtn: {
    backgroundColor: Colors.cardWhite,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  refreshText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
});
