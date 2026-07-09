'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, PlayCircle } from 'lucide-react';

interface ProductGalleryProps {
  images: string[];
  productName: string;
  videos?: string[];
}

export default function ProductGallery({ images, productName, videos }: ProductGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Fotos primeiro, depois vídeos
  const allMedia = videos && videos.length > 0 ? [...images, ...videos] : images;
  const currentSrc = allMedia[currentIndex] ?? "";
  const isVideo = (index: number) => index >= images.length;
  const hasMultipleMedia = allMedia.length > 1;
  const hasVideos = videos && videos.length > 0;

  const nextMedia = () => {
    if (!hasMultipleMedia) return;
    setCurrentIndex((prev) => (prev + 1) % allMedia.length);
  };

  const prevMedia = () => {
    if (!hasMultipleMedia) return;
    setCurrentIndex((prev) => (prev - 1 + allMedia.length) % allMedia.length);
  };

  const goToVideo = () => {
    if (hasVideos) {
      // Vai para o primeiro vídeo (logo após as imagens)
      setCurrentIndex(images.length);
    }
  };

  return (
    <div className="relative aspect-square rounded-[3rem] overflow-hidden bg-white shadow-sm group">
      {isVideo(currentIndex) ? (
        <video
          key={currentIndex}
          src={currentSrc}
          title={`${productName} Video`}
          controls
          autoPlay
          muted
          loop
          playsInline
          className="w-full h-full object-contain bg-black/90"
        />
      ) : (
        <Image
          src={currentSrc}
          alt={`${productName} - Imagem ${currentIndex + 1}`}
          fill
          className="object-cover transition-opacity duration-500"
          referrerPolicy="no-referrer"
        />
      )}

      {/* Botões de Navegação — sempre visíveis, desabilitados se só tem 1 mídia */}
      <button
        onClick={prevMedia}
        disabled={!hasMultipleMedia}
        className={`absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center transition-all ${
          hasMultipleMedia
            ? 'text-[#2D241E] hover:bg-[#A6815C] hover:text-white opacity-0 group-hover:opacity-100 cursor-pointer'
            : 'text-[#2D241E]/30 opacity-40 cursor-not-allowed'
        }`}
        aria-label="Mídia anterior"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>

      <button
        onClick={nextMedia}
        disabled={!hasMultipleMedia}
        className={`absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center transition-all ${
          hasMultipleMedia
            ? 'text-[#2D241E] hover:bg-[#A6815C] hover:text-white opacity-0 group-hover:opacity-100 cursor-pointer'
            : 'text-[#2D241E]/30 opacity-40 cursor-not-allowed'
        }`}
        aria-label="Próxima mídia"
      >
        <ChevronRight className="w-6 h-6" />
      </button>

      {/* Dots de Navegação — sempre visíveis */}
      {allMedia.length > 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/50 backdrop-blur-sm px-3 py-2 rounded-full">
          {allMedia.map((_, index) => (
            <button
              key={index}
              onClick={() => hasMultipleMedia && setCurrentIndex(index)}
              disabled={!hasMultipleMedia}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                index === currentIndex
                  ? 'bg-[#A6815C] scale-125'
                  : hasMultipleMedia
                    ? 'bg-[#6B5E55]/50 hover:bg-[#A6815C]/50 cursor-pointer'
                    : 'bg-[#6B5E55]/20 cursor-not-allowed'
              }`}
              aria-label={`Ir para a mídia ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Botão "Ver Vídeo" — clicável, vai direto para o primeiro vídeo */}
      {hasVideos && !isVideo(currentIndex) && (
        <button
          onClick={goToVideo}
          className="absolute top-4 right-4 bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-bold text-[#2D241E] hover:bg-[#A6815C] hover:text-white transition-colors cursor-pointer"
        >
          <PlayCircle className="w-4 h-4" />
          Ver Vídeo
        </button>
      )}
    </div>
  );
}
