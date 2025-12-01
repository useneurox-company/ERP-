require('dotenv').config();

module.exports = {
  // Telegram Bot Token (from @BotFather)
  BOT_TOKEN: process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE',

  // ERP API endpoint
  ERP_API_URL: process.env.ERP_API_URL || 'http://localhost:7000/api',

  // Allowed users (Telegram user IDs) - empty = all allowed
  ALLOWED_USERS: process.env.ALLOWED_USERS ? process.env.ALLOWED_USERS.split(',').map(Number) : [],

  // Session timeout (ms)
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes

  // Input modes
  MODES: {
    TEXT: 'text',      // Free text input
    STEPS: 'steps',    // Step by step
    FORM: 'form'       // Mini form (WebApp)
  },

  // Standard buttons text
  BUTTONS: {
    BACK: '⬅️ Назад',
    CANCEL: '❌ Отмена',
    HELP: '💬 Помощь',
    YES: '✅ Да',
    NO: '❌ Нет',
    CORRECT: '✅ Всё верно',
    EDIT: '✏️ Исправить',
    CLARIFY: '💬 Уточнить'
  },

  // Mode selection buttons
  MODE_BUTTONS: {
    TEXT: '💬 Расскажи текстом',
    STEPS: '📝 По шагам',
    FORM: '📋 Форма'
  }
};
