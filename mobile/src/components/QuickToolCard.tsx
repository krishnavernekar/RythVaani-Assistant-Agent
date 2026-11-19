import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors, spacing, tokens } from '../theme/tokens';
import { getLineHeight } from '../i18n/translations';

/**
 * Quick Tools card displayed in the 2×2 grid on the Home Dashboard.
 * Tapping the card navigates to the relevant screen.
 */
interface QuickToolCardProps {
  icon: string;
  labelEn: string;
  labelTe: string;
  subtitleEn: string;
  subtitleTe: string;
  route: string;
  accentBg?: string;
  /** Optional override — used when the tool opens an in-place modal instead of a route. */
  onPress?: () => void;
}

export function QuickToolCard({
  icon,
  labelEn,
  labelTe,
  subtitleEn,
  subtitleTe,
  route,
  accentBg = '#E8F5E9',
  onPress,
}: QuickToolCardProps) {
  const navigation = useNavigation<any>();

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => {
        if (onPress) {
          onPress();
          return;
        }
        navigation.navigate(route as any);
      }}
      activeOpacity={0.8}
      accessibilityRole="button"
    >
      <View style={[styles.iconBox, { backgroundColor: accentBg }]}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <Text style={styles.label}>{labelEn}</Text>
      <Text
        style={[
          styles.subtitle,
          { lineHeight: getLineHeight(11, 'te') },
        ]}
        numberOfLines={1}
      >
        {labelTe}
      </Text>
      <Text style={styles.hint} numberOfLines={1}>
        {subtitleEn}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    gap: spacing.sm,
    ...tokens.card,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 20,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.ink,
  },
  hint: {
    fontSize: 11,
    color: Colors.slate,
  },
});
