import multer from "multer";
import path from "path";
import fs from "fs";

// Directory to store images
const IMAGES_DIR = path.join(process.cwd(), "uploads/images");
const DOCUMENTS_DIR = path.join(process.cwd(), "uploads/documents");

// Ensure directory exists
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}
if (!fs.existsSync(DOCUMENTS_DIR)) fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });

// Configure Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, IMAGES_DIR);
  },
  filename: (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  let prefix = "file";

  if (file.fieldname === "image_url") prefix = "user";
  if (file.fieldname === "service_image") prefix = "service";
  if (file.fieldname === "product_image") prefix = "product";

  const filename = `${prefix}-${Date.now()}${ext}`;
  cb(null, filename);
},

});

// Filter allowed image types
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype;
  if (allowedTypes.test(ext) && allowedTypes.test(mime)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files (jpg, jpeg, png, webp) are allowed!"));
  }
};

// 5 MB max file size
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export default upload;

const employeeEvidenceFilter = (req, file, cb) => {
  const isPdfField = file.fieldname === "id_document_pdf";
  const isImage = /^(image\/(jpeg|png|webp))$/.test(file.mimetype);
  if ((isPdfField && file.mimetype === "application/pdf") || (!isPdfField && isImage)) return cb(null, true);
  cb(new Error(isPdfField ? "Only PDF files are allowed for the ID document." : "Only JPG, PNG, or WebP images are allowed."));
};

export const employeeEvidenceUpload = multer({
  // Evidence stays in memory briefly so the storage service can optimise images
  // before putting them in Cloudinary. It also allows a local development fallback.
  storage: multer.memoryStorage(),
  fileFilter: employeeEvidenceFilter,
  limits: { fileSize: 8 * 1024 * 1024 },
});
