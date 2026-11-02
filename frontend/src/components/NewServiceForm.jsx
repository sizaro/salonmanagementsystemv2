import { useState, useEffect } from "react";
import Button from "./Button";

export default function NewServiceForm({ onSubmit, onClose, Sections, serviceData = null }) {
  const [formData, setFormData] = useState({
    id: null,
    service_name: "",
    service_amount: "",
    salon_amount: "",
    section_id: "",
    description: "",
    service_image: null,
    roles: [{ role_name: "", role_amount: "" }],
    materials: [{ material_name: "", material_cost: "" }],
  });

  // Populate formData when editing
  useEffect(() => {
    if (serviceData) {
      setFormData({
        id: serviceData.id,
        service_name: serviceData.service_name || "",
        service_amount: serviceData.service_amount || "",
        salon_amount: serviceData.salon_amount || "",
        section_id: serviceData.section_id || "",
        description: serviceData.description || "",
        service_image: null, // can't prefill file input
        roles: serviceData.roles?.length
          ? serviceData.roles.map((r) => ({
              role_name: r.role_name || "",
              role_amount: r.role_amount || "",
            }))
          : [{ role_name: "", role_amount: "" }],
        materials: serviceData.materials?.length
          ? serviceData.materials.map((m) => ({
              material_name: m.material_name || "",
              material_cost: m.material_cost || "",
            }))
          : [{ material_name: "", material_cost: "" }],
      });
    }
  }, [serviceData]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleRoleChange = (index, field, value) => {
    const newRoles = [...formData.roles];
    newRoles[index][field] = value;
    setFormData((prev) => ({ ...prev, roles: newRoles }));
  };

  const handleMaterialChange = (index, field, value) => {
    const newMaterials = [...formData.materials];
    newMaterials[index][field] = value;
    setFormData((prev) => ({ ...prev, materials: newMaterials }));
  };

  const addRole = () =>
    setFormData((prev) => ({
      ...prev,
      roles: [...prev.roles, { role_name: "", role_amount: "" }],
    }));
  const removeRole = (index) =>
    setFormData((prev) => ({ ...prev, roles: prev.roles.filter((_, i) => i !== index) }));
  const addMaterial = () =>
    setFormData((prev) => ({
      ...prev,
      materials: [...prev.materials, { material_name: "", material_cost: "" }],
    }));
  const removeMaterial = (index) =>
    setFormData((prev) => ({ ...prev, materials: prev.materials.filter((_, i) => i !== index) }));

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.service_name.trim()) return alert("Service name is required");
    if (!formData.section_id) return alert("Please select a section");
    if (!formData.service_amount.trim()) return alert("Service full amount is required");
    if (!formData.salon_amount.trim()) return alert("Salon amount is required");
    if (!formData.description.trim()) return alert("Service description is required");

    const validRoles = formData.roles.filter((r) => r.role_name.trim() && r.role_amount);
    const validMaterials = formData.materials.filter(
      (m) => m.material_name.trim() && m.material_cost,
    );

    const data = new FormData();
    data.append("id", formData.id);
    data.append("service_name", formData.service_name);
    data.append("service_amount", Number(formData.service_amount));
    data.append("salon_amount", Number(formData.salon_amount));
    data.append("section_id", formData.section_id);
    data.append("description", formData.description);
    if (formData.service_image) data.append("service_image", formData.service_image);

    validRoles.forEach((r, i) => {
      data.append(`roles[${i}][role_name]`, r.role_name);
      data.append(`roles[${i}][role_amount]`, Number(r.role_amount));
    });

    validMaterials.forEach((m, i) => {
      data.append(`materials[${i}][material_name]`, m.material_name);
      data.append(`materials[${i}][material_cost]`, Number(m.material_cost));
    });

    if (serviceData && serviceData.id) {
      // Editing: pass id + data
      onSubmit(serviceData.id, data);
    } else {
      // Creating: only pass data
      onSubmit(data);
    }

    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="h-[80vh] space-y-4 overflow-y-auto p-4">
      <h2 className="mb-4 text-xl font-semibold">
        {serviceData ? "Edit Service" : "Add New Service"}
      </h2>

      {/* SECTION */}
      <label className="block font-medium">
        Section:
        <select
          className="mt-1 w-full rounded border p-2"
          value={formData.section_id}
          onChange={(e) => handleChange("section_id", e.target.value)}
        >
          <option value="">Select a section</option>
          {Sections?.map((sec) => (
            <option key={sec.id} value={sec.id}>
              {sec.section_name}
            </option>
          ))}
        </select>
      </label>

      {/* SERVICE NAME */}
      <label className="block font-medium">
        Service Name:
        <input
          type="text"
          className="mt-1 w-full rounded border p-2"
          value={formData.service_name}
          onChange={(e) => handleChange("service_name", e.target.value)}
        />
      </label>

      {/* SERVICE AMOUNT */}
      <label className="block font-medium">
        Service Full Amount:
        <input
          type="text"
          className="mt-1 w-full rounded border p-2"
          value={formData.service_amount}
          onChange={(e) => handleChange("service_amount", e.target.value.replace(/[^\d.]/g, ""))}
        />
      </label>

      {/* SALON AMOUNT */}
      <label className="block font-medium">
        Salon Amount:
        <input
          type="text"
          className="mt-1 w-full rounded border bg-yellow-100 p-2"
          value={formData.salon_amount}
          onChange={(e) => handleChange("salon_amount", e.target.value.replace(/[^\d.]/g, ""))}
        />
      </label>

      {/* DESCRIPTION */}
      <label className="block font-medium">
        Service Description:
        <textarea
          className="mt-1 w-full rounded border p-2"
          value={formData.description}
          onChange={(e) => handleChange("description", e.target.value)}
        />
      </label>

      {/* IMAGE UPLOAD */}
      <label className="block font-medium">
        Service Image:
        <input
          type="file"
          accept="image/*"
          className="mt-1 block w-full rounded-md border-gray-300 p-2"
          onChange={(e) => handleChange("service_image", e.target.files[0])}
        />
      </label>

      {/* ROLES */}
      <h3 className="mt-4 text-lg font-semibold">Employee Roles</h3>
      {formData.roles.map((role, index) => (
        <div key={index} className="space-y-2 rounded-lg border bg-gray-100 p-3 shadow-sm">
          <label className="block font-medium">
            Role Name:
            <input
              type="text"
              className="mt-1 w-full rounded border p-2"
              value={role.role_name}
              onChange={(e) => handleRoleChange(index, "role_name", e.target.value)}
            />
          </label>

          <label className="block font-medium">
            Role Amount:
            <input
              type="text"
              className="mt-1 w-full rounded border p-2"
              value={role.role_amount}
              onChange={(e) =>
                handleRoleChange(index, "role_amount", e.target.value.replace(/[^\d.]/g, ""))
              }
            />
          </label>

          {index > 0 && (
            <Button
              type="button"
              className="bg-red-600 text-white"
              onClick={() => removeRole(index)}
            >
              Remove Role
            </Button>
          )}
        </div>
      ))}
      <Button type="button" className="bg-yellow-500 text-black" onClick={addRole}>
        + Add Role
      </Button>

      {/* MATERIALS */}
      <h3 className="mt-6 text-lg font-semibold">Service Materials</h3>
      {formData.materials.map((mat, index) => (
        <div key={index} className="space-y-2 rounded-lg border bg-blue-100 p-3 shadow-sm">
          <label className="block font-medium">
            Material Name:
            <input
              type="text"
              className="mt-1 w-full rounded border p-2"
              value={mat.material_name}
              onChange={(e) => handleMaterialChange(index, "material_name", e.target.value)}
            />
          </label>

          <label className="block font-medium">
            Material Cost:
            <input
              type="text"
              className="mt-1 w-full rounded border p-2"
              value={mat.material_cost}
              onChange={(e) =>
                handleMaterialChange(index, "material_cost", e.target.value.replace(/[^\d.]/g, ""))
              }
            />
          </label>

          {index > 0 && (
            <Button
              type="button"
              className="bg-red-600 text-white"
              onClick={() => removeMaterial(index)}
            >
              Remove Material
            </Button>
          )}
        </div>
      ))}
      <Button type="button" className="bg-green-500 text-black" onClick={addMaterial}>
        + Add Material
      </Button>

      {/* SUBMIT */}
      <div className="mt-5 flex gap-3">
        <Button type="submit">{serviceData ? "Update Service" : "Create Service"}</Button>
        <Button type="button" className="bg-gray-400" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
