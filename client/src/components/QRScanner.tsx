import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Camera, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QRScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScanSuccess: (decodedText: string) => void;
}

export function QRScanner({ open, onOpenChange, onScanSuccess }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string>("");
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    const startScanner = async () => {
      if (!open) return;

      try {
        // Request camera permission
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
        setHasPermission(true);
        setError("");

        // Initialize scanner
        const scanner = new Html5Qrcode("qr-reader");
        scannerRef.current = scanner;

        // Start scanning
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            // Success callback
            onScanSuccess(decodedText);
            stopScanner();
            onOpenChange(false);
          },
          (errorMessage) => {
            // Error callback - just log, don't show to user
            // This fires constantly when no QR is detected
            // console.log("Scan error:", errorMessage);
          }
        );

        setIsScanning(true);
      } catch (err) {
        console.error("Error starting scanner:", err);
        setHasPermission(false);
        setError("Не удалось получить доступ к камере. Проверьте разрешения в настройках браузера.");
      }
    };

    const stopScanner = async () => {
      if (scannerRef.current && isScanning) {
        try {
          await scannerRef.current.stop();
          scannerRef.current.clear();
        } catch (err) {
          console.error("Error stopping scanner:", err);
        }
        setIsScanning(false);
      }
    };

    if (open) {
      startScanner();
    } else {
      stopScanner();
    }

    // Cleanup on unmount
    return () => {
      stopScanner();
    };
  }, [open, onScanSuccess, onOpenChange]);

  const handleRetry = () => {
    setError("");
    setHasPermission(null);
    onOpenChange(false);
    setTimeout(() => onOpenChange(true), 100);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Сканирование QR-кода
          </DialogTitle>
          <DialogDescription>
            Наведите камеру на QR-код товара
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {error}
              </AlertDescription>
            </Alert>
          )}

          {hasPermission === false && (
            <div className="text-center py-4">
              <Button onClick={handleRetry} variant="outline">
                Повторить попытку
              </Button>
            </div>
          )}

          <div className="relative">
            <div
              id="qr-reader"
              className="rounded-lg overflow-hidden"
              style={{ width: "100%" }}
            />
            {isScanning && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 border-2 border-primary rounded-lg">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-primary animate-pulse" />
                </div>
              </div>
            )}
          </div>

          <div className="text-sm text-muted-foreground text-center">
            {isScanning
              ? "Сканирование... Поднесите QR-код ближе"
              : "Инициализация камеры..."}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
