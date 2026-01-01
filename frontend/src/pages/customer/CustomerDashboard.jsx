import { useState, useEffect, useMemo } from "react";
import Modal from "../../components/Modal.jsx";
import ServiceForm from "../../components/ServiceForm.jsx";
import Button from "../../components/Button.jsx";
import ConfirmModal from "../../components/ConfirmModal.jsx";
import { useData } from "../../context/DataContext.jsx";

export default function customerDashboard() {
  const [modalOpen, setModalOpen] = useState(false);
  const [messageModal, setMessageModal] = useState({ open: false, text: "", type: "" });
  const [adverts, setAdverts] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const { 
    user, 
    users, 
    services, 
    serviceMaterials = [],
    sections,
    serviceDefinitions,
    serviceRoles,
    fetchSections,
    fetchServiceDefinitions,
    fetchServiceTransactions,
    fetchServiceMaterials,
    fetchServiceRoles,
    createServiceTransaction,
    fetchUsers 
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
    return (services || []).map((service) => {
      const matchedMaterials = (serviceMaterials || []).filter(
        (m) => m.service_definition_id === service.service_definition_id
      );
      return { ...service, materials: matchedMaterials.length > 0 ? matchedMaterials : [] };
    });
  }, [services, serviceMaterials]);

  console.log("services with materials in the customer dashboard", servicesWithMaterials)

  // Modal controls
  const openModal = () => setModalOpen(true);
  const closeModal = () => setModalOpen(false);
  const showMessage = (text, type = "success") =>
    setMessageModal({ open: true, text, type });
  const closeMessage = () => setMessageModal({ open: false, text: "", type: "" });

  // Fetch all data on mount
  useEffect(() => {
    fetchUsers();
    fetchServiceRoles();
    fetchSections();
    fetchServiceDefinitions();
    fetchServiceMaterials();
    fetchServiceTransactions();
  }, []);

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

  const timeSlots = Array.from({ length: 16 }, (_, i) => `${8 + i}:00`); // 8:00–23:00

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

      const hour = time.split(":")[0] + ":00";
      if (timeSlots.includes(hour)) {
        map[date][hour] = s;
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

  // Filter available employees based on confirmed services
  useEffect(() => {
  if (!appointmentDate || !appointmentTime) {
    setFilteredEmployees(employees);
    return;
  }

  const available = employees.filter((emp) => {
    const isBusy = servicesWithMaterials.some((s) => 
      s.status === "confirmed" &&
      s.performers?.some(p => p.employee_id === emp.id) &&
      s.appointment_date?.split("T")[0] === appointmentDate &&
      s.appointment_time === appointmentTime
    );
    return !isBusy;
  });

  setFilteredEmployees(available);
}, [appointmentDate, appointmentTime, servicesWithMaterials, employees]);


  // Wait until user and users are loaded
  if (!user || !user.id || users.length === 0) {
    return (
      <div className="flex justify-center items-center h-screen text-gray-600">
        Loading your dashboard...
      </div>
    );
  }

  return (
    <div className="p-8 space-y-10">
      <h1 className="text-2xl font-bold">Welcome to Your Dashboard {user.last_name}</h1>

      {/* Special Offers */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Special Offers</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {adverts.map((ad) => (
            <div key={ad.id} className="border p-4 rounded-xl shadow-sm bg-gray-50">
              <h3 className="text-lg font-semibold">{ad.title}</h3>
              <p className="text-gray-600">{ad.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Employee Availability */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Check Employee Availability</h2>
        <div className="flex overflow-x-auto space-x-4 pb-3">
          {employees.map((emp) => (
            <div
              key={emp.id}
              onClick={() => setSelectedEmployee(emp)}
              className={`cursor-pointer border rounded-xl p-3 min-w-[150px] text-center shadow-sm ${
                selectedEmployee?.id === emp.id
                  ? "bg-blue-100 border-blue-400"
                  : "bg-white hover:bg-gray-50"
              }`}
            >
              <img
                src={`${staticBaseUrl}${emp.image_url}` || "/default-avatar.png"}
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
          <div className="overflow-auto max-h-[400px] max-w-full border">
            <h3 className="text-lg font-semibold mt-4">
              {selectedEmployee.first_name}'s Weekly Schedule
            </h3>
            <table className="min-w-full border text-sm text-left">
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
                {timeSlots.map((time) => (
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
      <div className="text-center">
        <Button
          onClick={openModal}
          className="bg-blue-500 hover:bg-blue-400 text-white px-6 py-2 rounded-xl"
        >
          Book an Appointment
        </Button>
      </div>

      {/* Appointment Modal */}
      <Modal isOpen={modalOpen} onClose={closeModal}>
        <ServiceForm
          isCustomer={true}
          onSubmit={createServiceTransaction}
          onClose={closeModal}
          Sections={sections}
          Services={serviceDefinitions}
          Roles={serviceRoles}
          Employees={employees}
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
