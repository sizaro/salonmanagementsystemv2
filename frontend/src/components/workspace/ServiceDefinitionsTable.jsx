import { useEffect, useMemo, useState } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import Modal from "../Modal.jsx";

const PAGE_SIZE = 6;

const money = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toLocaleString() : "0";
};

const serviceName = (service) => service.name || service.service_name || service.serviceName || "Unnamed service";
const rolesFor = (service) => service.roles || service.service_roles || service.role_list || [];
const materialsFor = (service) => service.materials || service.service_materials || service.material_list || [];
const imageFor = (service, staticBaseUrl) => {
  const image = service.image_url || service.image || service.image_path;
  if (!image) return null;
  return /^https?:\/\//i.test(image) ? image : `${staticBaseUrl}${image}`;
};

export default function ServiceDefinitionsTable({
  services = [],
  sections = [],
  staticBaseUrl = "",
  onEdit,
  onDelete,
  readOnly = false,
}) {
  const [page, setPage] = useState(1);
  const [selectedService, setSelectedService] = useState(null);
  const totalPages = Math.max(1, Math.ceil(services.length / PAGE_SIZE));
  const visibleServices = useMemo(
    () => services.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [services, page],
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const sectionName = (service) => {
    const section = sections.find((entry) => Number(entry.id) === Number(service.section_id));
    return section?.section_name || section?.name || service.section_name || "Unassigned";
  };

  const amount = (service) => service.full_amount ?? service.service_amount ?? service.price ?? 0;
  const selectedRoles = selectedService ? rolesFor(selectedService) : [];
  const selectedMaterials = selectedService ? materialsFor(selectedService) : [];

  return (
    <section className="workspace-data-panel service-definitions-panel">
      <div className="workspace-table-toolbar">
        <div>
          <p className="workspace-section-kicker">Salon setup</p>
          <h3>Service Definitions</h3>
          <p>Review a service, then open its full definition when you need the complete pricing and setup details.</p>
        </div>
        <span className="workspace-table-count">{services.length} {services.length === 1 ? "service" : "services"}</span>
      </div>

      <div className="workspace-table-scroll">
        <table className="workspace-data-table workspace-service-table">
          <thead>
            <tr>
              <th><span className="workspace-table-heading">Service</span></th>
              <th><span className="workspace-table-heading">Section</span></th>
              <th><span className="workspace-table-heading">Price</span></th>
              <th><span className="workspace-table-heading">Setup</span></th>
              <th className="workspace-table-actions"><span className="workspace-table-heading">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {visibleServices.length > 0 ? visibleServices.map((service) => {
              const image = imageFor(service, staticBaseUrl);
              const roles = rolesFor(service);
              const materials = materialsFor(service);
              return (
                <tr key={service.id}>
                  <td>
                    <div className="workspace-service-cell">
                      {image ? <img src={image} alt="" /> : <span className="workspace-service-image-fallback">{serviceName(service).slice(0, 1).toUpperCase()}</span>}
                      <strong>{serviceName(service)}</strong>
                    </div>
                  </td>
                  <td>{sectionName(service)}</td>
                  <td className="workspace-amount">UGX {money(amount(service))}</td>
                  <td><span className="workspace-setup-summary">{roles.length} {roles.length === 1 ? "role" : "roles"} · {materials.length} {materials.length === 1 ? "item" : "items"}</span></td>
                  <td className="workspace-table-actions">
                    <div className="workspace-row-actions">
                      <button type="button" onClick={() => setSelectedService(service)} className="workspace-view-action"><Eye aria-hidden="true" size={15} />View</button>
                      {!readOnly && <button type="button" onClick={() => onEdit?.(service.id)} aria-label={`Edit ${serviceName(service)}`}><Pencil aria-hidden="true" size={15} />Edit</button>}
                      {!readOnly && <button type="button" onClick={() => onDelete?.(service.id)} className="workspace-delete-action" aria-label={`Delete ${serviceName(service)}`}><Trash2 aria-hidden="true" size={15} />Delete</button>}
                    </div>
                  </td>
                </tr>
              );
            }) : <tr><td colSpan={5} className="workspace-table-empty">No service definitions available.</td></tr>}
          </tbody>
        </table>
      </div>

      {services.length > PAGE_SIZE && <div className="workspace-table-pagination">
        <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, services.length)} of {services.length}</span>
        <div>
          <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>Previous</button>
          <span>Page {page} of {totalPages}</span>
          <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages}>Next</button>
        </div>
      </div>}

      <Modal isOpen={Boolean(selectedService)} onClose={() => setSelectedService(null)} sizeClass="max-w-3xl">
        {selectedService && <div className="workspace-service-detail">
          <div className="workspace-service-detail-header">
            {imageFor(selectedService, staticBaseUrl) ? <img src={imageFor(selectedService, staticBaseUrl)} alt="" /> : <span className="workspace-service-image-fallback">{serviceName(selectedService).slice(0, 1).toUpperCase()}</span>}
            <div><p className="workspace-section-kicker">Service definition</p><h2>{serviceName(selectedService)}</h2><span>{sectionName(selectedService)}</span></div>
          </div>
          <div className="workspace-service-detail-metrics">
            <article><span>Full amount</span><strong>UGX {money(amount(selectedService))}</strong></article>
            <article><span>Salon amount</span><strong>UGX {money(selectedService.salon_amount ?? selectedService.salonAmount ?? selectedService.salon ?? 0)}</strong></article>
            <article><span>Employee allocation</span><strong>UGX {money(selectedRoles.reduce((sum, role) => sum + (Number(role.amount ?? role.role_amount ?? role.earned_amount) || 0), 0))}</strong></article>
            <article><span>Materials cost</span><strong>UGX {money(selectedMaterials.reduce((sum, material) => sum + (Number(material.cost ?? material.material_cost) || 0), 0))}</strong></article>
          </div>
          <div className="workspace-service-detail-grid">
            <section><h3>Roles and employee amounts</h3>{selectedRoles.length ? <ul>{selectedRoles.map((role, index) => <li key={`${role.id || role.role_id || index}`}>{role.role_name || role.role || role.name || "Role"}<strong>UGX {money(role.amount ?? role.role_amount ?? role.earned_amount ?? 0)}</strong></li>)}</ul> : <p>No employee roles are recorded for this service.</p>}</section>
            <section><h3>Materials and other services</h3>{selectedMaterials.length ? <ul>{selectedMaterials.map((material, index) => <li key={`${material.id || material.material_id || index}`}>{material.material_name || material.name || "Item"}<strong>UGX {money(material.cost ?? material.material_cost ?? 0)}</strong></li>)}</ul> : <p>No materials or other service costs are recorded.</p>}</section>
          </div>
          {!readOnly && <div className="workspace-service-detail-footer"><button type="button" className="workspace-primary-action" onClick={() => { setSelectedService(null); onEdit?.(selectedService.id); }}>Edit service definition</button></div>}
        </div>}
      </Modal>
    </section>
  );
}
