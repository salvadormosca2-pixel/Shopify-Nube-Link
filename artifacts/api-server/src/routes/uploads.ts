import { Router, type IRouter, type Request, type Response } from "express";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import { adminAuth } from "../middleware/admin";

const router: IRouter = Router();

cloudinary.config({
  cloud_name: process.env["CLOUDINARY_CLOUD_NAME"],
  api_key: process.env["CLOUDINARY_API_KEY"],
  api_secret: process.env["CLOUDINARY_API_SECRET"],
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Solo se permiten imágenes"));
    }
  },
});

/**
 * POST /admin/uploads/image
 * Admin-only: upload an image file to Cloudinary.
 * Returns { url } with the optimized Cloudinary HTTPS URL.
 */
router.post(
  "/admin/uploads/image",
  adminAuth,
  upload.single("image"),
  async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: "No se recibió ningún archivo de imagen" });
      return;
    }

    try {
      const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "alfis-jeans",
            resource_type: "image",
            transformation: [{ quality: "auto", fetch_format: "auto" }],
          },
          (error, result) => {
            if (error || !result) reject(error ?? new Error("Upload failed"));
            else resolve(result as { secure_url: string });
          }
        );
        stream.end(req.file!.buffer);
      });

      res.json({ url: result.secure_url });
    } catch (error) {
      req.log.error({ err: error }, "Cloudinary upload error");
      res.status(500).json({ error: "Error al subir la imagen a Cloudinary" });
    }
  }
);

export default router;
