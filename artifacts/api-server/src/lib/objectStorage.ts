import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env["CLOUDINARY_CLOUD_NAME"],
  api_key: process.env["CLOUDINARY_API_KEY"],
  api_secret: process.env["CLOUDINARY_API_SECRET"],
  secure: true,
});

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env["CLOUDINARY_CLOUD_NAME"] &&
    process.env["CLOUDINARY_API_KEY"] &&
    process.env["CLOUDINARY_API_SECRET"]
  );
}

export async function uploadToCloudinary(
  buffer: Buffer,
  contentType: string,
  originalName: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const folder = "alfis-jeans";
    const publicId = `${folder}/${Date.now()}-${originalName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: "image",
        format: "webp",
        quality: "auto:good",
        transformation: [{ width: 1200, crop: "limit" }],
        overwrite: false,
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Cloudinary upload failed"));
        } else {
          resolve(result.secure_url);
        }
      },
    );

    uploadStream.end(buffer);
  });
}
