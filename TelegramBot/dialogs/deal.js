const { Markup } = require('telegraf');
const config = require('../config');

// Dialog steps
const STEPS = {
  MODE_SELECT: 'mode_select',
  CLIENT: 'client',
  CLIENT_CONFIRM: 'client_confirm',
  PRODUCT: 'product',
  PRODUCT_CONFIRM: 'product_confirm',
  QUANTITY: 'quantity',
  CONFIRM: 'confirm'
};

// Start deal dialog
async function start(ctx) {
  ctx.session.dialog = 'deal';
  ctx.session.step = STEPS.MODE_SELECT;
  ctx.session.data = {};

  await ctx.reply(
    '📦 *Новая сделка*\n\nКак удобнее?',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('💬 Расскажи текстом', 'deal:mode:text')],
        [Markup.button.callback('📝 По шагам', 'deal:mode:steps')],
        [Markup.button.callback('📋 Форма', 'deal:mode:form')],
        [Markup.button.callback(config.BUTTONS.CANCEL, 'deal:cancel')]
      ])
    }
  );
}

// Handle text input in deal dialog
async function handleText(ctx, text) {
  const step = ctx.session.step;
  const mode = ctx.session.mode;

  // TEXT MODE - parse everything at once
  if (mode === config.MODES.TEXT) {
    return handleFreeText(ctx, text);
  }

  // STEPS MODE - process step by step
  switch (step) {
    case STEPS.CLIENT:
      return handleClientInput(ctx, text);

    case STEPS.PRODUCT:
      return handleProductInput(ctx, text);

    case STEPS.QUANTITY:
      return handleQuantityInput(ctx, text);

    default:
      return ctx.reply('Выбери режим ввода или напиши /cancel');
  }
}

// Handle free text input - parse client, product, quantity from one message
async function handleFreeText(ctx, text) {
  // Simple parsing (in real app - use NLP/AI)
  const parsed = parseFreetText(text);

  ctx.session.data = { ...ctx.session.data, ...parsed };

  // Show what we understood
  let response = '🤔 Понял так:\n\n';

  if (parsed.clientName) {
    response += `👤 Клиент: *${parsed.clientName}*\n`;
  } else {
    response += `👤 Клиент: _не указан_\n`;
  }

  if (parsed.productName) {
    response += `📦 Товар: *${parsed.productName}*\n`;
  } else {
    response += `📦 Товар: _не указан_\n`;
  }

  if (parsed.quantity) {
    response += `🔢 Кол-во: *${parsed.quantity}*\n`;
  } else {
    response += `🔢 Кол-во: _не указано_\n`;
  }

  // Check if we have enough data
  const missing = [];
  if (!parsed.clientName) missing.push('клиент');
  if (!parsed.productName) missing.push('товар');

  if (missing.length > 0) {
    response += `\n❓ Уточни: ${missing.join(', ')}`;
    await ctx.reply(response, { parse_mode: 'Markdown' });
    return;
  }

  // All data collected - confirm
  response += '\n' + `💰 Сумма: _расчёт..._`;

  await ctx.reply(response, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback(config.BUTTONS.CORRECT, 'deal:confirm')],
      [Markup.button.callback(config.BUTTONS.EDIT, 'deal:edit')],
      [Markup.button.callback(config.BUTTONS.CLARIFY, 'deal:clarify')],
      [Markup.button.callback(config.BUTTONS.CANCEL, 'deal:cancel')]
    ])
  });

  ctx.session.step = STEPS.CONFIRM;
}

// Simple text parser (demo version)
function parseFreetText(text) {
  const result = {};
  const lower = text.toLowerCase();

  // Find client (look for names)
  const nameMatch = text.match(/([А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)?)/);
  if (nameMatch) {
    result.clientName = nameMatch[1];
  }

  // Find quantity
  const qtyMatch = text.match(/(\d+)\s*(?:шт|штук|единиц)?/i);
  if (qtyMatch) {
    result.quantity = parseInt(qtyMatch[1]);
  }

  // Find product (simplified - just look for keywords)
  const products = ['кресло', 'стол', 'стул', 'диван', 'шкаф', 'полка'];
  for (const prod of products) {
    if (lower.includes(prod)) {
      result.productName = prod.charAt(0).toUpperCase() + prod.slice(1);
      break;
    }
  }

  return result;
}

// Handle client input in step mode
async function handleClientInput(ctx, text) {
  // Search client in database (demo - just save name)
  ctx.session.data.clientSearch = text;

  // Demo: pretend we found clients
  const mockClients = [
    { id: 1, name: 'Иванов Пётр', company: 'ООО Ромашка' },
    { id: 2, name: 'Иванов Сергей', company: 'ИП Иванов' }
  ];

  const found = mockClients.filter(c =>
    c.name.toLowerCase().includes(text.toLowerCase())
  );

  if (found.length === 0) {
    await ctx.reply(
      `Не нашёл "${text}" в базе.\n\nЧто делаем?`,
      Markup.inlineKeyboard([
        [Markup.button.callback('➕ Создать нового', 'deal:client:new')],
        [Markup.button.callback('🔍 Искать по-другому', 'deal:client:retry')],
        [Markup.button.callback(config.BUTTONS.BACK, 'deal:back')]
      ])
    );
    return;
  }

  if (found.length === 1) {
    ctx.session.data.client = found[0];
    ctx.session.step = STEPS.PRODUCT;
    return askProduct(ctx);
  }

  // Multiple results - let user choose
  const buttons = found.map((c, i) =>
    [Markup.button.callback(`${i + 1}. ${c.name} (${c.company})`, `deal:client:select:${c.id}`)]
  );
  buttons.push([Markup.button.callback('➕ Новый клиент', 'deal:client:new')]);
  buttons.push([Markup.button.callback(config.BUTTONS.BACK, 'deal:back')]);

  await ctx.reply('Нашёл несколько:', Markup.inlineKeyboard(buttons));
}

// Ask for product
async function askProduct(ctx) {
  const client = ctx.session.data.client;

  await ctx.reply(
    `👤 Клиент: *${client.name}*\n\n` +
    `Что продаём?`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔍 Найти товар', 'deal:product:search')],
        [Markup.button.callback('📷 Отправить фото', 'deal:product:photo')],
        [Markup.button.callback('💬 Описать', 'deal:product:describe')],
        [Markup.button.callback(config.BUTTONS.BACK, 'deal:back')]
      ])
    }
  );
}

// Handle product input
async function handleProductInput(ctx, text) {
  // Demo: just save product name
  ctx.session.data.productName = text;
  ctx.session.step = STEPS.QUANTITY;

  await ctx.reply(
    `📦 Товар: *${text}*\n\n` +
    `Количество?`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('1', 'deal:qty:1'),
          Markup.button.callback('2', 'deal:qty:2'),
          Markup.button.callback('3', 'deal:qty:3'),
          Markup.button.callback('5', 'deal:qty:5'),
          Markup.button.callback('10', 'deal:qty:10')
        ],
        [Markup.button.callback(config.BUTTONS.BACK, 'deal:back')]
      ])
    }
  );
}

// Handle quantity input
async function handleQuantityInput(ctx, text) {
  const qty = parseInt(text);
  if (isNaN(qty) || qty <= 0) {
    return ctx.reply('Введи число больше 0');
  }

  ctx.session.data.quantity = qty;
  return showConfirmation(ctx);
}

// Show final confirmation
async function showConfirmation(ctx) {
  const data = ctx.session.data;
  ctx.session.step = STEPS.CONFIRM;

  const clientName = data.client?.name || data.clientName || 'Не указан';
  const productName = data.productName || 'Не указан';
  const quantity = data.quantity || 1;

  // Demo price calculation
  const price = 15000;
  const total = price * quantity;

  await ctx.reply(
    `📦 *Новая сделка*\n\n` +
    `👤 Клиент: ${clientName}\n` +
    `📦 Товар: ${productName}\n` +
    `🔢 Кол-во: ${quantity} шт.\n` +
    `💰 Сумма: ${total.toLocaleString()} ₽\n\n` +
    `Всё верно?`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('✅ Создать сделку', 'deal:create')],
        [Markup.button.callback(config.BUTTONS.EDIT, 'deal:edit')],
        [Markup.button.callback(config.BUTTONS.CANCEL, 'deal:cancel')]
      ])
    }
  );
}

// Handle callback queries
async function handleCallback(ctx, params) {
  const [action, ...rest] = params;

  switch (action) {
    case 'mode':
      return handleModeSelect(ctx, rest[0]);

    case 'cancel':
      ctx.session.dialog = null;
      ctx.session.step = null;
      ctx.session.data = {};
      await ctx.editMessageText('❌ Сделка отменена');
      return;

    case 'back':
      return handleBack(ctx);

    case 'client':
      return handleClientCallback(ctx, rest);

    case 'product':
      return handleProductCallback(ctx, rest);

    case 'qty':
      ctx.session.data.quantity = parseInt(rest[0]);
      return showConfirmation(ctx);

    case 'confirm':
      return showConfirmation(ctx);

    case 'create':
      return createDeal(ctx);

    case 'edit':
      ctx.session.step = STEPS.CLIENT;
      ctx.session.mode = config.MODES.STEPS;
      await ctx.editMessageText('Начнём сначала. Кто клиент?');
      return;
  }
}

// Handle mode selection
async function handleModeSelect(ctx, mode) {
  ctx.session.mode = mode;

  switch (mode) {
    case 'text':
      ctx.session.step = STEPS.CLIENT;
      await ctx.editMessageText(
        '💬 *Режим: свободный текст*\n\n' +
        'Расскажи про сделку своими словами.\n' +
        'Например: "Иванов хочет 3 кресла"',
        { parse_mode: 'Markdown' }
      );
      break;

    case 'steps':
      ctx.session.step = STEPS.CLIENT;
      await ctx.editMessageText(
        '📝 *Режим: по шагам*\n\n' +
        'Кто клиент?\n' +
        '_Напиши имя или телефон_',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔍 Найти в базе', 'deal:client:search')],
            [Markup.button.callback('➕ Новый клиент', 'deal:client:new')],
            [Markup.button.callback(config.BUTTONS.BACK, 'deal:back')]
          ])
        }
      );
      break;

    case 'form':
      await ctx.editMessageText(
        '📋 *Режим: форма*\n\n' +
        'Эта функция в разработке.\n' +
        'Пока выбери другой режим:',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('💬 Текстом', 'deal:mode:text')],
            [Markup.button.callback('📝 По шагам', 'deal:mode:steps')],
            [Markup.button.callback(config.BUTTONS.CANCEL, 'deal:cancel')]
          ])
        }
      );
      break;
  }
}

// Handle back navigation
async function handleBack(ctx) {
  const step = ctx.session.step;

  switch (step) {
    case STEPS.PRODUCT:
      ctx.session.step = STEPS.CLIENT;
      await ctx.editMessageText('Кто клиент?');
      break;

    case STEPS.QUANTITY:
      ctx.session.step = STEPS.PRODUCT;
      await askProduct(ctx);
      break;

    case STEPS.CONFIRM:
      ctx.session.step = STEPS.QUANTITY;
      await handleProductInput(ctx, ctx.session.data.productName);
      break;

    default:
      await start(ctx);
  }
}

// Handle client-related callbacks
async function handleClientCallback(ctx, params) {
  const [action, ...rest] = params;

  switch (action) {
    case 'search':
      await ctx.editMessageText('Введи имя, телефон или email клиента:');
      break;

    case 'new':
      await ctx.editMessageText('Введи имя нового клиента:');
      ctx.session.data.newClient = true;
      break;

    case 'select':
      const clientId = parseInt(rest[0]);
      // Demo: create mock client
      ctx.session.data.client = {
        id: clientId,
        name: clientId === 1 ? 'Иванов Пётр' : 'Иванов Сергей',
        company: clientId === 1 ? 'ООО Ромашка' : 'ИП Иванов'
      };
      ctx.session.step = STEPS.PRODUCT;
      await askProduct(ctx);
      break;

    case 'retry':
      await ctx.editMessageText('Введи имя клиента по-другому:');
      break;
  }
}

// Handle product-related callbacks
async function handleProductCallback(ctx, params) {
  const [action] = params;

  switch (action) {
    case 'search':
      ctx.session.step = STEPS.PRODUCT;
      await ctx.editMessageText('Введи название товара:');
      break;

    case 'photo':
      await ctx.editMessageText('📷 Отправь фото товара');
      break;

    case 'describe':
      ctx.session.step = STEPS.PRODUCT;
      await ctx.editMessageText('Опиши товар своими словами:');
      break;
  }
}

// Create deal in system
async function createDeal(ctx) {
  const data = ctx.session.data;

  // Demo: just show success
  await ctx.editMessageText(
    '✅ *Сделка создана!*\n\n' +
    `📋 Номер: #${Math.floor(Math.random() * 10000)}\n` +
    `👤 ${data.client?.name || data.clientName}\n` +
    `📦 ${data.productName} × ${data.quantity || 1}\n\n` +
    '_Сделка добавлена в систему_',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📄 Выписать счёт', 'invoice:create')],
        [Markup.button.callback('📦 Ещё одна сделка', 'deal:new')],
        [Markup.button.callback('🏠 В меню', 'menu:main')]
      ])
    }
  );

  // Clear session
  ctx.session.dialog = null;
  ctx.session.step = null;
  ctx.session.data = {};
}

// Handle photo messages
async function handlePhoto(ctx) {
  if (ctx.session.step === STEPS.PRODUCT) {
    // Demo: pretend we recognized the product
    ctx.session.data.productName = 'Кресло офисное Model X';
    ctx.session.step = STEPS.QUANTITY;

    await ctx.reply(
      '📷 Распознал товар:\n\n' +
      `📦 *Кресло офисное Model X*\n` +
      `💰 Цена: 15 000 ₽\n` +
      `📊 На складе: 12 шт\n\n` +
      'Это тот товар?',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('✅ Да, этот', 'deal:product:confirmed')],
          [Markup.button.callback('❌ Нет, другой', 'deal:product:search')],
          [Markup.button.callback(config.BUTTONS.BACK, 'deal:back')]
        ])
      }
    );
    return;
  }

  await ctx.reply('Фото получено, но сейчас не ожидаю фото товара.');
}

// Go back to previous step
function back(ctx) {
  return handleBack(ctx);
}

// Called when mode is selected
function onModeSelected(ctx, mode) {
  return handleModeSelect(ctx, mode);
}

module.exports = {
  start,
  handleText,
  handleCallback,
  handlePhoto,
  back,
  onModeSelected
};
