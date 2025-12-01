const { Telegraf, Markup, session } = require('telegraf');
const config = require('./config');

// Import handlers
const { handleStart, handleHelp } = require('./handlers/commands');
const { handleModeSelection, handleTextInput, handleCallback } = require('./handlers/messages');

// Import dialogs
const dealDialog = require('./dialogs/deal');

// Create bot instance
const bot = new Telegraf(config.BOT_TOKEN);

// Session middleware - stores user state
bot.use(session());

// Initialize session
bot.use((ctx, next) => {
  ctx.session = ctx.session || {
    mode: null,           // Current input mode (text/steps/form)
    dialog: null,         // Current dialog (deal/warehouse/etc)
    step: null,           // Current step in dialog
    data: {},             // Collected data
    lastActivity: Date.now()
  };
  ctx.session.lastActivity = Date.now();
  return next();
});

// Access control (if configured)
bot.use((ctx, next) => {
  if (config.ALLOWED_USERS.length > 0) {
    const userId = ctx.from?.id;
    if (!config.ALLOWED_USERS.includes(userId)) {
      return ctx.reply('⛔ Доступ запрещён. Обратитесь к администратору.');
    }
  }
  return next();
});

// ============ COMMANDS ============

// /start - Welcome message
bot.command('start', handleStart);

// /help - Help
bot.command('help', handleHelp);

// /deal - Create new deal
bot.command('deal', async (ctx) => {
  await dealDialog.start(ctx);
});

// /cancel - Cancel current dialog
bot.command('cancel', async (ctx) => {
  ctx.session.dialog = null;
  ctx.session.step = null;
  ctx.session.mode = null;
  ctx.session.data = {};
  await ctx.reply('❌ Действие отменено.\n\nЧем могу помочь?', Markup.keyboard([
    ['📦 Новая сделка', '📋 Мои сделки'],
    ['🏭 Склад', '📊 Отчёты'],
    ['💬 Помощь']
  ]).resize());
});

// ============ TEXT MESSAGES ============

bot.on('text', async (ctx) => {
  const text = ctx.message.text;

  // Quick commands from keyboard
  if (text === '📦 Новая сделка' || text.toLowerCase().includes('новая сделка')) {
    return dealDialog.start(ctx);
  }
  if (text === '💬 Помощь' || text === config.BUTTONS.HELP) {
    return handleHelp(ctx);
  }
  if (text === config.BUTTONS.CANCEL || text.toLowerCase() === 'отмена') {
    ctx.session.dialog = null;
    ctx.session.step = null;
    ctx.session.data = {};
    return ctx.reply('❌ Отменено. Чем могу помочь?');
  }
  if (text === config.BUTTONS.BACK || text.toLowerCase() === 'назад') {
    // Go back in dialog
    if (ctx.session.dialog) {
      const dialog = getDialog(ctx.session.dialog);
      if (dialog && dialog.back) {
        return dialog.back(ctx);
      }
    }
    return ctx.reply('Некуда возвращаться.');
  }

  // Mode switching
  if (text === 'хочу текстом' || text.toLowerCase().includes('текстом')) {
    ctx.session.mode = config.MODES.TEXT;
    return ctx.reply('Хорошо, расскажи своими словами 💬');
  }
  if (text === 'давай по шагам' || text.toLowerCase().includes('по шагам')) {
    ctx.session.mode = config.MODES.STEPS;
    return ctx.reply('Хорошо, пойдём по шагам 📝');
  }

  // If in active dialog - pass to dialog handler
  if (ctx.session.dialog) {
    const dialog = getDialog(ctx.session.dialog);
    if (dialog && dialog.handleText) {
      return dialog.handleText(ctx, text);
    }
  }

  // Default - try to understand intent
  await handleTextInput(ctx, text);
});

// ============ CALLBACK QUERIES (inline buttons) ============

bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery.data;

  // Answer callback to remove loading state
  await ctx.answerCbQuery();

  // Parse callback data
  const [action, ...params] = data.split(':');

  // Mode selection
  if (action === 'mode') {
    ctx.session.mode = params[0];
    if (ctx.session.dialog) {
      const dialog = getDialog(ctx.session.dialog);
      if (dialog && dialog.onModeSelected) {
        return dialog.onModeSelected(ctx, params[0]);
      }
    }
    return;
  }

  // Dialog-specific callbacks
  if (action === 'deal') {
    return dealDialog.handleCallback(ctx, params);
  }

  // Generic callbacks
  await handleCallback(ctx, action, params);
});

// ============ PHOTOS ============

bot.on('photo', async (ctx) => {
  if (ctx.session.dialog) {
    const dialog = getDialog(ctx.session.dialog);
    if (dialog && dialog.handlePhoto) {
      return dialog.handlePhoto(ctx);
    }
  }
  await ctx.reply('📷 Фото получено! Но я пока не знаю что с ним делать.\nНачни диалог командой /deal');
});

// ============ HELPERS ============

function getDialog(name) {
  const dialogs = {
    'deal': dealDialog,
    // 'warehouse': warehouseDialog,
    // 'project': projectDialog,
  };
  return dialogs[name];
}

// ============ ERROR HANDLING ============

bot.catch((err, ctx) => {
  console.error('Bot error:', err);
  ctx.reply('😔 Произошла ошибка. Попробуй ещё раз или напиши /cancel');
});

// ============ START BOT ============

bot.launch().then(() => {
  console.log('🤖 ERP Telegram Bot started!');
  console.log('Bot username: @' + bot.botInfo?.username);
});

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
