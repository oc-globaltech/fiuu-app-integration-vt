/**
 * Fiuu's record of our payments, newest first: webhooks plus a sync from
 * Fiuu's daily report, so the badge follows Fiuu (CAPTURED, CANCELLED, ...).
 * UNVERIFIED (-1) is a notification whose skey did not match and must not be
 * treated as money.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import {
  fetchTransactions,
  describeStatus,
  formatWhen,
} from '../utils/transactions';
import Hero from './Hero';
import Pill from './Pill';
import { colors, fonts, ui } from '../theme';

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh) => {
    if (isRefresh) setRefreshing(true);
    const outcome = await fetchTransactions();
    setTransactions(outcome.transactions);
    setError(outcome.ok ? outcome.warning : outcome.error);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  const renderItem = ({ item }) => {
    const { label, color } = describeStatus(item.status, item.stat_name);

    return (
      <View style={styles.row}>
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
          Payments from the last 7 days appear here once Fiuu records them.
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator size="large" color={colors.ink} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ListHeaderComponent={
          <>
            <Hero
              lines={['Transactions']}
              character={require('../../assets/lottie/notify.json')}
            />
            <View style={styles.header}>
              <Text style={styles.title}>
                {transactions.length
                  ? `${transactions.length} from Fiuu`
                  : 'From Fiuu'}
              </Text>
              <Pill title="Refresh" onPress={() => load(true)} />
            </View>

            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </>
        }
        data={transactions}
        keyExtractor={(item) => item.order_id}
        renderItem={renderItem}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={
          transactions.length ? styles.listContent : styles.listContentEmpty
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={colors.ink}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: ui.screen,
  centre: { ...ui.screen, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    marginLeft: 4,
  },
  title: { fontFamily: fonts.medium, fontSize: 20, color: colors.ink },
  listContent: { padding: 16, paddingBottom: 32 },
  listContentEmpty: { flexGrow: 1, padding: 16 },
  row: { ...ui.card, marginBottom: 10, paddingHorizontal: 28 },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orderId: { ...ui.body, fontFamily: fonts.medium, flex: 1, marginRight: 8 },
  badge: ui.badge,
  amount: {
    fontFamily: fonts.medium,
    fontSize: 53,
    lineHeight: 58,
    letterSpacing: 53 * -0.04,
    color: colors.ink,
    marginTop: 4,
  },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap' },
  meta: { ...ui.muted, marginRight: 12 },
  when: { ...ui.muted, marginTop: 2 },
  warning: {
    ...ui.badge,
    backgroundColor: colors.sky,
    color: colors.white,
    marginTop: 8,
  },
  errorBox: { ...ui.card, backgroundColor: colors.coral },
  errorText: { ...ui.body, fontFamily: fonts.medium, color: colors.white },
  empty: { ...ui.card, alignItems: 'center', paddingVertical: 32 },
  emptyTitle: { ...ui.sectionTitle, marginLeft: 0, marginBottom: 8 },
  emptyText: { ...ui.muted, textAlign: 'center' },
});
