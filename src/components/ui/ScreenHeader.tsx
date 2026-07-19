import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, font, space } from '@/constants/theme';

interface Props {
  title: string;
  showBack?: boolean;
  backTo?: string;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightPress?: () => void;
  rightBadge?: React.ReactNode;
}

export default function ScreenHeader({ title, showBack, backTo, rightIcon, onRightPress, rightBadge }: Props) {
  const router = useRouter();
  const onBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else if (backTo) {
      router.replace(backTo as any);
    }
  };
  return (
    <View style={styles.header}>
      <View style={styles.side}>
        {showBack && (
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.side, styles.right]}>
        {rightBadge}
        {rightIcon && (
          <TouchableOpacity onPress={onRightPress} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name={rightIcon} size={22} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.md,
    minHeight: 56,
  },
  side: { width: 60, justifyContent: 'center' },
  right: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm },
  title: {
    flex: 1,
    textAlign: 'center',
    color: colors.text,
    fontSize: font.md,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
