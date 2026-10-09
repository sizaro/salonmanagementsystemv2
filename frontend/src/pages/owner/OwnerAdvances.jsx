import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useData } from "../../context/DataContext.jsx";
import useOwnerReport from "../../hooks/useOwnerReport.js";
import AdvanceForm from "../../components/AdvanceForm.jsx";
import ConfirmModal from "../../components/ConfirmModal.jsx";
import Modal from "../../components/Modal.jsx";

const REPORT_TYPES = {
  DAY: "day",
  WEEK: "week",
  MONTH: "month",
  YEAR: "year",
};

const OwnerAdvances = () => {
  const {
    users = [],
    fetchUsers,
    fetchAdvanceById,
    createAdvance,
    updateAdvance,
    deleteAdvance,
  } = useData();

  const {
    report,
    fetchDailyData,
    fetchWeeklyData,
    fetchMonthlyData,
    fetchYearlyData,
  } = useOwnerReport();

  const advances = report?.advances ?? [];

  const toYMD = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const today = new Date();

  const [selectedDate, setSelectedDate] = useState(toYMD(today));
  const [monthYear, setMonthYear] = useState("");
  const [year, setYear] = useState("");

  const [week, setWeek] = useState({
    start: null,
    end: null,
  });

  const [reportLabel, setReportLabel] = useState("");
  const [activeReportType, setActiveReportType] = useState(REPORT_TYPES.DAY);

  const [showModal, setShowModal] = useState(false);
  const [editingAdvance, setEditingAdvance] = useState(null);

  // Determines the type when creating a brand-new advance.
  // Editing uses the existing advance's entry_type instead.
  const [newAdvanceEntryType, setNewAdvanceEntryType] = useState("current");

  const [viewingAdvance, setViewingAdvance] = useState(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [advanceToDelete, setAdvanceToDelete] = useState(null);

  const employees = useMemo(() => {
    return (users || []).filter(
      (user) =>
        user &&
        `${user.first_name || ""} ${user.last_name || ""}`
          .trim()
          .toLowerCase() !== "ntege saleh" &&
        user.role !== "customer",
    );
  }, [users]);

  const employeeMap = useMemo(() => {
    return new Map(
      employees.map((employee) => [Number(employee.id), employee]),
    );
  }, [employees]);

  const employeeAdvances = useMemo(() => {
    return advances.filter((advance) =>
      employeeMap.has(Number(advance.employee_id)),
    );
  }, [advances, employeeMap]);

  // ========================
  // REPORT REFRESH
  // ========================

  const refreshCurrentReport = async () => {
    switch (activeReportType) {
      case REPORT_TYPES.WEEK:
        if (week.start && week.end) {
          await fetchWeeklyData(week.start, week.end);
        }
        break;

      case REPORT_TYPES.MONTH:
        if (monthYear) {
          const [selectedYear, selectedMonth] = monthYear
            .split("-")
            .map(Number);

          await fetchMonthlyData(selectedYear, selectedMonth);
        }
        break;

      case REPORT_TYPES.YEAR:
        if (year) {
          await fetchYearlyData(Number(year));
        }
        break;

      case REPORT_TYPES.DAY:
      default:
        await fetchDailyData(selectedDate);
        break;
    }
  };

  // ========================
  // FILTER HANDLERS
  // ========================

  const handleDayChange = async (event) => {
    const value = event.target.value;

    if (!value) return;

    setSelectedDate(value);
    setActiveReportType(REPORT_TYPES.DAY);
    setReportLabel("");

    await fetchDailyData(value);
  };

  const handleWeekChange = async (event) => {
    const weekString = event.target.value;

    if (!weekString) return;

    const [selectedYear, selectedWeek] = weekString.split("-W").map(Number);

    const firstDayOfYear = new Date(selectedYear, 0, 1);

    const day = firstDayOfYear.getDay();

    const firstMonday = new Date(firstDayOfYear);

    const diff = day === 0 ? -6 : 1 - day;

    firstMonday.setDate(firstDayOfYear.getDate() + diff);

    const monday = new Date(firstMonday);

    monday.setDate(firstMonday.getDate() + (selectedWeek - 1) * 7);

    const sunday = new Date(monday);

    sunday.setDate(monday.getDate() + 6);

    setWeek({
      start: monday,
      end: sunday,
    });

    setActiveReportType(REPORT_TYPES.WEEK);

    setReportLabel(
      `${monday.toLocaleDateString()} → ${sunday.toLocaleDateString()}`,
    );

    await fetchWeeklyData(monday, sunday);
  };

  const handleMonthChange = async (event) => {
    const value = event.target.value;

    if (!value) return;

    const [selectedYear, selectedMonth] = value.split("-").map(Number);

    setMonthYear(value);
    setActiveReportType(REPORT_TYPES.MONTH);

    setReportLabel(
      new Date(selectedYear, selectedMonth - 1, 1).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
    );

    await fetchMonthlyData(selectedYear, selectedMonth);
  };

  const handleYearChange = async (event) => {
    const selectedYear = event.target.value;

    if (!selectedYear) return;

    setYear(selectedYear);
    setActiveReportType(REPORT_TYPES.YEAR);

    setReportLabel(`Year ${selectedYear}`);

    await fetchYearlyData(Number(selectedYear));
  };

  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];

    for (let current = currentYear; current >= currentYear - 10; current--) {
      years.push(current);
    }

    return years;
  };

  // ========================
  // CRUD HANDLERS
  // ========================

  const handleAddPast = () => {
    setEditingAdvance(null);
    setNewAdvanceEntryType("past");
    setShowModal(true);
  };

  const handleEdit = async (advanceId) => {
    try {
      const advance = await fetchAdvanceById(advanceId);

      setEditingAdvance(advance);
      setNewAdvanceEntryType(advance?.entry_type || "current");
      setShowModal(true);
    } catch (error) {
      console.error("Failed to fetch advance:", error);
    }
  };

  const handleView = async (advanceId) => {
    try {
      const advance = await fetchAdvanceById(advanceId);

      setViewingAdvance(advance);
      setViewModalOpen(true);
    } catch (error) {
      console.error("Failed to fetch advance:", error);
    }
  };

  const handleDelete = (advanceId) => {
    setAdvanceToDelete(advanceId);
    setConfirmModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!advanceToDelete) return;

    try {
      await deleteAdvance(advanceToDelete);

      setConfirmModalOpen(false);
      setAdvanceToDelete(null);

      await refreshCurrentReport();
    } catch (error) {
      console.error("Failed to delete advance:", error);
    }
  };

  const handleModalSubmit = async (advanceData) => {
    try {
      if (editingAdvance) {
        await updateAdvance(editingAdvance.id, advanceData);
      } else {
        await createAdvance(advanceData);
      }

      setShowModal(false);
      setEditingAdvance(null);
      setNewAdvanceEntryType("current");

      await refreshCurrentReport();
    } catch (error) {
      console.error("Failed to save advance:", error);
    }
  };

  const closeAdvanceModal = () => {
    setShowModal(false);
    setEditingAdvance(null);
    setNewAdvanceEntryType("current");
  };

  // ========================
  // DISPLAY HELPERS
  // ========================

  const getEmployeeName = (employeeId) => {
    const employee = employeeMap.get(Number(employeeId));

    if (!employee) {
      return "Unknown employee";
    }

    return `${employee.first_name || ""} ${employee.last_name || ""}`.trim();
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return "—";

    const date = new Date(`${dateValue}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
      return dateValue;
    }

    return date.toLocaleDateString();
  };

  const formatTime = (timeValue) => {
    if (!timeValue) return "—";

    const timeString = String(timeValue).slice(0, 5);

    const [hours, minutes] = timeString.split(":").map(Number);

    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      return timeValue;
    }

    const date = new Date();

    date.setHours(hours, minutes, 0, 0);

    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getBusinessDate = (advance) => {
    if (advance.advance_date) {
      return formatDate(advance.advance_date);
    }

    if (advance.created_at) {
      return new Date(advance.created_at).toLocaleDateString();
    }

    return "—";
  };

  const getBusinessTime = (advance) => {
    if (advance.advance_time) {
      return formatTime(advance.advance_time);
    }

    if (advance.created_at) {
      return new Date(advance.created_at).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });
    }

    return "—";
  };

  const formatCreatedAt = (createdAt) => {
    if (!createdAt) return "—";

    const date = new Date(createdAt);

    if (Number.isNaN(date.getTime())) {
      return createdAt;
    }

    return date.toLocaleString();
  };

  const isPastAdvance = (advance) =>
    String(advance?.entry_type || "").toLowerCase() === "past";

  const isFinanceWorkflowAdvance = (advance) => Boolean(advance?.finance_request_id);
  const formatFinanceStatus = (advance) => String(advance?.finance_workflow_status || "").replaceAll("_", " ");

  // ========================
  // INITIAL LOAD
  // ========================

  useEffect(() => {
    fetchDailyData(selectedDate);
    fetchUsers();
  }, []);

  // ========================
  // RENDER
  // ========================

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* FILTER BAR */}
      <div className="mb-6 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block font-medium mb-1">Day:</label>

          <input
            type="date"
            value={selectedDate}
            onChange={handleDayChange}
            className="border rounded p-2"
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Week:</label>

          <input
            type="week"
            onChange={handleWeekChange}
            className="border rounded p-2"
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Month:</label>

          <input
            type="month"
            value={monthYear}
            onChange={handleMonthChange}
            className="border rounded p-2"
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Year:</label>

          <select
            value={year}
            onChange={handleYearChange}
            className="border rounded p-2"
          >
            <option value="">Select Year</option>

            {generateYearOptions().map((currentYear) => (
              <option key={currentYear} value={currentYear}>
                {currentYear}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* REPORT LABEL */}
      {reportLabel && (
        <div className="mb-4 text-gray-600">
          Showing: <span className="font-semibold">{reportLabel}</span>
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Advances</h1>

          <p className="text-sm text-gray-500 mt-1">
            Employee advances recorded by business date. New current advances use the finance workflow so approval, settlement, and receipts stay connected.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to="/owner/finance?action=advance&tab=advances"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md shadow"
          >
            Create Finance Advance Request
          </Link>

          <button
            type="button"
            onClick={handleAddPast}
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-md shadow"
          >
            Add Past Advance
          </button>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-950">
        <span className="font-semibold">Settlement rule:</span> current employee advances are requested, approved, disbursed, acknowledged, and then settled from Employee Finance. Direct historical entries remain available for audit, but are not silently deducted from pay.
      </div>

      {/* SUMMARY */}
      <div className="mb-4 bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-sm text-gray-500">Records</p>

            <p className="text-xl font-bold text-gray-800">
              {employeeAdvances.length}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-500">Total Advances</p>

            <p className="text-xl font-bold text-gray-800">
              {employeeAdvances
                .reduce(
                  (total, advance) => total + Number(advance.amount || 0),
                  0,
                )
                .toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto bg-white shadow rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                Employee
              </th>

              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                Amount
              </th>

              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                Business Date
              </th>

              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                Business Time
              </th>

              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                Type
              </th>

              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                Description
              </th>

              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                Settlement
              </th>

              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200">
            {employeeAdvances.length === 0 ? (
              <tr>
                <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                  No advances found for this period.
                </td>
              </tr>
            ) : (
              employeeAdvances.map((advance) => {
                const past = isPastAdvance(advance);

                return (
                  <tr key={advance.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {getEmployeeName(advance.employee_id)}
                    </td>

                    <td className="px-4 py-3 font-medium">
                      {Number(advance.amount || 0).toLocaleString()}
                    </td>

                    <td className="px-4 py-3">{getBusinessDate(advance)}</td>

                    <td className="px-4 py-3">{getBusinessTime(advance)}</td>

                    <td className="px-4 py-3">
                      {past ? (
                        <span className="inline-flex px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                          Past
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                          Current
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">{advance.description || "—"}</td>

                    <td className="px-4 py-3">
                      {isFinanceWorkflowAdvance(advance) ? (
                        <div className="space-y-1">
                          <span className="inline-flex rounded-full bg-indigo-100 px-2 py-1 text-xs font-semibold text-indigo-800">
                            {formatFinanceStatus(advance) || "Finance workflow"}
                          </span>
                          <p className="text-xs text-gray-600">
                            Outstanding: {Number(advance.finance_outstanding_amount || 0).toLocaleString()}
                          </p>
                          {advance.settlement_receipt_numbers && (
                            <p className="text-xs text-gray-500">Settlements: {advance.settlement_receipt_numbers}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">Direct record</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleView(advance.id)}
                          className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded-md text-sm"
                        >
                          View
                        </button>

                        {isFinanceWorkflowAdvance(advance) ? (
                          <Link
                            to="/owner/finance?tab=advances"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-md text-sm"
                          >
                            Finance control
                          </Link>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleEdit(advance.id)}
                              className="bg-yellow-400 hover:bg-yellow-500 text-white px-3 py-1 rounded-md text-sm"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDelete(advance.id)}
                              className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-sm"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ADD / EDIT ADVANCE MODAL */}
      <Modal isOpen={showModal} onClose={closeAdvanceModal}>
        <AdvanceForm
          advanceData={editingAdvance}
          onSubmit={handleModalSubmit}
          onClose={closeAdvanceModal}
          entryType={editingAdvance?.entry_type || newAdvanceEntryType}
        />
      </Modal>

      {/* VIEW ADVANCE MODAL */}
      <Modal
        isOpen={viewModalOpen}
        onClose={() => {
          setViewModalOpen(false);
          setViewingAdvance(null);
        }}
      >
        {viewingAdvance && (
          <div className="max-w-2xl space-y-5 p-2">
            <header className="rounded-2xl bg-slate-900 p-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-200">Employee advance record</p>
              <h2 className="mt-1 text-2xl font-bold">UGX {Number(viewingAdvance.amount || 0).toLocaleString()}</h2>
              <p className="mt-2 text-sm text-slate-300">{getEmployeeName(viewingAdvance.employee_id)} · {getBusinessDate(viewingAdvance)} at {getBusinessTime(viewingAdvance)}</p>
            </header>

            <div className="grid gap-3 sm:grid-cols-2">
              <AdvanceDetail label="Employee" value={getEmployeeName(viewingAdvance.employee_id)} />
              <AdvanceDetail label="Business record" value={isPastAdvance(viewingAdvance) ? "Historical entry" : "Current entry"} />
              <AdvanceDetail label="Description" value={viewingAdvance.description || "—"} />
              <AdvanceDetail label="Recorded in system" value={formatCreatedAt(viewingAdvance.created_at)} />
              {isPastAdvance(viewingAdvance) && <AdvanceDetail label="Backdate reason" value={viewingAdvance.backdate_reason || "—"} />}
            </div>

            {isFinanceWorkflowAdvance(viewingAdvance) ? (
              <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-indigo-700">Finance workflow</p>
                    <p className="mt-1 font-semibold text-indigo-950">{formatFinanceStatus(viewingAdvance) || "Recorded"}</p>
                  </div>
                  <p className="text-lg font-bold text-indigo-950">Outstanding: UGX {Number(viewingAdvance.finance_outstanding_amount || 0).toLocaleString()}</p>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-indigo-900 sm:grid-cols-2">
                  <p>Issued receipt: {viewingAdvance.finance_receipt_number || "Not issued"}</p>
                  <p>Settled: UGX {Number(viewingAdvance.finance_settled_amount || 0).toLocaleString()}</p>
                  <p>Disbursed: {formatCreatedAt(viewingAdvance.finance_disbursed_at)}</p>
                  <p>Acknowledged: {formatCreatedAt(viewingAdvance.finance_acknowledged_at)}</p>
                </div>
                {viewingAdvance.settlement_receipt_numbers && <p className="mt-3 text-xs text-indigo-800">Settlement receipts: {viewingAdvance.settlement_receipt_numbers}</p>}
                <Link to="/owner/finance?tab=advances" className="mt-4 inline-flex rounded-lg bg-indigo-700 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-800">Open settlement control</Link>
              </section>
            ) : (
              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                This is a direct historical advance record. It was not issued through the approval and settlement workflow.
              </section>
            )}

            <button
              type="button"
              onClick={() => {
                setViewModalOpen(false);
                setViewingAdvance(null);
              }}
              className="w-full rounded-xl bg-gray-700 px-4 py-2 font-semibold text-white hover:bg-gray-800"
            >
              Close
            </button>
          </div>
        )}
      </Modal>

      {/* DELETE CONFIRMATION */}
      <ConfirmModal
        isOpen={confirmModalOpen}
        message="Are you sure you want to delete this advance?"
        confirmMessage="yes"
        onConfirm={confirmDelete}
        onClose={() => {
          setConfirmModalOpen(false);
          setAdvanceToDelete(null);
        }}
      />
    </div>
  );
};

export default OwnerAdvances;

function AdvanceDetail({ label, value }) {
  return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-sm font-medium text-slate-900">{value || "—"}</p></div>;
}
