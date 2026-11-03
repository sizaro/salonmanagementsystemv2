import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";
import { localPrivateReference, readPrivateArtifact } from "./privateArtifactStorage.js";

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

const uploadBuffer = (buffer, options) => new Promise((resolve, reject) => {
  const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
    if (error) reject(error);
    else resolve(result);
  });
  stream.end(buffer);
});

const localTarget = (bucket, fileName) => ({
  directory: path.join(process.cwd(), "private-uploads", bucket),
  url: localPrivateReference({ bucket, fileName }),
  filePath: path.join(process.cwd(), "private-uploads", bucket, fileName),
});

const randomName = (prefix, extension) => `${prefix}-${Date.now()}-${crypto.randomBytes(5).toString("hex")}${extension}`;

export const sha256 = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");

export async function signatureFromDataUrl(value) {
  const match = /^data:image\/(png|jpeg);base64,([a-z0-9+/=\s]+)$/i.exec(String(value || ""));
  if (!match) {
    const error = new Error("A valid handwritten signature is required");
    error.statusCode = 400;
    throw error;
  }
  const raw = Buffer.from(match[2], "base64");
  if (!raw.length || raw.length > 1_500_000) {
    const error = new Error("The signature image is invalid or too large");
    error.statusCode = 400;
    throw error;
  }
  try {
    // Normalise to a lossless PNG. The unmodified drawing is retained in this
    // PNG and the SHA-256 hash is stored with the signature evidence.
    return await sharp(raw).rotate().png({ compressionLevel: 9 }).toBuffer();
  } catch {
    const error = new Error("The supplied signature image could not be read");
    error.statusCode = 400;
    throw error;
  }
}

export async function storeSignaturePng(buffer) {
  if (configured()) {
    const result = await uploadBuffer(buffer, {
      folder: "salon-management/finance-signatures",
      resource_type: "image",
      type: "authenticated",
      public_id: `receipt-signature-${Date.now()}`,
      overwrite: false,
    });
    return `private://cloudinary/image/${result.public_id}`;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Signed receipt storage requires Cloudinary configuration in production.");
  }
  const target = localTarget("finance-signatures", randomName("receipt-signature", ".png"));
  await fs.mkdir(target.directory, { recursive: true });
  await fs.writeFile(target.filePath, buffer);
  return target.url;
}

export async function storeReceiptPdf(buffer) {
  if (configured()) {
    const result = await uploadBuffer(buffer, {
      folder: "salon-management/finance-receipts",
      resource_type: "raw",
      type: "authenticated",
      public_id: `employee-finance-receipt-${Date.now()}`,
      overwrite: false,
      format: "pdf",
    });
    return `private://cloudinary/raw/${result.public_id}`;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Signed receipt storage requires Cloudinary configuration in production.");
  }
  const target = localTarget("finance-receipts", randomName("employee-finance-receipt", ".pdf"));
  await fs.mkdir(target.directory, { recursive: true });
  await fs.writeFile(target.filePath, buffer);
  return target.url;
}

export async function storeManualReceipt(buffer, mimeType = "application/pdf") {
  const isImage = /^image\/(png|jpeg|webp)$/i.test(String(mimeType));
  const extension = mimeType === "image/jpeg" ? ".jpg" : mimeType === "image/webp" ? ".webp" : isImage ? ".png" : ".pdf";
  if (configured()) {
    const result = await uploadBuffer(buffer, {
      folder: "salon-management/manual-finance-receipts",
      resource_type: isImage ? "image" : "raw",
      type: "authenticated",
      public_id: `manual-finance-receipt-${Date.now()}`,
      overwrite: false,
      ...(isImage ? {} : { format: "pdf" }),
    });
    return `private://cloudinary/${isImage ? "image" : "raw"}/${result.public_id}`;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Manual receipt storage requires Cloudinary configuration in production.");
  }
  const target = localTarget("manual-finance-receipts", randomName("manual-finance-receipt", extension));
  await fs.mkdir(target.directory, { recursive: true });
  await fs.writeFile(target.filePath, buffer);
  return target.url;
}

export async function readStoredArtifact(url) {
  return readPrivateArtifact(url);
}
