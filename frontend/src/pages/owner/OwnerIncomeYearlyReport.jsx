import React, { useState, useEffect } from "react";
import { useData } from "../../context/DataContext.jsx";
import Modal from "../../components/Modal";
import ServiceForm from "../../components/ServiceForm.jsx";
import ConfirmModal from "../../components/ConfirmModal.jsx";

const OwnerIncomeYearlyReport = () => {
  const {
    services,
    expenses,
    advances,
    fetchYearlyData,
    fetchServiceById,
    updateService,
    deleteService,
  } = useData();

  const [year, setYear] = useState(new Date().getFullYear());
  const [reportLabel, setReportLabel] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState(null);

  // ---- Calculate totals ----
  const calculateTotals = (services, expenses, advances) => {
    const grossIncome = services.reduce((sum, s) => sum + (parseInt(s.service_amount, 10) || 0), 0);

    const employeesSalary = services.reduce(
      (sum, s) =>
        sum +
        (parseInt(s.barber_amount, 10) || 0) +
        (parseInt(s.barber_assistant_amount, 10) || 0) +
        (parseInt(s.scrubber_assistant_amount, 10) || 0) +
        (parseInt(s.black_shampoo_assistant_amount, 10) || 0) +
        (parseInt(s.super_black_assistant_amount, 10) || 0) +
        (parseInt(s.black_mask_assistant_amount, 10) || 0),
      0,
    );

    const totalExpenses = expenses.reduce((sum, e) => sum + (parseInt(e.amount, 10) || 0), 0);
    const totalAdvances = advances.reduce((sum, a) => sum + (parseInt(a.amount, 10) || 0), 0);

    const netEmployeeSalary = employeesSalary - totalAdvances;
    const netIncome = grossIncome - (totalExpenses + netEmployeeSalary);
    const cashAtHand = netIncome + netEmployeeSalary;

    return {
      grossIncome,
      employeesSalary,
      totalExpenses,
      totalAdvances,
      netEmployeeSalary,
      netIncome,
      cashAtHand,
    };
  };

  const {
    grossIncome,
    employeesSalary,
    totalExpenses,
    totalAdvances,
    netEmployeeSalary,
    netIncome,
    cashAtHand,
  } = calculateTotals(services, expenses, advances);

  // ---- Format UTC date strings to EAT ----
  const formatEAT = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-UG", {
      timeZone: "Africa/Kampala",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // ---- Handle year change ----
  const handleYearChange = (e) => {
    const selectedYear = parseInt(e.target.value, 10);
    setYear(selectedYear);
    setReportLabel(`Year ${selectedYear}`);
    fetchYearlyData(selectedYear);
  };

  // ---- Handle Edit/Delete ----
  const handleEditClick = async (serviceId) => {
    const service = await fetchServiceById(serviceId);
    setEditingService(service);
    setShowModal(true);
  };

  const handleModalSubmit = async (updatedService) => {
    await updateService(updatedService.id, updatedService);
    await fetchYearlyData(year);
    setShowModal(false);
    setEditingService(null);
  };

  const handleDelete = (serviceId) => {
    setServiceToDelete(serviceId);
    setConfirmModalOpen(true);
  };

  const confirmDelete = async () => {
    if (serviceToDelete) {
      await deleteService(serviceToDelete);
      await fetchYearlyData(year);
      setConfirmModalOpen(false);
      setServiceToDelete(null);
    }
  };

  // ---- Generate year options ----
  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear; y >= currentYear - 10; y--) {
      years.push(y);
    }
    return years;
  };

  // ---- On page load ----
  useEffect(() => {
    const currentYear = new Date().getFullYear();
    setYear(currentYear);
    setReportLabel(`Year ${currentYear}`);
    fetchYearlyData(currentYear);
  }, []);

  return (
    <div className="income-page mx-auto max-w-6xl overflow-y-hidden p-4">
      <h1 className="mb-6 text-center text-3xl font-bold text-gray-800">Yearly Income Report</h1>

      {/* Year Picker */}
      <div className="mb-4">
        <label className="mb-2 block font-medium">Pick a year:</label>
        <select value={year} onChange={handleYearChange} className="rounded border p-2">
          {generateYearOptions().map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <p className="mt-2 text-gray-600">{reportLabel}</p>
      </div>

      {/* Summary Section */}
      <section className="mb-6 rounded-lg bg-white p-4 shadow-md">
        <h2 className="mb-2 text-xl font-semibold text-blue-700">Summary</h2>
        <p>
          <span className="font-medium">Gross Income:</span> {grossIncome.toLocaleString()} UGX
        </p>
        <p>
          <span className="font-medium">Employees Salary:</span> {employeesSalary.toLocaleString()}{" "}
          UGX
        </p>
        <p>
          <span className="font-medium">Expenses:</span> {totalExpenses.toLocaleString()} UGX
        </p>
        <p>
          <span className="font-medium">Advances:</span> {totalAdvances.toLocaleString()} UGX
        </p>
        <p>
          <span className="font-medium">Net Employees Salary:</span>{" "}
          {netEmployeeSalary.toLocaleString()} UGX
        </p>
        <p>
          <span className="font-medium">Salon Net Income:</span> {netIncome.toLocaleString()} UGX
        </p>
        <p>
          <span className="font-medium">Total Cash Available:</span> {cashAtHand.toLocaleString()}{" "}
          UGX
        </p>
      </section>

      {/* Services Table */}
      <section className="rounded-lg bg-white p-4 shadow-md">
        <h2 className="mb-4 text-xl font-semibold text-blue-700">Services Rendered</h2>
        <div className="max-h-[60vh] w-full overflow-x-auto overflow-y-auto rounded border border-gray-300">
          <table className="min-w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-blue-700 text-white">
              <tr>
                <th className="px-3 py-2 text-left">No.</th>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Service Amount</th>
                <th className="px-3 py-2 text-left">Salon Amount</th>
                <th className="px-3 py-2 text-left">Barber</th>
                <th className="px-3 py-2 text-left">Barber Amount</th>
                <th className="px-3 py-2 text-left">Aesthetician</th>
                <th className="px-3 py-2 text-left">Aesthetician Amount</th>
                <th className="px-3 py-2 text-left">Scrub Aesthetician</th>
                <th className="px-3 py-2 text-left">Scrubber Amount</th>
                <th className="px-3 py-2 text-left">Black Shampoo Aesthetician</th>
                <th className="px-3 py-2 text-left">Black Shampoo Aesthetician Amount</th>
                <th className="px-3 py-2 text-left">Black Shampoo Amount</th>
                <th className="px-3 py-2 text-left">Super Black Aesthetician</th>
                <th className="px-3 py-2 text-left">Super Black Aesthetician Amount</th>
                <th className="px-3 py-2 text-left">Super Black Amount</th>
                <th className="px-3 py-2 text-left">Black Mask Aesthetician</th>
                <th className="px-3 py-2 text-left">Black Mask Aesthetician Amount</th>
                <th className="px-3 py-2 text-left">Black Mask Amount</th>
                <th className="px-3 py-2 text-left">Time of Service</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {services.map((service, index) => (
                <tr key={service.id} className={index % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                  <td className="px-3 py-2">{index + 1}</td>
                  <td className="px-3 py-2">{service.name}</td>
                  <td className="px-3 py-2">{service.service_amount}</td>
                  <td className="px-3 py-2">{service.salon_amount}</td>
                  <td className="px-3 py-2">{service.barber}</td>
                  <td className="px-3 py-2">{service.barber_amount}</td>
                  <td className="px-3 py-2">{service.barber_assistant || "-"}</td>
                  <td className="px-3 py-2">{service.barber_assistant_amount}</td>
                  <td className="px-3 py-2">{service.scrubber_assistant || "-"}</td>
                  <td className="px-3 py-2">{service.scrubber_assistant_amount}</td>
                  <td className="px-3 py-2">{service.black_shampoo_assistant || "-"}</td>
                  <td className="px-3 py-2">{service.black_shampoo_assistant_amount || "-"}</td>
                  <td className="px-3 py-2">{service.black_shampoo_amount}</td>
                  <td className="px-3 py-2">{service.super_black_assistant || "-"}</td>
                  <td className="px-3 py-2">{service.super_black_assistant_amount || "-"}</td>
                  <td className="px-3 py-2">{service.super_black_amount}</td>
                  <td className="px-3 py-2">{service.black_mask_assistant || "-"}</td>
                  <td className="px-3 py-2">{service.black_mask_assistant_amount || "-"}</td>
                  <td className="px-3 py-2">{service.black_mask_amount}</td>
                  <td className="px-3 py-2">{formatEAT(service.service_timestamp)}</td>
                  <td className="space-x-1 px-3 py-2">
                    <button
                      className="rounded bg-blue-500 px-2 py-1 text-white hover:bg-blue-600"
                      onClick={() => handleEditClick(service.id)}
                    >
                      Edit
                    </button>
                    <button
                      className="rounded bg-red-500 px-2 py-1 text-white hover:bg-red-600"
                      onClick={() => handleDelete(service.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modals */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingService(null);
        }}
      >
        {editingService && (
          <ServiceForm
            serviceData={editingService}
            onSubmit={handleModalSubmit}
            onClose={() => {
              setShowModal(false);
              setEditingService(null);
            }}
          />
        )}
      </Modal>

      <ConfirmModal
        isOpen={confirmModalOpen}
        message="Are you sure you want to delete this service?"
        onConfirm={confirmDelete}
        onClose={() => setConfirmModalOpen(false)}
      />
    </div>
  );
};

export default OwnerIncomeYearlyReport;
