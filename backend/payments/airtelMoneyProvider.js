import { createMockProviderAdapter } from "./mockProvider.js";

// Replace this adapter's internals with the official Airtel sandbox/production
// implementation later. The Payment Engine contract remains unchanged.
export const createAirtelMoneyAdapter = () => createMockProviderAdapter("AIRTEL_MONEY");
