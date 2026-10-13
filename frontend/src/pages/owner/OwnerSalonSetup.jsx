import { useEffect, useState } from "react";
import Modal from "../../components/Modal.jsx";
import SectionForm from "../../components/SectionForm.jsx";
import NewServiceForm from "../../components/NewServiceForm.jsx";
import ServiceDefinitionsTable from "../../components/workspace/ServiceDefinitionsTable.jsx";
import { useData } from "../../context/DataContext.jsx";

export default function OwnerSalonSetup() {
  const [modalType, setModalType] = useState(null);
  const [editingSection, setEditingSection] = useState(null);
  const [editingService, setEditingService] = useState(null);
  const {
    sections = [], serviceDefinitions = [],
    fetchSections, createSection, updateSection, deleteSection, fetchSectionById,
    fetchServiceDefinitions, createServiceDefinition, updateServiceDefinition, deleteServiceDefinition, fetchServiceDefinitionById,
  } = useData();
  const staticBaseUrl = import.meta.env.MODE === "development" ? "http://localhost:5500" : "https://salonmanagementsystemv2-ru0i.onrender.com";

  useEffect(() => {
    fetchSections();
    fetchServiceDefinitions();
    // The provider exposes fresh function references; setup data loads once on page entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeModal = () => { setModalType(null); setEditingSection(null); setEditingService(null); };
  const editSection = async (id) => { setEditingSection(await fetchSectionById(id)); setModalType("edit-section"); };
  const editService = async (id) => { setEditingService(await fetchServiceDefinitionById(id)); setModalType("edit-service"); };
  const submitSection = async (formData) => { await updateSection(formData.id, formData); closeModal(); };
  const submitService = async (id, formData) => { await updateServiceDefinition(id, formData); closeModal(); };
  const addSection = async (formData) => { await createSection(formData); closeModal(); };
  const addService = async (formData) => { await createServiceDefinition(formData); closeModal(); };

  return <div className="workspace-page space-y-5">
    <header className="workspace-page-header">
      <div><p className="workspace-section-kicker">Salon configuration</p><h1>Salon Setup</h1><p>Manage service sections and definitions without crowding the daily dashboard.</p></div>
      <div className="workspace-setup-header-actions"><button type="button" onClick={() => setModalType("new-section")}>Add section</button><button type="button" className="workspace-primary-action" onClick={() => setModalType("new-service")}>Add service</button></div>
    </header>
    <section className="workspace-data-panel">
      <div className="workspace-table-toolbar"><div><p className="workspace-section-kicker">Categories</p><h2>Sections</h2><p>Organize services into concise salon categories.</p></div><span className="workspace-table-count">{sections.length} {sections.length === 1 ? "section" : "sections"}</span></div>
      <div className="workspace-table-scroll"><table className="workspace-data-table workspace-sections-table"><thead><tr><th><span className="workspace-table-heading">Name</span></th><th className="workspace-table-actions"><span className="workspace-table-heading">Actions</span></th></tr></thead><tbody>{sections.length ? sections.map((section) => <tr key={section.id}><td><strong>{section.section_name}</strong></td><td className="workspace-table-actions"><div className="workspace-row-actions"><button type="button" onClick={() => editSection(section.id)}>Edit</button><button type="button" className="workspace-delete-action" onClick={() => deleteSection(section.id)}>Delete</button></div></td></tr>) : <tr><td className="workspace-table-empty" colSpan={2}>No sections available.</td></tr>}</tbody></table></div>
    </section>
    <ServiceDefinitionsTable services={serviceDefinitions} sections={sections} staticBaseUrl={staticBaseUrl} onEdit={editService} onDelete={deleteServiceDefinition} />
    <Modal isOpen={modalType === "new-section" || modalType === "edit-section"} onClose={closeModal}>
      {modalType === "new-section" && <SectionForm onSubmit={addSection} onClose={closeModal} sectionData={null} />}
      {modalType === "edit-section" && <SectionForm onSubmit={submitSection} onClose={closeModal} existingSection={editingSection} />}
    </Modal>
    <Modal isOpen={modalType === "new-service" || modalType === "edit-service"} onClose={closeModal} sizeClass="max-w-3xl">
      {modalType === "new-service" && <NewServiceForm onSubmit={addService} onClose={closeModal} Sections={sections} />}
      {modalType === "edit-service" && <NewServiceForm onSubmit={submitService} onClose={closeModal} Sections={sections} serviceData={editingService} />}
    </Modal>
  </div>;
}
