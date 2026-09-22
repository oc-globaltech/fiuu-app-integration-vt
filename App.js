import { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import XDKPayment from './src/components/XDKPayment';
import VTPayment from './src/components/VTPayment';
import Transactions from './src/components/Transactions';
import { parseVTResponse } from './src/utils/vtDeepLink';
import { readPendingOrder } from './src/utils/pendingOrder';

export default function App() {
  const [activeTab, setActiveTab] = useState('xdk');
  // The VT app's return link, held here rather than in VTPayment. A screen only
  // listens while it is mounted, and this one is not mounted unless its tab is
  // open - so a link that cold-starts the app (iOS having killed us while the
  // VT app was in front) would land on the XDK tab and the result would be
  // dropped. Listening at the root means the return is caught whatever is on
  // screen, and we switch to the VT tab to show it.
  const [vtLink, setVtLink] = useState(null);

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

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'xdk' && styles.tabActive]}
          onPress={() => setActiveTab('xdk')}
        >
          <Text style={[styles.tabText, activeTab === 'xdk' && styles.tabTextActive]}>
            Mobile XDK
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'vt' && styles.tabActive]}
          onPress={() => setActiveTab('vt')}
        >
          <Text style={[styles.tabText, activeTab === 'vt' && styles.tabTextActive]}>
            Virtual Terminal
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'txn' && styles.tabActive]}
          onPress={() => setActiveTab('txn')}
        >
          <Text style={[styles.tabText, activeTab === 'txn' && styles.tabTextActive]}>
            Transactions
          </Text>
        </TouchableOpacity>
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
    backgroundColor: '#f8f9fa',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingTop: 50,
    paddingBottom: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 2,
  },
  tabActive: {
    backgroundColor: '#00a8e8',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#495057',
  },
  tabTextActive: {
    color: '#fff',
  },
  screen: {
    flex: 1,
  },
});
