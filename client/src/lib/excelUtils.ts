import * as XLSX from 'xlsx';
import { nanoid } from 'nanoid';
import type { HardwareSpecItem, CuttingSpecItem } from '@/types/constructorDocumentation';

/**
 * Export hardware specification to Excel file
 */
export function exportHardwareSpecToExcel(items: HardwareSpecItem[], fileName: string = 'Спецификация_Фурнитура.xlsx') {
  // Prepare data for Excel
  const data = items.map((item, index) => ({
    '№': index + 1,
    'Название': item.name,
    'Артикул': item.article,
    'Количество': item.quantity,
    'Ед. измерения': item.unit,
    'На складе': item.warehouseAvailable || '-',
    'Нужно закупить': item.needsToProcure ? 'Да' : 'Нет',
    'Аналог': item.alternativeUsed ? 'Да' : 'Нет',
    'Примечания': item.notes || '',
    'Добавлено': new Date(item.addedAt).toLocaleString('ru-RU'),
    'Кем добавлено': item.addedByName
  }));

  // Create workbook and worksheet
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Фурнитура');

  // Set column widths
  ws['!cols'] = [
    { wch: 5 },   // №
    { wch: 30 },  // Название
    { wch: 15 },  // Артикул
    { wch: 12 },  // Количество
    { wch: 15 },  // Ед. измерения
    { wch: 12 },  // На складе
    { wch: 15 },  // Нужно закупить
    { wch: 10 },  // Аналог
    { wch: 30 },  // Примечания
    { wch: 20 },  // Добавлено
    { wch: 20 }   // Кем добавлено
  ];

  // Generate and download file
  XLSX.writeFile(wb, fileName);
}

/**
 * Import hardware specification from Excel file
 */
export async function importHardwareSpecFromExcel(
  file: File,
  userId: string,
  userName: string
): Promise<HardwareSpecItem[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const items: HardwareSpecItem[] = jsonData.map((row: any) => {
          // Support both Russian and English column names
          const name = row['Название'] || row['Name'] || row['name'] || '';
          const article = row['Артикул'] || row['Article'] || row['article'] || '';
          const quantity = parseInt(row['Количество'] || row['Quantity'] || row['quantity'] || '1');
          const unit = row['Ед. измерения'] || row['Unit'] || row['unit'] || 'шт';
          const notes = row['Примечания'] || row['Notes'] || row['notes'] || '';

          if (!name || !article) {
            throw new Error('Необходимо заполнить название и артикул для каждой позиции');
          }

          return {
            id: nanoid(),
            name: String(name).trim(),
            article: String(article).trim(),
            quantity: isNaN(quantity) ? 1 : quantity,
            unit: String(unit).trim(),
            notes: notes ? String(notes).trim() : undefined,
            addedAt: new Date().toISOString(),
            addedBy: userId,
            addedByName: userName
          };
        });

        resolve(items);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Ошибка чтения файла'));
    };

    reader.readAsBinaryString(file);
  });
}

/**
 * Export cutting specification to Excel file
 */
export function exportCuttingSpecToExcel(items: CuttingSpecItem[], fileName: string = 'Спецификация_Распил.xlsx') {
  // Prepare data for Excel
  const data = items.map((item, index) => ({
    '№': index + 1,
    'Название детали': item.partName,
    'Размеры (ДхШхТ)': item.dimensions,
    'Материал': item.material,
    'Количество': item.quantity,
    'Кромкование': item.edgeBanding || '-',
    'Примечания': item.notes || '',
    'Добавлено': new Date(item.addedAt).toLocaleString('ru-RU'),
    'Кем добавлено': item.addedByName
  }));

  // Create workbook and worksheet
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Распил');

  // Set column widths
  ws['!cols'] = [
    { wch: 5 },   // №
    { wch: 25 },  // Название детали
    { wch: 20 },  // Размеры
    { wch: 15 },  // Материал
    { wch: 12 },  // Количество
    { wch: 15 },  // Кромкование
    { wch: 30 },  // Примечания
    { wch: 20 },  // Добавлено
    { wch: 20 }   // Кем добавлено
  ];

  // Generate and download file
  XLSX.writeFile(wb, fileName);
}

/**
 * Import cutting specification from Excel file
 */
export async function importCuttingSpecFromExcel(
  file: File,
  userId: string,
  userName: string
): Promise<CuttingSpecItem[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const items: CuttingSpecItem[] = jsonData.map((row: any) => {
          // Support both Russian and English column names
          const partName = row['Название детали'] || row['Part Name'] || row['partName'] || '';
          const dimensions = row['Размеры (ДхШхТ)'] || row['Размеры'] || row['Dimensions'] || row['dimensions'] || '';
          const material = row['Материал'] || row['Material'] || row['material'] || '';
          const quantity = parseInt(row['Количество'] || row['Quantity'] || row['quantity'] || '1');
          const edgeBanding = row['Кромкование'] || row['Edge Banding'] || row['edgeBanding'] || '';
          const notes = row['Примечания'] || row['Notes'] || row['notes'] || '';

          if (!partName || !dimensions || !material) {
            throw new Error('Необходимо заполнить название детали, размеры и материал для каждой позиции');
          }

          return {
            id: nanoid(),
            partName: String(partName).trim(),
            dimensions: String(dimensions).trim(),
            material: String(material).trim(),
            quantity: isNaN(quantity) ? 1 : quantity,
            edgeBanding: edgeBanding ? String(edgeBanding).trim() : undefined,
            notes: notes ? String(notes).trim() : undefined,
            addedAt: new Date().toISOString(),
            addedBy: userId,
            addedByName: userName
          };
        });

        resolve(items);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Ошибка чтения файла'));
    };

    reader.readAsBinaryString(file);
  });
}

/**
 * Download Excel template for hardware specification
 */
export function downloadHardwareSpecTemplate() {
  const template = [
    {
      'Название': 'Петля накладная',
      'Артикул': 'PH-100-CR',
      'Количество': 4,
      'Ед. измерения': 'шт',
      'Примечания': 'Хром'
    },
    {
      'Название': 'Направляющая телескопическая',
      'Артикул': 'SL-450-FU',
      'Количество': 2,
      'Ед. измерения': 'пара',
      'Примечания': 'Полного выдвижения 450мм'
    }
  ];

  const ws = XLSX.utils.json_to_sheet(template);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Шаблон');

  ws['!cols'] = [
    { wch: 30 },  // Название
    { wch: 15 },  // Артикул
    { wch: 12 },  // Количество
    { wch: 15 },  // Ед. измерения
    { wch: 30 }   // Примечания
  ];

  XLSX.writeFile(wb, 'Шаблон_Фурнитура.xlsx');
}

/**
 * Download Excel template for cutting specification
 */
export function downloadCuttingSpecTemplate() {
  const template = [
    {
      'Название детали': 'Столешница',
      'Размеры (ДхШхТ)': '2000×600×18',
      'Материал': 'ЛДСП',
      'Количество': 1,
      'Кромкование': '2-2-2-2',
      'Примечания': 'Цвет: дуб сонома'
    },
    {
      'Название детали': 'Боковая стенка',
      'Размеры (ДхШхТ)': '720×600×18',
      'Материал': 'ЛДСП',
      'Количество': 2,
      'Кромкование': '0-0-2-2',
      'Примечания': 'Цвет: дуб сонома'
    }
  ];

  const ws = XLSX.utils.json_to_sheet(template);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Шаблон');

  ws['!cols'] = [
    { wch: 25 },  // Название детали
    { wch: 20 },  // Размеры
    { wch: 15 },  // Материал
    { wch: 12 },  // Количество
    { wch: 15 },  // Кромкование
    { wch: 30 }   // Примечания
  ];

  XLSX.writeFile(wb, 'Шаблон_Распил.xlsx');
}
