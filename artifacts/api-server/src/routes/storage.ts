import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { uploadToCloudinary, isCloudinaryConfigured } from "../lib/objectStorage";
import { adminAuth } from "../middleware/admin";

const router: IRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Solo se permiten imágenes"));
    }
  },
});

/**
 * POST /storage/upload
 *
 * Admin-only: upload a product image to Cloudinary.
 * Accepts multipart/form-data with a "file" field.
 * Returns { url } — the permanent Cloudinary CDN URL.
 */
router.post(
  "/storage/upload",
  adminAuth,
  upload.single("file"),
  async (req: Request, res: Response) => {
    if (!isCloudinaryConfigured()) {
      res.status(503).json({
        error: "storage_unavailable",
        message:
          "El almacenamiento de imágenes no está configurado. " +
          "Configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET.",
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "No se recibió ningún archivo" });
      return;
    }

    try {
      const url = await uploadToCloudinary(
        req.file.buffer,
        req.file.mimetype,
        req.file.originalname,
      );
      res.json({ url });
    } catch (error) {
      console.error("Error uploading to Cloudinary", error);
      res.status(500).json({ error: "Error al subir la imagen" });
    }
  },
);

export default router;
