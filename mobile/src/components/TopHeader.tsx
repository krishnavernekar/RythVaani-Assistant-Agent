import React from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, spacing, tokens } from '../theme/tokens';
import { Language, useAppStore } from '../store/useAppStore';
import { getLineHeight } from '../i18n/translations';

interface TopHeaderProps {
  /** Shown below location, e.g. "RythuVaani AI • Home" */
  subtitle: string;
  /** Show back button (renders as "←") */
  showBack?: boolean;
  onBack?: () => void;
  /** Optional right-side action (e.g. notification bell) */
  onNotificationPress?: () => void;
}

/**
 * Reusable top bar matching the Stitch prototype:
 *   Location pill  |  Subtitle  |  Language toggle  |  Bell
 */
export function TopHeader({
  subtitle,
  showBack = false,
  onBack,
  onNotificationPress,
}: TopHeaderProps) {
  const insets = useSafeAreaInsets();
  const {
    language,
    setLanguage,
    farmer,
    unreadNotificationCount,
    setNotificationModalOpen,
  } = useAppStore();
  const isTelugu = language === 'te';
  const locationText = isTelugu
    ? farmer.mandalTe || farmer.mandal || 'గుంటూరు మండలం'
    : farmer.mandal || farmer.district || 'Guntur';

  const handleLangToggle = () => {
    const next: Language = isTelugu ? 'en' : 'te';
    setLanguage(next);
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + spacing.sm },
        tokens.bgCard,
      ]}
    >
      <View style={styles.row}>
        {/* Left side: Back / Location + Subtitle */}
        <View style={styles.left}>
          {showBack ? (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={onBack}
              hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
            >
              <Text style={styles.backText}>{'←'}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.locationPill} numberOfLines={1}>
              📍 {locationText}
            </Text>
          )}
          <Text
            style={[
              styles.subtitle,
              { lineHeight: getLineHeight(16, language) },
            ]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        </View>

        {/* Right side: Lang toggle + Bell */}
        <View style={styles.right}>
          <TouchableOpacity
            style={styles.langPill}
            onPress={handleLangToggle}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            aria-label="Toggle language"
          >
            <Text style={styles.langText}>
              {isTelugu ? 'తె / EN' : 'EN / తె'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bellBtn}
            onPress={onNotificationPress ?? (() => setNotificationModalOpen(true))}
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
            accessibilityLabel="Open smart alerts"
          >
            <Text style={styles.bellText}>🔔</Text>
            {unreadNotificationCount > 0 ? (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>
                  {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  left: {
    flex: 1,
    minWidth: 0,
  },
  locationPill: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.slate,
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primary,
    marginTop: 2,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  langPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 9999,
    backgroundColor: Colors.primarySoft,
    borderWidth: 1,
    borderColor: '#A5D6A7',
  },
  langText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
  },
  bellBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellText: {
    fontSize: 18,
  },
  bellBadge: {
    position: 'absolute',
    top: -4,
    right: -5,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  bellBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    lineHeight: 12,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  backText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.slate,
  },
});