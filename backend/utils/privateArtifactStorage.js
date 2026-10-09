import fs from "fs/promises";
import path from "path";
import { v2 as cloudinary } from "cloudinary";
import { loadEnvironment } from "../config/environment.js";

loadEnvironment();

const cloudinaryReady = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME
  && process.env.CLOUDINARY_API_KEY
  && process.env.CLOUDINARY_API_SECRET,
);

if (cloudinaryReady) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

const legacyLocalPath = (reference) => {
  if (!reference?.startsWith("/uploads/")) return null;
  const uploadsRoot = path.resolve(process.cwd(), "uploads");
  const candidate = path.resolve(process.cwd(), `.${reference}`);
  return candidate.startsWith(uploadsRoot) ? candidate : null;
};

const privateLocalPath = (reference) => {
  const match = /^private:\/\/local\/([a-z-]+)\/([a-zA-Z0-9_.-]+)$/.exec(String(reference || ""));
  if (!match) return null;
  return path.join(process.cwd(), "private-uploads", match[1], match[2]);
};

export const localPrivateReference = ({ bucket, fileName }) => `private://local/${bucket}/${fileName}`;

export async function readPrivateArtifact(reference) {
  const localPath = privateLocalPath(reference) || legacyLocalPath(reference);
  if (localPath) return fs.readFile(localPath);

  const signedUrl = signedPrivateUrl(reference);
  if (!signedUrl) throw new Error("Private artifact is unavailable");
  const response = await fetch(signedUrl);
  if (!response.ok) throw new Error("Private artifact could not be read");
  return Buffer.from(await response.arrayBuffer());
}

export function signedPrivateUrl(reference) {
  const match = /^private:\/\/cloudinary\/(image|raw)\/(.+)$/.exec(String(reference || ""));
  if (!match || !cloudinaryReady) return null;
  const [, resourceType, publicId] = match;
  return cloudinary.url(publicId, {
    resource_type: resourceType,
    type: "authenticated",
    sign_url: true,
    secure: true,
  });
}

export async function sendPrivateArtifact(res, reference, { downloadName } = {}) {
  const localPath = privateLocalPath(reference) || legacyLocalPath(reference);
  if (localPath) {
    if (downloadName) res.setHeader("Content-Disposition", `attachment; filename=\"${downloadName}\"`);
    return res.sendFile(localPath);
  }
  const url = signedPrivateUrl(reference);
  if (!url) {
    const error = new Error("Private artifact is unavailable");
    error.statusCode = 404;
    throw error;
  }
  return res.redirect(url);
}
