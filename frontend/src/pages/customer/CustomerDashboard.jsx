import { useState, useEffect, useMemo } from "react";
import Modal from "../../components/Modal.jsx";
import ServiceForm from "../../components/ServiceForm.jsx";
import Button from "../../components/Button.jsx";
import ConfirmModal from "../../components/ConfirmModal.jsx";
import { useData } from "../../context/DataContext.jsx";

export default function CustomerDashboard() {
  const [modalOpen, setModalOpen] = useState(false);
  const [adverts, setAdverts] = useState([]);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const { 
    user, 
    users, 
    transactions,
    sections,
    serviceDefinitions,
    serviceRoles,
    createServiceTransaction,
    fetchAppointmentAvailability,
  } = useData();

  const configuredApiUrl = import.meta.env.VITE_API_URL || "";
  const staticBaseUrl = import.meta.env.VITE_STATIC_URL || (
    configuredApiUrl.startsWith("http")
      ? configuredApiUrl.replace(/\/api\/?$/, "")
      : import.meta.env.MODE === "development"
        ? "http://localhost:5500"
        : "https://salonmanagementsystemv2-ru0i.onrender.com"
  );
  const resolveImage = (url) => !url ? "/default-avatar.png" : String(url).startsWith("http") ? url : `${staticBaseUrl}${url}`;

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

  if (!user || !user.id) {
    return (
      <div className="dashboard-page grid min-h-[60vh] place-items-center">
        <div className="dashboard-card text-center"><div className="mx-auto mb-3 h-9 w-9 animate-spin rounded-full border-4 border-stone-200 border-t-[var(--salon-copper)]" /><p>Preparing your dashboard…</p></div>
      </div>
    );
  }

  return (
    <div className="dashboard-page space-y-8">
      <header className="dashboard-hero flex flex-col gap-5 sm:flex-row sm:items-center">
        <img src={resolveImage(user.image_url)} alt="" className="relative z-10 h-24 w-24 rounded-3xl border-4 border-white object-cover shadow-lg" />
        <div><p className="salon-eyebrow text-[var(--salon-copper)]">Customer portal</p>
        <h1 className="relative z-10 mt-2 font-serif text-3xl font-semibold sm:text-4xl">Welcome, {user.first_name} {user.last_name}</h1>
        <p className="relative z-10 mt-2 max-w-2xl text-stone-600">Book your next visit, check live professional availability, and follow every appointment from one place.</p></div>
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
        <h2 className="text-xl font-semibold">Choose a professional</h2>
        <p className="text-sm text-stone-600">Select a professional here or while booking. Exact availability is checked live for your chosen date and time; existing customers’ schedules remain private.</p>
        <div className="flex overflow-x-auto space-x-4 pb-3">
          {employees.map((emp) => (
            <div key={emp.id} className="dashboard-card min-w-[160px] text-center">
              <img
                src={resolveImage(emp.image_url)}
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

        {employees.length === 0 && <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">No professionals are currently marked available for online booking.</p>}
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
