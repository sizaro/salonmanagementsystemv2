import { useState, useEffect, useMemo } from "react";
import Modal from "../../components/Modal.jsx";
import ServiceForm from "../../components/ServiceForm";
import SectionForm from "../../components/SectionForm.jsx";
import NewServiceForm from "../../components/NewServiceForm.jsx";
import ExpenseForm from "../../components/ExpenseForm";
import AdvanceForm from "../../components/AdvanceForm";
import ClockForm from "../../components/ClockForm";
import TagFeeForm from "../../components/TagFeeForm.jsx";
import LateFeeForm from "../../components/LateFeeForm.jsx";
import CancelReasonForm from "../../components/CancelReasonForm.jsx";
import Button from "../../components/Button";
import { useData } from "../../context/DataContext.jsx";
import io from "socket.io-client";


export default function OwnerDashboard() {
  const [modalType, setModalType] = useState(null);
  const [salonStatus, setSalonStatus] = useState("closed");
  const [selectedFee, setSelectedFee] = useState(null);
  const [edittingServiceDefinition, setEdittingServiceDefinition] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelServiceId, setCancelServiceId] = useState(null);
  const [activeTab, setActiveTab] = useState("pending");

  const {
    services,
    sendFormData,
    sessions,
    users,
    fetchUsers,
    updateServiceTransactionById,
    updateServiceTransactionAppointment,
    fetchServiceTransactionById,
    updateServicet,
    fetchServiceById,
    fetchLateFeeById,
    createLateFee,
    updateLateFee,
    deleteLateFee,
    fetchTagFees,
    fetchTagFeeById,
    createTagFee,
    updateTagFee,
    deleteTagFee,
    isDataLoaded,
    sections,
    serviceDefinitions,
    createServiceDefinition,
    updateServiceDefinition,
    fetchServiceDefinitionById,
    deleteServiceDefinition,
    serviceMaterials = [],
    serviceRoles,
    fetchSections,
    createSection,
    updateSection,
    deleteSection,
    fetchServiceDefinitions,
    fetchServiceMaterials,
    fetchServiceRoles,
    createServiceTransaction,
    fetchServiceTransactions,
    fetchServiceTransactionsApp,
    pendingCount,
    pendingAppointments
  } = useData();


  
    const servicesWithMaterials = useMemo(() => {
      return (services.data || services || []).map((service) => {
        const matchedMaterials = (serviceMaterials || []).filter(
          (m) => m.service_definition_id === service.service_definition_id
        );
        return { ...service, materials: matchedMaterials.length > 0 ? matchedMaterials : null };
      });
    }, [services, serviceMaterials]);
  
    console.log("services with materials", servicesWithMaterials)
  const Employees = (users || []).filter(
    (user) =>
      `${user.first_name} ${user.last_name}`.toLowerCase() !== "ntege saleh" &&
      user.role !== "customer"
  );

  const createdbyID = (users || []).find(
    (user) => `${user.role}`.toLowerCase() === "owner"
  );

  const Customers = (users || []).filter((user) => user.role === "customer");

  const formatTime12h = (time24) => {
    if (!time24) return "N/A";
    let [hour, minute] = time24.split(":").map(Number);
    const ampm = hour >= 12 ? "PM" : "AM";
    if (hour === 0) hour = 12;
    else if (hour > 12) hour -= 12;
    return `${hour}:${minute.toString().padStart(2, "0")} ${ampm}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-UG", { timeZone: "Africa/Kampala" });
  };

  const handleSalonSession = async (status) => {
    try {
      let formData;
      if (status === "open") {
        formData = { openTime: new Date().toISOString(), closeTime: null, status: "open" };
        const res = await sendFormData("openSalon", formData);
        console.log("Salon opened:", res.data);
        setSalonStatus("open");
      } else if (status === "closed") {
        formData = { closeTime: new Date().toISOString(), status: "closed" };
        const res = await sendFormData("closeSalon", formData);
        console.log("Salon closed:", res.data);
        setSalonStatus("closed");
      }
    } catch (err) {
      console.error("Error handling salon session:", err.response?.data || err.message);
    }
  };

  const closeModal = () => {
    setModalType(null);
  };

  const createService = async (formData) => {
    try {
      await sendFormData("createService", formData);
      closeModal();
    } catch (err) {
      console.error("Failed to submit service", err);
    }
  };

  const createExpense = async (formData) => {
    try {
      await sendFormData("createExpense", formData);
      closeModal();
    } catch (err) {
      console.error("Failed to submit expense", err);
    }
  };

  const createAdvance = async (formData) => {
    try {
      await sendFormData("createAdvance", formData);
      closeModal();
    } catch (err) {
      console.error("Failed to submit advance", err);
    }
  };

  const handleClocking = async (type, formData) => {
    try {
      if (type === "clockin") await sendFormData("createClocking", formData);
      else if (type === "clockout") await sendFormData("updateClocking", formData);
      else console.error("Invalid clocking type");
    } catch (err) {
      console.error("Error handling clocking:", err.response?.data || err.message);
    }
  };

  const CreateTagFee = async (formData) => {
    try {
      await createTagFee(formData);
      closeModal();
    } catch (err) {
      console.error("Failed to submit tag fee", err);
    }
  };

  const CreateLateFee = async (formData) => {
    try {
      await createLateFee(formData);
      closeModal();
    } catch (err) {
      console.error("Failed to submit late fee", err);
    }
  };

  const appointmentsByStatus = {
    pending:(pendingAppointments || []),
    confirmed: (servicesWithMaterials || []).filter((s) => s.status === "confirmed"),
    completed: (servicesWithMaterials || []).filter((s) => s.status === "completed"),
    cancelled: (servicesWithMaterials || []).filter((s) => s.status === "cancelled"),
  };

  console.log("pending appointments in", pendingAppointments)

  useEffect(() => {
    if (sessions && sessions.length > 0) setSalonStatus(sessions[0].status);
    else setSalonStatus("closed");
  }, [sessions]);

  useEffect(() => {
    fetchUsers();
    fetchSections();
    fetchServiceDefinitions();
    fetchServiceMaterials();
    fetchServiceTransactions();

  }, []);

  const handleStatusUpdate = async (serviceId, newStatus, cancel_reason = null) => {
    try {
      const service = await fetchServiceTransactionById(serviceId);
      if (!service) return;
      await updateServiceTransactionById(serviceId, { ...service, status: newStatus, cancel_reason });
    } catch (err) {
      console.error("Failed to update service status", err);
    }
  };

  const handleAppointmentStatus = async (serviceId, newStatus, cancel_reason = null) => {
  try {
    const service = await fetchServiceTransactionById(serviceId);
    if (!service) return;

    await updateServiceTransactionAppointment(serviceId, { ...service, status: newStatus, cancel_reason });

    setActiveTab(newStatus);

    fetchServiceTransactions();
    fetchServiceTransactionsApp();
  } catch (err) {
    console.error("Failed to update service status", err);
  }
};


  const handleStatusUpdatet = async (serviceId, newStatus) => {
    try {
      const service = await fetchServiceById(serviceId);
      if (!service) return;
      await updateServicet(serviceId, { ...service, status: newStatus });
    } catch (err) {
      console.error("Failed to update service status", err);
    }
  };

  const handleEditSection = async (sectionOrId) => {
   await setSelectedItem(item);
    setModalType("edit_section");
  };

  const handleEditServiceDefinition = async (id) => {
    try {
        const serviceDef = await fetchServiceDefinitionById(id);
        await setEdittingServiceDefinition(serviceDef);
        setModalType("edit_service_definition");
      } catch (err) {
        console.error("Failed to fetch:", err);
      }
  };

  const handleAddServiceDefinition = async (formData) => {
  try {
    await createServiceDefinition(formData);
    closeModal();
  } catch (err) {
    console.error("Failed to create service definition", err);
  }
};


  const handleUpdateSection = async (formData) => {
    try {
      if (!selectedItem || !selectedItem.id) throw new Error("No section selected for update");
      await updateSection(selectedItem.id, formData);
      closeModal();
    } catch (err) {
      console.error("Failed to update section", err);
    }
  };

  const handleUpdateServiceDefinition = async (id, formData) => {
    try {
      if (!formData) throw new Error("No service definition selected for update");
      await updateServiceDefinition(id, formData);
      closeModal();
    } catch (err) {
      console.error("Failed to update service definition", err);
    }
  };

  const getRolesFromDef = (def) => def.roles || def.service_roles || def.role_list || [];
  const getMaterialsFromDef = (def) => def.materials || def.service_materials || def.material_list || [];
  const sumRolesAmount = (roles) => Array.isArray(roles) ? roles.reduce((sum, r) => sum + (parseFloat(r.amount || r.role_amount || r.earned_amount || 0) || 0), 0) : 0;
  const sumMaterialsCost = (materials) => Array.isArray(materials) ? materials.reduce((sum, m) => sum + (parseFloat(m.cost || m.material_cost || 0) || 0), 0) : 0;

  const handleDeleteSectionClick = async (id) => {
    try { await deleteSection(id); } catch (err) { console.error("Failed to delete section", err); }
  };

  const handleDeleteServiceDefinitionClick = async (id) => {
    try { await deleteServiceDefinition(id); } catch (err) { console.error("Failed to delete service definition", err); }
  };

  return (
    <>
      <div className="space-y-10">
        <div className="space-y-10">
          {salonStatus === "closed" ? (
            <Button className="bg-green-400 hover:bg-green-300" onClick={() => handleSalonSession("open")}>
              Open Salon
            </Button>
          ) : (
            <Button onClick={() => handleSalonSession("closed")}>Close Salon</Button>
          )}
        </div>

        <Button onClick={() => setModalType("service")}>Add Service</Button>
        <Button onClick={() => setModalType("expense")}>Add Expense</Button>
        <Button onClick={() => setModalType("advance")}>Add Advance</Button>
        <Button onClick={() => setModalType("clocking")}>Employee Clocking</Button>
        <Button onClick={() => setModalType("tagfee")}>Add Tag Fee</Button>
        <Button onClick={() => setModalType("latefee")}>Add Late Fee</Button>

        <h2 className="text-lg font-semibold mt-10">Service Setup</h2>
        <div className="flex gap-3 mt-3">
          <Button onClick={() => setModalType("new_section")}>Add Section</Button>
          <Button onClick={() => setModalType("new_service_definition")}>Add New Service</Button>
        </div>

        <section className="bg-white shadow-md rounded-lg p-4 mb-6">
  <h2 className="text-xl font-semibold text-blue-700 mb-4">Appointments</h2>

  <div className="flex gap-2 mb-4 flex-wrap">
    {["pending", "confirmed", "completed", "cancelled"].map((status) => (
      <button
        key={status}
        className={`px-4 py-2 rounded ${
          activeTab === status
            ? "bg-blue-500 text-white"
            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
        }`}
        onClick={() => setActiveTab(status)}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </button>
    ))}
  </div>

  <div className="flex flex-wrap gap-4">
    {appointmentsByStatus[activeTab].length > 0 ? (
      appointmentsByStatus[activeTab].map((s) => {
        const assigned = (s.performers || [])
          .map((p) => {
            const emp = Employees.find((e) => e.id === p.employee_id);
            const role = serviceRoles.find((r) => r.id === p.role_id);

            if (!emp || !role) return null;

            return {
              label: role.role_name,
              name: `${emp.first_name} ${emp.last_name}`,
            };
          })
          .filter(Boolean);

        const customer = Customers.find((c) => c.id === s.customer_id);

        return (
          <div
            key={s.id}
            className={`border rounded-lg p-4 w-[calc(33.333%-1rem)] min-w-[180px] ${
              activeTab === "pending"
                ? "bg-yellow-50 border-yellow-200"
                : activeTab === "confirmed"
                ? "bg-green-50 border-green-200"
                : activeTab === "completed"
                ? "bg-blue-50 border-blue-200"
                : "bg-red-50 border-red-200"
            }`}
          >
            <p className="font-medium">{s.service_name}</p>

            <p>
              Customer:{" "}
              {customer
                ? `${customer.first_name} ${customer.last_name}`
                : "N/A"}
            </p>

            <p>Date: {formatDate(s.appointment_date)}</p>
            <p>Time: {formatTime12h(s.appointment_time)}</p>
            <p>Customer Note: {s.customer_note}</p>

            {assigned.length > 0 ? (
              assigned.map((a, idx) => (
                <p key={idx} className="text-sm text-gray-700">
                  {a.label}:{" "}
                  <span className="font-medium">{a.name}</span>
                </p>
              ))
            )
            
            : (
              <p className="text-sm text-gray-500">No staff assigned</p>
            )}

            {s.status === "cancelled" && s.cancel_reason && (
              <p className="text-red-600 text-sm mt-2">
                <strong>Reason:</strong> {s.cancel_reason}
              </p>
            )}


            {activeTab === "pending" && (
              <div className="flex gap-2 mt-2">
                <Button onClick={() => handleAppointmentStatus(s.transaction_id, "confirmed")}>
                  Confirm
                </Button>
                <Button
                  onClick={() => {
                    setCancelServiceId(s.transaction_id);
                    setShowCancelModal(true);
                  }}
                >
                  Cancel
                </Button>
              </div>
            )}

            {activeTab === "confirmed" && (
              <div className="flex gap-2 mt-2">
                <Button onClick={() => handleAppointmentStatus(s.transaction_id, "completed")}>
                  Complete
                </Button>
                <Button
                  onClick={() => {
                    setCancelServiceId(s.transaction_id);
                    setShowCancelModal(true);
                  }}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        );
      })
    ) : (
      <p className="text-gray-500">No {activeTab} appointments</p>
    )}
  </div>
</section>


        <section className="mt-6">
          <h3 className="text-md font-semibold mb-2">Sections</h3>
          <table className="min-w-full border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-4 py-2 text-left">Name</th>
                <th className="border px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sections && sections.length > 0 ? (
                sections.map((section) => (
                  <tr key={section.id}>
                    <td className="border px-4 py-2">{section.section_name}</td>
                    <td className="border px-4 py-2 flex gap-2">
                      <Button onClick={() => handleEditSection(section)}>Edit</Button>
                      <Button onClick={() => handleDeleteSectionClick(section.id)}>Delete</Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="border px-4 py-2" colSpan={2}>No sections available</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="mt-6">
          <h3 className="text-md font-semibold mb-2">Service Definitions</h3>
          <table className="min-w-full border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-4 py-2 text-left">Name</th>
                <th className="border px-4 py-2 text-left">Section</th>
                <th className="border px-4 py-2 text-left">Roles</th>
                <th className="border px-4 py-2 text-left">Other Services</th>
                <th className="border px-4 py-2 text-left">Employees Total Amount</th>
                <th className="border px-4 py-2 text-left">Other services Total Costs</th>
                <th className="border px-4 py-2 text-left">Salon Amount</th>
                <th className="border px-4 py-2 text-left">Full Amount</th>
                <th className="border px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {serviceDefinitions && serviceDefinitions.length > 0 ? (
                serviceDefinitions.map((service) => {
                  const roles = getRolesFromDef(service);
                  const materials = getMaterialsFromDef(service);
                  const totalRoles = sumRolesAmount(roles);
                  const totalMaterials = sumMaterialsCost(materials);

                  const displayName = service.name || service.service_name || service.serviceName || "N/A";
                  const displaySalon = (service.salon_amount ?? service.salonAmount ?? service.salon) || "0";
                  const displayFull = (service.full_amount ?? service.service_amount ?? service.price) || "0";

                  const sectionName =
                    (sections || []).find((s) => String(s.id) === String(service.section_id))?.section_name ||
                    (sections || []).find((s) => String(s.id) === String(service.section_id))?.name ||
                    service.section_name ||
                    "N/A";

                  return (
                    <tr key={service.id}>
                      <td className="border px-4 py-2 align-top">{displayName}</td>
                      <td className="border px-4 py-2 align-top">{sectionName}</td>
                      <td className="border px-4 py-2 align-top">
                        {roles && roles.length > 0 ? (
                          <ul className="list-disc ml-4">
                            {roles.map((r, idx) => (
                              <li key={idx}>
                                {(r.role_name || r.role || r.name) || "role"}: <span className="font-semibold">{(r.role_amount || r.amount || r.earned_amount || 0).toString()}</span>
                              </li>
                            ))}
                          </ul>
                        ) : <span className="text-gray-500">None</span>}
                      </td>
                      <td className="border px-4 py-2 align-top">
                        {materials && materials.length > 0 ? (
                          <ul className="list-disc ml-4">
                            {materials.map((m, idx) => (
                              <li key={idx}>
                                {(m.material_name || m.name) || "material"}: <span className="font-semibold">{(m.material_cost || m.cost || 0).toString()}</span>
                              </li>
                            ))}
                          </ul>
                        ) : <span className="text-gray-500">None</span>}
                      </td>
                      <td className="border px-4 py-2 align-top font-semibold">{totalRoles}</td>
                      <td className="border px-4 py-2 align-top font-semibold">{totalMaterials}</td>
                      <td className="border px-4 py-2 align-top font-semibold">{displaySalon}</td>
                      <td className="border px-4 py-2 align-top font-semibold">{displayFull}</td>
                      <td className="border px-4 py-2 flex gap-2 align-top">
                        <Button onClick={() => handleEditServiceDefinition(service.id)}>Edit</Button>
                        <Button onClick={() => handleDeleteServiceDefinitionClick(service.id)}>Delete</Button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="border px-4 py-2" colSpan={9}>No service definitions available</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <Modal isOpen={modalType !== null} onClose={closeModal}>
          {modalType === "service" && (
            <ServiceForm
              onSubmit={createServiceTransaction}
              onClose={closeModal}
              Services={serviceDefinitions}
              Roles={serviceRoles}
              Employees={Employees}
              Sections={sections}
              createdBy={createdbyID?.id}
              serviceStatus={null}
            />
          )}
          {modalType === "expense" && <ExpenseForm onSubmit={createExpense} onClose={closeModal} />}
          {modalType === "advance" && <AdvanceForm onSubmit={createAdvance} onClose={closeModal} />}
          {modalType === "clocking" && <ClockForm onSubmit={handleClocking} onClose={closeModal} employees={Employees} />}
          {modalType === "tagfee" && <TagFeeForm onSubmit={CreateTagFee} onClose={closeModal} feeData={selectedFee} employees={Employees || []} />}
          {modalType === "latefee" && <LateFeeForm onSubmit={CreateLateFee} onClose={closeModal} feeData={selectedFee} employees={Employees || []} />}
          {modalType === "new_section" && <SectionForm onSubmit={createSection} onClose={closeModal} sectionData={null} />}
          {modalType === "edit_section" && <SectionForm onSubmit={handleUpdateSection} onClose={closeModal} sectionData={selectedItem} />}
          {modalType === "new_service_definition" && <NewServiceForm onSubmit={handleAddServiceDefinition} onClose={closeModal} Sections={sections} />}
          {modalType === "edit_service_definition" && <NewServiceForm onSubmit={handleUpdateServiceDefinition} onClose={closeModal} Sections={sections} serviceData={edittingServiceDefinition} />}
        </Modal>

        <Modal isOpen={showCancelModal} onClose={() => setShowCancelModal(false)}>
          <CancelReasonForm serviceId={cancelServiceId} onSubmit={handleAppointmentStatus} onClose={() => setShowCancelModal(false)} />
        </Modal>
      </div>
    </>
  );
}
