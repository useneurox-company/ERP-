import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import mime from "mime-types";
import { attachmentsRepository } from "./repository";
import { salesRepository } from "../sales/repository";
import { insertDealAttachmentSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { ObjectStorageService, ObjectNotFoundError } from "../../objectStorage";
import { ObjectPermission } from "../../objectAcl";
import { localFileStorage } from "../../localFileStorage";
import { activityLogsRepository } from "../tasks/repository";
import { generatePdfPreview, getCachedPreviewPath } from "../../services/pdfPreviewService";
import { generateXlsxPreview, getCachedXlsxPreviewPath } from "../../services/xlsxPreviewService";

export const router = Router();

// Configure multer for memory storage with 500MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 524288000, // 500MB limit
  },
});

// POST /api/objects/upload - direct file upload to local storage
router.post("/api/objects/upload", (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      // Multer error handling
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: `File too large. Maximum size is 50MB. Please reduce file size and try again.`
        });
      }
      console.error("Multer error:", err);
      return res.status(400).json({ error: err.message || "Failed to upload file" });
    }
    next();
  });
}, async (req, res) => {
  try {
    console.log('[Upload] POST /api/objects/upload - Starting upload');
    const userId = req.headers["x-user-id"] as string;

    if (!userId) {
      console.log('[Upload] No user ID in headers');
      return res.status(401).json({ error: "User not authenticated" });
    }

    console.log('[Upload] User ID:', userId);

    if (!req.file) {
      console.log('[Upload] No file in request');
      return res.status(400).json({ error: "No file uploaded" });
    }

    console.log('[Upload] Received file:', {
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    // Save file to local storage
    const objectPath = await localFileStorage.saveFile(req.file.buffer, req.file.originalname);

    console.log(`✅ [Upload] File saved successfully: ${req.file.originalname} -> ${objectPath}`);

    // Return objectPath for metadata storage
    const response = {
      objectPath,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype
    };

    console.log('[Upload] Returning response:', response);

    res.json(response);
  } catch (error) {
    console.error("[Upload] Error uploading file:", error);
    res.status(500).json({ error: "Failed to upload file" });
  }
});

// GET /objects/:objectPath(*) - скачивание файла из локального хранилища
router.get("/objects/:objectPath(*)", async (req, res) => {
  try {
    // Note: No authentication check here to allow direct file access via browser
    // Files are protected by UUID-based filenames which are hard to guess
    // Download file from local storage
    await localFileStorage.downloadFile(req.path, res);
  } catch (error) {
    console.error("Error downloading object:", error);
    if (!res.headersSent) {
      return res.status(500).json({ error: "Failed to download file" });
    }
  }
});

// GET /api/attachments/preview/:id - получение превью для документа
router.get("/api/attachments/preview/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Универсальный поиск вложения во всех таблицах
    const attachment = await attachmentsRepository.getAnyAttachmentById(id);

    if (!attachment) {
      console.log(`[Preview] Attachment not found: ${id}`);
      return res.status(404).json({ error: "Attachment not found" });
    }

    console.log(`[Preview] Found attachment: ${attachment.file_name} from ${attachment.source}, path: ${attachment.file_path}`);

    // Преобразуем URL path (/objects/...) в файловый путь
    const { exists, filePath: realFilePath } = await localFileStorage.getFile(attachment.file_path);

    if (!exists) {
      console.log(`[Preview] File not found on disk: ${realFilePath}`);
      return res.status(404).json({ error: "File not found on disk" });
    }

    console.log(`[Preview] Real file path: ${realFilePath}`);

    // Определяем тип файла по имени, пути или mime_type
    const fileName = attachment.file_name.toLowerCase();
    const filePath = attachment.file_path.toLowerCase();
    const mimeType = attachment.mime_type?.toLowerCase() || '';

    const isImage = fileName.match(/\.(jpg|jpeg|png|gif|svg|bmp|webp)$/) ||
                    filePath.match(/\.(jpg|jpeg|png|gif|svg|bmp|webp)$/) ||
                    mimeType.startsWith('image/');
    const isPdf = fileName.match(/\.pdf$/) ||
                  filePath.match(/\.pdf$/) ||
                  mimeType === 'application/pdf';
    const isXlsx = fileName.match(/\.(xlsx|xls)$/) ||
                   filePath.match(/\.(xlsx|xls)$/) ||
                   mimeType.includes('spreadsheet') || mimeType.includes('excel');

    console.log(`[Preview] File type detection: fileName=${fileName}, filePath=${filePath}, mimeType=${mimeType}, isPdf=${!!isPdf}, isImage=${!!isImage}, isXlsx=${!!isXlsx}`);

    // Функция для отправки изображения
    const sendImageFile = (filePath: string) => {
      if (!fs.existsSync(filePath)) {
        console.log(`[Preview] File not found on disk: ${filePath}`);
        return res.status(404).json({ error: "File not found on disk" });
      }

      const mimeType = mime.lookup(filePath) || 'image/jpeg';
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Кэш на 24 часа

      const readStream = fs.createReadStream(filePath);
      readStream.on('error', (err) => {
        console.error('[Preview] Error reading file:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Failed to read file" });
        }
      });
      readStream.pipe(res);
    };

    if (isImage) {
      // Для изображений отдаем сам файл
      sendImageFile(realFilePath);
    } else if (isPdf) {
      // Для PDF генерируем или берем из кэша превью первой страницы
      const cachedPreview = getCachedPreviewPath(id);

      if (cachedPreview) {
        console.log(`[Preview] Using cached PDF preview: ${cachedPreview}`);
        sendImageFile(cachedPreview);
      } else {
        // Генерируем превью асинхронно
        console.log(`[Preview] Generating PDF preview for: ${attachment.file_name}`);
        const previewPath = await generatePdfPreview(realFilePath, id);

        if (previewPath) {
          sendImageFile(previewPath);
        } else {
          // Если генерация не удалась, возвращаем 204 (клиент покажет иконку)
          console.log(`[Preview] PDF preview generation failed, returning 204`);
          res.status(204).send();
        }
      }
    } else if (isXlsx) {
      // Для XLSX генерируем или берем из кэша превью первого листа
      const cachedPreview = getCachedXlsxPreviewPath(id);

      if (cachedPreview) {
        console.log(`[Preview] Using cached XLSX preview: ${cachedPreview}`);
        sendImageFile(cachedPreview);
      } else {
        // Генерируем превью асинхронно
        console.log(`[Preview] Generating XLSX preview for: ${attachment.file_name}`);
        const previewPath = await generateXlsxPreview(realFilePath, id);

        if (previewPath) {
          sendImageFile(previewPath);
        } else {
          // Если генерация не удалась, возвращаем 204 (клиент покажет иконку)
          console.log(`[Preview] XLSX preview generation failed, returning 204`);
          res.status(204).send();
        }
      }
    } else {
      // Для других файлов возвращаем пустой ответ (клиент покажет иконку)
      res.status(204).send();
    }
  } catch (error) {
    console.error("Error getting preview:", error);
    res.status(500).json({ error: "Failed to get preview" });
  }
});

// GET /api/attachments/download/:id - скачивание файла по ID
router.get("/api/attachments/download/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Универсальный поиск вложения во всех таблицах
    const attachment = await attachmentsRepository.getAnyAttachmentById(id);

    if (!attachment) {
      console.log(`[Download] Attachment not found: ${id}`);
      return res.status(404).json({ error: "Attachment not found" });
    }

    console.log(`[Download] Found attachment: ${attachment.file_name} from ${attachment.source}, path: ${attachment.file_path}`);

    const filePath = attachment.file_path;

    // Проверяем существование файла
    if (!fs.existsSync(filePath)) {
      console.log(`[Download] File not found on disk: ${filePath}`);
      return res.status(404).json({ error: "File not found on disk" });
    }

    // Получаем размер файла для Content-Length
    const stat = fs.statSync(filePath);

    // Определяем MIME тип
    const mimeType = mime.lookup(filePath) || 'application/octet-stream';

    // Устанавливаем заголовки
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.file_name)}"`);

    // Стримим файл
    const readStream = fs.createReadStream(filePath);
    readStream.on('error', (err) => {
      console.error('[Download] Error reading file:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to read file" });
      }
    });
    readStream.pipe(res);
  } catch (error) {
    console.error("Error downloading attachment:", error);
    res.status(500).json({ error: "Failed to download attachment" });
  }
});

// POST /api/deals/:dealId/attachments - сохранение метаданных после загрузки
router.post("/api/deals/:dealId/attachments", async (req, res) => {
  try {
    const { dealId } = req.params;
    const userId = req.headers["x-user-id"] as string;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Проверяем, существует ли сделка
    const deal = await salesRepository.getDealById(dealId);
    if (!deal) {
      return res.status(404).json({ error: "Deal not found" });
    }

    // Валидация данных
    const validationResult = insertDealAttachmentSchema.safeParse({
      ...req.body,
      deal_id: dealId,
      uploaded_by: userId,
    });

    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      return res.status(400).json({ error: errorMessage });
    }

    if (!req.body.file_path) {
      return res.status(400).json({ error: "file_path is required" });
    }

    // Verify file exists in local storage
    const { exists } = await localFileStorage.getFile(req.body.file_path);
    if (!exists) {
      return res.status(404).json({ error: "Uploaded file not found" });
    }

    // Сохраняем метаданные в БД
    const newAttachment = await attachmentsRepository.createDealAttachment(validationResult.data);

    // Log activity
    await activityLogsRepository.logActivity({
      entity_type: "deal",
      entity_id: dealId,
      action_type: "created",
      user_id: userId,
      description: `Добавлено вложение: ${newAttachment.file_name}`,
    });

    res.status(201).json(newAttachment);
  } catch (error) {
    console.error("Error creating deal attachment:", error);
    res.status(500).json({ error: "Failed to create attachment" });
  }
});

// GET /api/deals/:dealId/attachments - получение списка файлов
router.get("/api/deals/:dealId/attachments", async (req, res) => {
  try {
    const { dealId } = req.params;
    
    // Проверяем, существует ли сделка
    const deal = await salesRepository.getDealById(dealId);
    if (!deal) {
      return res.status(404).json({ error: "Deal not found" });
    }

    const attachments = await attachmentsRepository.getDealAttachments(dealId);
    res.json(attachments);
  } catch (error) {
    console.error("Error fetching deal attachments:", error);
    res.status(500).json({ error: "Failed to fetch attachments" });
  }
});

// DELETE /api/deals/:dealId/attachments/:id - удаление файла
router.delete("/api/deals/:dealId/attachments/:id", async (req, res) => {
  try {
    const { dealId, id } = req.params;
    const userId = req.headers["x-user-id"] as string;
    
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Получаем вложение
    const attachment = await attachmentsRepository.getDealAttachmentById(id);
    
    if (!attachment) {
      return res.status(404).json({ error: "Attachment not found" });
    }

    if (attachment.deal_id !== dealId) {
      return res.status(404).json({ error: "Attachment not found for this deal" });
    }

    // Проверяем, что пользователь является владельцем файла
    if (attachment.uploaded_by !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Удаляем запись из БД
    const deleted = await attachmentsRepository.deleteDealAttachment(id);

    if (!deleted) {
      return res.status(404).json({ error: "Attachment not found" });
    }

    // Log activity
    await activityLogsRepository.logActivity({
      entity_type: "deal",
      entity_id: dealId,
      action_type: "deleted",
      user_id: userId,
      description: `Удалено вложение: ${attachment.file_name}`,
    });

    // Удаляем физический файл из локального хранилища
    try {
      await localFileStorage.deleteFile(attachment.file_path);
    } catch (error) {
      console.warn("Failed to delete physical file:", error);
      // Continue even if file deletion fails
    }

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting deal attachment:", error);
    res.status(500).json({ error: "Failed to delete attachment" });
  }
});
