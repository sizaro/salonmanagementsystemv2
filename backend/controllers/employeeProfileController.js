import { getEmployeeDocument, getEmployeeProfile } from "../models/employeeProfileModel.js";
import { readPrivateArtifact, sendPrivateArtifact } from "../utils/privateArtifactStorage.js";

const employeeIdFromRequest = (req) => {
  const employeeId = Number(req.params.id);
  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    const error = new Error("A valid employee id is required");
    error.statusCode = 400;
    throw error;
  }
  return employeeId;
};

const role = (req) => String(req.user?.role || "").toLowerCase();
const isLeadership = (req) => ["owner", "manager"].includes(role(req));
const canView = (req, employeeId) => {
  const currentRole = role(req);
  return ["owner", "manager", "cashier"].includes(currentRole)
    || (currentRole === "employee" && Number(req.user?.id) === employeeId);
};
const canViewDocuments = (req, employeeId) => isLeadership(req)
  || (role(req) === "employee" && Number(req.user?.id) === employeeId);

const respond = (res, error) => res.status(error.statusCode || 500).json({
  error: error.statusCode ? error.message : "Unable to load the employee profile",
});

export const getEmployeeProfileById = async (req, res) => {
  try {
    const employeeId = employeeIdFromRequest(req);
    if (!canView(req, employeeId)) {
      return res.status(403).json({ error: "You are not allowed to view this employee profile" });
    }
    const profile = await getEmployeeProfile({
      salonId: req.salon_id,
      employeeId,
      includeSensitive: canViewDocuments(req, employeeId),
    });
    if (!profile) return res.status(404).json({ error: "Employee was not found" });
    return res.json({ profile, permissions: { can_view_documents: canViewDocuments(req, employeeId) } });
  } catch (error) {
    return respond(res, error);
  }
};

export const openEmployeeDocument = async (req, res) => {
  try {
    const employeeId = employeeIdFromRequest(req);
    if (!canViewDocuments(req, employeeId)) {
      return res.status(403).json({ error: "You are not allowed to open this employee document" });
    }
    const documentUrl = await getEmployeeDocument({
      salonId: req.salon_id,
      employeeId,
      kind: req.params.kind,
    });
    if (!documentUrl) return res.status(404).json({ error: "Document was not found" });

    // Cloudinary serves authenticated raw assets as generic downloads in some
    // browsers. Relay National ID PDFs through this authorised endpoint with
    // an explicit inline PDF response so they open in a browser tab instead.
    if (req.params.kind === "id-pdf") {
      const document = await readPrivateArtifact(documentUrl);
      res.set({
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="employee-${employeeId}-national-id.pdf"`,
        "Content-Length": String(document.length),
        "Content-Type": "application/pdf",
        "X-Content-Type-Options": "nosniff",
      });
      return res.send(document);
    }

    return sendPrivateArtifact(res, documentUrl);
  } catch (error) {
    return respond(res, error);
  }
};
