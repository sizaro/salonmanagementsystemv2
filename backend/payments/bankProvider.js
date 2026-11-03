import crypto from "crypto";

// Bank collections are customer-initiated credits. Salehish displays its
// receiving account and reference; it never asks for credentials or initiates
// a debit from the customer's account.
export const createBankAdapter = ({ mode = "mock" } = {}) => ({
  provider: "BANK_TRANSFER",
  mode,
  initiateIncomingCollection: ({ bankPaymentReference }) => ({
    status: "AWAITING_TRANSFER",
    providerReference: bankPaymentReference,
    customerMessage: "Awaiting an incoming transfer to the official salon account.",
  }),
  initiatePayout: ({ intentReference }) => ({
    status: mode === "manual" ? "AWAITING_MANUAL_VERIFICATION" : "PENDING",
    providerReference: `${mode === "manual" ? "MANUAL-BANK-PAYOUT" : "MOCK-BANK-PAYOUT"}-${intentReference.replace(/[^A-Z0-9]/gi, "").slice(-12)}`,
    customerMessage: mode === "manual"
      ? "This bank payout is awaiting authorised manual execution and verification."
      : "Development bank payout simulation started. The payout will be confirmed after a short delay.",
  }),
  delayMs: Math.max(1200, Number(process.env.MOCK_PAYMENT_DELAY_MS || 2500)),
  mockCredit: ({ bankPaymentReference }) => ({
    bankTransactionId: `MOCK-BANK-${crypto.randomBytes(7).toString("hex").toUpperCase()}`,
    transferReference: bankPaymentReference,
  }),
  capabilities: {
    incomingCreditNotifications: true,
    transactionInquiry: true,
    accountCreditVerification: true,
    referenceMatching: true,
    destinationAccountVerification: true,
    transactionIdDeduplication: true,
    unmatchedCreditReconciliation: true,
    delayedNotificationRecovery: true,
    virtualAccounts: false,
  },
  normalizeIncomingCredit: (payload = {}) => ({
    bankTransactionId: String(payload.bank_transaction_id || "").trim(),
    transferReference: String(payload.transfer_reference || "").trim() || null,
    destinationAccount: String(payload.destination_account || "").trim() || null,
    amount: Number(payload.amount),
    currency: String(payload.currency || "UGX").trim().toUpperCase(),
    status: String(payload.status || "CONFIRMED").trim().toUpperCase(),
    providerFee: payload.provider_fee == null ? null : Number(payload.provider_fee),
  }),
  creditMatchesIntent: ({ credit, intent, bankAccount }) => Boolean(
    credit?.bankTransactionId
      && credit?.status === "CONFIRMED"
      && credit?.transferReference === intent?.bank_payment_reference
      && Number(credit?.amount) === Number(intent?.amount)
      && credit?.currency === intent?.currency
      && (!credit?.destinationAccount || credit.destinationAccount === bankAccount?.account_number)
  ),
  inquiry: async () => ({ status: "NOT_CONFIGURED" }),
});
