import fs from "fs";
import path from "path";
import multer from "multer";
import { Router, Response } from "express";
import { authenticate, AuthRequest } from "../lib/auth.middleware.js";
import { addMediaAsset } from "../lib/mediaDb.js";

const router = Router();

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^\w.\-]/g, "_");
    cb(null, `${Date.now()}-${safe}`);
  },
});

// Allow larger media uploads for Explorer videos.
const upload = multer({ storage, limits: { fileSize: 512 * 1024 * 1024 } });

router.post("/", authenticate, upload.single("file"), async (req: AuthRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ error: "No file" });
  const publicPath = `/uploads/${req.file.filename}`;
  try {
    await addMediaAsset({
      uploaderId: req.user?.userId || null,
      url: publicPath,
      storagePath: req.file.path,
      fileName: req.file.filename,
      mimeType: req.file.mimetype,
      fileSizeBytes: req.file.size,
      metadata: { originalName: req.file.originalname },
    });
  } catch (err) {
    console.warn("media-db insert failed (non-fatal):", err);
  }
  res.json({ url: publicPath, path: publicPath });
});

export default router;
