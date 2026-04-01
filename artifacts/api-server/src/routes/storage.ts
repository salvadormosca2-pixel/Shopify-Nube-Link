import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { adminAuth } from "../middleware/admin";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/**
 * POST /storage/uploads/request-url
 *
 * Admin-only: request a presigned URL for product image upload.
 * Client sends JSON metadata — NOT the file.
 * Then the client uploads the file directly to the presigned URL.
 */
router.post("/storage/uploads/request-url", adminAuth, async (req: Request, res: Response) => {
  const { name, size, contentType } = req.body;

  if (!name || !contentType) {
    res.status(400).json({ error: "Missing required fields: name, contentType" });
    return;
  }

  try {
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    res.json({ uploadURL, objectPath, metadata: { name, size, contentType } });
  } catch (error) {
    console.error("Error generating upload URL", error);
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    const response = await objectStorageService.downloadObject(file);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) {
      Readable.fromWeb(response.body as import("stream/web").ReadableStream).pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    console.error("Error serving public object", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve uploaded object entities.
 */
router.get("/storage/objects/*objectPath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.objectPath;
    const objectPath = `/objects/${Array.isArray(raw) ? raw.join("/") : raw}`;
    const file = await objectStorageService.getObjectEntityFile(objectPath);
    const response = await objectStorageService.downloadObject(file, 86400);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) {
      Readable.fromWeb(response.body as import("stream/web").ReadableStream).pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Object not found" });
    } else {
      console.error("Error serving object", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

export default router;
