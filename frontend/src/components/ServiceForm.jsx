import React, { useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";

const APPOINTMENT_TIME_SLOTS = Array.from({ length: 32 }, (_, index) => {
  const totalMinutes = (8 * 60) + (index * 30);
  const hour = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minute = String(totalMinutes % 60).padStart(2, "0");
  return `${hour}:${minute}`;
});

export default function ServiceForm({
  isCustomer = false,
  onSubmit,
  onClose,
  Sections,
  Services,
  Roles,
  Employees,
  Appointments = [],
  getAppointmentAvailability,
  createdBy,
  customerId = null,
  serviceStatus,
  serviceData = null,
  entryType = "current",
}) {

  console.log("sections in the service form", Sections)
  console.log("roles in the service form", Roles)
  console.log("service definitions in the service form", Services)
  console.log("service transactioin to be edited in the service form", serviceData)
  
  const [sections, setSections] = useState(Sections);
  const [services, setServices] = useState([]);
  const [roles, setRoles] = useState([]);
  const [employees, setEmployees] = useState(Employees);
  const [serviceAmount, setServiceAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [remoteBusyEmployeeIds, setRemoteBusyEmployeeIds] = useState([]);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  console.log("employees to be edited in the service form", Employees)

  const [form, setForm] = useState({
    id:null,
    section_id: "",
    service_definition_id: "",
    appointment_date: "",
    appointment_time: "",
    customerNote: "",
    status: serviceStatus || null,
    performers: [],
  });

  // --------------------------
  // Prefill form for editing
  // --------------------------
  useEffect(() => {
    if (serviceData) {
      const sectionId = serviceData.definition_section_id ?? serviceData.section_id;
      setForm({
        id: serviceData.transaction_id ?? serviceData.id,
        section_id: sectionId,
        service_definition_id: serviceData.service_definition_id,
        appointment_date: serviceData.appointment_date || "",
        appointment_time: serviceData.appointment_time || "",
        customerNote: serviceData.customer_note || "",
        status: serviceData.status || serviceStatus || null,
        performers: (serviceData.performers || []).map((performer) => ({
          ...performer,
          role_id: performer.role_id ?? performer.service_role_id,
          earned_amount: performer.earned_amount ?? performer.role_amount,
        })),
      });

      setServices(Services.filter((s) => Number(s.section_id) === Number(sectionId)));

      if (serviceData.service_definition_id) {
        const matchingRoles = Roles.filter(
          (r) => Number(r.service_definition_id) === Number(serviceData.service_definition_id)
        );
        setRoles(matchingRoles);
        setServiceAmount(Number(serviceData.full_amount || serviceData.service_amount || 0));
      }
    }
  }, [serviceData, Services, Roles, serviceStatus]);

  useEffect(() => {
    setSections(Sections || []);
  }, [Sections]);

  useEffect(()=>{
    setEmployees(Employees || [])
  }, [Employees])

  // --------------------------
  // When a section is selected
  // --------------------------
  const handleSectionSelect = (id) => {
    setForm({
      ...form,
      section_id: id,
      service_definition_id: "",
      performers: [],
    });

    setRoles([]);
    setServices(Services.filter((s) => Number(s.section_id) === Number(id)));
  };

  // --------------------------
  // When a service is selected
  // --------------------------
const handleServiceSelect = (e) => {
  const id = Number(e.target.value);

  // retrieve the object
  const serviceObj = JSON.parse(
    e.target.selectedOptions[0].dataset.service
  );

  console.log("Selected service object:", serviceObj);

  const matchingRoles = Roles.filter(
    (r) => Number(r.service_definition_id) === Number(id)
  );

  const performers = matchingRoles.map((role) => {
    const isSalon = role.role_name.toLowerCase() === "salon";

    return {
      role_id: role.id,
      employee_id: isSalon ? null : "",
      earned_amount: role.earned_amount,
    };
  });

  setForm({
    ...form,
    service_definition_id: id,
    performers,
  });

  setServiceAmount(Number(serviceObj.service_amount));
  setRoles(matchingRoles);
};



  const handleCustomerNote = (e) => {
    setForm({
      ...form,
      customerNote:e.target.value
    });
  };

  // --------------------------
  // Update performer employee
  // --------------------------
  const updatePerformer = (roleId, employeeId) => {
    const updated = form.performers.map((p) =>
      Number(p.role_id) === Number(roleId)
        ? { ...p, employee_id: employeeId === "" ? null : employeeId }
        : p
    );

    setForm({ ...form, performers: updated });
  };

  const busyEmployeeIds = useMemo(() => {
    if (!isCustomer || !form.appointment_date || !form.appointment_time) {
      return new Set();
    }

    const requestedTime = form.appointment_time.slice(0, 5);
    const currentId = Number(form.id);
    return new Set([
      ...remoteBusyEmployeeIds,
      ...(
      (Appointments || [])
        .filter((appointment) => {
          const appointmentId = Number(appointment.transaction_id ?? appointment.id);
          return appointmentId !== currentId &&
            ["pending", "confirmed"].includes(String(appointment.status).toLowerCase()) &&
            appointment.appointment_date?.slice(0, 10) === form.appointment_date &&
            appointment.appointment_time?.slice(0, 5) === requestedTime;
        })
        .flatMap((appointment) => appointment.performers || [])
        .map((performer) => Number(performer.employee_id))
        .filter(Number.isInteger)
      ),
    ]);
  }, [Appointments, form.appointment_date, form.appointment_time, form.id, isCustomer, remoteBusyEmployeeIds]);

  useEffect(() => {
    if (!isCustomer || busyEmployeeIds.size === 0) return;
    setForm((current) => {
      let changed = false;
      const performers = current.performers.map((performer) => {
        if (!busyEmployeeIds.has(Number(performer.employee_id))) return performer;
        changed = true;
        return { ...performer, employee_id: "" };
      });
      return changed ? { ...current, performers } : current;
    });
  }, [busyEmployeeIds, isCustomer]);

  useEffect(() => {
    if (!isCustomer || !form.appointment_date || !form.appointment_time || !getAppointmentAvailability) {
      setRemoteBusyEmployeeIds([]);
      return;
    }

    let active = true;
    setCheckingAvailability(true);
    const timer = setTimeout(() => {
      getAppointmentAvailability(form.appointment_date, form.appointment_time)
        .then((ids) => {
          if (active) setRemoteBusyEmployeeIds(Array.isArray(ids) ? ids : []);
        })
        .catch(() => {
          if (active) setSubmitError("Availability could not be checked. Try again before submitting.");
        })
        .finally(() => {
          if (active) setCheckingAvailability(false);
        });
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [form.appointment_date, form.appointment_time, getAppointmentAvailability, isCustomer]);

  // --------------------------
  // SUBMIT (create or update)
  // --------------------------

  const handleSubmit = async (e) => {
  e.preventDefault();
  setSubmitError("");

  if (!form.section_id || !form.service_definition_id) {
    setSubmitError("Select a section and service.");
    return;
  }
  if (isCustomer && (!form.appointment_date || !form.appointment_time)) {
    setSubmitError("Select an appointment date and time.");
    return;
  }

  const missingRole = roles.find((role) => {
    if (role.role_name?.trim().toLowerCase() === "salon") return false;
    return !form.performers.find(
      (performer) => Number(performer.role_id) === Number(role.id) && performer.employee_id,
    );
  });
  if (missingRole) {
    setSubmitError(`Select an employee for ${missingRole.role_name}.`);
    return;
  }

  const payload = {
  id: form.id || null,

  section_id: form.section_id,
  service_definition_id: form.service_definition_id,

  entry_type: entryType,

  appointment_date: isCustomer 
    ? form.appointment_date 
    : null,

  appointment_time: isCustomer 
    ? form.appointment_time 
    : null,

  created_by: createdBy,

  customer_id: customerId,

  customer_note: form.customerNote,

  status: form.status || serviceStatus || null,

  performers: form.performers.map((p) => ({
    role_id: p.role_id,
    employee_id: p.employee_id === "" ? null : p.employee_id,
    earned_amount: p.earned_amount,
  })),
};

  // ⬇️ DEEP LOG - shows the REAL payload sent to backend
  console.log(
    "🟦 FINAL PAYLOAD SENT TO BACKEND →\n",
    JSON.stringify(payload, null, 2)
  );

  const transactionId = serviceData?.transaction_id ?? serviceData?.id;
  try {
    setSubmitting(true);
    if (serviceData && transactionId) {
      await onSubmit(transactionId, payload);
    } else {
      await onSubmit(payload);
    }
    if (onClose) onClose();
  } catch (error) {
    setSubmitError(
      error?.response?.data?.message || error?.response?.data?.error ||
      "The appointment could not be submitted. Please try again.",
    );
  } finally {
    setSubmitting(false);
  }
};


  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full p-4 max-h-[80vh] overflow-y-auto">
      {/* SECTION SELECT */}

      {isCustomer && (
        <>
          <p className="text-sm text-gray-700 bg-yellow-100 p-2 rounded">
          Note: Your appointment will only remain valid for <b>10 minutes</b> after the scheduled time.
          After that, the employee may attend to another client, and you may have to wait.
          </p>
        </>
      )}
      <div className="flex flex-col">
        <label>Section</label>
        <select
          value={form.section_id}
          onChange={(e) => handleSectionSelect(Number(e.target.value))}
          required
        >
          <option value="">Select Section</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.section_name}
            </option>
          ))}
        </select>
      </div>

      {/* SERVICE SELECT */}
      {services.length > 0 && (
        <div className="flex flex-col">
          <label>Service</label>
          <select
            value={form.service_definition_id}
            onChange={handleServiceSelect}
            required
          >
            <option value="">Select Service</option>
            {services.map((s) => (
              <option 
                key={s.id} 
                value={s.id}
                data-service={JSON.stringify(s)}
              >
                {s.service_name}
              </option>
            ))}
          </select>

        </div>
      )}

      {/* PERFORMERS (Salon hidden) */}
      {roles.length > 0 && (
          <div className="flex flex-col gap-2">
          {checkingAvailability && <p className="text-xs text-blue-600">Checking employee availability…</p>}
          {roles.map((role) => {
            const isSalon =
              role.role_name && role.role_name.toLowerCase() === "salon";
            if (isSalon) return null;

            return (
              <div key={role.id} className="flex flex-col">
                <label>{role.role_name}</label>
                <select
                  className="overflow-y-auto"
                  value={
                    form.performers.find((p) => Number(p.role_id) === Number(role.id))
                      ?.employee_id || ""
                  }
                  onChange={(e) => updatePerformer(role.id, e.target.value)}
                  required
                >
                  <option value="">select employee</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id} disabled={busyEmployeeIds.has(Number(emp.id))}>
                      {emp.first_name} {emp.last_name}{busyEmployeeIds.has(Number(emp.id)) ? " — booked" : ""}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      )}

      {/* CUSTOMER DATE & TIME */}
      {isCustomer && (
        <>
          <div className="flex flex-col">
            <label>Appointment Date</label>
            <input
              type="date"
              min={DateTime.now().setZone("Africa/Kampala").toISODate()}
              value={form.appointment_date}
              onChange={(e) =>
                setForm({ ...form, appointment_date: e.target.value })
              }
              required
            />
          </div>

          <div className="flex flex-col">
            <label>Appointment Time</label>
            <select
              value={form.appointment_time}
              onChange={(e) =>
                setForm({ ...form, appointment_time: e.target.value })
              }
              required
            >
              <option value="">Select a time</option>
              {APPOINTMENT_TIME_SLOTS.map((time) => (
                <option key={time} value={time}>{time}</option>
              ))}
            </select>
            <span className="mt-1 text-xs text-gray-500">
              24-hour time, available in 30-minute intervals.
            </span>
          </div>

          <div className="flex flex-col">
            <label className="block mb-1 font-medium">Additional Information</label>
             <textarea
              name="customerNote"
              value={form.customerNote}
              onChange={handleCustomerNote}
              placeholder="Any special requests or details..."
              className="w-full border rounded px-2 py-1"
            />
          </div>

          {
            form.service_definition_id && (
              <p className="rounded-lg bg-green-50 p-3 text-gray-700 font-medium">
                Online booking price: <span className="text-green-700">UGX {Math.max(0, Math.round(Number(serviceAmount || 0) * 0.95)).toLocaleString()}</span>
                <span className="ml-2 text-sm text-gray-500 line-through">UGX {Number(serviceAmount || 0).toLocaleString()}</span>
                <span className="mt-1 block text-xs text-green-700">5% online booking discount</span>
          </p>
            )
          }
        </>
      )}

      {submitError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{submitError}</p>}

      <button type="submit" disabled={submitting} className="bg-blue-500 text-white p-2 rounded disabled:cursor-not-allowed disabled:opacity-60">
        {submitting ? "Submitting…" : serviceData ? "Save Changes" : isCustomer ? "Request Appointment" : "Add Service"}
      </button>
    </form>
  );
}












// const menMap = {
//   '7000-service': { serviceAmount: 7000, salonAmount: 4000, barberAmount: 2000, barberAssistantAmount: 1000 },
//   '6000-service': { serviceAmount: 6000, salonAmount: 3000, barberAmount: 2000, barberAssistantAmount: 1000 },
//   '5000-service': { serviceAmount: 5000, salonAmount: 3000, barberAmount: 2000 },
//   'child-service': { serviceAmount: 3000, salonAmount: 2000, barberAmount: 1000 },
//   'beard-service': { serviceAmount: 3000, salonAmount: 2000, barberAmount: 1000 },
//   'haircut-blackmask-12000': { serviceAmount: 12000, salonAmount: 4000, barberAmount: 2000, barberAssistantAmount: 1000, blackMaskAmount: 4000, blackMaskAssistantAmount: 1000 },
//   'haircut-blackshampoo-12000': { serviceAmount: 12000, salonAmount: 4000, barberAmount: 2000, barberAssistantAmount: 1000, blackShampooAmount: 3500, blackShampooAssistantAmount: 1500 },
//   'haircut-blackshampoo-10000': { serviceAmount: 10000, salonAmount: 4000, barberAmount: 2000, barberAssistantAmount: 1000, blackShampooAmount: 3000, blackShampooAssistantAmount: 1000 },
//   'haircut-superblack-15000': { serviceAmount: 15000, salonAmount: 4000, barberAmount: 2000, barberAssistantAmount: 1000, superBlackAmount: 6000, superBlackAssistantAmount: 2000 },
//   'trimming-scrub-5000': { serviceAmount: 5000, salonAmount: 3000, barberAmount: 1000, barberAssistantAmount: 1000 },
//   'haircut-honey-10000': { serviceAmount: 10000, salonAmount: 6000, barberAmount: 2000, barberAssistantAmount: 2000 },
//   'haircut-women': { serviceAmount: 10000, salonAmount: 6000, barberAmount: 4000 },
//   'scrub-only-3000': { serviceAmount: 3000, salonAmount: 2000, scrubAmount: 2000, scrubAssistantAmount: 1000 },
//   'scrub-only-5000': { serviceAmount: 5000, salonAmount: 4000, scrubAmount: 4000, scrubAssistantAmount: 1000 },
//   'blackshampoo-only-3000': { serviceAmount: 3000, blackShampooAmount: 2000, blackShampooAssistantAmount: 1000 },
//   'blackshampoo-only-5000': { serviceAmount: 5000, blackShampooAmount: 4000, blackShampooAssistantAmount: 1000 },
//   'superblack-only-8000': { serviceAmount: 8000, salonAmount: 6000, superBlackAssistantAmount: 2000 }
// };

// const womenMap = {
//   'Cornrows (Natural Kiswahili) 10000': { serviceAmount: 10000, salonAmount: 5000, womenEmployeeAmount: 5000 },
//   'Cornrows with Braids (Kiswahili with Braids) 20000': { serviceAmount: 20000, salonAmount: 10000, womenEmployeeAmount: 10000 },
//   'Kinky Hairstyles 30000': { serviceAmount: 30000, salonAmount: 15000, womenEmployeeAmount: 15000 },
//   'Twist Small 45000': { serviceAmount: 45000, salonAmount: 22500, womenEmployeeAmount: 22500 },
//   'Twist Big 35000': { serviceAmount: 35000, salonAmount: 17500, womenEmployeeAmount: 17500 },
//   'Spring Twist 20000': { serviceAmount: 20000, salonAmount: 10000, womenEmployeeAmount: 10000 },
//   'Kinky Twist 30000': { serviceAmount: 30000, salonAmount: 15000, womenEmployeeAmount: 15000 },
//   'Braids (Kanasatu) 30000': { serviceAmount: 30000, salonAmount: 15000, womenEmployeeAmount: 15000 },
//   'Crochet Braids 30000': { serviceAmount: 30000, salonAmount: 15000, womenEmployeeAmount: 15000 },
//   'Knotless Braids 35000': { serviceAmount: 35000, salonAmount: 17500, womenEmployeeAmount: 17500 },
//   'Coco Twist 35000': { serviceAmount: 35000, salonAmount: 17500, womenEmployeeAmount: 17500 },
//   'Natural Dreads 60000': { serviceAmount: 60000, salonAmount: 30000, womenEmployeeAmount: 30000 },
//   'Artificial Dreads 50000': { serviceAmount: 50000, salonAmount: 25000, womenEmployeeAmount: 25000 },
//   'Pro Dry Movit 7000': { serviceAmount: 7000, salonAmount: 5000, womenEmployeeAmount: 2000 },
//   'Pro Dry Radiant 10000': { serviceAmount: 10000, salonAmount: 7000, womenEmployeeAmount: 3000 },
//   'Pro Dry Retouch 25000': { serviceAmount: 25000, salonAmount: 15000, womenEmployeeAmount: 10000 },
//   'Retouch 35k 35000': { serviceAmount: 35000, salonAmount: 20000, womenEmployeeAmount: 15000 },
//   'Retouch 45k 45000': { serviceAmount: 45000, salonAmount: 30000, womenEmployeeAmount: 15000 },
//   'Simple Makeup 5000': { serviceAmount: 5000, salonAmount: 3000, womenEmployeeAmount: 2000 },
//   'Simple Makeup 10000': { serviceAmount: 10000, salonAmount: 7000, womenEmployeeAmount: 3000 },
//   'Repair 20000': { serviceAmount: 20000, salonAmount: 10000, womenEmployeeAmount: 10000 },
//   'Dreadlock Repair 25000': { serviceAmount: 25000, salonAmount: 12500, womenEmployeeAmount: 12500 },
//   'Pencil Hairstyle 35000': { serviceAmount: 35000, salonAmount: 17500, womenEmployeeAmount: 17500 },
// };


// const nailsMap = {
//   // Nail Cutting
//   'Nail Cutting Hands 3000': { serviceAmount: 3000, salonAmount: 1500, nailEmployeeAmount: 1500 },
//   'Nail Cutting Feet 3000': { serviceAmount: 3000, salonAmount: 1500, nailEmployeeAmount: 1500 },
//   'Nail Cutting Both 6000': { serviceAmount: 6000, salonAmount: 3000, nailEmployeeAmount: 3000 },

//   // Henne
//   'Henne Hands Low 5000': { serviceAmount: 5000, salonAmount: 2500, nailEmployeeAmount: 2500 },
//   'Henne Feet Low 5000': { serviceAmount: 5000, salonAmount: 2500, nailEmployeeAmount: 2500 },
//   'Henne Hands High 10000': { serviceAmount: 10000, salonAmount: 5000, nailEmployeeAmount: 5000 },
//   'Henne Feet High 10000': { serviceAmount: 10000, salonAmount: 5000, nailEmployeeAmount: 5000 },
//   'Henne Both High 20000': { serviceAmount: 20000, salonAmount: 10000, nailEmployeeAmount: 10000 },

//   // Normal Polish
//   'Normal Polish Hands 5000': { serviceAmount: 5000, salonAmount: 2500, nailEmployeeAmount: 2500 },
//   'Normal Polish Feet 5000': { serviceAmount: 5000, salonAmount: 2500, nailEmployeeAmount: 2500 },
//   'Normal Polish Both 10000': { serviceAmount: 10000, salonAmount: 5000, nailEmployeeAmount: 5000 },

//   // Foot Scrubbing
//   'Foot Scrubbing Low 10000': { serviceAmount: 10000, salonAmount: 5000, nailEmployeeAmount: 5000 },
//   'Foot Scrubbing High 15000': { serviceAmount: 15000, salonAmount: 7500, nailEmployeeAmount: 7500 },

//   // Gel Polish
//   'Gel Polish Hands Low 10000': { serviceAmount: 10000, salonAmount: 5000, nailEmployeeAmount: 5000 },
//   'Gel Polish Feet Low 10000': { serviceAmount: 10000, salonAmount: 5000, nailEmployeeAmount: 5000 },
//   'Gel Polish Hands High 15000': { serviceAmount: 15000, salonAmount: 7500, nailEmployeeAmount: 7500 },
//   'Gel Polish Feet High 15000': { serviceAmount: 15000, salonAmount: 7500, nailEmployeeAmount: 7500 },
//   'Gel Polish Both 20000': { serviceAmount: 20000, salonAmount: 10000, nailEmployeeAmount: 10000 },
//   'Gel Polish Both High 30000': { serviceAmount: 30000, salonAmount: 15000, nailEmployeeAmount: 15000 },

//   // Artificial + Gel
//   'Artificial + Gel Hands 20000': { serviceAmount: 20000, salonAmount: 10000, nailEmployeeAmount: 10000 },
//   'Artificial + Gel Feet 20000': { serviceAmount: 20000, salonAmount: 10000, nailEmployeeAmount: 10000 },
//   'Artificial + Gel Both 40000': { serviceAmount: 40000, salonAmount: 20000, nailEmployeeAmount: 20000 },

//   // Artificial + Normal
//   'Artificial + Normal Hands Low 10000': { serviceAmount: 10000, salonAmount: 5000, nailEmployeeAmount: 5000 },
//   'Artificial + Normal Feet Low 10000': { serviceAmount: 10000, salonAmount: 5000, nailEmployeeAmount: 5000 },
//   'Artificial + Normal Hands High 15000': { serviceAmount: 15000, salonAmount: 7500, nailEmployeeAmount: 7500 },
//   'Artificial + Normal Feet High 15000': { serviceAmount: 15000, salonAmount: 7500, nailEmployeeAmount: 7500 },
//   'Artificial + Normal Both Low 20000': { serviceAmount: 20000, salonAmount: 10000, nailEmployeeAmount: 10000 },
//   'Artificial + Normal Both High 30000': { serviceAmount: 30000, salonAmount: 15000, nailEmployeeAmount: 15000 },

//   // Builder
//   'Builder Hands 25000': { serviceAmount: 25000, salonAmount: 12500, nailEmployeeAmount: 12500 },
//   'Builder Feet 25000': { serviceAmount: 25000, salonAmount: 12500, nailEmployeeAmount: 12500 },
//   'Builder Both 50000': { serviceAmount: 50000, salonAmount: 25000, nailEmployeeAmount: 25000 },

//   // Airbrush Design
//   'Airbrush Design Hands 5000': { serviceAmount: 5000, salonAmount: 2500, nailEmployeeAmount: 2500 },
//   'Airbrush Design Feet 5000': { serviceAmount: 5000, salonAmount: 2500, nailEmployeeAmount: 2500 },
//   'Airbrush Design Both 10000': { serviceAmount: 10000, salonAmount: 5000, nailEmployeeAmount: 5000 },

//   // Polygel
//   'Polygel Hands 30000': { serviceAmount: 30000, salonAmount: 15000, nailEmployeeAmount: 15000 },
//   'Polygel Feet 30000': { serviceAmount: 30000, salonAmount: 15000, nailEmployeeAmount: 15000 },
//   'Polygel Both 60000': { serviceAmount: 60000, salonAmount: 30000, nailEmployeeAmount: 30000 },

//   // Power Nail
//   'Power Nail Hands 30000': { serviceAmount: 30000, salonAmount: 15000, nailEmployeeAmount: 15000 },
//   'Power Nail Feet 30000': { serviceAmount: 30000, salonAmount: 15000, nailEmployeeAmount: 15000 },
//   'Power Nail Both 60000': { serviceAmount: 60000, salonAmount: 30000, nailEmployeeAmount: 30000 },
// };

// export default function ServiceForm({ onSubmit, onClose, serviceData, Employees, isCustomer = false, createdBy, serviceStatus, customerId=null, Services}) {
//   const [formData, setFormData] = useState({
//     section: "",
//     service: "",
//     barber: "",
//     barberAssistant: "",
//     scrubberAssistant: "",
//     blackMaskAssistant: "",
//     blackShampooAssistant: "",
//     superBlackAssistant: "",
//     service_timestamp: "",
//     customerNote: "",
//     created_by: createdBy,
//     status: serviceStatus,
//     appointment_time:"",
//     appointment_date: "",
//     womenEmployeeId: '',
//     womenEmployeeAmount: '',
//     nailEmployeeId: '',
//     nailEmployeeAmount: '',
//     customer_id: customerId,
//   });

//   console.log("these are the employees in the service form:", Employees)

//   console.log("this is the service to be edited in the service form:", serviceData)

//   const [serviceAmount, setServiceAmount] = useState(0);
//   const [employees, setFilteredEmployees] = useState([]);

  
// const [section, setSection] = useState("");
// const [services, setServices] = useState([]);

// const handleSectionChange = (section) => {
//   if (section === "men") {
//     const menServices = Object.keys(menMap);
//     setServices(menServices);
//     setSection(section);
//     setFormData((prev) => ({ ...prev, section }));
//   } 
//   else if (section === "women") {
//     const womenServices = Object.keys(womenMap);
//     setServices(womenServices);
//     setSection(section);
//     setFormData((prev) => ({ ...prev, section }));
//   } 
//   else if (section === "nails") {
//     const nailServices = Object.keys(nailsMap);
//     setServices(nailServices);
//     setSection(section);
//     setFormData((prev) => ({ ...prev, section:section}))
//   } 
//   else {
//     setServices([]);
//     setSection("");
//     setFormData((prev) => ({ ...prev, section: "" })); // ✅ reset formData.section
//   }
// };



// useEffect(() => {
//   if (serviceData) {
//     setFormData({
//       id: serviceData.id || "",
//       section: serviceData.section || "",
//       service: serviceData.name || "",
//       barber: serviceData.barber || null,
//       barberAssistant: serviceData.barber_assistant || null,
//       scrubberAssistant: serviceData.scrubber_assistant || null,
//       blackMaskAssistant: serviceData.black_mask_assistant || null,
//       blackShampooAssistant: serviceData.black_shampoo_assistant || null,
//       superBlackAssistant: serviceData.super_black_assistant || null,

//       womenEmployeeId: serviceData.wome_emp || "",
//       womenEmployeeAmount: serviceData.women_emp_amt || "",
//       nailEmployeeId: serviceData.nail_emp || "",
//       nailEmployeeAmount: serviceData.nail_emp_amt || "",

//       service_timestamp: serviceData.service_timestamp || "",
//       customerNote: serviceData.customer_note || "",
//       created_by: createdBy,
//       status: serviceStatus,
//       appointment_time: serviceData.appointment_time || "",
//       appointment_date: serviceData.appointment_date || "",
//       customer_id: customerId,
//     });
//   }
// }, [serviceData]);


// useEffect(() => {
//   if (formData.section) {
//     handleSectionChange(formData.section);
//   }
// }, [formData.section]);

// useEffect(() => {
//   if (Employees && Employees?.length > 0) {
//     setFilteredEmployees(Employees)
//   }
// }, [Employees]);



//   // Update service amount dynamically
//  useEffect(() => {
//     const currentMap =
//       section === "men" ? menMap :
//       section === "women" ? womenMap :
//       section === "nails" ? nailsMap :
//       {};
//     const selected = currentMap[formData.service];
//     setServiceAmount(selected ? selected.serviceAmount : 0);
//   }, [formData.service, section]);

//   useEffect(() => {
//   if (!formData.appointment_date || !formData.appointment_time) {
//     setFilteredEmployees(Employees);
//     return;
//   }

//   // Filter out employees who already have CONFIRMED services at the selected date & time
//   const unavailableEmployeeIds = Services
//     ?.filter(
//       (service) =>
//         service.status === "confirmed" && // ✅ Only confirmed services matter
//         service.appointment_date === formData.appointment_date &&
//         service.appointment_time === formData.appointment_time
//     )
//     .flatMap((s) => [
//       s.barber_id,
//       s.barber_assistant_id,
//       s.scrubber_assistant_id,
//       s.black_mask_assistant_id,
//       s.black_shampoo_assistant_id,
//       s.super_black_assistant_id,
//     ])
//     .filter(Boolean);

//   const availableEmployees = Employees.filter(
//     (emp) => !unavailableEmployeeIds.includes(emp.id)
//   );

//   setFilteredEmployees(availableEmployees);
// }, [formData.appointment_date, formData.appointment_time, serviceData, Employees]);


//   const handleChange = (e) => {
//   let { name, value } = e.target;
//   setFormData((prev) => ({ ...prev, [name]: value }));
// };


//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     const {
//       id,
//       section,
//       service,
//       barber,
//       barberAssistant,
//       scrubberAssistant,
//       blackShampooAssistant,
//       superBlackAssistant,
//       blackMaskAssistant,
//       service_timestamp,
//       customerNote,
//       created_by,
//       status,
//       appointment_date,
//       appointment_time,
//       customer_id,

//     } = formData;

//     let formattedTime = appointment_time; // "09:00 AM"

// // Convert to 24-hour format when saving:
// if (formattedTime) {
//   const [time, modifier] = formattedTime.split(" ");
//   let [hours, minutes] = time.split(":").map(Number);
//   if (modifier === "PM" && hours !== 12) hours += 12;
//   if (modifier === "AM" && hours === 12) hours = 0;
//   formattedTime = `${hours.toString().padStart(2, "0")}:${minutes}`;
// }

//    // All service maps
// const allMaps = {
//   men: menMap,
//   women: womenMap,
//   nails: nailsMap,
// };

// // Convert empty values to null and ensure numbers
// const toNullableNumber = (val) => {
//   if (val === "" || val === " " || val === null || val === undefined) return null;
//   return Number(val);
// };

// // Grab the map for the current section
// const calculationMap = allMaps[formData.section];
// if (!calculationMap) return alert("Invalid section selected");

// // Grab the service calculation object
// const calculation = calculationMap[formData.service];
// if (!calculation) return alert("Invalid service selected");

// // Build payload dynamically based on section
// const payload = {
//   id,
//   section: formData.section,
//   name: formData.service,
//   service_amount: calculation.serviceAmount || 0,
//   salon_amount: calculation.salonAmount || 0,
//   customer_note: formData.customerNote,
//   created_by,
//   status,
//   appointment_date: formData.appointment_date,
//   appointment_time: formData.appointment_time,
//   customer_id: formData.customer_id,
//   service_timestamp: formData.service_timestamp,
  
//   // Men-specific fields
//   barber_id: formData.section === "men" ? toNullableNumber(formData.barber) : null,
//   barber_amount: formData.section === "men" ? calculation.barberAmount || 0 : 0,
//   barber_assistant_id: formData.section === "men" ? toNullableNumber(formData.barberAssistant) : null,
//   barber_assistant_amount: formData.section === "men" ? calculation.barberAssistantAmount || 0 : 0,
//   scrubber_assistant_id: formData.section === "men" ? toNullableNumber(formData.scrubberAssistant) : null,
//   scrubber_assistant_amount: formData.section === "men" ? calculation.scrubAssistantAmount || 0 : 0,
//   black_shampoo_assistant_id: formData.section === "men" ? toNullableNumber(formData.blackShampooAssistant) : null,
//   black_shampoo_assistant_amount: formData.section === "men" ? calculation.blackShampooAssistantAmount || 0 : 0,
//   black_shampoo_amount: formData.section === "men" ? calculation.blackShampooAmount || 0 : 0,
//   super_black_assistant_id: formData.section === "men" ? toNullableNumber(formData.superBlackAssistant) : null,
//   super_black_assistant_amount: formData.section === "men" ? calculation.superBlackAssistantAmount || 0 : 0,
//   super_black_amount: formData.section === "men" ? calculation.superBlackAmount || 0 : 0,
//   black_mask_assistant_id: formData.section === "men" ? toNullableNumber(formData.blackMaskAssistant) : null,
//   black_mask_assistant_amount: formData.section === "men" ? calculation.blackMaskAssistantAmount || 0 : 0,
//   black_mask_amount: formData.section === "men" ? calculation.blackMaskAmount || 0 : 0,

//   // Women-specific fields
//   women_employee_id: formData.section === "women" ? toNullableNumber(formData.womenEmployeeId) : null,
//   women_employee_amount: formData.section === "women" ? calculation.womenEmployeeAmount || 0 : 0,

//   // Nails-specific fields
//   nail_employee_id: formData.section === "nails" ? toNullableNumber(formData.nailEmployeeId) : null,
//   nail_employee_amount: formData.section === "nails" ? calculation.nailEmployeeAmount || 0 : 0,
// };



//     onSubmit(payload);
//     onClose();
//   };

//   return (
//     <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto h-[80vh]">
     
      
// <div>
//   <label>Choose Section</label>
//     <select value={formData.section} onChange={(e) => handleSectionChange(e.target.value)} className="w-full border rounded px-2 py-1">
//       <option value="">Select Section</option>
//       <option value="men">Men</option>
//       <option value="women">Women</option>
//       <option value="nails">Nails</option>
//     </select>
//  </div>


//  <div>
//   <label>Choose Service</label>
//   <select
//     value={formData.service || ""} 
//     onChange={(e) => handleChange(e)}
//     name="service"
//     className="w-full border rounded px-2 py-1"
//   >
//     <option value="">Select Service </option>
//     {services.map((serviceName) => (
//       <option key={serviceName} value={serviceName}>
//         {serviceName}
//       </option>
//     ))}
//   </select>
// </div>




//       {isCustomer && (
//   <>
//     {/* Appointment Date */}
//     <div>
//       <label className="block mb-1 font-medium">Appointment Date</label>
//       <input
//         type="date"
//         name="appointment_date"
//         value={formData.appointment_date || ""}
//         onChange={handleChange
//         }
//         className="w-full border rounded px-2 py-1"
//       />
//     </div>

//     {/* Appointment Time */}
//     <div>
//       <label className="block mb-1 font-medium">Appointment Time</label>
//       <select
//         name="appointment_time"
//         value={formData.appointment_time || ""}
//         onChange={handleChange}
//         className="w-full border rounded px-2 py-1"
//       >
//         <option value="">Select time</option>
//         {[
//           "08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM",
//           "12:00 PM", "01:00 PM", "02:00 PM", "03:00 PM",
//           "04:00 PM", "05:00 PM", "06:00 PM", "07:00 PM", "08:00 PM",
//         ].map((time) => (
//           <option key={time} value={time}>
//             {time}
//           </option>
//         ))}
//       </select>
//     </div>


//   </>
// )}




// {/* MEN SECTION */}
// {formData.section === 'men' && (
//   <div className="">

//      {/* Service selection */}
//     {/* 7000-service */}
//     {formData.service === "7000-service" && (
//       <>
//         <div>
//           <label className="block mb-1">Barber</label>
//           <select
//             name="barber"
//             value={formData.barber}
//             onChange={handleChange}
//             className="w-full border rounded px-2 py-1"
//           >
//             <option value=""></option>
//             {employees.map((emp) => (
//   <option key={emp.id} value={emp.id}>
//     {emp.first_name} {emp.last_name}
//   </option>
// ))}

//           </select>
//         </div>
//         <div>
//           <label className="block mb-1">Aesthetician</label>
//           <select
//             name="barberAssistant"
//             value={formData.barberAssistant}
//             onChange={handleChange}
//             className="w-full border rounded px-2 py-1"
//           >
//             <option value=""></option>
//             {employees.map((emp) => (
//   <option key={emp.id} value={emp.id}>
//     {emp.first_name} {emp.last_name}
//   </option>
// ))}

//           </select>
//         </div>
//       </>
//     )}

//     {/* 6000-service */}
//     {formData.service === "6000-service" && (
//       <>
//         <div>
//           <label className="block mb-1">Barber</label>
//           <select
//             name="barber"
//             value={formData.barber}
//             onChange={handleChange}
//             className="w-full border rounded px-2 py-1"
//           >
//             <option value=""></option>
//             {employees.map((emp) => (
//   <option key={emp.id} value={emp.id}>
//     {emp.first_name} {emp.last_name}
//   </option>
// ))}

//           </select>
//         </div>
//         <div>
//           <label className="block mb-1">Aesthetician</label>
//           <select
//             name="barberAssistant"
//             value={formData.barberAssistant}
//             onChange={handleChange}
//             className="w-full border rounded px-2 py-1"
//           >
//             <option value=""></option>
//             {employees.map((emp) => (
//   <option key={emp.id} value={emp.id}>
//     {emp.first_name} {emp.last_name}
//   </option>
// ))}

//           </select>
//         </div>
//       </>
//     )}


//     {/* 5000-service */}
//     {formData.service === "5000-service" && (
//       <div>
//         <label className="block mb-1">Barber</label>
//         <select
//           name="barber"
//           value={formData.barber}
//           onChange={handleChange}
//           className="w-full border rounded px-2 py-1"
//         >
//           <option value=""></option>
//           {employees.map((emp) => (
//   <option key={emp.id} value={emp.id}>
//     {emp.first_name} {emp.last_name}
//   </option>
// ))}

//         </select>
//       </div>
//     )}

//     {/* child-service */}
//     {formData.service === "child-service" && (
//       <div>
//         <label className="block mb-1">Barber</label>
//         <select
//           name="barber"
//           value={formData.barber}
//           onChange={handleChange}
//           className="w-full border rounded px-2 py-1"
//         >
//           <option value=""></option>
//           {employees.map((emp) => (
//   <option key={emp.id} value={emp.id}>
//     {emp.first_name} {emp.last_name}
//   </option>
// ))}

//         </select>
//       </div>
//     )}

//     {/* beard-service */}
//     {formData.service === "beard-service" && (
//       <div>
//         <label className="block mb-1">Barber</label>
//         <select
//           name="barber"
//           value={formData.barber}
//           onChange={handleChange}
//           className="w-full border rounded px-2 py-1"
//         >
//           <option value=""></option>
//           {employees.map((emp) => (
//   <option key={emp.id} value={emp.id}>
//     {emp.first_name} {emp.last_name}
//   </option>
// ))}

//         </select>
//       </div>
//     )}

//     {/* haircut-blackmask-12000 */}
//     {formData.service === "haircut-blackmask-12000" && (
//       <>
//         <div>
//           <label className="block mb-1">Barber</label>
//           <select
//             name="barber"
//             value={formData.barber}
//             onChange={handleChange}
//             className="w-full border rounded px-2 py-1"
//           >
//             <option value=""></option>
//             {employees.map((emp) => (
//   <option key={emp.id} value={emp.id}>
//     {emp.first_name} {emp.last_name}
//   </option>
// ))}

//           </select>
//         </div>
//         <div>
//           <label className="block mb-1">Aesthetician</label>
//           <select
//             name="barberAssistant"
//             value={formData.barberAssistant}
//             onChange={handleChange}
//             className="w-full border rounded px-2 py-1"
//           >
//             <option value=""></option>
//             {employees.map((emp) => (
//   <option key={emp.id} value={emp.id}>
//     {emp.first_name} {emp.last_name}
//   </option>
// ))}
//           </select>
//         </div>
//         <div>
//           <label className="block mb-1">Black Mask Aesthetician</label>
//           <select
//             name="blackMaskAssistant"
//             value={formData.blackMaskAssistant}
//             onChange={handleChange}
//             className="w-full border rounded px-2 py-1"
//           >
//             <option value=""></option>
//             {employees.map((emp) => (
//   <option key={emp.id} value={emp.id}>
//     {emp.first_name} {emp.last_name}
//   </option>
// ))}

//           </select>
//         </div>
//       </>
//     )}


//     {/* trimming-scrub-5000 */}
//     {formData.service === "trimming-scrub-5000" && (
//       <>
//         <div>
//           <label className="block mb-1">Barber</label>
//           <select
//             name="barber"
//             value={formData.barber}
//             onChange={handleChange}
//             className="w-full border rounded px-2 py-1"
//           >
//             <option value=""></option>
//             {employees.map((emp) => (
//   <option key={emp.id} value={emp.id}>
//     {emp.first_name} {emp.last_name}
//   </option>
// ))}

//           </select>
//         </div>
//         <div>
//           <label className="block mb-1">Aesthetician</label>
//           <select
//             name="barberAssistant"
//             value={formData.barberAssistant}
//             onChange={handleChange}
//             className="w-full border rounded px-2 py-1"
//           >
//             <option value=""></option>
//             {employees.map((emp) => (
//   <option key={emp.id} value={emp.id}>
//     {emp.first_name} {emp.last_name}
//   </option>
// ))}
//           </select>
//         </div>
//       </>
//     )}
  

//     {/* haircut-honey-10000 */}
//     {formData.service === "haircut-honey-10000" && (
//       <>
//         <div>
//           <label className="block mb-1">Barber</label>
//           <select
//             name="barber"
//             value={formData.barber}
//             onChange={handleChange}
//             className="w-full border rounded px-2 py-1"
//           >
//             <option value=""></option>
//             {employees.map((emp) => (
//   <option key={emp.id} value={emp.id}>
//     {emp.first_name} {emp.last_name}
//   </option>
// ))}

//           </select>
//         </div>
//         <div>
//           <label className="block mb-1">Aesthetician</label>
//           <select
//             name="barberAssistant"
//             value={formData.barberAssistant}
//             onChange={handleChange}
//             className="w-full border rounded px-2 py-1"
//           >
//             <option value=""></option>
//             {employees.map((emp) => (
//   <option key={emp.id} value={emp.id}>
//     {emp.first_name} {emp.last_name}
//   </option>
// ))}
//           </select>
//         </div>
//       </>
//     )}

//     {/* haircut-women */}
//     {formData.service === "haircut-women" && (
//       <>
//         <div>
//           <label className="block mb-1">Barber</label>
//           <select
//             name="barber"
//             value={formData.barber}
//             onChange={handleChange}
//             className="w-full border rounded px-2 py-1"
//           >
//             <option value=""></option>
//             {employees.map((emp) => (
//   <option key={emp.id} value={emp.id}>
//     {emp.first_name} {emp.last_name}
//   </option>
// ))}

//           </select>
//         </div>
//       </>
//     )}


//     {/* haircut-blackshampoo-12000 */}
//     {formData.service === "haircut-blackshampoo-12000" && (
//       <>
//         <div>
//           <label className="block mb-1">Barber</label>
//           <select
//             name="barber"
//             value={formData.barber}
//             onChange={handleChange}
//             className="w-full border rounded px-2 py-1"
//           >
//             <option value=""></option>
//             {employees.map((emp) => (
//   <option key={emp.id} value={emp.id}>
//     {emp.first_name} {emp.last_name}
//   </option>
// ))}
//           </select>
//         </div>
//         <div>
//           <label className="block mb-1">Aesthetician</label>
//           <select
//             name="barberAssistant"
//             value={formData.barberAssistant}
//             onChange={handleChange}
//             className="w-full border rounded px-2 py-1"
//           >
//             <option value=""></option>
//             {employees.map((emp) => (
//   <option key={emp.id} value={emp.id}>
//     {emp.first_name} {emp.last_name}
//   </option>
// ))}

//           </select>
//         </div>
//         <div>
//           <label className="block mb-1">Black Shampoo Aesthetician</label>
//           <select
//             name="blackShampooAssistant"
//             value={formData.blackShampooAssistant}
//             onChange={handleChange}
//             className="w-full border rounded px-2 py-1"
//           >
//             <option value=""></option>
//             {employees.map((emp) => (
//   <option key={emp.id} value={emp.id}>
//     {emp.first_name} {emp.last_name}
//   </option>
// ))}

//           </select>
//         </div>
//       </>
//     )}

//     {/* haircut-blackshampoo-10000 */}
//     {formData.service === "haircut-blackshampoo-10000" && (
//       <>
//         <div>
//           <label className="block mb-1">Barber</label>
//           <select
//             name="barber"
//             value={formData.barber}
//             onChange={handleChange}
//             className="w-full border rounded px-2 py-1"
//           >
//             <option value=""></option>
//             {employees.map((emp) => (
//   <option key={emp.id} value={emp.id}>
//     {emp.first_name} {emp.last_name}
//   </option>
// ))}

//           </select>
//         </div>
//         <div>
//           <label className="block mb-1">Aesthetician</label>
//           <select
//             name="barberAssistant"
//             value={formData.barberAssistant}
//             onChange={handleChange}
//             className="w-full border rounded px-2 py-1"
//           >
//             <option value=""></option>
//             {employees.map((emp) => (
//   <option key={emp.id} value={emp.id}>
//     {emp.first_name} {emp.last_name}
//   </option>
// ))}

//           </select>
//         </div>
//         <div>
//           <label className="block mb-1">Black Shampoo Aesthetician</label>
//           <select
//             name="blackShampooAssistant"
//             value={formData.blackShampooAssistant}
//             onChange={handleChange}
//             className="w-full border rounded px-2 py-1"
//           >
//             <option value=""></option>
//             {employees.map((emp) => (
//   <option key={emp.id} value={emp.id}>
//     {emp.first_name} {emp.last_name}
//   </option>
// ))}

//           </select>
//         </div>
//       </>
//     )}

//     {/* haircut-superblack-15000 */}
//     {formData.service === "haircut-superblack-15000" && (
//       <>
//         <div>
//           <label className="block mb-1">Barber</label>
//           <select
//             name="barber"
//             value={formData.barber}
//             onChange={handleChange}
//             className="w-full border rounded px-2 py-1"
//           >
//             <option value=""></option>
//             {employees.map((emp) => (
//   <option key={emp.id} value={emp.id}>
//     {emp.first_name} {emp.last_name}
//   </option>
// ))}

//           </select>
//         </div>
//         <div>
//           <label className="block mb-1">Aesthetician</label>
//           <select
//             name="barberAssistant"
//             value={formData.barberAssistant}
//             onChange={handleChange}
//             className="w-full border rounded px-2 py-1"
//           >
//             <option value=""></option>
//             {employees.map((emp) => (
//   <option key={emp.id} value={emp.id}>
//     {emp.first_name} {emp.last_name}
//   </option>
// ))}

//           </select>
//         </div>
//         <div>
//           <label className="block mb-1">SuperBlack Aesthetician</label>
//           <select
//             name="superBlackAssistant"
//             value={formData.superBlackAssistant}
//             onChange={handleChange}
//             className="w-full border rounded px-2 py-1"
//           >
//             <option value=""></option>
//             {employees.map((emp) => (
//   <option key={emp.id} value={emp.id}>
//     {emp.first_name} {emp.last_name}
//   </option>
// ))}

//           </select>
//         </div>
//       </>
//     )}

//     {/* scrub-only-3000 */}
//     {formData.service === "scrub-only-3000" && (
//       <div>
//         <label className="block mb-1">Scrubber Aesthetician</label>
//         <select
//           name="scrubberAssistant"
//           value={formData.scrubberAssistant}
//           onChange={handleChange}
//           className="w-full border rounded px-2 py-1"
//         >
//           <option value=""></option>
//           {employees.map((emp) => (
//   <option key={emp.id} value={emp.id}>
//     {emp.first_name} {emp.last_name}
//   </option>
// ))}

//         </select>
//       </div>
//     )}

//     {/* scrub-only-5000 */}
//     {formData.service === "scrub-only-5000" && (
//       <div>
//         <label className="block mb-1">Scrubber Aesthetician</label>
//         <select
//           name="scrubberAssistant"
//           value={formData.scrubberAssistant}
//           onChange={handleChange}
//           className="w-full border rounded px-2 py-1"
//         >
//           <option value=""></option>
//           {employees.map((emp) => (
//   <option key={emp.id} value={emp.id}>
//     {emp.first_name} {emp.last_name}
//   </option>
// ))}

//         </select>
//       </div>
//     )}

//     {/* blackshampoo-only-3000 */}
//     {formData.service === "blackshampoo-only-3000" && (
//       <div>
//         <label className="block mb-1">Black Shampoo Aesthetician</label>
//         <select
//           name="blackShampooAssistant"
//           value={formData.blackShampooAssistant}
//           onChange={handleChange}
//           className="w-full border rounded px-2 py-1"
//         >
//           <option value=""></option>
//           {employees.map((emp) => (
//   <option key={emp.id} value={emp.id}>
//     {emp.first_name} {emp.last_name}
//   </option>
// ))}

//         </select>
//       </div>
//     )}

//     {/* blackshampoo-only-5000 */}
//     {formData.service === "blackshampoo-only-5000" && (
//       <div>
//         <label className="block mb-1">Black Shampoo Aesthetician</label>
//         <select
//           name="blackShampooAssistant"
//           value={formData.blackShampooAssistant}
//           onChange={handleChange}
//           className="w-full border rounded px-2 py-1"
//         >
//           <option value=""></option>
//           {employees.map((emp) => (
//   <option key={emp.id} value={emp.id}>
//     {emp.first_name} {emp.last_name}
//   </option>
// ))}

//         </select>
//       </div>
//     )}

    
//     {/* Super Black Only */}
//     {formData.service === "superblack-only-8000" && (
//       <div>
//         <label className="block mb-1">Super Black Aesthetician</label>
//         <select
//           name="superBlackAssistant"
//           value={formData.superBlackAssistant}
//           onChange={handleChange}
//           className="w-full border rounded px-2 py-1"
//         >
//           <option value=""></option>
//           {employees.map((emp) => (
//   <option key={emp.id} value={emp.id}>
//     {emp.first_name} {emp.last_name}
//   </option>
// ))}

//         </select>
//       </div>
//       )}

//   </div>
// )}

// {/* WOMEN SECTION */}
// {formData.section === 'women' && (
//   <div className="women-section">
//     {/* Render choose worker only if a service has been chosen */}
//     {formData.service && (
//       <div>
//         <label className="block mb-1">Choose Worker</label>
//         <select
//           name="womenEmployeeId"
//           value={formData.womenEmployeeId|| ""}
//           onChange={handleChange}
//           className="w-full border rounded px-2 py-1"
//         >
//           <option value="">Select Worker</option>
//           {employees.map((emp) => (
//             <option key={emp.id} value={emp.id}>
//               {emp.first_name} {emp.last_name}
//             </option>
//           ))}
//         </select>
//       </div>
//     )}
//   </div>

 
// )}

// {/* NAILS SECTION */}
// {formData.section === 'nails' && (
//   <div className="nails-section">
//     {/* Show select only if service is chosen */}
//     {formData.service && (
//       <div>
//         <label className="block mb-1">Choose Nail Technician</label>
//         <select
//           name="nailEmployeeId"
//           value={formData.nailEmployeeId|| ""}
//           onChange={handleChange}
//           className="w-full border rounded px-2 py-1"
//         >
//           <option value="">Select Worker</option>
//           {employees.map((emp) => (
//             <option key={emp.id} value={emp.id}>
//               {emp.first_name} {emp.last_name}
//             </option>
//           ))}
//         </select>
//       </div>
//     )}
//   </div>
// )}
      
//     {isCustomer && (
//         <>
//           <p className="text-sm text-gray-700 bg-yellow-100 p-2 rounded">
//             Note: Your appointment will only remain valid for <b>10 minutes</b> after the scheduled time.
//             After that, the employee may attend to another client, and you may have to wait.
//           </p>

//           {formData.service && (
//             <p className="text-gray-700 font-medium">
//               The total amount for this service is <span className="text-green-700">UGX {serviceAmount}</span>
//             </p>
//           )}

//           <div>
//             <label className="block mb-1 font-medium">Additional Information</label>
//             <textarea
//               name="customerNote"
//               value={formData.customerNote}
//               onChange={handleChange}
//               placeholder="Any special requests or details..."
//               className="w-full border rounded px-2 py-1"
//             />
//           </div>
//         </>
//       )}

//       <button
//         className="mt-4 bg-blue-400 hover:bg-blue-600 text-white py-2 px-4 rounded"
//         type="submit"
//       >
//         Submit
//       </button>
//     </form>
//   );
// }

