// API роуты для ассистента
import { Router } from "express";
import { assistantService } from "./service";

const router = Router();

// Главный эндпоинт чата
router.post("/api/assistant/chat", async (req, res) => {
  try {
    const { userId, message, action, actionData } = req.body;

    if (!userId) {
      res.status(400).json({ error: "userId is required" });
      return;
    }

    if (!message && !action) {
      res.status(400).json({ error: "message or action is required" });
      return;
    }

    // Определяем text для передачи в processMessage
    let textToSend = message || '';

    // Если есть actionData, конвертируем его в текст
    if (action && actionData) {
      if (typeof actionData === 'object') {
        // Для stage_select и подобных - передаём JSON
        textToSend = JSON.stringify(actionData);
      } else {
        textToSend = String(actionData);
      }
    }

    const result = await assistantService.processMessage(
      userId,
      textToSend,
      action
    );

    res.json(result);
  } catch (error: any) {
    console.error("[Assistant] Chat error:", error);
    res.status(500).json({
      error: error.message || "Assistant error",
      message: "Что-то пошло не так. Попробуй ещё раз.",
      buttons: [
        { text: "🏠 В начало", action: "home" }
      ],
      state: "idle",
      usedAI: false
    });
  }
});

// Проверка здоровья
router.get("/api/assistant/health", (req, res) => {
  res.json({
    status: "ok",
    model: "google/gemini-2.5-flash-lite",
    hasApiKey: !!process.env.OPENROUTER_API_KEY
  });
});

export default router;
