import { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as Linking from 'expo-linking';
import { AppState } from 'react-native';
import {
  buildVTSaleUrl,
  buildVTStatusUrl,
  buildVTVoidUrl,
  parseVTResponse,
  isVTAppInstalled,
} from '../utils/vtDeepLink';
import { confirmPayment } from '../utils/paymentStatus';
import {
  savePendingOrder,
  readPendingOrder,
  clearPendingOrder,
} from '../utils/pendingOrder';

export default function VTPayment({ incomingLink }) {
  const [vtInstalled, setVtInstalled] = useState(false);
  const [result, setResult] = useState(null);

  // Transaction fields
  const [opType, setOpType] = useState('SALE');
  const [amount, setAmount] = useState('1.01');
  const [orderId, setOrderId] = useState(`VT-${Date.now()}`);
  const [currency, setCurrency] = useState('MYR');
  const [channel, setChannel] = useState('CARD');
  const [payType, setPayType] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  // The order we are waiting on. A ref so the AppState listener always reads
  // the current value rather than the one captured when it was registered.
  const pendingOrder = useRef(null);

  // The VT app's return link is caught by App, which listens at the root so a
  // link that cold-starts the app is not missed while this screen is unmounted.
  useEffect(() => {
    if (incomingLink?.url) handleDeepLink({ url: incomingLink.url });
  }, [incomingLink]);

  useEffect(() => {
    // Check if VT app is installed
    isVTAppInstalled().then(setVtInstalled);

    // iOS may have reclaimed us while the VT app was in front. If an order was
    // outstanding when that happened, it is on disk - pick it up and confirm,
    // so a tap is not lost just because the app restarted.
    const outstanding = readPendingOrder();
    if (outstanding) {
      pendingOrder.current = outstanding.orderId;
      setOrderId(outstanding.orderId);
      checkServer(outstanding.orderId);
    }

    // iOS suspends our timers while the VT app is in front, so the deep link is
    // not the only way back - the cashier may just switch apps. Whenever we
    // become active again with a sale outstanding, ask the server what Fiuu
    // notified. This is what makes a card tap detectable even if VT never
    // deep-links back to us.
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && pendingOrder.current) {
        checkServer(pendingOrder.current);
      }
    });

    return () => appStateSub.remove();
  }, []);

  const checkServer = (id) => {
    setConfirmation({ state: 'checking' });
    // A terminal tap takes a while: poll for roughly two minutes.
    confirmPayment(id, { attempts: 20, delayMs: 2000, maxDelayMs: 6000 }).then(
      (outcome) => {
        setConfirmation(outcome);
        // Only stop waiting once the server has actually answered about it.
        if (outcome.state === 'confirmed' || outcome.state === 'recorded') {
          pendingOrder.current = null;
          clearPendingOrder();
        }
      },
    );
  };

  const handleDeepLink = (event) => {
    const parsed = parseVTResponse(event.url);
    if (parsed) {
      setResult(parsed);
      console.log('VT Response:', parsed);

      // Say plainly what happened, so returning from the VT app cannot look
      // like nothing happened.
      if (parsed.type === 'ERROR') {
        Alert.alert('Payment ERROR', parsed.errorMsg || parsed.errorCode || 'Unknown error');
      } else {
        const label = parsed.status === '00' ? 'SUCCESS'
          : parsed.status === '22' ? 'PENDING'
          : parsed.status === '44' ? 'VOIDED'
          : 'FAILED';
        Alert.alert(
          `Payment ${label}`,
          `Order ${parsed.orderId || ''}${parsed.amount ? ` - ${parsed.currency || ''} ${parsed.amount}` : ''}`
            + '\n\nConfirming with the server...',
        );
      }

      // The deep link is the device's account of the payment. Confirm it
      // against what Fiuu actually notified before treating it as money.
      if (parsed.orderId) checkServer(parsed.orderId);
    }
  };

  const handleSale = async () => {
    if (!vtInstalled) {
      Alert.alert('Error', 'Fiuu VT app is not installed on this device.');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount.');
      return;
    }

    if (!orderId) {
      Alert.alert('Error', 'Please enter an order ID.');
      return;
    }

    const url = buildVTSaleUrl({
      currency,
      amount,
      orderId,
      channel,
      payType: channel.includes('RPP') ? '2' : undefined,
    });

    console.log('Opening VT SALE:', url);
    setResult(null);
    setConfirmation(null);
    pendingOrder.current = orderId;
    savePendingOrder(orderId);
    await Linking.openURL(url);
  };

  const handleStatus = async () => {
    if (!vtInstalled) {
      Alert.alert('Error', 'Fiuu VT app is not installed on this device.');
      return;
    }

    if (!orderId) {
      Alert.alert('Error', 'Please enter an order ID.');
      return;
    }

    const url = buildVTStatusUrl(orderId);
    console.log('Opening VT STATUS:', url);
    setResult(null);
    await Linking.openURL(url);
  };

  const handleVoid = async () => {
    if (!vtInstalled) {
      Alert.alert('Error', 'Fiuu VT app is not installed on this device.');
      return;
    }

    if (!orderId) {
      Alert.alert('Error', 'Please enter an order ID.');
      return;
    }

    Alert.alert(
      'Confirm Void',
      `Are you sure you want to void order ${orderId}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Void',
          style: 'destructive',
          onPress: async () => {
            const url = buildVTVoidUrl(orderId);
            console.log('Opening VT VOID:', url);
            setResult(null);
            await Linking.openURL(url);
          },
        },
      ]
    );
  };

  const generateNewOrderId = () => {
    setOrderId(`VT-${Date.now()}`);
  };

  const renderConfirmation = () => {
    if (!confirmation) return null;

    const { state, payment, error } = confirmation;
    const text = {
      checking: 'Waiting for Fiuu to notify our server\u2026',
      confirmed: `Payment confirmed by server (txn ${payment?.txn_id || 'n/a'})`,
      recorded: `Server recorded status ${payment?.status}${payment?.verified ? '' : ' (skey did NOT verify)'}`,
      pending: 'No webhook received - payment not confirmed',
      unavailable: `Could not reach server${error ? `: ${error}` : ''}`,
    }[state];

    const color = state === 'confirmed' ? '#28a745'
      : state === 'recorded' ? '#dc3545'
      : '#ffc107';

    return (
      <View style={[styles.resultCard, { borderLeftColor: color }]}>
        <Text style={[styles.resultTitle, { color }]}>Server</Text>
        <Text style={styles.resultLabel}>{text}</Text>
      </View>
    );
  };

  const renderResult = () => {
    if (!result) return null;

    const isError = result.type === 'ERROR';
    const isSuccess = result.status === '00';
    const statusColor = isError ? '#dc3545' : isSuccess ? '#28a745' : '#ffc107';
    const statusText = isError
      ? 'ERROR'
      : isSuccess
      ? 'SUCCESS'
      : result.opType || 'RESPONSE';

    return (
      <View style={[styles.resultCard, { borderLeftColor: statusColor }]}>
        <Text style={[styles.resultTitle, { color: statusColor }]}>
          {statusText}
        </Text>
        <Text style={styles.resultLabel}>Response:</Text>
        <Text style={styles.resultText}>
          {JSON.stringify(result, null, 2)}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <Text style={styles.header}>Fiuu Virtual Terminal</Text>
          <Text style={styles.subHeader}>App-to-App Deep Link SDK</Text>

          {!vtInstalled && (
            <View style={styles.warningCard}>
              <Text style={styles.warningText}>
                Fiuu VT app is not installed. Please install it from the App Store / Play Store.
              </Text>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Operation Type</Text>
            <View style={styles.opTypeRow}>
              {['SALE', 'STATUS', 'VOID'].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.opTypeButton,
                    opType === type && styles.opTypeButtonActive,
                  ]}
                  onPress={() => setOpType(type)}
                >
                  <Text
                    style={[
                      styles.opTypeButtonText,
                      opType === type && styles.opTypeButtonTextActive,
                    ]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Transaction Details</Text>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.flex1, styles.marginRight]}
                placeholder="Amount *"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
              />
              <TextInput
                style={[styles.input, styles.flex1]}
                placeholder="Currency"
                value={currency}
                onChangeText={setCurrency}
              />
            </View>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.flex1, styles.marginRight]}
                placeholder="Order ID *"
                value={orderId}
                onChangeText={setOrderId}
              />
              <TouchableOpacity style={styles.smallButton} onPress={generateNewOrderId}>
                <Text style={styles.smallButtonText}>New ID</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Channel (e.g. CARD, RPP_DuitNowQR-Offline)"
              value={channel}
              onChangeText={setChannel}
            />
            {channel.includes('RPP') && (
              <TextInput
                style={styles.input}
                placeholder="Pay Type (e.g. 2 for e-wallet)"
                value={payType}
                onChangeText={setPayType}
                keyboardType="numeric"
              />
            )}
          </View>

          {opType === 'SALE' && (
            <TouchableOpacity
              style={[styles.actionButton, !vtInstalled && styles.actionButtonDisabled]}
              onPress={handleSale}
              disabled={!vtInstalled}
            >
              <Text style={styles.actionButtonText}>Sale Transaction</Text>
            </TouchableOpacity>
          )}

          {opType === 'STATUS' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.statusButton, !vtInstalled && styles.actionButtonDisabled]}
              onPress={handleStatus}
              disabled={!vtInstalled}
            >
              <Text style={styles.actionButtonText}>Check Status</Text>
            </TouchableOpacity>
          )}

          {opType === 'VOID' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.voidButton, !vtInstalled && styles.actionButtonDisabled]}
              onPress={handleVoid}
              disabled={!vtInstalled}
            >
              <Text style={styles.actionButtonText}>Void Transaction</Text>
            </TouchableOpacity>
          )}

          {renderConfirmation()}
          {renderResult()}

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Fiuu VT SDK v1.0 | Deep Link Integration
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1a1a2e',
    textAlign: 'center',
    marginTop: 20,
  },
  subHeader: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  warningCard: {
    backgroundColor: '#fff3cd',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  warningText: {
    color: '#856404',
    fontSize: 14,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  opTypeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  opTypeButton: {
    flex: 1,
    paddingVertical: 10,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#e9ecef',
    alignItems: 'center',
  },
  opTypeButtonActive: {
    backgroundColor: '#00a8e8',
  },
  opTypeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
  },
  opTypeButtonTextActive: {
    color: '#fff',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 10,
    backgroundColor: '#fafafa',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flex1: {
    flex: 1,
  },
  marginRight: {
    marginRight: 8,
  },
  smallButton: {
    backgroundColor: '#e9ecef',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  smallButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#495057',
  },
  actionButton: {
    backgroundColor: '#00a8e8',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  statusButton: {
    backgroundColor: '#6c757d',
  },
  voidButton: {
    backgroundColor: '#dc3545',
  },
  actionButtonDisabled: {
    backgroundColor: '#adb5bd',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  resultLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 4,
  },
  resultText: {
    fontSize: 13,
    color: '#333',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  footer: {
    alignItems: 'center',
    marginTop: 8,
  },
  footerText: {
    fontSize: 12,
    color: '#aaa',
  },
});
