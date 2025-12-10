import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { ImageLightbox } from "@/components/ui/image-lightbox";

interface LightboxImage {
  url: string;
  title?: string;
}

interface LightboxContextType {
  openLightbox: (images: LightboxImage[], startIndex?: number) => void;
  closeLightbox: () => void;
  isOpen: boolean;
}

const LightboxContext = createContext<LightboxContextType | undefined>(undefined);

export function LightboxProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [images, setImages] = useState<LightboxImage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const openLightbox = useCallback((imgs: LightboxImage[], startIndex = 0) => {
    setImages(imgs);
    setCurrentIndex(startIndex);
    setIsOpen(true);
  }, []);

  const closeLightbox = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleNavigate = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  return (
    <LightboxContext.Provider value={{ openLightbox, closeLightbox, isOpen }}>
      {children}
      <ImageLightbox
        images={images}
        currentIndex={currentIndex}
        isOpen={isOpen}
        onClose={closeLightbox}
        onNavigate={handleNavigate}
      />
    </LightboxContext.Provider>
  );
}

export function useLightbox() {
  const context = useContext(LightboxContext);
  if (context === undefined) {
    throw new Error("useLightbox must be used within a LightboxProvider");
  }
  return context;
}
