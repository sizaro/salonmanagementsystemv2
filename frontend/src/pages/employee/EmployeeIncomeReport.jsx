import EmployeeReportWorkspace from "../reports/EmployeeReportWorkspace.jsx";

// The personal route uses the same server-calculated report but has no employee
// selector, so an employee can only see their own financial history.
export default function EmployeeIncomeReport() {
  return <EmployeeReportWorkspace self />;
}
