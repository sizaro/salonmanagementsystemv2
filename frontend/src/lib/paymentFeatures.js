// External provider flows remain available for local mock-provider development.
// Production stays cash-only until each provider has been formally enabled with
// its live credentials and operational approval. The production deployment can
// enable the UI later with VITE_ENABLE_EXTERNAL_PAYMENTS_UI=true.
export const externalPaymentUiEnabled =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_EXTERNAL_PAYMENTS_UI === "true";
