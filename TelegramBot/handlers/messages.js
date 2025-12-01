const { Markup } = require('telegraf');
const config = require('../config');

// Handle mode selection
async function handleModeSelection(ctx, mode) {
  ctx.session.mode = mode;

  switch (mode) {
    case config.MODES.TEXT:
      await ctx.reply('Хорошо! Расскажи своими словами что нужно сделать 💬');
      break;
    case config.MODES.STEPS:
      await ctx.reply('Отлично! Пойдём по шагам. Отвечай на вопросы 📝');
      break;
    case config.MODES.FORM:
      await ctx.reply('Открываю форму... 📋');
      // TODO: WebApp integration
      break;
  }
}

// Handle free text input (when no active dialog)
async function handleTextInput(ctx, text) {
  const lowerText = text.toLowerCase();

  // Try to understand intent
  if (lowerText.includes('сделк') || lowerText.includes('продаж') || lowerText.includes('заказ')) {
    const dealDialog = require('../dialogs/deal');
    return dealDialog.start(ctx);
  }

  if (lowerText.includes('склад') || lowerText.includes('остат') || lowerText.includes('товар')) {
    return ctx.reply('🏭 Модуль склада в разработке.\n\nПока доступны только сделки: /deal');
  }

  if (lowerText.includes('отчёт') || lowerText.includes('отчет') || lowerText.includes('статистик')) {
    return ctx.reply('📊 Модуль отчётов в разработке.\n\nПока доступны только сделки: /deal');
  }

  // Default response
  await ctx.reply(
    'Не совсем понял 🤔\n\n' +
    'Попробуй:\n' +
    '• "Новая сделка"\n' +
    '• "Покажи остатки"\n' +
    '• "Отчёт за месяц"\n\n' +
    'Или выбери из меню ниже:',
    Markup.keyboard([
      ['📦 Новая сделка', '📋 Мои сделки'],
      ['🏭 Склад', '📊 Отчёты'],
      ['💬 Помощь']
    ]).resize()
  );
}

// Handle callback queries
async function handleCallback(ctx, action, params) {
  switch (action) {
    case 'confirm':
      await ctx.editMessageText('✅ Подтверждено!');
      break;

    case 'cancel':
      ctx.session.dialog = null;
      ctx.session.step = null;
      ctx.session.data = {};
      await ctx.editMessageText('❌ Отменено');
      break;

    case 'back':
      // Handle back action
      if (ctx.session.dialog) {
        // Dialog-specific back handling
      }
      break;

    default:
      await ctx.answerCbQuery('Неизвестное действие');
  }
}

module.exports = {
  handleModeSelection,
  handleTextInput,
  handleCallback
};
