import assert from "node:assert/strict";
import test from "node:test";
import { createBankAdapter } from "../payments/bankProvider.js";
import { createAirtelMoneyAdapter } from "../payments/airtelMoneyProvider.js";
import { createMtnMomoAdapter } from "../payments/mtnMomoProvider.js";
import { makeBankPaymentReference, makeIntentReference } from "../payments/paymentReferences.js";

test("bank references are provider-safe and never reused in a large sample", () => {
  const references = Array.from({ length: 2000 }, () => makeBankPaymentReference());
  assert.equal(new Set(references).size, references.length);
  for (const reference of references) assert.match(reference, /^SLH-\d{6}-[A-F0-9]{8}$/);
  assert.match(makeIntentReference(), /^PAY-[A-Z0-9]+-[A-F0-9]{8}$/);
});

test("bank collection is customer initiated and exposes reconciliation capabilities", () => {
  const bank = createBankAdapter();
  const initiated = bank.initiateIncomingCollection({ bankPaymentReference: "SLH-261026-AABBCCDD" });
  assert.equal(initiated.status, "AWAITING_TRANSFER");
  assert.equal(typeof bank.initiate, "undefined");
  assert.equal(bank.capabilities.incomingCreditNotifications, true);
  assert.equal(bank.capabilities.transactionIdDeduplication, true);
  assert.equal(bank.capabilities.unmatchedCreditReconciliation, true);
});

test("manual bank payouts stay pending for controlled verification", () => {
  const bank = createBankAdapter({ mode: "manual" });
  const payout = bank.initiatePayout({ intentReference: "PAY-MANUAL-1", amount: 10000 });
  assert.equal(payout.status, "AWAITING_MANUAL_VERIFICATION");
  assert.match(payout.providerReference, /^MANUAL-BANK-PAYOUT-/);
  assert.match(payout.customerMessage, /manual execution and verification/i);
});

test("bank credit matching requires reference, account, amount, currency, and confirmed status", () => {
  const bank = createBankAdapter();
  const intent = { bank_payment_reference: "SLH-261026-AABBCCDD", amount: 10000, currency: "UGX" };
  const account = { account_number: "00112233" };
  const valid = { bankTransactionId: "BANK-1", transferReference: intent.bank_payment_reference, destinationAccount: account.account_number, amount: 10000, currency: "UGX", status: "CONFIRMED" };
  assert.equal(bank.creditMatchesIntent({ credit: valid, intent, bankAccount: account }), true);
  assert.equal(bank.creditMatchesIntent({ credit: { ...valid, transferReference: "WRONG" }, intent, bankAccount: account }), false);
  assert.equal(bank.creditMatchesIntent({ credit: { ...valid, amount: 9999 }, intent, bankAccount: account }), false);
  assert.equal(bank.creditMatchesIntent({ credit: { ...valid, destinationAccount: "OTHER" }, intent, bankAccount: account }), false);
  assert.equal(bank.creditMatchesIntent({ credit: { ...valid, status: "PENDING" }, intent, bankAccount: account }), false);
});

test("same-amount customers remain distinguishable by their unique references", () => {
  const bank = createBankAdapter();
  const account = { account_number: "00112233" };
  const first = { bank_payment_reference: "SLH-261026-11111111", amount: 25000, currency: "UGX" };
  const second = { bank_payment_reference: "SLH-261026-22222222", amount: 25000, currency: "UGX" };
  const credit = { bankTransactionId: "BANK-2", transferReference: second.bank_payment_reference, destinationAccount: account.account_number, amount: 25000, currency: "UGX", status: "CONFIRMED" };
  assert.equal(bank.creditMatchesIntent({ credit, intent: first, bankAccount: account }), false);
  assert.equal(bank.creditMatchesIntent({ credit, intent: second, bankAccount: account }), true);
});

test("mobile-money mocks use collection requests rather than bank-credit controls", () => {
  for (const mobile of [createMtnMomoAdapter(), createAirtelMoneyAdapter()]) {
    assert.equal(typeof mobile.initiate, "function");
    assert.equal(typeof mobile.initiateIncomingCollection, "undefined");
    assert.equal(mobile.initiate({ intentReference: "PAY-X" }).status, "PENDING");
  }
});

test("mock provider resolution is unavailable in production mode", async () => {
  process.env.NODE_ENV = "production";
  process.env.DATABASE_URL ||= "postgres://invalid:invalid@127.0.0.1:1/invalid";
  process.env.SESSION_SECRET ||= "payment-test-secret";
  process.env.PAYMENTS_MODE = "mock";
  const { getProviderAdapter } = await import(`../payments/paymentProviders.js?production-isolation=${Date.now()}`);
  assert.throws(() => getProviderAdapter("MTN_MOMO"), /disabled in production|not configured/i);
});
