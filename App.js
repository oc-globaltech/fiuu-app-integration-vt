import { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
// Per-weight paths: the package index would bundle every weight.
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import XDKPayment from './src/components/XDKPayment';
import VTPayment from './src/components/VTPayment';
import Transactions from './src/components/Transactions';
import { parseVTResponse } from './src/utils/vtDeepLink';
import { readPendingOrder } from './src/utils/pendingOrder';
import { colors, fonts, radius } from './src/theme';

const TABS = [
  { key: 'xdk', title: 'Mobile XDK' },
  { key: 'vt', title: 'Terminal' },
  { key: 'txn', title: 'Transactions' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('xdk');
  // The VT app's return link, held here rather than in VTPayment. A screen only
  // listens while it is mounted, and this one is not mounted unless its tab is
  // open - so a link that cold-starts the app (iOS having killed us while the
  // VT app was in front) would land on the XDK tab and the result would be
  // dropped. Listening at the root means the return is caught whatever is on
  // screen, and we switch to the VT tab to show it.
  const [vtLink, setVtLink] = useState(null);
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium });

  useEffect(() => {
    const receive = (url) => {
      if (!url || !parseVTResponse(url)) return;
      setActiveTab('vt');
      // Stamped so the same URL arriving twice still re-triggers the effect.
      setVtLink({ url, receivedAt: Date.now() });
    };

    const subscription = Linking.addEventListener('url', ({ url }) => receive(url));
    // Covers the cold start: the app was launched by the return link itself.
    Linking.getInitialURL().then(receive);

    // And the case with no link at all: iOS reclaimed us during a payment and
    // the user reopened the app by hand. An order left outstanding on disk
    // means a tap may have completed, so open the tab that will confirm it.
    if (readPendingOrder()) setActiveTab('vt');

    return () => subscription.remove();
  }, []);

  // The link listener above is already running, so nothing is missed while the
  // fonts load; the screens just wait for them so no text renders unstyled.
  // A font that fails to load falls back to the system face rather than
  // leaving a blank screen - which would also hide a VT result.
  if (!fontsLoaded && !fontError) return <View style={styles.container} />;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.tabBar}>
        {TABS.map(({ key, title }) => {
          const active = activeTab === key;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setActiveTab(key)}
            >
              <Text
                style={styles.tabText}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {title}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.screen}>
        {activeTab === 'xdk' && <XDKPayment />}
        {activeTab === 'vt' && <VTPayment incomingLink={vtLink} />}
        {activeTab === 'txn' && <Transactions />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  // Floating white pill on the cream: the nav's lift is the colour change alone.
  tabBar: {
    flexDirection: 'row',
    marginTop: 58,
    marginHorizontal: 16,
    padding: 5,
    gap: 4,
    borderRadius: radius.round,
    backgroundColor: colors.white,
  },
  tab: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderRadius: radius.round,
  },
  tabActive: {
    backgroundColor: colors.grass,
  },
  tabText: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.ink,
  },
  screen: {
    flex: 1,
  },
});
