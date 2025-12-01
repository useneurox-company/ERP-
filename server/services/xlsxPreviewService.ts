import XLSX from "xlsx";
import { createCanvas } from "@napi-rs/canvas";
import fs from "fs";
import path from "path";

const PREVIEWS_DIR = path.join(process.cwd(), ".local", "previews");
const PREVIEW_WIDTH = 800;
const PREVIEW_HEIGHT = 600;
const CELL_WIDTH = 100;
const CELL_HEIGHT = 30;
const FONT_SIZE = 12;
const HEADER_BG = "#f3f4f6";
const BORDER_COLOR = "#e5e7eb";

// Убедимся что директория для превью существует
if (!fs.existsSync(PREVIEWS_DIR)) {
  fs.mkdirSync(PREVIEWS_DIR, { recursive: true });
}

/**
 * Генерация превью для XLSX файла
 * Рендерит первые N строк и столбцов первого листа
 */
export async function generateXlsxPreview(
  xlsxPath: string,
  attachmentId: string
): Promise<string | null> {
  const previewPath = path.join(PREVIEWS_DIR, `${attachmentId}.jpg`);

  // Проверяем кэш
  if (fs.existsSync(previewPath)) {
    console.log(`[XLSX Preview] Using cached preview: ${attachmentId}`);
    return previewPath;
  }

  try {
    console.log(`[XLSX Preview] Generating preview for: ${xlsxPath}`);

    // Читаем XLSX файл
    const workbook = XLSX.readFile(xlsxPath);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // Конвертируем в массив массивов
    const data: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (!data || data.length === 0) {
      console.log(`[XLSX Preview] Empty spreadsheet: ${xlsxPath}`);
      return null;
    }

    // Ограничиваем количество строк и столбцов для превью
    const maxRows = Math.min(data.length, 15);
    const maxCols = Math.min(
      Math.max(...data.map((row) => row.length)),
      8
    );

    // Создаем canvas
    const canvas = createCanvas(PREVIEW_WIDTH, PREVIEW_HEIGHT);
    const ctx = canvas.getContext("2d");

    // Белый фон
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);

    // Настройки шрифта
    ctx.font = `${FONT_SIZE}px Arial`;
    ctx.textBaseline = "middle";

    // Рисуем заголовок с именем листа
    ctx.fillStyle = "#1f2937";
    ctx.font = `bold ${FONT_SIZE + 2}px Arial`;
    ctx.fillText(firstSheetName, 10, 15);
    ctx.font = `${FONT_SIZE}px Arial`;

    // Отступ после заголовка
    const startY = 40;

    // Рисуем таблицу
    for (let row = 0; row < maxRows; row++) {
      const rowData = data[row] || [];
      const y = startY + row * CELL_HEIGHT;

      for (let col = 0; col < maxCols; col++) {
        const x = col * CELL_WIDTH;
        const cellValue = rowData[col] !== undefined ? String(rowData[col]) : "";

        // Фон ячейки (первая строка - заголовок)
        if (row === 0) {
          ctx.fillStyle = HEADER_BG;
        } else {
          ctx.fillStyle = "#ffffff";
        }
        ctx.fillRect(x, y, CELL_WIDTH, CELL_HEIGHT);

        // Границы ячейки
        ctx.strokeStyle = BORDER_COLOR;
        ctx.strokeRect(x, y, CELL_WIDTH, CELL_HEIGHT);

        // Текст ячейки
        ctx.fillStyle = "#374151";
        if (row === 0) {
          ctx.font = `bold ${FONT_SIZE}px Arial`;
        } else {
          ctx.font = `${FONT_SIZE}px Arial`;
        }

        // Обрезаем текст если не помещается
        let displayText = cellValue;
        const maxTextWidth = CELL_WIDTH - 10;
        let textWidth = ctx.measureText(displayText).width;

        if (textWidth > maxTextWidth) {
          while (textWidth > maxTextWidth && displayText.length > 0) {
            displayText = displayText.slice(0, -1);
            textWidth = ctx.measureText(displayText + "...").width;
          }
          displayText += "...";
        }

        ctx.fillText(displayText, x + 5, y + CELL_HEIGHT / 2);
      }
    }

    // Если строк больше чем показано - добавляем индикатор
    if (data.length > maxRows) {
      ctx.fillStyle = "#9ca3af";
      ctx.font = `italic ${FONT_SIZE}px Arial`;
      ctx.fillText(
        `... еще ${data.length - maxRows} строк`,
        10,
        startY + maxRows * CELL_HEIGHT + 20
      );
    }

    // Сохраняем как JPEG
    const buffer = canvas.toBuffer("image/jpeg", 85);
    fs.writeFileSync(previewPath, buffer);

    console.log(`[XLSX Preview] Preview generated: ${previewPath}`);
    return previewPath;
  } catch (error) {
    console.error(`[XLSX Preview] Failed to generate preview:`, error);
    return null;
  }
}

/**
 * Получить путь к кэшированному превью
 */
export function getCachedXlsxPreviewPath(attachmentId: string): string | null {
  const previewPath = path.join(PREVIEWS_DIR, `${attachmentId}.jpg`);
  return fs.existsSync(previewPath) ? previewPath : null;
}

/**
 * Удалить кэшированное превью
 */
export function deleteCachedXlsxPreview(attachmentId: string): boolean {
  const previewPath = path.join(PREVIEWS_DIR, `${attachmentId}.jpg`);
  if (fs.existsSync(previewPath)) {
    fs.unlinkSync(previewPath);
    console.log(`[XLSX Preview] Deleted cached preview: ${attachmentId}`);
    return true;
  }
  return false;
}
