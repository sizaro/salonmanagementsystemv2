const MOCK_DELAY_MS = Math.max(1200, Number(process.env.MOCK_PAYMENT_DELAY_MS || 2500));

const referenceFor = (provider, intentReference) =>
  `MOCK-${provider}-${intentReference.replace(/[^A-Z0-9]/gi, "").slice(-12)}`;

export const createMockProviderAdapter = (provider) => ({
  provider,
  mode: "mock",
  delayMs: MOCK_DELAY_MS,
  initiate: ({ intentReference }) => ({
    status: "PENDING",
    providerReference: referenceFor(provider, intentReference),
    customerMessage:
      "Development simulation started. The payment will be confirmed after a short delay.",
  }),
});
