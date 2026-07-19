import React, { useState } from 'react';
import { View, TextInput, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { colors, font, radius, space } from '@/constants/theme';

interface Props {
  value: string;
  onChangeValue: (raw: string) => void;
  placeholder?: string;
  editable?: boolean;
  style?: StyleProp<ViewStyle>;
  borderColor?: string;
  textAlign?: 'left' | 'center' | 'right';
}

function toRaw(text: string): string {
  let cleaned = text.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length > 2) cleaned = `${parts[0]}.${parts.slice(1).join('')}`;
  return cleaned;
}

export default function CurrencyInput({
  value,
  onChangeValue,
  placeholder = '$0.00',
  editable = true,
  style,
  borderColor,
  textAlign = 'center',
}: Props) {
  const [focused, setFocused] = useState(false);

  const raw = toRaw(value);

  const displayValue = (() => {
    if (focused) {
      return raw ? `$${raw}` : '$';
    }
    const num = Number(raw || 0);
    const formatted = Math.abs(num).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const sign = num < 0 ? '-' : '';
    return `${sign}$${formatted}`;
  })();

  const handleChange = (text: string) => {
    onChangeValue(toRaw(text));
  };

  const handleBlur = () => {
    setFocused(false);
    const normalized = Number(raw || 0).toFixed(2);
    onChangeValue(normalized);
  };

  return (
    <View
      style={[
        styles.wrap,
        style,
        { borderColor: borderColor ?? (focused ? colors.inputBorderFocus : colors.inputBorder) },
      ]}
    >
      <TextInput
        value={displayValue}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={handleBlur}
        keyboardType="decimal-pad"
        placeholder={placeholder}
        placeholderTextColor={colors.subtext}
        editable={editable}
        style={[styles.input, { textAlign }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 44,
    backgroundColor: colors.inputBg,
    borderRadius: radius.input,
    borderWidth: 1,
    paddingHorizontal: space.sm,
    justifyContent: 'center',
  },
  input: {
    color: colors.text,
    fontSize: font.sm,
    fontWeight: '700',
    height: '100%',
    paddingVertical: 0,
  },
});
