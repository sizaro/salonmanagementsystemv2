import "./salehish-loading.css";

export function LoadingButton({ loading = false, loadingLabel = "Processing…", disabled, children, className = "", preserveStyle = false, ...rest }) {
  return <button {...rest} className={`${preserveStyle ? "" : "sh-loading-button"} ${className}`.trim()} disabled={disabled || loading} aria-busy={loading}>{loading ? <><span className="sh-loading-spinner" aria-hidden="true" /><span>{loadingLabel}</span></> : children}</button>;
}
