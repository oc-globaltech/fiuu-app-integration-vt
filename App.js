import { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import XDKPayment from './src/components/XDKPayment';
import VTPayment from './src/components/VTPayment';
import Transactions from './src/components/Transactions';

export default function App() {
  const [activeTab, setActiveTab] = useState('xdk');

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
        {activeTab === 'vt' && <VTPayment />}
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
