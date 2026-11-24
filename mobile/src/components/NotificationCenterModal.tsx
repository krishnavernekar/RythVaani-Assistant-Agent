/**
 * NotificationCenterModal + NotificationToastBanner
 * --------------------------------------------------
 * Global, store-driven smart-alert UI. Mounted once inside NavigationContainer
 * so every screen (including custom-header screens) shares the same bell badge,
 * modal and urgent toast. Uses only existing dependencies.
 */
import React from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, spacing } from '../theme/tokens';
import { getLineHeight } from '../i18n/translations';
import { useAppStore } from '../store/useAppStore';
import type { FarmerNotification } from '../services/notificationService';
import { playIndicVoice, type SarvamLang } from '../services/sarvamVoiceService';
import { speak, stopSpeaking } from '../utils/voice';

type FilterKey = 'ALL' | 'SCHEME' | 'WEATHER' | 'MANDI';

type NotificationTabName =
  | 'HomeDashboard'
  | 'AskAgronomistScreen'
  | 'GovtSchemesChecker'
  | 'MandiMarketRates'
  | 'FarmerProfile';

/** Shared root-navigation shape for the global alert UI. */
export type NotificationNavigationParamList = {
  WelcomeAuth: undefined;
  MainTabs: { screen?: NotificationTabName } | undefined;
  AgrometWeather: undefined;
  CropHealthScanner: undefined;
  ApiStatus: undefined;
};

export type NotificationNavigationRef =
  NavigationContainerRefWithCurrent<NotificationNavigationParamList>;

interface NotificationComponentsProps {
  navigation: NotificationNavigationRef;
}

const sarvamLanguage = (language: string): SarvamLang =>
  language === 'en' ? 'en-IN' : language === 'hi' ? 'hi-IN' : 'te-IN';

const alertText = (
  notification: FarmerNotification,
  isTe: boolean,
): string => {
  const title = isTe ? notification.titleTe : notification.titleEn;
  const message = isTe ? notification.messageTe : notification.messageEn;
  const reason = isTe ? notification.reasonTe : notification.reasonEn;
  return [title, message, reason ? `${isTe ? 'మీ ప్రొఫైల్ ఆధారంగా' : 'Why you got this'}: ${reason}` : '']
    .filter(Boolean)
    .join('\n\n');
};

/** Navigate from the global modal to the alert's target screen. */
const navigateToTarget = (
  navigation: NotificationNavigationRef,
  notification: FarmerNotification,
): void => {
  switch (notification.actionTab) {
    case 'Market':
      navigation.navigate('MainTabs', { screen: 'MandiMarketRates' });
      break;
    case 'AskAI':
      navigation.navigate('MainTabs', { screen: 'AskAgronomistScreen' });
      break;
    case 'Weather':
      navigation.navigate('AgrometWeather');
      break;
    case 'Profile':
      navigation.navigate('MainTabs', { screen: 'FarmerProfile' });
      break;
    case 'Schemes':
    default:
      navigation.navigate('MainTabs', { screen: 'GovtSchemesChecker' });
      break;
  }
};

const PriorityBadge = ({
  notification,
  isTe,
}: {
  notification: FarmerNotification;
  isTe: boolean;
}) => {
  const urgent = notification.priority === 'URGENT';
  const label = urgent
    ? isTe
      ? 'తక్షణం'
      : 'URGENT'
    : notification.category === 'SCHEME'
      ? isTe
        ? 'కొత్త పథకం'
        : 'NEW SCHEME'
      : notification.category === 'MANDI'
        ? isTe
          ? 'మార్కెట్ అప్ డేట్'
          : 'MANDI UPDATE'
        : notification.category === 'WEATHER'
          ? isTe
            ? 'వాతావరణ హెచ్చరిక'
            : 'WEATHER ALERT'
          : isTe
            ? 'ప్రొఫైల్ అప్ డేట్'
            : 'PROFILE UPDATE';
  return (
    <View style={[styles.priorityBadge, urgent && styles.priorityUrgent]}>
      <Text style={[styles.priorityText, urgent && styles.priorityTextUrgent]}>
        {urgent ? '🔴' : '🟢'} {label}
      </Text>
    </View>
  );
};

export function NotificationCenterModal({
  navigation,
}: NotificationComponentsProps) {
  const isNotificationModalOpen = useAppStore(
    (state) => state.isNotificationModalOpen,
  );
  const setNotificationModalOpen = useAppStore(
    (state) => state.setNotificationModalOpen,
  );
  const notifications = useAppStore((state) => state.notifications);
  const farmer = useAppStore((state) => state.farmer);
  const language = useAppStore((state) => state.language);
  const refreshNotifications = useAppStore((state) => state.refreshNotifications);
  const markNotificationRead = useAppStore((state) => state.markNotificationRead);
  const markAllNotificationsRead = useAppStore(
    (state) => state.markAllNotificationsRead,
  );

  const [filter, setFilter] = React.useState<FilterKey>('ALL');
  const [refreshing, setRefreshing] = React.useState(false);
  const insets = useSafeAreaInsets();

  React.useEffect(() => () => stopSpeaking(), []);

  if (!isNotificationModalOpen) return null;

  const isTe = language === 'te';
  const label = (en: string, te: string) => (isTe ? te : en);
  const sarvamLang = sarvamLanguage(language);
  const crops = farmer.crops ?? [];
  const subtitle = isTe
    ? `${farmer.nameTe || farmer.name || 'రైతు'} • ${farmer.acres} ఎకరాలు • ${crops.join(', ') || 'అన్ని పంటలు'}`
    : `${farmer.nameEn || farmer.name || 'Farmer'} • ${farmer.acres} Acres • ${crops.join(', ') || 'all crops'}`;

  const visible = notifications.filter((item) => {
    if (filter === 'ALL') return true;
    if (filter === 'SCHEME') return item.category === 'SCHEME';
    if (filter === 'WEATHER') return item.category === 'WEATHER';
    return item.category === 'MANDI';
  });

  const close = () => {
    stopSpeaking();
    setNotificationModalOpen(false);
  };

  const onRefresh = () => {
    setRefreshing(true);
    void (async () => {
      try {
        await refreshNotifications();
      } finally {
        setRefreshing(false);
      }
    })();
  };

  const listen = (notification: FarmerNotification) => {
    const text = alertText(notification, isTe);
    playIndicVoice(text, sarvamLang, () => speak(text, { language: sarvamLang }));
  };

  const takeAction = (notification: FarmerNotification) => {
    markNotificationRead(notification.id);
    stopSpeaking();
    setNotificationModalOpen(false);
    navigateToTarget(navigation, notification);
  };

  const pills: { key: FilterKey; en: string; te: string }[] = [
    { key: 'ALL', en: 'All', te: 'అన్నీ' },
    { key: 'SCHEME', en: '🏛️ New Schemes', te: 'కొత్త పథకాలు' },
    { key: 'WEATHER', en: '⛈️ Weather & Pest', te: 'వాతావరణం' },
    { key: 'MANDI', en: '📈 Mandi', te: 'మార్కెట్' },
  ];

  return (
    <Modal
      visible={isNotificationModalOpen}
      animationType="slide"
      transparent
      onRequestClose={close}
    >
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.backdrop}>
          <TouchableOpacity
            style={styles.backdropTouch}
            activeOpacity={1}
            onPress={close}
          />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={styles.title}>
                  🔔 {label('RythuVaani Smart Alerts', 'రైతువాణి ముఖ్య సమాచారం')}
                </Text>
                <Text style={styles.subtitle}>{subtitle}</Text>
              </View>
              <TouchableOpacity onPress={close} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.markAllRow}>
              <TouchableOpacity style={styles.markAllBtn} onPress={markAllNotificationsRead}>
                <Text style={styles.markAllText}>
                  ✓ {label('Mark All Read', 'అన్నీ చదివినట్టు గుర్తించు')}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pillRow}
            >
              {pills.map((pill) => (
                <TouchableOpacity
                  key={pill.key}
                  style={[styles.pill, filter === pill.key && styles.pillActive]}
                  onPress={() => setFilter(pill.key)}
                >
                  <Text
                    style={[
                      styles.pillText,
                      filter === pill.key && styles.pillTextActive,
                    ]}
                  >
                    {isTe ? pill.te : pill.en}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            >
              {visible.length === 0 ? (
                <Text style={styles.emptyText}>
                  {label('No alerts in this category yet.', 'ఈ విభాగంలో ఇంకా హెచ్చరికలు లేవు.')}
                </Text>
              ) : null}
              {visible.map((notification) => (
                <View
                  key={notification.id}
                  style={[
                    styles.card,
                    !notification.isRead && styles.cardUnread,
                  ]}
                >
                  <View style={styles.cardTopRow}>
                    <PriorityBadge notification={notification} isTe={isTe} />
                    {!notification.isRead ? (
                      <View style={styles.unreadDot} />
                    ) : null}
                  </View>

                  <View style={styles.reasonPill}>
                    <Text style={styles.reasonText}>
                      🌱 {label('Why you got this', 'మీ ప్రొఫైల్ ఆధారంగా')}:{' '}
                      {isTe ? notification.reasonTe : notification.reasonEn}
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.cardTitle,
                      { lineHeight: getLineHeight(15, language) },
                    ]}
                  >
                    {isTe ? notification.titleTe : notification.titleEn}
                  </Text>
                  <Text
                    style={[
                      styles.cardMessage,
                      { lineHeight: getLineHeight(13, language) },
                    ]}
                  >
                    {isTe ? notification.messageTe : notification.messageEn}
                  </Text>

                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={styles.listenBtn}
                      onPress={() => listen(notification)}
                    >
                      <Text style={styles.listenText}>
                        🔊 {label('Listen Alert', 'వినండి')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => takeAction(notification)}
                    >
                      <Text style={styles.actionText}>
                        ➤{' '}
                        {notification.actionTab === 'Schemes'
                          ? label('View Scheme', 'పథకం చూడండి')
                          : label('Take Action', 'చర్య తీసుకోండి')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={onRefresh}
              disabled={refreshing}
            >
              {refreshing ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Text style={styles.refreshText}>
                  🔔 {label('Check for New Scheme Updates', 'కొత్త పథక అప్ డేట్ ల కోసం చూడండి')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** Dismissible floating toast for a new urgent alert / profile-preference edit. */
export function NotificationToastBanner({
  navigation,
}: NotificationComponentsProps) {
  const notification = useAppStore((state) => state.activeBannerNotification);
  const dismiss = useAppStore((state) => state.dismissBannerNotification);
  const markNotificationRead = useAppStore((state) => state.markNotificationRead);
  const language = useAppStore((state) => state.language);
  const insets = useSafeAreaInsets();

  React.useEffect(() => () => stopSpeaking(), []);

  if (!notification) return null;

  const isTe = language === 'te';
  const sarvamLang = sarvamLanguage(language);

  const listen = () => {
    const text = alertText(notification, isTe);
    playIndicVoice(text, sarvamLang, () => speak(text, { language: sarvamLang }));
  };

  const view = () => {
    markNotificationRead(notification.id);
    dismiss();
    navigateToTarget(navigation, notification);
  };

  return (
    <View style={[styles.toastWrap, { paddingTop: insets.top + spacing.xs }]}>
      <View style={styles.toastCard}>
        <View style={styles.toastTopRow}>
          <Text style={styles.toastIcon}>🔔</Text>
          <View style={styles.toastBody}>
            <Text
              style={[
                styles.toastTitle,
                { lineHeight: getLineHeight(13, language) },
              ]}
              numberOfLines={2}
            >
              {isTe ? notification.titleTe : notification.titleEn}
            </Text>
            <Text style={styles.toastReason} numberOfLines={1}>
              {isTe ? notification.reasonTe : notification.reasonEn}
            </Text>
          </View>
          <TouchableOpacity onPress={dismiss} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Text style={styles.toastClose}>✕</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.toastActions}>
          <TouchableOpacity style={styles.toastBtn} onPress={listen}>
            <Text style={styles.toastBtnText}>
              🔊 {isTe ? 'వినండి' : 'Listen'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.toastBtn, styles.toastViewBtn]} onPress={view}>
            <Text style={styles.toastViewText}>
              {isTe ? 'View ➔' : 'View ➔'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  backdropTouch: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: Colors.cardWhite,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
    color: Colors.primary,
  },
  subtitle: {
    fontSize: 11,
    color: Colors.slate,
    marginTop: 3,
  },
  closeText: {
    fontSize: 18,
    color: Colors.slate,
    padding: spacing.xs,
  },
  markAllRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.sm,
  },
  markAllBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    backgroundColor: Colors.primarySoft,
  },
  markAllText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
  },
  pillRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 9999,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  pillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.slate,
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.slate,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  card: {
    padding: spacing.md,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  cardUnread: {
    borderColor: '#86EFAC',
    backgroundColor: '#F7FEF8',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priorityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
    backgroundColor: '#DCFCE7',
  },
  priorityUrgent: {
    backgroundColor: '#FEE2E2',
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#15803D',
  },
  priorityTextUrgent: {
    color: '#B91C1C',
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  reasonPill: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
  },
  reasonText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: Colors.ink,
    marginTop: spacing.sm,
  },
  cardMessage: {
    fontSize: 13,
    color: Colors.slate,
    marginTop: 4,
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  listenBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  listenText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.slate,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  actionText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  refreshBtn: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center',
  },
  refreshText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
  },
  toastWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingHorizontal: spacing.md,
    pointerEvents: 'box-none',
  },
  toastCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: '#86EFAC',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
  },
  toastTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  toastIcon: {
    fontSize: 18,
  },
  toastBody: {
    flex: 1,
  },
  toastTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: Colors.ink,
  },
  toastReason: {
    fontSize: 10,
    color: '#15803D',
    marginTop: 2,
  },
  toastClose: {
    fontSize: 14,
    color: Colors.slate,
    paddingHorizontal: spacing.xs,
  },
  toastActions: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  toastBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  toastBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.slate,
  },
  toastViewBtn: {
    backgroundColor: Colors.primary,
  },
  toastViewText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
  },
});
