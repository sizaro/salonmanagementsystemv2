import { useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Search, SlidersHorizontal } from "lucide-react";

const displayValue = (value) => {
  const normalized = String(value ?? "").trim();
  return !normalized || normalized.toLowerCase() === "null" ? "—" : value;
};

export default function EmployeeDirectoryTable({ employees, onView, onEdit, onDelete, allowManage = false }) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("ALL");
  const [sort, setSort] = useState({ field: "first_name", direction: "asc" });
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const roles = useMemo(() => [...new Set(employees.map((employee) => employee.role).filter(Boolean))].sort(), [employees]);
  const filteredEmployees = useMemo(() => {
    const lookup = query.trim().toLowerCase();
    const filtered = employees.filter((employee) => {
      const searchable = [employee.first_name, employee.middle_name, employee.last_name, employee.email, employee.contact, employee.next_of_kin].join(" ").toLowerCase();
      return (role === "ALL" || employee.role === role) && (!lookup || searchable.includes(lookup));
    });
    return filtered.sort((a, b) => {
      const left = String(a[sort.field] ?? "").toLowerCase();
      const right = String(b[sort.field] ?? "").toLowerCase();
      return left.localeCompare(right) * (sort.direction === "asc" ? 1 : -1);
    });
  }, [employees, query, role, sort]);
  const pageCount = Math.max(1, Math.ceil(filteredEmployees.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const rows = filteredEmployees.slice((safePage - 1) * pageSize, safePage * pageSize);
  const changeSort = (field) => {
    setSort((current) => current.field === field ? { field, direction: current.direction === "asc" ? "desc" : "asc" } : { field, direction: "asc" });
    setPage(1);
  };
  const header = (label, field) => <th className="workspace-table-heading"><button type="button" onClick={() => changeSort(field)} className="workspace-sort-button">{label}<ChevronDown size={14} className={sort.field === field && sort.direction === "desc" ? "rotate-180" : ""} /></button></th>;

  return <section className="workspace-data-panel">
    <div className="workspace-table-toolbar">
      <div><p className="workspace-section-kicker">People</p><h2>Employee directory</h2><p>{filteredEmployees.length} of {employees.length} team members shown</p></div>
      <div className="workspace-table-controls">
        <label className="workspace-search-field"><Search size={17} /><span className="sr-only">Search employees</span><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search employees" /></label>
        <label className="workspace-filter-field"><SlidersHorizontal size={16} /><span className="sr-only">Filter by role</span><select value={role} onChange={(event) => { setRole(event.target.value); setPage(1); }}><option value="ALL">All roles</option>{roles.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      </div>
    </div>
    <div className="workspace-table-scroll"><table className="workspace-data-table"><thead><tr>{header("First name", "first_name")}{header("Middle name", "middle_name")}{header("Last name", "last_name")}{header("Email", "email")}{header("Role", "role")}{header("Phone", "contact")}{header("Next of kin", "next_of_kin")}<th className="workspace-table-heading">Next of kin phone</th><th className="workspace-table-heading workspace-table-actions">Actions</th></tr></thead>
      <tbody>{rows.length ? rows.map((employee) => <tr key={employee.id}><td className="font-semibold text-[var(--salehish-ink)]">{displayValue(employee.first_name)}</td><td>{displayValue(employee.middle_name)}</td><td>{displayValue(employee.last_name)}</td><td>{displayValue(employee.email)}</td><td><span className="workspace-role-badge">{displayValue(employee.role)}</span></td><td>{displayValue(employee.contact)}</td><td>{displayValue(employee.next_of_kin)}</td><td>{displayValue(employee.next_of_kin_contact)}</td><td><div className="workspace-row-actions"><button type="button" onClick={() => onView(employee.id)}>View</button>{allowManage && <><button type="button" onClick={() => onEdit(employee.id)}>Edit</button><button type="button" className="workspace-danger-action" onClick={() => onDelete(employee.id)}>Delete</button></>}</div></td></tr>) : <tr><td colSpan="9" className="workspace-table-empty">No employees match these filters.</td></tr>}</tbody></table></div>
    <footer className="workspace-pagination"><p>Page {safePage} of {pageCount}</p><div><button type="button" disabled={safePage === 1} onClick={() => setPage(safePage - 1)} aria-label="Previous page"><ChevronLeft size={18} /></button><button type="button" disabled={safePage === pageCount} onClick={() => setPage(safePage + 1)} aria-label="Next page"><ChevronRight size={18} /></button></div></footer>
  </section>;
}
