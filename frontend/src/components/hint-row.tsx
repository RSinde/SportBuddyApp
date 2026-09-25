import type { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { Spacing } from '@/constants/theme';
import { useTranslation } from '@/i18n';

type HintRowProps = {
  title?: string;
  hint?: ReactNode;
};

export function HintRow({ title, hint }: HintRowProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.stepRow}>
      <ThemedText type="small">{title ?? t('shared.hintRow.title')}</ThemedText>
      <ThemedView type="backgroundSelected" style={styles.codeSnippet}>
        <ThemedText themeColor="textSecondary">{hint ?? t('shared.hintRow.hint')}</ThemedText>
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  stepRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  codeSnippet: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
  },
});
