/**
 * Screen headline: oversized Inter straight on the cream canvas, with an
 * animated character underneath. Purely decorative - nothing here is
 * interactive.
 */
import { StyleSheet, Text, View } from 'react-native';
import LottieView from 'lottie-react-native';
import { colors, fonts } from '../theme';

const SIZE = 64;

export default function Hero({ lines, tagline, character }) {
  return (
    <View style={styles.wrap}>
      {lines.map((line) => (
        <Text key={line} style={styles.display} numberOfLines={1} adjustsFontSizeToFit>
          {line}
        </Text>
      ))}
      {!!tagline && <Text style={styles.tagline}>{tagline}</Text>}
      {!!character && <LottieView source={character} autoPlay loop style={styles.character} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 16, marginBottom: 8, paddingHorizontal: 4 },
  display: {
    fontFamily: fonts.medium,
    fontSize: SIZE,
    lineHeight: SIZE * 1.02,
    letterSpacing: SIZE * -0.06,
    color: colors.ink,
  },
  tagline: {
    fontFamily: fonts.regular,
    fontSize: 18,
    lineHeight: 27,
    color: colors.ink,
    marginTop: 12,
  },
  character: { width: '100%', height: 220, marginTop: 4 },
});
