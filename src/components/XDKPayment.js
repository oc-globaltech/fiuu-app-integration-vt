import { useState } from 'react';
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
  Switch,
} from 'react-native';
import { startPayment } from 'fiuu-mobile-xdk-expo';
import { parsePaymentResult, STATUS_COLORS } from '../utils/paymentResult';
import Hero from './Hero';
import Pill from './Pill';
import { colors, fonts, radius, ui } from '../theme';
import { confirmPayment } from '../utils/paymentStatus';
import {
  CHANNEL_GROUPS,
  MULTI_CHANNEL,
  channelName,
  isCreditChannel,
} from '../config/channels';
import {
  FIUU_MERCHANT_ID,
  FIUU_VERIFICATION_KEY,
  FIUU_USERNAME,
  FIUU_PASSWORD,
  FIUU_APP_NAME,
  FIUU_SANDBOX_MODE,
} from '@env';

export default function XDKPayment() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const [merchantId, setMerchantId] = useState(FIUU_MERCHANT_ID || '');
  const [verificationKey, setVerificationKey] = useState(FIUU_VERIFICATION_KEY || '');
  const [username, setUsername] = useState(FIUU_USERNAME || '');
  const [password, setPassword] = useState(FIUU_PASSWORD || '');
  const [appName, setAppName] = useState(FIUU_APP_NAME || '');

  const [amount, setAmount] = useState('1.10');
  const [orderId, setOrderId] = useState(`ORDER-${Date.now()}`);
  const [channel, setChannel] = useState(MULTI_CHANNEL);
  const [channelOpen, setChannelOpen] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [currency, setCurrency] = useState('MYR');
  const [country, setCountry] = useState('MY');
  const [billName, setBillName] = useState('');
  const [billEmail, setBillEmail] = useState('');
  const [billMobile, setBillMobile] = useState('');
  const [billDescription, setBillDescription] = useState('');
  const [sandboxMode, setSandboxMode] = useState(
    FIUU_SANDBOX_MODE === 'false' ? false : true
  );

  const handleStartPayment = () => {
    if (!merchantId || !verificationKey) {
      Alert.alert('Error', 'Please enter your Merchant ID and Verification Key.');
      return;
    }

    if (!amount || parseFloat(amount) < 1.01) {
      Alert.alert('Error', 'Amount must be at least 1.01');
      return;
    }

    const paymentDetails = {
      mp_dev_mode: sandboxMode,
      mp_username: username,
      mp_password: password,
      mp_merchant_ID: merchantId,
      mp_app_name: appName || 'FiuuApp',
      mp_verification_key: verificationKey,

      mp_amount: amount,
      mp_order_ID: orderId,
      mp_currency: currency,
      mp_country: country,

      mp_bill_description: billDescription || 'Payment via Fiuu XDK',
      mp_bill_name: billName || 'Customer',
      mp_bill_email: billEmail || 'customer@example.com',
      mp_bill_mobile: billMobile || '+60123456789',

      mp_channel: channel,
      mp_channel_editing: true,
      mp_editing_enabled: true,
      mp_sandbox_mode: false,
      // Express mode skips Fiuu's payment info page, so it needs one specific
      // channel. Credit channels cannot use it (Fiuu security requirement).
      mp_express_mode: channel !== MULTI_CHANNEL && !isCreditChannel(channel),
      mp_language: 'EN',
      mp_core_env: '4',
    };

    console.log('Sending payment details:', JSON.stringify(paymentDetails, null, 2));

    setLoading(true);
    setResult(null);
    setConfirmation(null);

    startPayment(paymentDetails, (paymentResult) => {
      setLoading(false);
      console.log('Fiuu Payment Result:', paymentResult);

      const parsed = parsePaymentResult(paymentResult);
      setResult(parsed);
      Alert.alert(
        `Payment ${parsed.status}`,
        parsed.message || `Order ${parsed.orderId || orderId}`
      );

      // The device's word is not proof. Ask our server what Fiuu actually
      // notified, which is the record that counts.
      setConfirmation({ state: 'checking' });
      confirmPayment(parsed.orderId || orderId).then(setConfirmation);
    });
  };

  const generateNewOrderId = () => {
    setOrderId(`ORDER-${Date.now()}`);
  };

  const renderConfirmation = () => {
    if (!confirmation) return null;

    const { state, payment, error } = confirmation;
    const text = {
      checking: 'Checking with server\u2026',
      confirmed: `Confirmed by server (txn ${payment?.txn_id || 'n/a'})`,
      recorded: `Server recorded status ${payment?.status}${payment?.verified ? '' : ' (skey did NOT verify)'}`,
      pending: 'No webhook received yet - not confirmed',
      unavailable: `Could not reach server${error ? `: ${error}` : ''}`,
    }[state];

    const color = state === 'confirmed' ? STATUS_COLORS.SUCCESS
      : state === 'recorded' ? STATUS_COLORS.FAILED
      : STATUS_COLORS.PENDING;

    return <Text style={[styles.confirmLine, { backgroundColor: color }]}>{text}</Text>;
  };

  const renderResult = () => {
    if (!result) return null;

    const { status, message, fields, txnId, orderId: resultOrderId, amount: paidAmount } = result;
    const statusColor = STATUS_COLORS[status] || STATUS_COLORS.FAILED;

    return (
      <View style={styles.resultCard}>
        <Text style={[styles.resultTitle, { backgroundColor: statusColor }]}>
          Payment {status}
        </Text>
        {!!message && <Text style={styles.resultLabel}>{message}</Text>}
        {!!txnId && <Text style={styles.resultLabel}>Transaction: {txnId}</Text>}
        {!!resultOrderId && (
          <Text style={styles.resultLabel}>Order: {resultOrderId}</Text>
        )}
        {!!paidAmount && (
          <Text style={styles.resultLabel}>
            Amount: {paidAmount} {fields.currency || ''}
          </Text>
        )}
        {renderConfirmation()}
        <Text style={styles.rawLabel}>Raw response</Text>
        <Text style={styles.resultText}>{JSON.stringify(fields, null, 2)}</Text>
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
            lines={['Mobile XDK']}
            tagline="Take a payment in-app with the Fiuu SDK."
            character={require('../../assets/lottie/pay.json')}
          />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Merchant Credentials</Text>
            <TextInput
              style={styles.input}
              placeholderTextColor={colors.stone}
              placeholder="Merchant ID *"
              value={merchantId}
              onChangeText={setMerchantId}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholderTextColor={colors.stone}
              placeholder="Verification Key *"
              value={verificationKey}
              onChangeText={setVerificationKey}
              autoCapitalize="none"
              secureTextEntry
            />
            <TextInput
              style={styles.input}
              placeholderTextColor={colors.stone}
              placeholder="Username (optional)"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholderTextColor={colors.stone}
              placeholder="Password (optional)"
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              secureTextEntry
            />
            <TextInput
              style={styles.input}
              placeholderTextColor={colors.stone}
              placeholder="App Name (optional)"
              value={appName}
              onChangeText={setAppName}
            />
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Sandbox Mode</Text>
              <Switch
                value={sandboxMode}
                onValueChange={setSandboxMode}
                trackColor={{ false: colors.sand, true: colors.grass }}
                thumbColor={colors.white}
                ios_backgroundColor={colors.sand}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Details</Text>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.flex1, styles.marginRight]}
                placeholderTextColor={colors.stone}
                placeholder="Amount * (min 1.01)"
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
                placeholder="Order ID"
                value={orderId}
                onChangeText={setOrderId}
              />
              <Pill title="New ID" onPress={generateNewOrderId} style={styles.smallButton} />
            </View>

            <TouchableOpacity
              style={styles.channelSelect}
              onPress={() => setChannelOpen((open) => !open)}
            >
              <View style={styles.flex1}>
                <Text style={styles.channelSelectLabel}>Payment Channel</Text>
                <Text style={styles.channelSelectValue}>{channelName(channel)}</Text>
              </View>
              <Text style={styles.channelChevron}>{channelOpen ? '\u25B2' : '\u25BC'}</Text>
            </TouchableOpacity>

            {channelOpen && (
              <View style={styles.channelPanel}>
                <TouchableOpacity
                  style={[
                    styles.chip,
                    channel === MULTI_CHANNEL && styles.chipSelected,
                  ]}
                  onPress={() => {
                    setChannel(MULTI_CHANNEL);
                    setChannelOpen(false);
                  }}
                >
                  <Text
                    style={styles.chipText}
                  >
                    All channels (let Fiuu show the list)
                  </Text>
                </TouchableOpacity>

                {CHANNEL_GROUPS.map((group) => (
                  <View key={group.group}>
                    <Text style={styles.channelGroup}>{group.group}</Text>
                    <View style={styles.chipRow}>
                      {group.items.map((item) => {
                        const selected = channel === item.code;
                        return (
                          <TouchableOpacity
                            key={item.code}
                            style={[styles.chip, selected && styles.chipSelected]}
                            onPress={() => {
                              setChannel(item.code);
                              setChannelOpen(false);
                            }}
                          >
                            <Text
                              style={styles.chipText}
                            >
                              {item.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>
            )}
            <TextInput
              style={styles.input}
              placeholderTextColor={colors.stone}
              placeholder="Country (e.g. MY, SG, ID)"
              value={country}
              onChangeText={setCountry}
              autoCapitalize="characters"
              maxLength={2}
            />
            <TextInput
              style={styles.input}
              placeholderTextColor={colors.stone}
              placeholder="Bill Name"
              value={billName}
              onChangeText={setBillName}
            />
            <TextInput
              style={styles.input}
              placeholderTextColor={colors.stone}
              placeholder="Bill Email"
              value={billEmail}
              onChangeText={setBillEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholderTextColor={colors.stone}
              placeholder="Bill Mobile"
              value={billMobile}
              onChangeText={setBillMobile}
              keyboardType="phone-pad"
            />
            <TextInput
              style={styles.input}
              placeholderTextColor={colors.stone}
              placeholder="Bill Description"
              value={billDescription}
              onChangeText={setBillDescription}
            />
          </View>

          <Pill
            variant="action"
            title={loading ? 'Processing...' : 'Pay with Fiuu'}
            onPress={handleStartPayment}
            disabled={loading}
            style={styles.payButton}
          />

          {renderResult()}

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Fiuu Mobile XDK v1.0.6 | Expo SDK 57
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
  section: ui.card,
  sectionTitle: ui.sectionTitle,
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginLeft: 4,
  },
  toggleLabel: ui.body,
  payButton: {
    marginBottom: 16,
  },
  confirmLine: {
    ...ui.badge,
    fontSize: 13,
    paddingVertical: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  channelSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.round,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginBottom: 10,
    backgroundColor: colors.sand,
  },
  channelSelectLabel: {
    ...ui.muted,
    fontSize: 12,
    lineHeight: 16,
    color: colors.ink,
  },
  channelSelectValue: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.ink,
  },
  channelChevron: {
    fontSize: 12,
    color: colors.ink,
    marginLeft: 8,
  },
  channelPanel: {
    borderRadius: 30,
    padding: 16,
    marginBottom: 10,
    backgroundColor: colors.cream,
  },
  channelGroup: {
    ...ui.muted,
    fontFamily: fonts.medium,
    marginTop: 10,
    marginBottom: 6,
    marginLeft: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    ...ui.chip,
    marginRight: 6,
    marginBottom: 6,
  },
  chipSelected: ui.chipSelected,
  chipText: ui.chipText,
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
    marginBottom: 2,
  },
  rawLabel: {
    ...ui.muted,
    fontFamily: fonts.medium,
    marginTop: 12,
    marginBottom: 6,
  },
  resultText: ui.mono,
  footer: ui.footer,
  footerText: ui.footerText,
});
