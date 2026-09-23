/**
 * The app's one button. A pill with a small circle at its right edge - the dot,
 * not a loud fill, is what says "this does something".
 *
 * action: coral fill, white dot. The single main action on a screen.
 * ghost:  white with a hairline, blue dot. Everything else.
 */
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts, radius } from '../theme';

export default function Pill({ title, onPress, variant = 'ghost', disabled, style }) {
  const action = variant === 'action';
  return (
    <TouchableOpacity
      style={[styles.pill, action ? styles.action : styles.ghost, disabled && styles.disabled, style]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.text, action && styles.actionText]} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.dot, { backgroundColor: action ? colors.white : colors.sky }]} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.round,
    paddingVertical: 11,
    paddingLeft: 20,
    paddingRight: 12,
    gap: 10,
  },
  action: { backgroundColor: colors.coral, paddingVertical: 17 },
  ghost: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.mist },
  disabled: { opacity: 0.4 },
  text: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  actionText: { fontSize: 17, color: colors.white },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
