import fs from "fs/promises";
import path from "path";
import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";

const imageFields = new Set(["image_url", "id_document_front", "id_document_back"]);
const configured = () => Boolean(
  process.env.CLOUDINARY_CLOUD_NAME
  && process.env.CLOUDINARY_API_KEY
  && process.env.CLOUDINARY_API_SECRET,
);

if (configured()) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

const first = (files, field) => files?.[field]?.[0] || null;
const fieldPrefix = (field) => ({
  image_url: "profile",
  id_document_front: "national-id-front",
  id_document_back: "national-id-back",
  id_document_pdf: "national-id-document",
}[field] || "employee-file");

const uploadBuffer = (buffer, options) => new Promise((resolve, reject) => {
  const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
    if (error) reject(error);
    else resolve(result);
  });
  stream.end(buffer);
});

const localUrl = (field, file) => {
  const isPdf = field === "id_document_pdf";
  const extension = isPdf ? ".pdf" : ".jpg";
  const directory = path.join(process.cwd(), isPdf ? "uploads/documents" : "uploads/images");
  const fileName = `${fieldPrefix(field)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extension}`;
  return { directory, fileName, url: `/uploads/${isPdf ? "documents" : "images"}/${fileName}` };
};

async function normaliseImage(buffer) {
  return sharp(buffer)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer();
}

async function saveOne(field, file) {
  if (!file) return undefined;
  const isImage = imageFields.has(field);
  const processed = isImage ? await normaliseImage(file.buffer) : file.buffer;

  if (configured()) {
    const result = await uploadBuffer(processed, {
      folder: "salon-management/employee-evidence",
      resource_type: isImage ? "image" : "raw",
      public_id: `${fieldPrefix(field)}-${Date.now()}`,
      overwrite: false,
    });
    return result.secure_url;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Employee uploads require Cloudinary configuration in production.");
  }

  const target = localUrl(field, file);
  await fs.mkdir(target.directory, { recursive: true });
  await fs.writeFile(path.join(target.directory, target.fileName), processed);
  return target.url;
}

/**
 * Optimises employee images and persists all evidence. With Cloudinary keys it
 * returns secure Cloudinary URLs; development without keys uses local files.
 */
export async function storeEmployeeEvidence(files) {
  const [image_url, id_document_front_url, id_document_back_url, id_document_pdf_url] = await Promise.all([
    saveOne("image_url", first(files, "image_url")),
    saveOne("id_document_front", first(files, "id_document_front")),
    saveOne("id_document_back", first(files, "id_document_back")),
    saveOne("id_document_pdf", first(files, "id_document_pdf")),
  ]);

  return { image_url, id_document_front_url, id_document_back_url, id_document_pdf_url };
}
