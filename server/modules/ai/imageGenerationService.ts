import Replicate from "replicate";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import crypto from "crypto";

// Lazy initialization of Replicate client
let replicate: Replicate | null = null;

function getReplicate(): Replicate {
  if (replicate) return replicate;

  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error("⚠️  Replicate API is not configured. Set REPLICATE_API_TOKEN in environment.");
  }

  replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
  console.log("✅ Replicate API initialized successfully");
  return replicate;
}

// Базовый путь для хранения сгенерированных изображений
const GENERATED_DIR = join(process.cwd(), ".local", "generated");

// Типы иконок для генерации
export type IconType =
  | "contract"    // Договор
  | "calendar"    // Календарь/дата
  | "customer"    // Покупатель
  | "phone"       // Телефон
  | "address"     // Адрес
  | "payment"     // Оплата
  | "catalog";    // Каталог товаров

/**
 * Сервис для генерации изображений через Replicate API (Google Imagen-4)
 */
class ImageGenerationService {
  /**
   * Инициализация директорий для хранения изображений
   */
  async initializeDirectories() {
    const dirs = [
      GENERATED_DIR,
      join(GENERATED_DIR, "icons"),
      join(GENERATED_DIR, "products"),
      join(GENERATED_DIR, "logos"),
      join(GENERATED_DIR, "qr"),
    ];

    for (const dir of dirs) {
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }
    }
  }

  /**
   * Базовая функция генерации изображения
   */
  private async generateImage(prompt: string, filename: string, aspectRatio: string = "1:1"): Promise<string> {
    const replicateClient = getReplicate();

    console.log(`🎨 [ImageGen] Generating: ${filename}`);
    console.log(`📝 [ImageGen] Prompt: ${prompt.substring(0, 100)}...`);

    try {
      // Используем Google Imagen-4 для высококачественной генерации
      const output = await replicateClient.run(
        "google/imagen-4",
        {
          input: {
            prompt: prompt,
            aspect_ratio: aspectRatio,
            safety_filter_level: "block_medium_and_above"
          }
        }
      );

      // Получаем URL для логирования
      const imageUrl = output.url();
      console.log(`📥 [ImageGen] Generated: ${imageUrl.substring(0, 50)}...`);

      // Сохраняем напрямую в файл (Replicate SDK поддерживает это)
      await this.initializeDirectories();
      const filePath = join(GENERATED_DIR, filename);
      await writeFile(filePath, output as any);

      console.log(`✅ [ImageGen] Saved: ${filePath}`);

      // Возвращаем относительный путь для использования в HTML
      return `/generated/${filename}`;
    } catch (error) {
      console.error(`❌ [ImageGen] Error generating ${filename}:`, error);
      throw error;
    }
  }

  /**
   * Генерация логотипа EMERALD
   */
  async generateLogo(): Promise<string> {
    const filename = "logos/emerald-logo.png";
    const filePath = join(GENERATED_DIR, filename);

    // Проверяем кэш
    if (existsSync(filePath)) {
      console.log(`📦 [ImageGen] Using cached logo`);
      return `/generated/${filename}`;
    }

    const prompt = `
      Luxury furniture brand logo with text 'EMERALD',
      elegant emerald green gemstone incorporated into design,
      modern minimalist style,
      metallic gold and emerald green colors (#50C878),
      professional brand identity,
      white background,
      high-end furniture company aesthetic,
      vector-style clean design,
      commercial quality,
      8K resolution
    `.trim().replace(/\s+/g, ' ');

    return await this.generateImage(prompt, filename, "16:9");
  }

  /**
   * Генерация иконки для секции документа
   */
  async generateIcon(type: IconType): Promise<string> {
    const filename = `icons/icon-${type}.png`;
    const filePath = join(GENERATED_DIR, filename);

    // Проверяем кэш
    if (existsSync(filePath)) {
      console.log(`📦 [ImageGen] Using cached icon: ${type}`);
      return `/generated/${filename}`;
    }

    const prompts: Record<IconType, string> = {
      contract: `
        Minimalist contract document icon,
        emerald green (#50C878),
        thin line art style,
        professional business icon,
        white background,
        vector-style,
        simple and clean,
        48x48 pixels perfect
      `.trim().replace(/\s+/g, ' '),

      calendar: `
        Modern calendar icon,
        emerald green accent,
        clean minimalist design,
        thin line art,
        white background,
        professional style,
        48x48 pixels perfect
      `.trim().replace(/\s+/g, ' '),

      customer: `
        Professional customer profile icon,
        emerald green,
        minimal line art style,
        person silhouette,
        white background,
        business icon,
        48x48 pixels perfect
      `.trim().replace(/\s+/g, ' '),

      phone: `
        Modern phone icon,
        emerald green,
        minimalist line art style,
        smartphone shape,
        white background,
        clean design,
        48x48 pixels perfect
      `.trim().replace(/\s+/g, ' '),

      address: `
        Location pin icon,
        emerald green,
        clean minimalist design,
        map marker shape,
        white background,
        professional style,
        48x48 pixels perfect
      `.trim().replace(/\s+/g, ' '),

      payment: `
        Payment schedule icon,
        emerald green and gold accent,
        professional business icon,
        money and calendar combined,
        white background,
        minimal line art,
        48x48 pixels perfect
      `.trim().replace(/\s+/g, ' '),

      catalog: `
        Product catalog icon,
        emerald green,
        modern minimalist style,
        grid or list symbol,
        white background,
        professional design,
        48x48 pixels perfect
      `.trim().replace(/\s+/g, ' '),
    };

    return await this.generateImage(prompts[type], filename, "1:1");
  }

  /**
   * Генерация изображения товара (мебель)
   */
  async generateProductImage(
    name: string,
    description: string,
    dimensions?: { height?: number; width?: number; depth?: number }
  ): Promise<string> {
    // Создаем уникальный hash для кэширования
    const hash = crypto
      .createHash('md5')
      .update(`${name}-${description}-${JSON.stringify(dimensions)}`)
      .digest('hex')
      .substring(0, 12);

    const filename = `products/product-${hash}.png`;
    const filePath = join(GENERATED_DIR, filename);

    // Проверяем кэш
    if (existsSync(filePath)) {
      console.log(`📦 [ImageGen] Using cached product: ${name}`);
      return `/generated/${filename}`;
    }

    // Форматируем размеры если есть
    let dimensionsText = "";
    if (dimensions && (dimensions.height || dimensions.width || dimensions.depth)) {
      dimensionsText = `dimensions ${dimensions.height}mm height × ${dimensions.width}mm width × ${dimensions.depth}mm depth,`;
    }

    const prompt = `
      Professional product photography of ${name}.
      ${description}.
      ${dimensionsText}
      Modern luxury furniture piece,
      high-end furniture showroom setting,
      clean white background,
      soft studio lighting from top and sides,
      photorealistic 3D render,
      commercial catalog quality,
      4K resolution,
      sharp details,
      professional presentation
    `.trim().replace(/\s+/g, ' ');

    return await this.generateImage(prompt, filename, "1:1");
  }

  /**
   * Генерация QR-кода с логотипом Emerald
   */
  async generateQRCode(contactInfo: string): Promise<string> {
    const hash = crypto.createHash('md5').update(contactInfo).digest('hex').substring(0, 8);
    const filename = `qr/qr-${hash}.png`;
    const filePath = join(GENERATED_DIR, filename);

    // Проверяем кэш
    if (existsSync(filePath)) {
      console.log(`📦 [ImageGen] Using cached QR code`);
      return `/generated/${filename}`;
    }

    const prompt = `
      Modern QR code design,
      emerald gemstone logo in center,
      emerald green and white colors,
      professional business style,
      scannable QR pattern,
      clean design,
      luxury brand aesthetic,
      white background
    `.trim().replace(/\s+/g, ' ');

    return await this.generateImage(prompt, filename, "1:1");
  }

  /**
   * Генерация всех иконок параллельно (оптимизация)
   */
  async generateAllIcons(): Promise<Record<IconType, string>> {
    console.log(`🎨 [ImageGen] Generating all icons in parallel...`);

    const iconTypes: IconType[] = [
      "contract", "calendar", "customer",
      "phone", "address", "payment", "catalog"
    ];

    const results = await Promise.all(
      iconTypes.map(type => this.generateIcon(type))
    );

    const icons: Record<IconType, string> = {} as any;
    iconTypes.forEach((type, index) => {
      icons[type] = results[index];
    });

    console.log(`✅ [ImageGen] All icons generated!`);
    return icons;
  }

  /**
   * Генерация изображений для всех позиций товаров параллельно
   */
  async generateProductImages(positions: Array<{
    name: string;
    description?: string;
    height?: number;
    width?: number;
    depth?: number;
  }>): Promise<string[]> {
    console.log(`🎨 [ImageGen] Generating ${positions.length} product images in parallel...`);

    const results = await Promise.all(
      positions.map(pos =>
        this.generateProductImage(
          pos.name,
          pos.description || "",
          {
            height: pos.height,
            width: pos.width,
            depth: pos.depth
          }
        )
      )
    );

    console.log(`✅ [ImageGen] All product images generated!`);
    return results;
  }

  /**
   * Генерация всех элементов для полного КП
   */
  async generateFullDocument(
    positions: Array<{
      name: string;
      description?: string;
      height?: number;
      width?: number;
      depth?: number;
    }>,
    contactInfo: string = "emerald-furniture.com"
  ) {
    console.log(`🎨 [ImageGen] Generating complete document with all AI elements...`);

    const [logo, icons, products, qr] = await Promise.all([
      this.generateLogo(),
      this.generateAllIcons(),
      this.generateProductImages(positions),
      this.generateQRCode(contactInfo),
    ]);

    console.log(`✅ [ImageGen] Complete document generated successfully!`);

    return {
      logo,
      icons,
      products,
      qr,
    };
  }
}

// Экспортируем синглтон сервиса
export const imageGenerationService = new ImageGenerationService();
