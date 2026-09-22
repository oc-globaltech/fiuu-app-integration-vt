-- Remove rows created while verifying the webhook end to end.
--
-- SELFTEST-1 was a hand-signed notification proving a valid skey is accepted.
-- FORGED-1 and FORGED-2 were deliberately bad signatures proving a forged
-- notification is recorded as status -1 and never reported as paid. They have
-- served their purpose and should not appear in the app's transaction list.
--
-- DEMO361 is a real transaction and is deliberately left alone.

delete from public.fiuu_payments
where order_id in ('SELFTEST-1', 'FORGED-1', 'FORGED-2');
