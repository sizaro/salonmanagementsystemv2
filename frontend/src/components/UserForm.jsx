import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, FileText, ShieldCheck } from "lucide-react";
import ProfilePhotoInput from "./common/ProfilePhotoInput.jsx";

const steps = ["Profile", "Identity", "Work details", "Review"];

const emptyForm = {
  first_name: "",
  middle_name: "",
  last_name: "",
  email: "",
  password: "",
  birthdate: "",
  contact: "",
  next_of_kin: "",
  next_of_kin_contact: "",
  role: "employee",
  gender: "",
  specialty: "",
  status: "active",
  bio: "",
  image_url: "",
  national_id_number: "",
  id_document_front: "",
  id_document_back: "",
  id_document_pdf: "",
  id_document_front_url: "",
  id_document_back_url: "",
  id_document_pdf_url: "",
};

const staticUrl = (url) => {
  if (!url || String(url).startsWith("http")) return url || "";
  const base = import.meta.env.VITE_STATIC_URL
    || (import.meta.env.MODE === "development" ? "http://localhost:5500" : "https://salonmanagementsystemv2-ru0i.onrender.com");
  return `${base}${url}`;
};

export default function UserForm({ user, onSubmit, onClose, role = "employee" }) {
  const [formData, setFormData] = useState({ ...emptyForm, role: role || "employee" });
  const [step, setStep] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) {
      setFormData({ ...emptyForm, role: role || "employee" });
      return;
    }

    setFormData({
      ...emptyForm,
      ...user,
      password: "",
      role: user.role || role || "employee",
      image_url: user.image_url || "",
      national_id_number: user.national_id_number || "",
      id_document_front_url: user.id_document_front_url || "",
      id_document_back_url: user.id_document_back_url || "",
      id_document_pdf_url: user.id_document_pdf_url || "",
    });
  }, [user, role]);

  const fullName = useMemo(
    () => [formData.first_name, formData.middle_name, formData.last_name].filter(Boolean).join(" ") || "New employee",
    [formData.first_name, formData.middle_name, formData.last_name],
  );

  const update = (name, value) => setFormData((previous) => ({ ...previous, [name]: value }));

  const handleChange = (event) => {
    const { name, value, type, files } = event.target;
    update(name, type === "file" ? files?.[0] || "" : value);
  };

  const hasFrontAndBack = Boolean(
    (formData.id_document_front instanceof File || formData.id_document_front_url)
    && (formData.id_document_back instanceof File || formData.id_document_back_url),
  );
  const hasPdf = Boolean(formData.id_document_pdf instanceof File || formData.id_document_pdf_url);

  const validateStep = (candidateStep) => {
    if (candidateStep === 0) {
      if (!formData.first_name.trim() || !formData.last_name.trim() || !formData.email.trim()) return "First name, last name, and email are required.";
      if (!user && !formData.password) return "Create a password for this employee.";
      if (formData.password && !/^(?=.*[0-9])(?=.*[!@#$%^&*(),.?\":{}|<>]).{8,}$/.test(formData.password)) return "Password must have at least 8 characters, one number, and one special character.";
    }
    if (candidateStep === 1) {
      if (!formData.national_id_number.trim()) return "Enter the employee's National ID number.";
      if (!hasFrontAndBack && !hasPdf) return "Add both National ID images or one complete PDF ID document.";
    }
    return "";
  };

  const nextStep = () => {
    const validation = validateStep(step);
    if (validation) {
      setError(validation);
      return;
    }
    setError("");
    setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const submit = async (event) => {
    event.preventDefault();
    const validation = validateStep(0) || validateStep(1);
    if (validation) {
      setError(validation);
      setStep(validateStep(0) ? 0 : 1);
      return;
    }

    const data = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      if (["image_url", "id_document_front", "id_document_back", "id_document_pdf"].includes(key)) {
        if (value instanceof File) data.append(key, value);
      } else if (!["id_document_front_url", "id_document_back_url", "id_document_pdf_url", "id"].includes(key) && value !== "") {
        data.append(key, value);
      }
    });

    try {
      setSubmitting(true);
      setError("");
      if (user?.id) await onSubmit(user.id, data);
      else await onSubmit(data);
    } catch (requestError) {
      setError(requestError?.response?.data?.error || requestError?.response?.data?.message || "The employee could not be saved. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto flex h-[86dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
      <div className="border-b border-stone-200 px-5 pb-4 pt-5 sm:px-7">
        <h2 className="text-xl font-semibold text-stone-900">{user ? "Edit employee" : "Create employee"}</h2>
        <p className="mt-1 text-sm text-stone-500">Complete each section, then review the record before saving.</p>
        <ol className="mt-5 grid grid-cols-4 gap-1">
          {steps.map((label, index) => (
            <li key={label} className="min-w-0">
              <div className={`h-1 rounded-full ${index <= step ? "bg-[var(--salon-copper)]" : "bg-stone-200"}`} />
              <p className={`mt-2 truncate text-xs font-semibold ${index === step ? "text-stone-900" : "text-stone-400"}`}>{index + 1}. {label}</p>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7">
        {step === 0 && (
          <div className="space-y-5">
            <div className="rounded-2xl bg-stone-50 p-4"><ProfilePhotoInput value={formData.image_url instanceof File ? formData.image_url : null} currentUrl={typeof formData.image_url === "string" ? formData.image_url : ""} onChange={(file) => update("image_url", file)} /></div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="First name" required><input value={formData.first_name} onChange={handleChange} name="first_name" /></Field>
              <Field label="Middle name"><input value={formData.middle_name} onChange={handleChange} name="middle_name" /></Field>
              <Field label="Last name" required><input value={formData.last_name} onChange={handleChange} name="last_name" /></Field>
              <Field label="Email" required><input type="email" value={formData.email} onChange={handleChange} name="email" /></Field>
              <label className="block text-sm font-medium text-stone-700">{user ? "New password (optional)" : "Password"}{!user && <span className="ml-1 text-rose-600">*</span>}<span className="relative mt-1 block"><input type={showPassword ? "text" : "password"} value={formData.password} onChange={handleChange} name="password" placeholder={user ? "Leave empty to keep the current password" : ""} className="block w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 pr-11 text-sm outline-none transition focus:border-[var(--salon-copper)] focus:ring-2 focus:ring-amber-100" /><button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-stone-500 hover:text-stone-800" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>
              <Field label="Contact"><input value={formData.contact} onChange={handleChange} name="contact" /></Field>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex gap-3"><ShieldCheck className="mt-0.5 shrink-0 text-amber-700" size={20} /><div><h3 className="font-semibold text-amber-950">Identity evidence</h3><p className="mt-1 text-sm text-amber-900/70">Enter the ID number and choose one evidence method: both sides as photos, or one complete PDF document.</p></div></div></div>
            <Field label="National ID number" required><input value={formData.national_id_number} onChange={handleChange} name="national_id_number" placeholder="e.g. CM12345678901234" /></Field>
            <div className="space-y-4">
              <EvidenceCard title="National ID — front" savedUrl={formData.id_document_front_url}><ProfilePhotoInput label="Front of ID" cameraTitle="Take front ID photo" documentMode facingMode="environment" value={formData.id_document_front instanceof File ? formData.id_document_front : null} currentUrl={formData.id_document_front_url} onChange={(file) => update("id_document_front", file)} /></EvidenceCard>
              <EvidenceCard title="National ID — back" savedUrl={formData.id_document_back_url}><ProfilePhotoInput label="Back of ID" cameraTitle="Take back ID photo" documentMode facingMode="environment" value={formData.id_document_back instanceof File ? formData.id_document_back : null} currentUrl={formData.id_document_back_url} onChange={(file) => update("id_document_back", file)} /></EvidenceCard>
            </div>
            <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.15em] text-stone-400"><span className="h-px flex-1 bg-stone-200" />or one PDF<span className="h-px flex-1 bg-stone-200" /></div>
            <div className="rounded-2xl border border-dashed border-stone-300 p-4"><div className="flex items-start gap-3"><FileText className="mt-0.5 text-stone-500" size={20} /><div className="min-w-0 flex-1"><p className="font-semibold text-stone-800">Complete National ID PDF</p><p className="mt-1 text-sm text-stone-500">Use this instead of the two photos when both sides are contained in one PDF.</p><input type="file" accept="application/pdf" name="id_document_pdf" onChange={handleChange} className="mt-3 block w-full text-sm" />{formData.id_document_pdf_url && <a className="mt-2 inline-block text-sm font-medium text-blue-700 underline" href={staticUrl(formData.id_document_pdf_url)} target="_blank" rel="noreferrer">Open saved ID PDF</a>}</div></div></div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Birthdate"><input type="date" value={formData.birthdate} onChange={handleChange} name="birthdate" /></Field>
              <Field label="Gender"><select value={formData.gender} onChange={handleChange} name="gender"><option value="">Select gender</option><option value="male">Male</option><option value="female">Female</option></select></Field>
              <Field label="Next of kin"><input value={formData.next_of_kin} onChange={handleChange} name="next_of_kin" /></Field>
              <Field label="Next of kin contact"><input value={formData.next_of_kin_contact} onChange={handleChange} name="next_of_kin_contact" /></Field>
              <Field label="Specialty"><input value={formData.specialty} onChange={handleChange} name="specialty" placeholder="e.g. Hair stylist" /></Field>
              <Field label="Role"><select value={formData.role} onChange={handleChange} name="role"><option value="manager">Manager</option><option value="cashier">Cashier</option><option value="employee">Employee</option></select></Field>
              <Field label="Status"><select value={formData.status} onChange={handleChange} name="status"><option value="active">Active</option><option value="inactive">Inactive</option><option value="on_leave">On leave</option></select></Field>
            </div>
            <Field label="Biography"><textarea value={formData.bio} onChange={handleChange} name="bio" rows="4" placeholder="A short professional introduction…" /></Field>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-stone-900 p-5 text-white"><p className="text-sm text-stone-300">Ready to save</p><h3 className="mt-1 text-2xl font-semibold">{fullName}</h3><p className="mt-2 text-sm text-stone-300">{formData.role || "Employee"} · {formData.email || "No email entered"}</p></div>
            <ReviewRow label="Profile photo" value={(formData.image_url instanceof File || formData.image_url) ? "Added" : "Not added"} />
            <ReviewRow label="National ID number" value={formData.national_id_number || "Not entered"} />
            <ReviewRow label="Identity evidence" value={hasFrontAndBack ? "Front and back images added" : hasPdf ? "PDF ID document added" : "Missing"} />
            <ReviewRow label="Contact" value={formData.contact || "Not entered"} />
            <ReviewRow label="Specialty" value={formData.specialty || "Not entered"} />
            <ReviewRow label="Status" value={formData.status || "active"} />
            <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"><Check className="mr-2 inline-block" size={16} />Review the record above, then save the employee.</p>
          </div>
        )}

        {error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-stone-200 bg-white px-5 py-4 sm:px-7">
        <button type="button" onClick={step === 0 ? onClose : () => { setError(""); setStep((current) => current - 1); }} disabled={submitting} className="inline-flex items-center gap-2 rounded-xl border border-stone-300 px-3 py-2 text-sm font-semibold disabled:opacity-50">{step === 0 ? "Cancel" : <><ArrowLeft size={16} /> Back</>}</button>
        {step < steps.length - 1 ? <button type="button" onClick={nextStep} className="inline-flex items-center gap-2 rounded-xl bg-[var(--salon-ink)] px-4 py-2 text-sm font-semibold text-white">Next <ArrowRight size={16} /></button> : <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-[var(--salon-copper)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{submitting ? "Saving…" : <><Check size={16} /> Save employee</>}</button>}
      </div>
    </form>
  );
}

function Field({ label, required, children }) {
  const child = React.Children.only(children);
  return <label className="block text-sm font-medium text-stone-700">{label}{required && <span className="ml-1 text-rose-600">*</span>}{React.cloneElement(child, { className: `${child.props.className || ""} mt-1 block w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[var(--salon-copper)] focus:ring-2 focus:ring-amber-100` })}</label>;
}

function EvidenceCard({ title, savedUrl, children }) {
  return <section className="rounded-2xl border border-stone-200 bg-stone-50 p-3"><h4 className="mb-3 text-sm font-semibold text-stone-800">{title}</h4>{children}{savedUrl && <a className="mt-2 inline-block text-sm font-medium text-blue-700 underline" href={staticUrl(savedUrl)} target="_blank" rel="noreferrer">Open saved image</a>}</section>;
}

function ReviewRow({ label, value }) {
  return <div className="flex items-start justify-between gap-4 rounded-xl border border-stone-200 px-4 py-3"><span className="text-sm text-stone-500">{label}</span><span className="max-w-[65%] break-words text-right text-sm font-semibold text-stone-800">{value}</span></div>;
}
