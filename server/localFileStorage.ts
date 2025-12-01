import { Response } from "express";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Local storage directory
const UPLOADS_DIR = path.join(__dirname, "..", ".local", "uploads");

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  console.log(`✅ Created uploads directory: ${UPLOADS_DIR}`);
}

export class LocalFileStorageService {
  constructor() {}

  /**
   * Generate a file path for storing uploaded file
   */
  generateFilePath(originalName: string): { filePath: string; objectPath: string } {
    const fileId = randomUUID();
    const ext = path.extname(originalName);
    const fileName = `${fileId}${ext}`;
    const filePath = path.join(UPLOADS_DIR, fileName);
    const objectPath = `/objects/${fileName}`;

    return { filePath, objectPath };
  }

  /**
   * Save uploaded file buffer to disk
   */
  async saveFile(buffer: Buffer, originalName: string): Promise<string> {
    const { filePath, objectPath } = this.generateFilePath(originalName);

    await fs.promises.writeFile(filePath, buffer);
    console.log(`✅ File saved: ${filePath}`);

    return objectPath;
  }

  /**
   * Get file from local storage
   */
  async getFile(objectPath: string): Promise<{ exists: boolean; filePath: string }> {
    // Handle /objects/ virtual path prefix (used by deal_attachments)
    if (objectPath.startsWith("/objects/")) {
      const fileName = objectPath.replace("/objects/", "");
      const filePath = path.join(UPLOADS_DIR, fileName);
      const exists = fs.existsSync(filePath);
      return { exists, filePath };
    }

    // If it is a real absolute path (e.g. /var/www/..., /home/...), use it directly
    if (path.isAbsolute(objectPath) && !objectPath.startsWith("/objects")) {
      const exists = fs.existsSync(objectPath);
      return { exists, filePath: objectPath };
    }

    // For relative paths, join with UPLOADS_DIR
    const filePath = path.join(UPLOADS_DIR, objectPath);
    const exists = fs.existsSync(filePath);
    return { exists, filePath };
  }

  /**
   * Stream file to response
   */
  async downloadFile(objectPath: string, res: Response): Promise<void> {
    const { exists, filePath } = await this.getFile(objectPath);

    if (!exists) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    // Get file stats for content-type detection
    const ext = path.extname(filePath).toLowerCase();
    const contentType = this.getContentType(ext);
    const fileName = path.basename(filePath);

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);

    const readStream = fs.createReadStream(filePath);
    readStream.on("error", (err) => {
      console.error("Error streaming file:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    });

    readStream.pipe(res);
  }

  /**
   * Delete file from local storage
   */
  async deleteFile(objectPath: string): Promise<boolean> {
    const { exists, filePath } = await this.getFile(objectPath);

    if (!exists) {
      return false;
    }

    await fs.promises.unlink(filePath);
    console.log(`✅ File deleted: ${filePath}`);
    return true;
  }

  /**
   * Get content type based on file extension
   */
  private getContentType(ext: string): string {
    const types: Record<string, string> = {
      ".pdf": "application/pdf",
      ".doc": "application/msword",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".xls": "application/vnd.ms-excel",
      ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".txt": "text/plain",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".svg": "image/svg+xml",
      ".zip": "application/zip",
      ".rar": "application/x-rar-compressed",
      ".7z": "application/x-7z-compressed",
    };

    return types[ext] || "application/octet-stream";
  }
}

export const localFileStorage = new LocalFileStorageService();
