/**
 * Design tokens - "warm storybook on cream paper".
 *
 * Cream canvas, white cards on top of it, 50px rounding on everything, no
 * shadows and no gradients. Inter is the only face, pushed to display sizes
 * with tight tracking. Green is the structural accent (nav, selection,
 * toggles); coral is kept for the one main action on a screen.
 */
import { Platform } from 'react-native';

export const colors = {
  grass: '#8ed462',
  cream: '#f5f1e4',
  ink: '#2c2e2a',
  white: '#ffffff',
  sand: '#e0dbce',
  stone: '#80827f',
  mist: '#d5d5d4',
  sky: '#2ba0ff',
  coral: '#ff705d',
  sun: '#f5e211',
};

// Keys double as fontFamily names once App has loaded them.
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
};

export const radius = { round: 50, small: 10 };

/** Shared pieces every screen uses, so the three stay in step. */
export const ui = {
  screen: { flex: 1, backgroundColor: colors.cream },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.round,
    padding: 24,
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: fonts.medium,
    fontSize: 20,
    lineHeight: 25,
    color: colors.ink,
    marginBottom: 14,
    marginLeft: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.mist,
    borderRadius: radius.round,
    paddingHorizontal: 18,
    paddingVertical: 13,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.ink,
    marginBottom: 10,
    backgroundColor: colors.cream,
  },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.ink },
  muted: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.stone },
  mono: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    color: colors.ink,
  },
  // Pill chip; selected ones fill green.
  chip: {
    borderWidth: 1,
    borderColor: colors.mist,
    borderRadius: radius.round,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.white,
  },
  chipSelected: { backgroundColor: colors.grass, borderColor: colors.grass },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  // Small sticker label for a status; meaning is carried by its text.
  badge: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.ink,
    overflow: 'hidden',
    borderRadius: radius.round,
    paddingHorizontal: 12,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  // Closing yellow band at the bottom of a screen.
  footer: {
    backgroundColor: colors.sun,
    borderRadius: radius.round,
    paddingVertical: 22,
    alignItems: 'center',
    marginTop: 8,
  },
  footerText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
};
