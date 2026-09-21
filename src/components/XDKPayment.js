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
import { StatusBar } from 'expo-status-bar';
import { startPayment } from 'fiuu-mobile-xdk-expo';
import { parsePaymentResult, STATUS_COLORS } from '../utils/paymentResult';
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

    startPayment(paymentDetails, (paymentResult) => {
      setLoading(false);
      console.log('Fiuu Payment Result:', paymentResult);

      const parsed = parsePaymentResult(paymentResult);
      setResult(parsed);
      Alert.alert(
        `Payment ${parsed.status}`,
        parsed.message || `Order ${parsed.orderId || orderId}`
      );
    });
  };

  const generateNewOrderId = () => {
    setOrderId(`ORDER-${Date.now()}`);
  };

  const renderResult = () => {
    if (!result) return null;

    const { status, message, fields, txnId, orderId: resultOrderId, amount: paidAmount } = result;
    const statusColor = STATUS_COLORS[status] || STATUS_COLORS.FAILED;

    return (
      <View style={[styles.resultCard, { borderLeftColor: statusColor }]}>
        <Text style={[styles.resultTitle, { color: statusColor }]}>
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
        <Text style={styles.resultLabel}>Raw response:</Text>
        <Text style={styles.resultText}>{JSON.stringify(fields, null, 2)}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="auto" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <Text style={styles.header}>Fiuu Mobile XDK</Text>
          <Text style={styles.subHeader}>Payment Integration Demo</Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Merchant Credentials</Text>
            <TextInput
              style={styles.input}
              placeholder="Merchant ID *"
              value={merchantId}
              onChangeText={setMerchantId}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="Verification Key *"
              value={verificationKey}
              onChangeText={setVerificationKey}
              autoCapitalize="none"
              secureTextEntry
            />
            <TextInput
              style={styles.input}
              placeholder="Username (optional)"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="Password (optional)"
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              secureTextEntry
            />
            <TextInput
              style={styles.input}
              placeholder="App Name (optional)"
              value={appName}
              onChangeText={setAppName}
            />
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Sandbox Mode</Text>
              <Switch
                value={sandboxMode}
                onValueChange={setSandboxMode}
                trackColor={{ false: '#767577', true: '#00a8e8' }}
                thumbColor={sandboxMode ? '#fff' : '#f4f3f4'}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Details</Text>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.flex1, styles.marginRight]}
                placeholder="Amount * (min 1.01)"
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
                placeholder="Order ID"
                value={orderId}
                onChangeText={setOrderId}
              />
              <TouchableOpacity style={styles.smallButton} onPress={generateNewOrderId}>
                <Text style={styles.smallButtonText}>New ID</Text>
              </TouchableOpacity>
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
                    style={[
                      styles.chipText,
                      channel === MULTI_CHANNEL && styles.chipTextSelected,
                    ]}
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
                              style={[
                                styles.chipText,
                                selected && styles.chipTextSelected,
                              ]}
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
              placeholder="Country (e.g. MY, SG, ID)"
              value={country}
              onChangeText={setCountry}
              autoCapitalize="characters"
              maxLength={2}
            />
            <TextInput
              style={styles.input}
              placeholder="Bill Name"
              value={billName}
              onChangeText={setBillName}
            />
            <TextInput
              style={styles.input}
              placeholder="Bill Email"
              value={billEmail}
              onChangeText={setBillEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="Bill Mobile"
              value={billMobile}
              onChangeText={setBillMobile}
              keyboardType="phone-pad"
            />
            <TextInput
              style={styles.input}
              placeholder="Bill Description"
              value={billDescription}
              onChangeText={setBillDescription}
            />
          </View>

          <TouchableOpacity
            style={[styles.payButton, loading && styles.payButtonDisabled]}
            onPress={handleStartPayment}
            disabled={loading}
          >
            <Text style={styles.payButtonText}>
              {loading ? 'Processing...' : 'Pay with Fiuu'}
            </Text>
          </TouchableOpacity>

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
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a2e',
    textAlign: 'center',
    marginTop: 20,
  },
  subHeader: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  toggleLabel: {
    fontSize: 15,
    color: '#333',
  },
  payButton: {
    backgroundColor: '#00a8e8',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  payButtonDisabled: {
    backgroundColor: '#99d6f0',
  },
  payButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  channelSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  channelSelectLabel: {
    fontSize: 11,
    color: '#888',
    marginBottom: 2,
  },
  channelSelectValue: {
    fontSize: 15,
    color: '#222',
    fontWeight: '600',
  },
  channelChevron: {
    fontSize: 12,
    color: '#888',
    marginLeft: 8,
  },
  channelPanel: {
    borderWidth: 1,
    borderColor: '#e2e2e2',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    backgroundColor: '#fafafa',
  },
  channelGroup: {
    fontSize: 11,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    marginTop: 10,
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 6,
    marginBottom: 6,
    backgroundColor: '#fff',
  },
  chipSelected: {
    backgroundColor: '#0d6efd',
    borderColor: '#0d6efd',
  },
  chipText: {
    fontSize: 13,
    color: '#333',
  },
  chipTextSelected: {
    color: '#fff',
    fontWeight: '600',
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
