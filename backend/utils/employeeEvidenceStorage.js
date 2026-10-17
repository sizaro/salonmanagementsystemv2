import fs from "fs/promises";
import path from "path";
import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";
import { localPrivateReference } from "./privateArtifactStorage.js";

const imageFields = new Set(["image_url", "id_document_front", "id_document_back"]);
const configured = () => Boolean(
  process.env.CLOUDINARY_CLOUD_NAME
  && process.env.CLOUDINARY_API_KEY
  && process.env.CLOUDINARY_API_SECRET,
);

const configureCloudinary = () => {
  if (!configured()) return false;

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  return true;
};

const first = (files, field) => files?.[field]?.[0] || null;
const fieldPrefix = (field) => ({
  image_url: "profile",
  id_document_front: "national-id-front",
  id_document_back: "national-id-back",
  id_document_pdf: "national-id-document",
}[field] || "employee-file");

const cloudinaryAssetOptions = (field) => {
  const isProfilePhoto = field === "image_url";
  const isPdf = field === "id_document_pdf";

  return {
    resource_type: isPdf ? "raw" : "image",
    type: isProfilePhoto ? "upload" : "authenticated",
  };
};

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
  if (field === "image_url") {
    const directory = path.join(process.cwd(), "uploads", "images");
    const fileName = `${fieldPrefix(field)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extension}`;
    return { directory, fileName, url: `/uploads/images/${fileName}` };
  }
  const bucket = "employee-evidence";
  const directory = path.join(process.cwd(), "private-uploads", bucket);
  const fileName = `${fieldPrefix(field)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extension}`;
  return { directory, fileName, url: localPrivateReference({ bucket, fileName }) };
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

  if (configureCloudinary()) {
    const assetOptions = cloudinaryAssetOptions(field);
    const result = await uploadBuffer(processed, {
      folder: "salon-management/employee-evidence",
      resource_type: assetOptions.resource_type,
      // A profile photograph is display media, not identity evidence. The
      // national-ID fields below remain authenticated/private.
      type: assetOptions.type,
      public_id: `${fieldPrefix(field)}-${Date.now()}`,
      overwrite: false,
    });
    return {
      reference: field === "image_url"
        ? result.secure_url
        : `private://cloudinary/${assetOptions.resource_type}/${result.public_id}`,
      publicId: result.public_id,
    };
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Employee uploads require Cloudinary configuration in production.");
  }

  const target = localUrl(field, file);
  await fs.mkdir(target.directory, { recursive: true });
  await fs.writeFile(path.join(target.directory, target.fileName), processed);
  return { reference: target.url, publicId: null };
}

const localPathFromReference = (reference) => {
  if (!reference) return null;
  if (reference.startsWith("/uploads/images/")) {
    return path.join(process.cwd(), reference.slice(1));
  }

  const match = /^private:\/\/local\/employee-evidence\/([a-zA-Z0-9_.-]+)$/.exec(reference);
  return match ? path.join(process.cwd(), "private-uploads", "employee-evidence", match[1]) : null;
};

/**
 * Removes one superseded employee asset only after its database reference has
 * been replaced or the employee has been deleted. Legacy URL-only Cloudinary
 * assets are deliberately retained because their exact public id is unknown.
 */
export async function removeEmployeeEvidenceAsset({ field, publicId, reference }) {
  if (publicId) {
    if (!configureCloudinary()) {
      throw new Error("Cloudinary configuration is required to remove an employee asset.");
    }

    const result = await cloudinary.uploader.destroy(publicId, {
      ...cloudinaryAssetOptions(field),
      invalidate: true,
    });
    if (!["ok", "not found"].includes(result.result)) {
      throw new Error(`Cloudinary could not remove employee ${field}: ${result.result || "unknown result"}`);
    }
    return;
  }

  const localPath = localPathFromReference(reference);
  if (localPath) await fs.unlink(localPath).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
}

export async function removeEmployeeEvidenceAssets(assets) {
  const results = await Promise.allSettled(assets.map(removeEmployeeEvidenceAsset));
  const failures = results.filter((result) => result.status === "rejected");
  if (failures.length) throw failures[0].reason;
}

/**
 * Optimises employee images and persists all evidence. Profile photos are
 * display media; national-ID images and PDFs are private authenticated assets.
 */
export async function storeEmployeeEvidence(files) {
  const [image, idDocumentFront, idDocumentBack, idDocumentPdf] = await Promise.all([
    saveOne("image_url", first(files, "image_url")),
    saveOne("id_document_front", first(files, "id_document_front")),
    saveOne("id_document_back", first(files, "id_document_back")),
    saveOne("id_document_pdf", first(files, "id_document_pdf")),
  ]);

  return {
    image_url: image?.reference,
    image_public_id: image?.publicId,
    id_document_front_url: idDocumentFront?.reference,
    id_document_front_public_id: idDocumentFront?.publicId,
    id_document_back_url: idDocumentBack?.reference,
    id_document_back_public_id: idDocumentBack?.publicId,
    id_document_pdf_url: idDocumentPdf?.reference,
    id_document_pdf_public_id: idDocumentPdf?.publicId,
  };
}
