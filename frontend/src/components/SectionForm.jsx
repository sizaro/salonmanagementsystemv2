import React, { useEffect, useState } from "react";

/**
 * Props:
 * - existingSection: { id, section_name } | null
 * - onSubmit: async function(sectionPayload)  // e.g. { id, section_name }
 * - onClose: function()
 */
export default function SectionForm({ existingSection = null, onSubmit, onClose }) {
  const [formData, setFormData] = useState({ section_name: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Update formData whenever existingSection changes
  useEffect(() => {
    setFormData({
      section_name: existingSection?.section_name || "",
      id: existingSection?.id || null
    });
  }, [existingSection]);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const trimmedName = formData.section_name.trim();
    if (!trimmedName) {
      setError("Section name is required");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({ ...formData, section_name: trimmedName });
      onClose && onClose();
    } catch (err) {
      console.error("SectionForm submit error:", err);
      setError(err?.message || "Failed to save section");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white p-4 rounded shadow">
      <h2 className="text-lg font-semibold mb-3">
        {existingSection ? "Edit Section" : "Add Section"}
      </h2>

      {error && <div className="text-red-600 mb-2">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm mb-1">Section name</label>
          <input
            type="text"
            name="section_name"
            value={formData.section_name}
            onChange={handleChange}
            className="w-full border rounded px-2 py-1"
            placeholder="e.g. men, women, nails"
            autoFocus
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="bg-blue-600 text-white px-3 py-1 rounded disabled:opacity-60"
          >
            {submitting ? "Saving..." : existingSection ? "Update" : "Create"}
          </button>

          <button
            type="button"
            onClick={() => onClose && onClose()}
            className="px-3 py-1 border rounded"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
