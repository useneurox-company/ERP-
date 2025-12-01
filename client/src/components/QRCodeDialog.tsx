import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { WarehouseItem } from "@shared/schema";

interface QRCodeDialogProps {
  item: WarehouseItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QRCodeDialog({ item, open, onOpenChange }: QRCodeDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrGenerated, setQrGenerated] = useState(false);

  useEffect(() => {
    if (!item || !open) {
      setQrGenerated(false);
      return;
    }

    // Получаем данные для QR (используем barcode или id)
    const qrData = item.barcode || item.id;

    console.log("Генерация QR для товара:", {
      name: item.name,
      id: item.id,
      barcode: item.barcode,
      qrData: qrData,
      canvasExists: !!canvasRef.current,
    });

    if (!qrData) {
      setQrError("Отсутствует barcode или ID товара");
      return;
    }

    // Очищаем предыдущую ошибку
    setQrError(null);
    setQrGenerated(false);

    // Добавляем небольшую задержку, чтобы canvas успел смонтироваться в DOM
    const timer = setTimeout(() => {
      if (!canvasRef.current) {
        console.error("Canvas ref недоступен после таймаута");
        setQrError("Canvas элемент не готов");
        return;
      }

      console.log("Начинаем генерацию QR-кода...", {
        canvas: canvasRef.current,
        canvasWidth: canvasRef.current.width,
        canvasHeight: canvasRef.current.height,
      });

      // Генерируем QR-код
      QRCode.toCanvas(
        canvasRef.current,
        qrData,
        {
          width: 300,
          margin: 2,
          color: {
            dark: "#000000",
            light: "#FFFFFF",
          },
          errorCorrectionLevel: "M",
        },
        (error) => {
          if (error) {
            console.error("Ошибка генерации QR-кода:", error);
            setQrError(`Ошибка генерации: ${error.message}`);
            setQrGenerated(false);
          } else {
            console.log("QR-код успешно сгенерирован", {
              canvasWidth: canvasRef.current?.width,
              canvasHeight: canvasRef.current?.height,
            });
            setQrGenerated(true);
          }
        }
      );
    }, 100);

    return () => clearTimeout(timer);
  }, [item, open]);

  const handlePrint = () => {
    if (!canvasRef.current || !item || !qrGenerated) {
      console.error("Canvas не готов для печати");
      return;
    }

    const canvas = canvasRef.current;
    const qrDataUrl = canvas.toDataURL("image/png");

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      console.error("Не удалось открыть окно печати");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Печать QR-кода - ${item.name}</title>
          <meta charset="utf-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              padding: 20px;
              margin: 0;
            }
            .qr-container {
              text-align: center;
              page-break-after: always;
              max-width: 400px;
            }
            .qr-code {
              margin: 20px 0;
            }
            .qr-code img {
              max-width: 100%;
              height: auto;
            }
            .item-name {
              font-size: 18px;
              font-weight: bold;
              margin: 10px 0;
              word-wrap: break-word;
            }
            .item-info {
              font-size: 14px;
              color: #666;
              margin: 5px 0;
            }
            @media print {
              body {
                margin: 0;
                padding: 20px;
              }
              .no-print {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="qr-container">
            <div class="item-name">${item.name}</div>
            <div class="item-info">Артикул: ${item.sku || "-"}</div>
            <div class="item-info">ID: ${item.barcode || item.id}</div>
            <div class="qr-code">
              <img src="${qrDataUrl}" alt="QR Code" />
            </div>
            <div class="item-info">Отсканируйте для быстрого доступа</div>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();

    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handleDownload = () => {
    if (!canvasRef.current || !item || !qrGenerated) {
      console.error("Canvas не готов для скачивания");
      return;
    }

    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL("image/png");

    const link = document.createElement("a");
    link.download = `qr-${item.sku || item.id}.png`;
    link.href = dataUrl;
    link.click();
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>QR-код товара</DialogTitle>
          <DialogDescription>{item.name}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          {qrError && (
            <Alert variant="destructive" className="w-full">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{qrError}</AlertDescription>
            </Alert>
          )}

          <div className="border rounded-lg p-4 bg-white">
            <canvas
              ref={canvasRef}
              className="block"
              style={{ maxWidth: "300px", height: "auto" }}
            />
          </div>

          <div className="text-center space-y-1">
            <p className="text-sm font-medium">
              Артикул: {item.sku || "-"}
            </p>
            <p className="text-xs text-muted-foreground font-mono">
              ID: {item.barcode || item.id}
            </p>
          </div>
        </div>

        <DialogFooter className="flex-row gap-2 sm:justify-center">
          <Button
            onClick={handlePrint}
            className="flex-1"
            disabled={!qrGenerated}
          >
            <Printer className="h-4 w-4 mr-2" />
            Печать
          </Button>
          <Button
            onClick={handleDownload}
            variant="outline"
            className="flex-1"
            disabled={!qrGenerated}
          >
            <Download className="h-4 w-4 mr-2" />
            Скачать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
