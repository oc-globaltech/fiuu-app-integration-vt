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

      mp_channel: 'multi',
      mp_bill_description: billDescription || 'Payment via Fiuu XDK',
      mp_bill_name: billName || 'Customer',
      mp_bill_email: billEmail || 'customer@example.com',
      mp_bill_mobile: billMobile || '+60123456789',

      mp_channel_editing: true,
      mp_editing_enabled: true,
      mp_sandbox_mode: false,
      mp_express_mode: false,
      mp_language: 'EN',
      mp_core_env: '4',
    };

    console.log('Sending payment details:', JSON.stringify(paymentDetails, null, 2));

    setLoading(true);
    setResult(null);

    startPayment(paymentDetails, (paymentResult) => {
      setLoading(false);
      setResult(paymentResult);
      console.log('Fiuu Payment Result:', paymentResult);
    });
  };

  const generateNewOrderId = () => {
    setOrderId(`ORDER-${Date.now()}`);
  };

  const renderResult = () => {
    if (!result) return null;

    const isSuccess = result?.StatCode === '00' || result?.status_code === '00';
    const isPending = result?.StatCode === '22' || result?.status_code === '22';
    const statusColor = isSuccess ? '#28a745' : isPending ? '#ffc107' : '#dc3545';
    const statusText = isSuccess ? 'SUCCESS' : isPending ? 'PENDING' : 'FAILED';

    return (
      <View style={[styles.resultCard, { borderLeftColor: statusColor }]}>
        <Text style={[styles.resultTitle, { color: statusColor }]}>
          Payment {statusText}
        </Text>
        <Text style={styles.resultLabel}>Response:</Text>
        <Text style={styles.resultText}>
          {typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result)}
        </Text>
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
