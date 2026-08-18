import { useState, useEffect, useMemo } from "react";
import Modal from "../../components/Modal.jsx";
import ServiceForm from "../../components/ServiceForm.jsx";
import Button from "../../components/Button.jsx";
import ConfirmModal from "../../components/ConfirmModal.jsx";
import { useData } from "../../context/DataContext.jsx";

const TIME_SLOTS = Array.from({ length: 32 }, (_, index) => {
  const totalMinutes = 8 * 60 + index * 30;
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
});

export default function CustomerDashboard() {
  const [modalOpen, setModalOpen] = useState(false);
  const [adverts, setAdverts] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const { 
    user, 
    users, 
    transactions, 
    serviceMaterials = [],
    sections,
    serviceDefinitions,
    serviceRoles,
    createServiceTransaction,
    fetchAppointmentAvailability,
  } = useData();

  const staticBaseUrl =
  import.meta.env.MODE === "development"
    ? "http://localhost:5500"
    : "https://salonmanagementsystemv2.onrender.com";

  // Filter employees (exclude Saleh & customers)
  const employees = useMemo(
    () =>
      (users || []).filter(
        (user) =>
          user.role !== "owner" &&
          user.role !== "customer"
      ),
    [users]
  );

  // Services enriched with their materials
  const servicesWithMaterials = useMemo(() => {
    return (transactions || []).map((service) => {
      const matchedMaterials = (serviceMaterials || []).filter(
        (m) => m.service_definition_id === service.service_definition_id
      );
      return { ...service, materials: matchedMaterials.length > 0 ? matchedMaterials : [] };
    });
  }, [transactions, serviceMaterials]);

  // Modal controls
  const openModal = () => setModalOpen(true);
  const closeModal = () => setModalOpen(false);
  const createAppointment = async (payload) => {
    await createServiceTransaction(payload);
    setConfirmModalOpen(true);
  };

  // Simulate adverts
  useEffect(() => {
    const promos = [
      { id: 1, title: "10% Off all Services", desc: "Book this week and save big!" },
      { id: 2, title: "Loyalty Bonus", desc: "Earn a free hair treatment after 5 visits!" },
    ];
    setAdverts(promos);
  }, []);

  // Weekly schedule setup
  const weekDates = useMemo(() => {
    const today = new Date();
    const week = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - today.getDay() + i); // Sunday as first day
      week.push(d);
    }
    return week;
  }, []);

  // Weekly schedule map (only confirmed services)
  const scheduleMap = useMemo(() => {
    if (!selectedEmployee || !servicesWithMaterials) return {};

    const confirmedServices = servicesWithMaterials.filter((s) => s.status === "confirmed");
    const map = {};
    weekDates.forEach((d) => {
      const iso = d.toISOString().split("T")[0];
      map[iso] = {};
    });

    confirmedServices.forEach((s) => {
      const date = s.appointment_date.split("T")[0] || s.appointment_date; 
      const time = s.appointment_time;

      const involvedIds = s.performers?.map(p => p.employee_id) || [];

      if (!involvedIds.includes(selectedEmployee.id)) return;
      if (!map[date]) return;

      const [hour, minute] = time.split(":");
      const slot = `${hour.padStart(2, "0")}:${Number(minute) < 30 ? "00" : "30"}`;
      if (TIME_SLOTS.includes(slot)) {
        map[date][slot] = s;
      }
    });

    return map;
  }, [selectedEmployee, servicesWithMaterials, weekDates]);

  // Render schedule cell
  const renderSlotCell = (dateISO, time) => {
    if (!selectedEmployee) return <td className="px-2 py-1 border h-12" />;
    const empStatus = selectedEmployee.status || "active";
    const leaveStart = selectedEmployee.leave_start_time;
    const leaveEnd = selectedEmployee.leave_end_time;

    const isLeave =
      empStatus === "leave" &&
      leaveStart &&
      leaveEnd &&
      new Date(`1970-01-01T${leaveStart}:00`) <= new Date(`1970-01-01T${time}:00`) &&
      new Date(`1970-01-01T${leaveEnd}:00`) > new Date(`1970-01-01T${time}:00`);

    if (isLeave) {
      return (
        <td className="px-2 py-1 border h-12 bg-yellow-100 text-xs text-center">
          On Leave
        </td>
      );
    }

    const s = scheduleMap[dateISO]?.[time];
    if (!s) return <td className="px-2 py-1 border h-12" />;

    const isMine = s.customer_id === user.id;

    return (
      <td
        className={`px-2 py-1 border h-12 text-xs text-center ${
          isMine ? "bg-green-100" : "bg-red-100"
        }`}
      >
        {isMine ? "Your Appointment" : "Booked"}
      </td>
    );
  };

  // Wait until user and users are loaded
  if (!user || !user.id || users.length === 0) {
    return (
      <div className="dashboard-page grid min-h-[60vh] place-items-center">
        <div className="dashboard-card text-center"><div className="mx-auto mb-3 h-9 w-9 animate-spin rounded-full border-4 border-stone-200 border-t-[var(--salon-copper)]" /><p>Preparing your dashboard…</p></div>
      </div>
    );
  }

  return (
    <div className="dashboard-page space-y-8">
      <header className="dashboard-hero">
        <p className="salon-eyebrow text-[var(--salon-copper)]">Customer portal</p>
        <h1 className="relative z-10 mt-2 font-serif text-3xl font-semibold sm:text-4xl">Welcome, {user.first_name} {user.last_name}</h1>
        <p className="relative z-10 mt-2 max-w-2xl text-stone-600">Book your next visit, check your barber’s availability, and follow every appointment from one place.</p>
      </header>

      {/* Special Offers */}
      <section className="dashboard-panel space-y-4">
        <h2 className="text-xl font-semibold">Special Offers</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {adverts.map((ad) => (
            <div key={ad.id} className="dashboard-card bg-gradient-to-br from-white to-amber-50">
              <h3 className="text-lg font-semibold">{ad.title}</h3>
              <p className="text-gray-600">{ad.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Employee Availability */}
      <section className="dashboard-panel space-y-4">
        <h2 className="text-xl font-semibold">Check Employee Availability</h2>
        <div className="flex overflow-x-auto space-x-4 pb-3">
          {employees.map((emp) => (
            <div
              key={emp.id}
              onClick={() => setSelectedEmployee(emp)}
              className={`dashboard-card min-w-[160px] cursor-pointer text-center ${
                selectedEmployee?.id === emp.id
                  ? "border-[var(--salon-copper)] bg-amber-50 ring-2 ring-[var(--salon-gold)]"
                  : ""
              }`}
            >
              <img
                src={emp.image_url ? `${staticBaseUrl}${emp.image_url}` : "/default-avatar.png"}
                alt={emp.first_name}
                className="w-16 h-16 rounded-full mx-auto object-cover"
              />
              <p className="mt-2 font-medium">
               {emp.last_name}
              </p>
              <p className="mt-2 font-medium">
                {emp.specialty}
              </p>
            </div>
          ))}
        </div>

        {selectedEmployee && (
          <div className="dashboard-table-wrap max-h-[30rem]">
            <h3 className="text-lg font-semibold mt-4">
              {selectedEmployee.first_name}'s Weekly Schedule
            </h3>
            <table className="dashboard-table text-sm">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="px-2 py-1 border">Time</th>
                  {weekDates.map((d, i) => (
                    <th key={i} className="px-2 py-1 border">
                      {d.toLocaleDateString("en-US", { weekday: "short" })}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIME_SLOTS.map((time) => (
                  <tr key={time}>
                    <td className="px-2 py-1 border font-medium">{time}</td>
                    {weekDates.map((d) => {
                      const dateISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                      return renderSlotCell(dateISO, time);
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Appointment Button */}
      <div className="dashboard-panel flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div><h2 className="font-serif text-2xl font-semibold">Ready for your next look?</h2><p className="text-sm text-stone-600">Choose a service, date, time, and professional.</p></div>
        <Button
          onClick={openModal}
          className="salon-button-primary"
        >
          Book an Appointment
        </Button>
      </div>

      {/* Appointment Modal */}
      <Modal isOpen={modalOpen} onClose={closeModal}>
        <ServiceForm
          isCustomer={true}
          onSubmit={createAppointment}
          onClose={closeModal}
          Sections={sections}
          Services={serviceDefinitions}
          Roles={serviceRoles}
          Employees={employees}
          Appointments={transactions}
          getAppointmentAvailability={fetchAppointmentAvailability}
          createdBy={user.id}
          customerId={user.id}
          serviceStatus={"pending"}
          serviceData={null}
        />
      </Modal>

      {/* Confirm Modal */}
      <ConfirmModal
        confirmMessage="okay"
        isOpen={confirmModalOpen}
        message="Appointment sent successfully"
        onConfirm={() => setConfirmModalOpen(false)}
        onClose={() => setConfirmModalOpen(false)}
      />
    </div>
  );
}
