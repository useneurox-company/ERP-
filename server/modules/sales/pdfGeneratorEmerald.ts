import type { DealDocument } from "@shared/schema";

/**
 * Функция для конвертации числа в строку прописью (рубли)
 */
function numberToWords(num: number): string {
  const units = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
  const teens = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
  const tens = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
  const hundreds = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];
  const thousands = ['тысяча', 'тысячи', 'тысяч'];

  if (num === 0) return 'ноль рублей 00 копеек';

  const integer = Math.floor(num);
  const fractional = Math.round((num - integer) * 100);

  let result = '';

  // Тысячи
  const thou = Math.floor(integer / 1000);
  if (thou > 0) {
    const h = Math.floor(thou / 100);
    const t = Math.floor((thou % 100) / 10);
    const u = thou % 10;

    if (h > 0) result += hundreds[h] + ' ';
    if (t === 1) {
      result += teens[u] + ' ';
    } else {
      if (t > 0) result += tens[t] + ' ';
      if (u > 0) {
        if (u === 1) result += 'одна ';
        else if (u === 2) result += 'две ';
        else result += units[u] + ' ';
      }
    }

    if (thou % 10 === 1 && thou % 100 !== 11) {
      result += thousands[0] + ' ';
    } else if ([2, 3, 4].includes(thou % 10) && ![12, 13, 14].includes(thou % 100)) {
      result += thousands[1] + ' ';
    } else {
      result += thousands[2] + ' ';
    }
  }

  // Сотни, десятки, единицы
  const remaining = integer % 1000;
  const h = Math.floor(remaining / 100);
  const t = Math.floor((remaining % 100) / 10);
  const u = remaining % 10;

  if (h > 0) result += hundreds[h] + ' ';
  if (t === 1) {
    result += teens[u] + ' ';
  } else {
    if (t > 0) result += tens[t] + ' ';
    if (u > 0) result += units[u] + ' ';
  }

  // Рубли
  if (integer % 10 === 1 && integer % 100 !== 11) {
    result += 'рубль';
  } else if ([2, 3, 4].includes(integer % 10) && ![12, 13, 14].includes(integer % 100)) {
    result += 'рубля';
  } else {
    result += 'рублей';
  }

  result += ` ${fractional.toString().padStart(2, '0')} копеек`;

  // Первая буква заглавная
  return result.charAt(0).toUpperCase() + result.slice(1);
}

/**
 * Генератор КП в стиле Google Таблицы (БЕЗ AI-генераций)
 */
export async function generateEmeraldPDF(document: DealDocument, dealId: string): Promise<string> {
  const data = typeof document.data === 'string' ? JSON.parse(document.data) : document.data;
  const positions = data?.positions || [];

  // Разделяем позиции на товары и услуги
  const products = positions.filter((pos: any) => !pos.isService);
  const services = positions.filter((pos: any) => pos.isService);

  const productsTotal = products.reduce((sum: number, pos: any) => {
    return sum + (pos.price * pos.quantity);
  }, 0);

  const servicesTotal = services.reduce((sum: number, pos: any) => {
    return sum + (pos.price * pos.quantity);
  }, 0);

  const totalAmount = productsTotal + servicesTotal;

  // Парсим график платежей
  const paymentSchedule = document.payment_schedule
    ? JSON.parse(document.payment_schedule)
    : { advance: 70, second: 20, final: 10 };

  const advanceAmount = totalAmount * (paymentSchedule.advance / 100);
  const secondAmount = totalAmount * (paymentSchedule.second / 100);
  const finalAmount = totalAmount * (paymentSchedule.final / 100);

  // Форматирование даты
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU');
  };

  const currentDate = formatDate(document.created_at || new Date().toISOString());

  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>КП ${document.document_number}</title>
  <style>
    @page {
      margin: 15mm 10mm;
      size: A4 landscape;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: Arial, sans-serif;
      font-size: 9pt;
      line-height: 1.3;
      color: #000;
      background: #fff;
    }

    .header {
      text-align: center;
      margin-bottom: 10px;
      padding-bottom: 5px;
      border-bottom: 2px solid #50C878;
    }

    .header h1 {
      font-size: 14pt;
      font-weight: bold;
      color: #50C878;
      margin-bottom: 5px;
    }

    .header-info {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      font-size: 9pt;
    }

    .header-info div {
      flex: 1;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
      font-size: 8pt;
    }

    table.main-table th,
    table.main-table td {
      border: 1px solid #ccc;
      padding: 4px;
      text-align: left;
      vertical-align: top;
    }

    table.main-table th {
      background-color: #50C878;
      color: white;
      font-weight: bold;
      text-align: center;
    }

    table.main-table td.number {
      text-align: center;
      width: 30px;
    }

    table.main-table td.dimensions {
      text-align: center;
      width: 50px;
    }

    table.main-table td.price {
      text-align: right;
      width: 80px;
    }

    .description {
      font-size: 7.5pt;
      color: #555;
      white-space: pre-wrap;
    }

    .summary {
      margin-top: 15px;
      margin-bottom: 15px;
    }

    .summary-row {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 5px;
      font-size: 10pt;
    }

    .summary-row strong {
      margin-left: 10px;
      min-width: 120px;
      text-align: right;
    }

    .summary-row.total {
      font-size: 12pt;
      font-weight: bold;
      color: #50C878;
      border-top: 2px solid #50C878;
      padding-top: 5px;
    }

    .terms {
      font-size: 8pt;
      margin-bottom: 15px;
      padding: 10px;
      background-color: #f9f9f9;
      border-left: 3px solid #50C878;
    }

    .payment-schedule {
      margin-top: 15px;
      margin-bottom: 20px;
    }

    .payment-schedule h3 {
      font-size: 11pt;
      margin-bottom: 8px;
      color: #50C878;
    }

    table.payment-table th,
    table.payment-table td {
      border: 1px solid #ccc;
      padding: 6px;
      text-align: left;
    }

    table.payment-table th {
      background-color: #50C878;
      color: white;
      font-weight: bold;
    }

    table.payment-table td.amount {
      text-align: right;
      font-weight: bold;
    }

    .signatures {
      margin-top: 30px;
      display: flex;
      justify-content: space-between;
    }

    .signature-block {
      width: 45%;
    }

    .signature-line {
      border-bottom: 1px solid #000;
      margin-top: 40px;
      padding-bottom: 5px;
    }

    .footer {
      margin-top: 20px;
      text-align: center;
      font-size: 9pt;
      color: #50C878;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>EMERALD</h1>
    <div>Приложение №1 к договору № ${document.document_number || 'ЭМ-XXX'}</div>
  </div>

  <div class="header-info">
    <div><strong>Объект:</strong> ${data.project_name || ''}</div>
    <div><strong>Заказчик:</strong> ${data.client_name || ''}</div>
    <div><strong>Адрес:</strong> ${data.address || ''}</div>
    <div><strong>Дата:</strong> ${currentDate}</div>
  </div>

  <table class="main-table">
    <thead>
      <tr>
        <th style="width: 30px;">№</th>
        <th style="width: 60px;">Изделие</th>
        <th style="width: 120px;">Наименование</th>
        <th>Описание</th>
        <th style="width: 45px;">Высота, мм</th>
        <th style="width: 45px;">Ширина, мм</th>
        <th style="width: 45px;">Глубина, мм</th>
        <th style="width: 40px;">Кол-во</th>
        <th style="width: 90px;">Стоимость</th>
      </tr>
    </thead>
    <tbody>
`;

  // Товары
  products.forEach((pos: any, index: number) => {
    const itemTotal = pos.price * pos.quantity;
    const itemNumber = `${document.document_number?.split('-')[0] || ''}\\${index + 1}`;

    html += `
      <tr>
        <td class="number">${index + 1}</td>
        <td class="number">${itemNumber}</td>
        <td>${pos.name || ''}</td>
        <td class="description">${pos.description || ''}</td>
        <td class="dimensions">${pos.height || '-'}</td>
        <td class="dimensions">${pos.width || '-'}</td>
        <td class="dimensions">${pos.depth || '-'}</td>
        <td class="number">${pos.quantity || 1}шт</td>
        <td class="price">${itemTotal.toLocaleString('ru-RU')} руб.</td>
      </tr>
    `;
  });

  // Услуги (монтаж, доставка)
  if (services.length > 0) {
    services.forEach((service: any) => {
      const serviceTotal = service.price * service.quantity;
      html += `
      <tr>
        <td colspan="8" style="text-align: left; font-weight: bold;">${service.name}</td>
        <td class="price">${serviceTotal.toLocaleString('ru-RU')} руб.</td>
      </tr>
      `;
    });
  }

  html += `
    </tbody>
  </table>

  <div class="terms">
    <p><strong>Фурнитура</strong> Австрийской марки BLUM</p>
    <p><strong>Лакокрасочные покрытия</strong> произв. Италия.</p>
    <p><strong>МДФ</strong> австрийской марки EGGER.</p>
    <p>Стоимость указана при оплате наличными и действует в течении 14 дней.</p>
    <p>В стоимость изделий не входит лицевая фурнитура (ручки), техника, каменная столешница.</p>
    <p><strong>Стоимость может меняться в случаях:</strong></p>
    <ul style="margin-left: 20px;">
      <li>внесения дополнительных изменений в спецификацию, конструкторскую рабочую документацию.</li>
      <li>смены материала и отделки на более дорогой/дешевый</li>
    </ul>
  </div>

  <div class="summary">
    ${services.filter((s: any) => s.name.toLowerCase().includes('доставк')).length > 0 ? `
    <div class="summary-row">
      <span>СТОИМОСТЬ ДОСТАВКИ:</span>
      <strong>${services.filter((s: any) => s.name.toLowerCase().includes('доставк')).reduce((sum: number, s: any) => sum + s.price * s.quantity, 0).toLocaleString('ru-RU')} руб.</strong>
    </div>
    ` : ''}
    <div class="summary-row">
      <span>СТОИМОСТЬ МЕБЕЛИ:</span>
      <strong>${productsTotal.toLocaleString('ru-RU')} руб.</strong>
    </div>
    <div class="summary-row total">
      <span>ОБЩАЯ СТОИМОСТЬ:</span>
      <strong>${totalAmount.toLocaleString('ru-RU')} руб.</strong>
    </div>
  </div>

  <div class="payment-schedule">
    <h3>Условия оплаты</h3>
    <table class="payment-table">
      <thead>
        <tr>
          <th style="width: 200px;">Наименование</th>
          <th style="width: 250px;">Момент оплаты</th>
          <th style="width: 60px;">%</th>
          <th style="width: 120px;">Сумма</th>
          <th>Сумма прописью</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Оплата за мебель<br/>(часть 1)</td>
          <td>Аванс для подготовки технической документации и начала производства</td>
          <td style="text-align: center;">${paymentSchedule.advance}%</td>
          <td class="amount">${advanceAmount.toLocaleString('ru-RU')} руб</td>
          <td>${numberToWords(advanceAmount)}</td>
        </tr>
        <tr>
          <td>Оплата за мебель<br/>(часть 2)</td>
          <td>Доплата перед доставкой мебели к заказчику</td>
          <td style="text-align: center;">${paymentSchedule.second}%</td>
          <td class="amount">${secondAmount.toLocaleString('ru-RU')} руб</td>
          <td>${numberToWords(secondAmount)}</td>
        </tr>
        <tr>
          <td>Оплата за мебель<br/>(часть 3)</td>
          <td>Доплата по завершению монтажа</td>
          <td style="text-align: center;">${paymentSchedule.final}%</td>
          <td class="amount">${finalAmount.toLocaleString('ru-RU')} руб</td>
          <td>${numberToWords(finalAmount)}</td>
        </tr>
        <tr style="font-weight: bold; background-color: #f0f0f0;">
          <td colspan="3">ОБЩАЯ СТОИМОСТЬ:</td>
          <td class="amount">${totalAmount.toLocaleString('ru-RU')} руб.</td>
          <td>${numberToWords(totalAmount)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="signatures">
    <div class="signature-block">
      <div><strong>Продавец:</strong></div>
      <div>ИП.Береговой М.И</div>
      <div class="signature-line">________________ (подпись)</div>
    </div>
    <div class="signature-block">
      <div><strong>Покупатель:</strong></div>
      <div>${data.client_name || '___________________________'}</div>
      <div class="signature-line">________________ (подпись)</div>
    </div>
  </div>

  <div class="footer">
    instagram: emerald__msk
  </div>
</body>
</html>
`;

  return html;
}
