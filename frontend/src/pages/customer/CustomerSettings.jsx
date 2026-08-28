import { useEffect, useState } from "react";
import { Eye, EyeOff, LockKeyhole, Save, UserRound } from "lucide-react";
import ProfilePhotoInput from "../../components/common/ProfilePhotoInput.jsx";
import { useData } from "../../context/DataContext.jsx";

const staticBaseUrl = import.meta.env.VITE_STATIC_URL || (import.meta.env.MODE === "development" ? "http://localhost:5500" : "https://salonmanagementsystemv2-ru0i.onrender.com");
const resolveImage = (url) => !url ? "" : String(url).startsWith("http") ? url : `${staticBaseUrl}${url}`;

export default function CustomerSettings() {
  const { user, fetchMyProfile, updateMyProfile, changeMyPassword } = useData();
  const [profile, setProfile] = useState({ first_name: "", middle_name: "", last_name: "", contact: "", gender: "", email: "", image_url: "" });
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileNotice, setProfileNotice] = useState(null);
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState(null);

  useEffect(() => {
    let active = true;
    fetchMyProfile().then((data) => { if (active) setProfile(data); }).catch(() => { if (active) setProfileNotice({ type: "error", text: "Your profile could not be loaded." }); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const updateField = (event) => setProfile((current) => ({ ...current, [event.target.name]: event.target.value }));

  const saveProfile = async (event) => {
    event.preventDefault();
    setProfileSaving(true);
    setProfileNotice(null);
    try {
      const formData = new FormData();
      ["first_name", "middle_name", "last_name", "contact", "gender"].forEach((key) => formData.append(key, profile[key] || ""));
      if (photo) formData.append("image_url", photo);
      const response = await updateMyProfile(formData);
      setProfile(response.data);
      setPhoto(null);
      setProfileNotice({ type: "success", text: "Your profile was updated successfully." });
    } catch (error) {
      setProfileNotice({ type: "error", text: error.response?.data?.error || "Your profile could not be updated." });
    } finally {
      setProfileSaving(false);
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    setPasswordNotice(null);
    if (passwords.newPassword !== passwords.confirmPassword) {
      setPasswordNotice({ type: "error", text: "The new passwords do not match." });
      return;
    }
    setPasswordSaving(true);
    try {
      const response = await changeMyPassword({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword });
      setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPasswordNotice({ type: "success", text: response.message });
    } catch (error) {
      setPasswordNotice({ type: "error", text: error.response?.data?.message || "Your password could not be changed." });
    } finally {
      setPasswordSaving(false);
    }
  };

  if (loading) return <div className="dashboard-page grid min-h-[60vh] place-items-center"><div className="dashboard-card">Loading your settings…</div></div>;

  return (
    <div className="dashboard-page space-y-6">
      <header className="dashboard-hero"><p className="salon-eyebrow text-[var(--salon-copper)]">Account settings</p><h1 className="relative z-10 mt-2 font-serif text-3xl font-semibold sm:text-4xl">Your profile and security</h1><p className="relative z-10 mt-2 max-w-2xl text-stone-600">Keep your personal details and portal password up to date.</p></header>

      <form onSubmit={saveProfile} className="dashboard-panel space-y-6">
        <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-100 text-[var(--salon-copper)]"><UserRound size={20} /></span><div><h2 className="font-serif text-2xl font-semibold">Personal profile</h2><p className="text-sm text-stone-500">Your email remains the account login and cannot be changed here.</p></div></div>
        <ProfilePhotoInput value={photo} currentUrl={resolveImage(profile.image_url)} onChange={setPhoto} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm font-semibold text-stone-700">First name<input required name="first_name" value={profile.first_name || ""} onChange={updateField} className="mt-2 w-full rounded-xl border border-stone-300 px-4 py-3 font-normal" /></label>
          <label className="text-sm font-semibold text-stone-700">Middle name<input name="middle_name" value={profile.middle_name || ""} onChange={updateField} className="mt-2 w-full rounded-xl border border-stone-300 px-4 py-3 font-normal" /></label>
          <label className="text-sm font-semibold text-stone-700">Last name<input required name="last_name" value={profile.last_name || ""} onChange={updateField} className="mt-2 w-full rounded-xl border border-stone-300 px-4 py-3 font-normal" /></label>
          <label className="text-sm font-semibold text-stone-700">Email<input readOnly value={profile.email || user?.email || ""} className="mt-2 w-full rounded-xl border border-stone-200 bg-stone-100 px-4 py-3 font-normal text-stone-500" /></label>
          <label className="text-sm font-semibold text-stone-700">Contact<input name="contact" value={profile.contact || ""} onChange={updateField} className="mt-2 w-full rounded-xl border border-stone-300 px-4 py-3 font-normal" /></label>
          <label className="text-sm font-semibold text-stone-700">Gender<select name="gender" value={profile.gender || ""} onChange={updateField} className="mt-2 w-full rounded-xl border border-stone-300 px-4 py-3 font-normal"><option value="">Prefer not to say</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></select></label>
        </div>
        {profileNotice && <p role="status" className={`rounded-xl p-3 text-sm ${profileNotice.type === "error" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{profileNotice.text}</p>}
        <button disabled={profileSaving} className="salon-button-primary disabled:opacity-60"><Save size={17} /> {profileSaving ? "Saving profile…" : "Save profile"}</button>
      </form>

      <form onSubmit={savePassword} className="dashboard-panel space-y-5">
        <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-rose-100 text-rose-700"><LockKeyhole size={20} /></span><div><h2 className="font-serif text-2xl font-semibold">Change portal password</h2><p className="text-sm text-stone-500">Confirm the current password before creating a new one.</p></div></div>
        <div className="grid gap-4 md:grid-cols-3">{[["currentPassword", "Current password"], ["newPassword", "New password"], ["confirmPassword", "Confirm new password"]].map(([name, label]) => <label key={name} className="relative text-sm font-semibold text-stone-700">{label}<input required minLength={8} name={name} type={showPasswords ? "text" : "password"} value={passwords[name]} onChange={(event) => setPasswords((current) => ({ ...current, [name]: event.target.value }))} className="mt-2 w-full rounded-xl border border-stone-300 px-4 py-3 pr-12 font-normal" /><button type="button" onClick={() => setShowPasswords((value) => !value)} className="absolute bottom-3 right-3 text-stone-500" aria-label="Show or hide passwords">{showPasswords ? <EyeOff size={18} /> : <Eye size={18} />}</button></label>)}</div>
        <p className="text-xs text-stone-500">Use at least 8 characters, one number, and one special character.</p>
        {passwordNotice && <p role="status" className={`rounded-xl p-3 text-sm ${passwordNotice.type === "error" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{passwordNotice.text}</p>}
        <button disabled={passwordSaving} className="salon-button-primary disabled:opacity-60"><LockKeyhole size={17} /> {passwordSaving ? "Changing password…" : "Change password"}</button>
      </form>
    </div>
  );
}
