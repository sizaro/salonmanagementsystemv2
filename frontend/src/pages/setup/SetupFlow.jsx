import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../../context/DataContext";

export default function SalonSetup() {
  const navigate = useNavigate();
  const {
    createSalon,
    createOwner,
    createSalonProfile,
  } = useData();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // shared
  const [salonId, setSalonId] = useState(null);
  const [slug, setSlug] = useState("");

  // step 1
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // step 2
  const [password, setPassword] = useState("");

  // step 3
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");

  /* ============================
     STEP 1: CREATE SALON
     ============================ */
  const handleCreateSalon = async () => {
    try {
      setLoading(true);
      setError("");

      const salon = await createSalon({ email, phone });

      // existing salon → skip setup
      if (!salon?.id) {
        navigate("/");
        return;
      }

      setSalonId(salon.id);
      setStep(2);
    } catch (err) {
      setError(err.message || "Failed to create salon");
    } finally {
      setLoading(false);
    }
  };

  /* ============================
     STEP 2: CREATE OWNER
     ============================ */
  const handleCreateOwner = async () => {
    try {
      setLoading(true);
      setError("");

      await createOwner({
        salon_id: salonId,
        email,
        password,
      });

      setStep(3);
    } catch (err) {
      setError(err.message || "Failed to create owner");
    } finally {
      setLoading(false);
    }
  };

  /* ============================
     STEP 3: CREATE SALON PROFILE
     ============================ */
  const handleCreateProfile = async () => {
    try {
      setLoading(true);
      setError("");

      const profile = await createSalonProfile({
        salon_id: salonId,
        name,
        tagline,
      });

      // slug is generated in backend
      setSlug(profile.slug);
      setStep(4);
    } catch (err) {
      setError(err.message || "Failed to create salon profile");
    } finally {
      setLoading(false);
    }
  };

  /* ============================
     UI
     ============================ */
  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-xl font-bold mb-4">Salon Setup</h1>

      {error && (
        <p className="text-red-500 mb-3">{error}</p>
      )}

      {/* STEP 1 */}
      {step === 1 && (
        <>
          <input
            className="input"
            placeholder="Business Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="input"
            placeholder="Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <button onClick={handleCreateSalon} disabled={loading}>
            Continue
          </button>
        </>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <>
          <p className="text-sm text-gray-600 mb-2">
            Create owner account
          </p>
          <input
            className="input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button onClick={handleCreateOwner} disabled={loading}>
            Continue
          </button>
        </>
      )}

      {/* STEP 3 */}
      {step === 3 && (
        <>
          <input
            className="input"
            placeholder="Salon Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="input"
            placeholder="Tagline (optional)"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
          />
          <button onClick={handleCreateProfile} disabled={loading}>
            Continue
          </button>
        </>
      )}

      {/* STEP 4 */}
      {step === 4 && (
        <>
          <p className="mb-2 font-medium">
            Your online salon link:
          </p>
          <a
            href={`/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline break-all"
          >
            {window.location.origin}/{slug}
          </a>

          <button
            className="mt-4"
            onClick={() => navigate(`/${slug}`)}
          >
            Finish Setup
          </button>
        </>
      )}
    </div>
  );
}
