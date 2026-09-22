/**
 * Every payment Fiuu has notified us about, newest first.
 *
 * This is the server's record, not the device's. A row here means Fiuu sent a
 * webhook; PAID means its signature also verified. UNVERIFIED (-1) is a
 * notification whose skey did not match and must not be treated as money.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import {
  fetchTransactions,
  describeStatus,
  formatWhen,
} from '../utils/transactions';

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh) => {
    if (isRefresh) setRefreshing(true);
    const outcome = await fetchTransactions();
    setTransactions(outcome.transactions);
    setError(outcome.ok ? null : outcome.error);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  const renderItem = ({ item }) => {
    const { label, color } = describeStatus(item.status);

    return (
      <View style={[styles.row, { borderLeftColor: color }]}>
        <View style={styles.rowTop}>
          <Text style={styles.orderId} numberOfLines={1}>
            {item.order_id}
          </Text>
          <Text style={[styles.badge, { backgroundColor: color }]}>{label}</Text>
        </View>

        <Text style={styles.amount}>
          {item.currency || ''} {item.amount != null ? Number(item.amount).toFixed(2) : '-'}
        </Text>

        <View style={styles.metaRow}>
          {!!item.channel && <Text style={styles.meta}>{item.channel}</Text>}
          {!!item.txn_id && <Text style={styles.meta}>txn {item.txn_id}</Text>}
        </View>

        <Text style={styles.when}>{formatWhen(item.paydate || item.created_at)}</Text>

        {!item.verified && (
          <Text style={styles.warning}>
            Signature did not verify — not proof of payment
          </Text>
        )}
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No transactions yet</Text>
        <Text style={styles.emptyText}>
          A payment appears here once Fiuu sends its webhook. Payments made
          before the webhook was configured will not be listed.
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator size="large" color="#00a8e8" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          Transactions{transactions.length ? ` (${transactions.length})` : ''}
        </Text>
        <TouchableOpacity style={styles.refresh} onPress={() => load(true)}>
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.order_id}
        renderItem={renderItem}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={
          transactions.length ? styles.listContent : styles.listContentEmpty
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#212529' },
  refresh: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#00a8e8',
  },
  refreshText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  listContentEmpty: { flexGrow: 1, paddingHorizontal: 16 },
  row: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderLeftWidth: 4,
    padding: 14,
    marginBottom: 10,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orderId: { fontSize: 15, fontWeight: '700', color: '#212529', flex: 1, marginRight: 8 },
  badge: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    overflow: 'hidden',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  amount: { fontSize: 20, fontWeight: '700', color: '#212529', marginTop: 6 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  meta: { fontSize: 12, color: '#6c757d', marginRight: 12 },
  when: { fontSize: 12, color: '#adb5bd', marginTop: 4 },
  warning: { fontSize: 12, color: '#6f42c1', marginTop: 6, fontWeight: '600' },
  errorBox: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f8d7da',
  },
  errorText: { color: '#842029', fontSize: 13 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#495057', marginBottom: 8 },
  emptyText: { fontSize: 13, color: '#6c757d', textAlign: 'center', lineHeight: 19 },
});
