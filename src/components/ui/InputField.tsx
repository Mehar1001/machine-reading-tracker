import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardTypeOptions,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, font, space } from '@/constants/theme';

interface Props {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  secure?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  borderColor?: string;
  editable?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  secure,
  keyboardType,
  autoCapitalize = 'none',
  borderColor,
  editable = true,
  style,
}: Props) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secure);

  const activeBorder = borderColor ?? (focused ? colors.inputBorderFocus : colors.inputBorder);

  return (
    <View style={[styles.wrap, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputRow, { borderColor: activeBorder }, !editable && styles.disabled]}>
        {icon && <Ionicons name={icon} size={18} color={colors.subtext} style={styles.leftIcon} />}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.subtext}
          secureTextEntry={hidden}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={styles.input}
        />
        {secure && (
          <TouchableOpacity onPress={() => setHidden((h) => !h)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={18} color={colors.subtext} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.md },
  label: { color: colors.subtext, fontSize: font.xs, fontWeight: '600', marginBottom: space.xs, textTransform: 'uppercase' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    backgroundColor: colors.inputBg,
    borderRadius: radius.input,
    borderWidth: 0.5,
    borderColor: colors.borderStrong,
    paddingHorizontal: space.md,
  },
  disabled: { opacity: 0.6, backgroundColor: colors.surface },
  leftIcon: { marginRight: space.sm },
  input: { flex: 1, color: colors.text, fontSize: font.sm, height: 48, paddingVertical: 0 },
});
