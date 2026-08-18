import { useState } from "react";
import Button from "./Button";

export default function CancelReasonForm({ serviceId, onSubmit, onClose }) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError("Please enter a reason for cancellation.");
      return;
    }
    try {
      setError("");
      setSubmitting(true);
      await onSubmit(serviceId, "cancelled", reason.trim());
      onClose();
    } catch (submitError) {
      setError(
        submitError?.response?.data?.message ||
        "The appointment could not be cancelled.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">
        Cancel Appointment
      </h2>
      <p className="text-sm text-gray-600">
        Please provide a short reason for cancelling this appointment.
      </p>

      <textarea
        className="w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring focus:ring-blue-300"
        rows="4"
        placeholder="Type your reason..."
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />

      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          onClick={onClose}
          className="bg-gray-300 hover:bg-gray-400 text-black"
        >
          Cancel
        </Button>
        <Button type="submit" disabled={submitting} className="bg-red-500 hover:bg-red-400 disabled:opacity-60">
          {submitting ? "Cancelling…" : "Submit Reason"}
        </Button>
      </div>
    </form>
  );
}
