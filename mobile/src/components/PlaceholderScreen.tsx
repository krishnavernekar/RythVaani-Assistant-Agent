import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, spacing, tokens } from '../theme/tokens';

/**
 * Placeholder screen – replaced as each EPIC is implemented.
 * Shows a clear label so the navigation shell compiles and runs cleanly.
 */
interface PlaceholderScreenProps {
  title: string;
  subtitle: string;
}

export function PlaceholderScreen({ title, subtitle }: PlaceholderScreenProps) {
  return (
    <View style={tokens.screenWrapper}>
      <View style={tokens.screenContent}>
        <View style={styles.center}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          <Text style={styles.comingSoon}>[Placeholder — Epic in progress]</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.primary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: Colors.slate,
    textAlign: 'center',
  },
  comingSoon: {
    marginTop: spacing.md,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.warningText,
    backgroundColor: Colors.warning,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 9999,
  },
});
