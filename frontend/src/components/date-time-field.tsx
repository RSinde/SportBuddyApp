import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

export type DateTimeFieldProps = {
  label?: string;
  value: Date;
  onChange: (date: Date) => void;
};

export function DateTimeField({ label, value, onChange }: DateTimeFieldProps) {
  const [mode, setMode] = useState<'date' | 'time' | null>(null);

  if (Platform.OS === 'ios') {
    return (
      <View style={styles.iosRow}>
        {label ? <ThemedText style={styles.label}>{label}</ThemedText> : null}
        <DateTimePicker
          value={value}
          mode="datetime"
          themeVariant="dark" // Força o calendário nativo da Apple a abrir em modo escuro
          onChange={(_event: DateTimePickerEvent, picked?: Date) => {
            if (picked) onChange(picked);
          }}
        />
      </View>
    );
  }

  function handleChange(event: DateTimePickerEvent, picked?: Date) {
    setMode(null);
    if (event.type !== 'set' || !picked) return;
    onChange(picked);
  }

  return (
    <View style={styles.field}>
      {label ? <ThemedText style={styles.label}>{label}</ThemedText> : null}
      <View style={styles.row}>
        <Pressable style={styles.flex1} onPress={() => setMode('date')}>
          <View style={styles.input}>
            <ThemedText style={styles.inputText}>{value.toLocaleDateString()}</ThemedText>
          </View>
        </Pressable>
        <Pressable style={styles.flex1} onPress={() => setMode('time')}>
          <View style={styles.input}>
            <ThemedText style={styles.inputText}>
              {value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </ThemedText>
          </View>
        </Pressable>
      </View>
      {mode && (
        <DateTimePicker 
          value={value} 
          mode={mode} 
          themeVariant="dark" // Força o calendário nativo do Android a abrir em modo escuro
          onChange={handleChange} 
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  iosRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.two,
    backgroundColor: '#111012',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  label: {
    color: '#f4f2ef',
    fontWeight: 'bold',
    fontSize: 16,
  },
  flex1: {
    flex: 1,
  },
  input: {
    height: 52, // Mesma altura dos TextInput
    backgroundColor: '#111012',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12, // Mesmos cantos arredondados
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  inputText: {
    color: '#f4f2ef',
    fontSize: 16,
  },
});