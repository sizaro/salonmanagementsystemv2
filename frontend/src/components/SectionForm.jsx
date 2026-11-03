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
      id: existingSection?.id || null,
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
    <div className="w-full max-w-md rounded bg-white p-4 shadow">
      <h2 className="mb-3 text-lg font-semibold">
        {existingSection ? "Edit Section" : "Add Section"}
      </h2>

      {error && <div className="mb-2 text-red-600">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-sm">Section name</label>
          <input
            type="text"
            name="section_name"
            value={formData.section_name}
            onChange={handleChange}
            className="w-full rounded border px-2 py-1"
            placeholder="e.g. men, women, nails"
            autoFocus
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-blue-600 px-3 py-1 text-white disabled:opacity-60"
          >
            {submitting ? "Saving..." : existingSection ? "Update" : "Create"}
          </button>

          <button
            type="button"
            onClick={() => onClose && onClose()}
            className="rounded border px-3 py-1"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
