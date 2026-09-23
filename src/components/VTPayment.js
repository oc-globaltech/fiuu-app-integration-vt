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
import { STATUS_COLORS } from '../utils/paymentResult';
import Hero from './Hero';
import Pill from './Pill';
import { colors, fonts, ui } from '../theme';

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
      // Not after a VOID: our server only records payment notifications, so it
      // would still find the original sale and report the order as paid.
      if (parsed.orderId && (parsed.opType || opType) !== 'VOID') checkServer(parsed.orderId);
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

    const color = state === 'confirmed' ? STATUS_COLORS.SUCCESS
      : state === 'recorded' ? STATUS_COLORS.FAILED
      : STATUS_COLORS.PENDING;

    return (
      <View style={styles.resultCard}>
        <Text style={[styles.resultTitle, { backgroundColor: color }]}>Server</Text>
        <Text style={styles.resultLabel}>{text}</Text>
      </View>
    );
  };

  const renderResult = () => {
    if (!result) return null;

    const isError = result.type === 'ERROR';
    const isSuccess = result.status === '00';
    const statusColor = isError ? STATUS_COLORS.FAILED
      : isSuccess ? STATUS_COLORS.SUCCESS
      : STATUS_COLORS.PENDING;
    const statusText = isError
      ? 'ERROR'
      : isSuccess
      ? 'SUCCESS'
      : result.opType || 'RESPONSE';

    return (
      <View style={styles.resultCard}>
        <Text style={[styles.resultTitle, { backgroundColor: statusColor }]}>
          {statusText}
        </Text>
        <Text style={styles.rawLabel}>Response</Text>
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
          <Hero
            lines={['Virtual', 'Terminal']}
            tagline="Hand off to the Fiuu VT app, tap, come back."
            character={require('../../assets/lottie/terminal.json')}
          />

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
                    style={styles.opTypeButtonText}
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
                placeholderTextColor={colors.stone}
                placeholder="Amount *"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
              />
              <TextInput
                style={[styles.input, styles.flex1]}
                placeholderTextColor={colors.stone}
                placeholder="Currency"
                value={currency}
                onChangeText={setCurrency}
              />
            </View>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.flex1, styles.marginRight]}
                placeholderTextColor={colors.stone}
                placeholder="Order ID *"
                value={orderId}
                onChangeText={setOrderId}
              />
              <Pill title="New ID" onPress={generateNewOrderId} style={styles.smallButton} />
            </View>
            <TextInput
              style={styles.input}
              placeholderTextColor={colors.stone}
              placeholder="Channel (e.g. CARD, RPP_DuitNowQR-Offline)"
              value={channel}
              onChangeText={setChannel}
            />
            {channel.includes('RPP') && (
              <TextInput
                style={styles.input}
                placeholderTextColor={colors.stone}
                placeholder="Pay Type (e.g. 2 for e-wallet)"
                value={payType}
                onChangeText={setPayType}
                keyboardType="numeric"
              />
            )}
          </View>

          <Pill
            variant="action"
            title={{ SALE: 'Sale Transaction', STATUS: 'Check Status', VOID: 'Void Transaction' }[opType]}
            onPress={{ SALE: handleSale, STATUS: handleStatus, VOID: handleVoid }[opType]}
            disabled={!vtInstalled}
            style={styles.actionButton}
          />

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
  safeArea: ui.screen,
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 48,
  },
  warningCard: {
    ...ui.card,
    backgroundColor: colors.sand,
  },
  warningText: ui.body,
  section: ui.card,
  sectionTitle: ui.sectionTitle,
  opTypeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  opTypeButton: {
    ...ui.chip,
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  opTypeButtonActive: ui.chipSelected,
  opTypeButtonText: ui.chipText,
  input: ui.input,
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
    marginBottom: 10,
  },
  actionButton: {
    marginBottom: 16,
  },
  resultCard: ui.card,
  resultTitle: {
    ...ui.badge,
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 12,
  },
  resultLabel: {
    ...ui.body,
    marginBottom: 4,
  },
  rawLabel: {
    ...ui.muted,
    fontFamily: fonts.medium,
    marginBottom: 6,
  },
  resultText: ui.mono,
  footer: ui.footer,
  footerText: ui.footerText,
});
