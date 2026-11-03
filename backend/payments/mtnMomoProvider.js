import { createMockProviderAdapter } from "./mockProvider.js";

// Replace this adapter's internals with the official MTN sandbox/production
// implementation later. The Payment Engine contract remains unchanged.
export const createMtnMomoAdapter = () => createMockProviderAdapter("MTN_MOMO");
