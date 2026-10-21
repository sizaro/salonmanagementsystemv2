import "./salehish-loading.css";

const bar = (width, height) => ({ width, height });

export function DashboardSkeleton({ className = "" }) {
  return <div className={className} aria-busy="true" aria-label="Loading dashboard"><div className="sh-skeleton-grid">{Array.from({ length: 4 }, (_, index) => <div className="sh-skeleton-card" key={index}><div className="sh-skeleton" style={bar("55%", 12)} /><div className="sh-skeleton" style={bar("65%", 30)} /><div className="sh-skeleton" style={bar("80%", 9)} /></div>)}</div><div className="sh-skeleton-grid" style={{ marginTop: 16 }}><div className="sh-skeleton-card" style={{ minHeight: 210 }}><div className="sh-skeleton" style={bar("42%", 16)} /><div className="sh-skeleton" style={{ width: "100%", flex: 1, minHeight: 135 }} /></div><div className="sh-skeleton-card" style={{ minHeight: 210 }}><div className="sh-skeleton" style={bar("55%", 16)} />{Array.from({ length: 4 }, (_, index) => <div className="sh-skeleton" style={bar(`${85 - index * 9}%`, 16)} key={index} />)}</div></div></div>;
}

export function TableSkeleton({ rows = 5, className = "" }) {
  return <div className={`sh-skeleton-card sh-skeleton-table ${className}`} aria-busy="true" aria-label="Loading records">{Array.from({ length: Math.max(0, rows) }, (_, index) => <div className="sh-skeleton-table-row" key={index}><div className="sh-skeleton" style={bar("90%", 14)} /><div className="sh-skeleton" style={bar("75%", 14)} /><div className="sh-skeleton" style={bar("85%", 14)} /><div className="sh-skeleton" style={bar("100%", 14)} /></div>)}</div>;
}