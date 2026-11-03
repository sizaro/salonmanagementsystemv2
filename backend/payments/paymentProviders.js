import { isProduction } from "../config/environment.js";
import { createAirtelMoneyAdapter } from "./airtelMoneyProvider.js";
import { createBankAdapter } from "./bankProvider.js";
import { createMtnMomoAdapter } from "./mtnMomoProvider.js";

export const normalizeProvider = (method) => {
  const provider = String(method || "").trim().toUpperCase();
  if (!["MTN_MOMO", "AIRTEL_MONEY", "BANK_TRANSFER"].includes(provider)) {
    const error = new Error("Choose MTN Mobile Money, Airtel Money, or Bank transfer.");
    error.statusCode = 400;
    throw error;
  }
  return provider;
};

export const getProviderAdapter = (provider) => {
  const mode = String(process.env.PAYMENTS_MODE || "mock").trim().toLowerCase();

  if (provider === "BANK_TRANSFER" && mode === "manual") {
    return createBankAdapter({ mode: "manual" });
  }

  if (mode !== "mock") {
    const error = new Error(
      `${provider} is not configured yet. Configure a sandbox or production provider adapter first.`,
    );
    error.statusCode = 503;
    throw error;
  }

  if (isProduction()) {
    const error = new Error("Mock payments are disabled in production.");
    error.statusCode = 503;
    throw error;
  }

  return {
    MTN_MOMO: createMtnMomoAdapter,
    AIRTEL_MONEY: createAirtelMoneyAdapter,
    BANK_TRANSFER: createBankAdapter,
  }[provider]();
};
