import { Router } from "express";
import { boardRepository } from "./repository";
import { insertBoardSchema, insertBoardColumnSchema, insertBoardCardSchema, insertBoardLabelSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import multer from "multer";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { unlink } from "fs/promises";

export const router = Router();

// Configure multer for file uploads
const UPLOAD_DIR = join(process.cwd(), ".local", "board_attachments");
if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + originalname);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// ============ BOARDS ============

// GET /api/boards - get all boards
router.get("/api/boards", async (req, res) => {
  try {
    const boards = await boardRepository.getAllBoards();
    res.json(boards);
  } catch (error) {
    console.error("[Boards] Error fetching boards:", error);
    res.status(500).json({ error: "Failed to fetch boards" });
  }
});

// GET /api/boards/:id - get board with all data
router.get("/api/boards/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const board = await boardRepository.getBoardWithData(id);

    if (!board) {
      res.status(404).json({ error: "Board not found" });
      return;
    }

    res.json(board);
  } catch (error) {
    console.error("[Boards] Error fetching board:", error);
    res.status(500).json({ error: "Failed to fetch board" });
  }
});

// POST /api/boards - create board
router.post("/api/boards", async (req, res) => {
  try {
    const board = await boardRepository.createBoard(req.body);
    res.status(201).json(board);
  } catch (error) {
    console.error("[Boards] Error creating board:", error);
    res.status(500).json({ error: "Failed to create board" });
  }
});

// PUT /api/boards/:id - update board
router.put("/api/boards/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const board = await boardRepository.updateBoard(id, req.body);
    res.json(board);
  } catch (error) {
    console.error("[Boards] Error updating board:", error);
    res.status(500).json({ error: "Failed to update board" });
  }
});

// DELETE /api/boards/:id - delete board
router.delete("/api/boards/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await boardRepository.deleteBoard(id);
    res.status(204).send();
  } catch (error) {
    console.error("[Boards] Error deleting board:", error);
    res.status(500).json({ error: "Failed to delete board" });
  }
});

// ============ COLUMNS ============

// POST /api/boards/:boardId/columns - create column
router.post("/api/boards/:boardId/columns", async (req, res) => {
  try {
    const { boardId } = req.params;
    const column = await boardRepository.createColumn(boardId, req.body);
    res.status(201).json(column);
  } catch (error) {
    console.error("[Boards] Error creating column:", error);
    res.status(500).json({ error: "Failed to create column" });
  }
});

// PUT /api/boards/:boardId/columns/:columnId - update column
router.put("/api/boards/:boardId/columns/:columnId", async (req, res) => {
  try {
    const { columnId } = req.params;
    const column = await boardRepository.updateColumn(columnId, req.body);
    res.json(column);
  } catch (error) {
    console.error("[Boards] Error updating column:", error);
    res.status(500).json({ error: "Failed to update column" });
  }
});

// DELETE /api/boards/:boardId/columns/:columnId - delete column
router.delete("/api/boards/:boardId/columns/:columnId", async (req, res) => {
  try {
    const { columnId } = req.params;
    await boardRepository.deleteColumn(columnId);
    res.status(204).send();
  } catch (error) {
    console.error("[Boards] Error deleting column:", error);
    res.status(500).json({ error: "Failed to delete column" });
  }
});

// PATCH /api/boards/:boardId/columns/reorder - reorder columns
router.patch("/api/boards/:boardId/columns/reorder", async (req, res) => {
  try {
    const { boardId } = req.params;
    const { columns } = req.body; // Array of { id, order }
    await boardRepository.reorderColumns(boardId, columns);
    res.json({ success: true });
  } catch (error) {
    console.error("[Boards] Error reordering columns:", error);
    res.status(500).json({ error: "Failed to reorder columns" });
  }
});

// ============ CARDS ============

// POST /api/boards/:boardId/columns/:columnId/cards - create card
router.post("/api/boards/:boardId/columns/:columnId/cards", async (req, res) => {
  try {
    const { columnId } = req.params;
    const card = await boardRepository.createCard(columnId, req.body);
    res.status(201).json(card);
  } catch (error) {
    console.error("[Boards] Error creating card:", error);
    res.status(500).json({ error: "Failed to create card" });
  }
});

// GET /api/boards/cards/:cardId - get card details
router.get("/api/boards/cards/:cardId", async (req, res) => {
  try {
    const { cardId } = req.params;
    const card = await boardRepository.getCardById(cardId);

    if (!card) {
      res.status(404).json({ error: "Card not found" });
      return;
    }

    res.json(card);
  } catch (error) {
    console.error("[Boards] Error fetching card:", error);
    res.status(500).json({ error: "Failed to fetch card" });
  }
});

// PUT /api/boards/cards/:cardId - update card
router.put("/api/boards/cards/:cardId", async (req, res) => {
  try {
    const { cardId } = req.params;
    const card = await boardRepository.updateCard(cardId, req.body);
    res.json(card);
  } catch (error) {
    console.error("[Boards] Error updating card:", error);
    res.status(500).json({ error: "Failed to update card" });
  }
});

// DELETE /api/boards/cards/:cardId - delete card
router.delete("/api/boards/cards/:cardId", async (req, res) => {
  try {
    const { cardId } = req.params;
    await boardRepository.deleteCard(cardId);
    res.status(204).send();
  } catch (error) {
    console.error("[Boards] Error deleting card:", error);
    res.status(500).json({ error: "Failed to delete card" });
  }
});

// PATCH /api/boards/cards/:cardId/move - move card (drag & drop)
router.patch("/api/boards/cards/:cardId/move", async (req, res) => {
  try {
    const { cardId } = req.params;
    const { column_id, order } = req.body;
    const card = await boardRepository.moveCard(cardId, column_id, order);
    res.json(card);
  } catch (error) {
    console.error("[Boards] Error moving card:", error);
    res.status(500).json({ error: "Failed to move card" });
  }
});

// ============ LABELS ============

// POST /api/boards/:boardId/labels - create label
router.post("/api/boards/:boardId/labels", async (req, res) => {
  try {
    const { boardId } = req.params;
    const label = await boardRepository.createLabel(boardId, req.body);
    res.status(201).json(label);
  } catch (error) {
    console.error("[Boards] Error creating label:", error);
    res.status(500).json({ error: "Failed to create label" });
  }
});

// PUT /api/boards/labels/:labelId - update label
router.put("/api/boards/labels/:labelId", async (req, res) => {
  try {
    const { labelId } = req.params;
    const label = await boardRepository.updateLabel(labelId, req.body);
    res.json(label);
  } catch (error) {
    console.error("[Boards] Error updating label:", error);
    res.status(500).json({ error: "Failed to update label" });
  }
});

// DELETE /api/boards/labels/:labelId - delete label
router.delete("/api/boards/labels/:labelId", async (req, res) => {
  try {
    const { labelId } = req.params;
    await boardRepository.deleteLabel(labelId);
    res.status(204).send();
  } catch (error) {
    console.error("[Boards] Error deleting label:", error);
    res.status(500).json({ error: "Failed to delete label" });
  }
});

// POST /api/boards/cards/:cardId/labels/:labelId - add label to card
router.post("/api/boards/cards/:cardId/labels/:labelId", async (req, res) => {
  try {
    const { cardId, labelId } = req.params;
    await boardRepository.addLabelToCard(cardId, labelId);
    res.status(201).json({ success: true });
  } catch (error) {
    console.error("[Boards] Error adding label to card:", error);
    res.status(500).json({ error: "Failed to add label to card" });
  }
});

// DELETE /api/boards/cards/:cardId/labels/:labelId - remove label from card
router.delete("/api/boards/cards/:cardId/labels/:labelId", async (req, res) => {
  try {
    const { cardId, labelId } = req.params;
    await boardRepository.removeLabelFromCard(cardId, labelId);
    res.status(204).send();
  } catch (error) {
    console.error("[Boards] Error removing label from card:", error);
    res.status(500).json({ error: "Failed to remove label from card" });
  }
});

// ============ ATTACHMENTS ============

// POST /api/boards/cards/:cardId/attachments - upload attachment
router.post("/api/boards/cards/:cardId/attachments", upload.single('file'), async (req, res) => {
  try {
    const { cardId } = req.params;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }

    const attachment = await boardRepository.createAttachment(cardId, {
      file_name: Buffer.from(file.originalname, 'latin1').toString('utf8'),
      file_path: file.filename,
      file_size: file.size,
      mime_type: file.mimetype,
      uploaded_by: req.body.userId || null,
    });

    res.status(201).json(attachment);
  } catch (error) {
    console.error("[Boards] Error uploading attachment:", error);
    res.status(500).json({ error: "Failed to upload attachment" });
  }
});

// GET /api/boards/attachments/:attachmentId/download - download attachment
router.get("/api/boards/attachments/:attachmentId/download", async (req, res) => {
  try {
    const { attachmentId } = req.params;
    const attachment = await boardRepository.getAttachmentById(attachmentId);

    if (!attachment) {
      res.status(404).json({ error: "Attachment not found" });
      return;
    }

    const filePath = join(UPLOAD_DIR, attachment.file_path);
    res.download(filePath, attachment.file_name);
  } catch (error) {
    console.error("[Boards] Error downloading attachment:", error);
    res.status(500).json({ error: "Failed to download attachment" });
  }
});

// DELETE /api/boards/attachments/:attachmentId - delete attachment
router.delete("/api/boards/attachments/:attachmentId", async (req, res) => {
  try {
    const { attachmentId } = req.params;
    const attachment = await boardRepository.deleteAttachment(attachmentId);

    if (attachment) {
      const filePath = join(UPLOAD_DIR, attachment.file_path);
      try {
        await unlink(filePath);
      } catch (e) {
        console.warn("[Boards] Could not delete file:", e);
      }
    }

    res.status(204).send();
  } catch (error) {
    console.error("[Boards] Error deleting attachment:", error);
    res.status(500).json({ error: "Failed to delete attachment" });
  }
});

// ============ MEMBERS ============

// GET /api/boards/:boardId/members - get board members
router.get("/api/boards/:boardId/members", async (req, res) => {
  try {
    const { boardId } = req.params;
    const members = await boardRepository.getBoardMembers(boardId);
    res.json(members);
  } catch (error) {
    console.error("[Boards] Error fetching members:", error);
    res.status(500).json({ error: "Failed to fetch members" });
  }
});

// POST /api/boards/:boardId/members - add member
router.post("/api/boards/:boardId/members", async (req, res) => {
  try {
    const { boardId } = req.params;
    const { user_id, role } = req.body;
    await boardRepository.addMember(boardId, user_id, role || 'member');
    res.status(201).json({ success: true });
  } catch (error) {
    console.error("[Boards] Error adding member:", error);
    res.status(500).json({ error: "Failed to add member" });
  }
});

// DELETE /api/boards/:boardId/members/:userId - remove member
router.delete("/api/boards/:boardId/members/:userId", async (req, res) => {
  try {
    const { boardId, userId } = req.params;
    await boardRepository.removeMember(boardId, userId);
    res.status(204).send();
  } catch (error) {
    console.error("[Boards] Error removing member:", error);
    res.status(500).json({ error: "Failed to remove member" });
  }
});
