'use client';

import React, { useState, useRef, useEffect, useTransition, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Play,
  Pause,
  Scissors,
  Trash,
  Copy,
  Plus,
  Sparkles,
  MusicNote,
  DownloadSimple,
  UploadSimple,
  InstagramLogo,
  TiktokLogo,
  YoutubeLogo,
  Eye,
  Layers,
  FilmStrip,
  MagicWand,
  SpeakerHigh,
  MagnifyingGlassPlus,
  MagnifyingGlassMinus,
  Keyboard,
  CaretLeft,
  CaretRight,
  SquaresFour,
} from '@/lib/ui/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AspectRatio, VideoProjectState } from '@/lib/types/content-studio';

// Carousel Slide Data Structure
interface CarouselSlide {
  id: string;
  title: string;
  imageSrc: string;
  textOverlay: string;
}

const DEFAULT_CAROUSEL_SLIDES: CarouselSlide[] = [
  {
    id: 'slide-1',
    title: 'Capa Carrossel: Luminária Lua 3D',
    imageSrc: '/images/Luminarias/Lua Cheia/luminarialuacheia1.png',
    textOverlay: 'LUMINÁRIA LUA 3D ✨',
  },
  {
    id: 'slide-2',
    title: 'Card 2: Detalhes & Textura',
    imageSrc: '/images/Luminarias/Lua Cheia/luminarialuacheia2.png',
    textOverlay: 'IMPRESSÃO EM ALTA RESOLUÇÃO',
  },
  {
    id: 'slide-3',
    title: 'Card 3: Outros Modelos (Vaso Geométrico)',
    imageSrc: '/images/Vasos Decoração/Vaso Geometrico Moderno/VasoG1.png',
    textOverlay: 'DECORAÇÃO MODERNA 3D',
  },
  {
    id: 'slide-4',
    title: 'Card 4: Chamada para Ação',
    imageSrc: '/images/Action Figure/Batman/Batman.png',
    textOverlay: 'LINK NA BIO • PEÇA A SUA',
  },
];

// Initial project with REAL working image paths from public/images
const INITIAL_PROJECT: VideoProjectState = {
  id: 'proj-demo-01',
  organizationId: 'org-gltech3d',
  title: 'Lançamento Luminária Lua 3D',
  aspectRatio: '9:16',
  resolution: { width: 1080, height: 1920 },
  durationSeconds: 15,
  fps: 30,
  layers: [
    {
      id: 'layer-bg-video',
      name: 'Foto Fundo (Luminária Lua)',
      type: 'image',
      visible: true,
      locked: false,
      transform: { x: 50, y: 50, scale: 1.0, rotation: 0, opacity: 1, blendMode: 'normal', zIndex: 1 },
      filters: { brightness: 100, contrast: 105, saturation: 110, blur: 0, sepia: 0, hueRotate: 0, removeBackground: false },
      content: { src: '/images/Luminarias/Lua Cheia/luminarialuacheia1.png' },
    },
    {
      id: 'layer-title',
      name: 'Título Principal',
      type: 'text',
      visible: true,
      locked: false,
      transform: { x: 50, y: 16, scale: 1.0, rotation: 0, opacity: 1, blendMode: 'normal', zIndex: 2 },
      filters: { brightness: 100, contrast: 100, saturation: 100, blur: 0, sepia: 0, hueRotate: 0, removeBackground: false },
      content: {
        textData: {
          text: 'LUMINÁRIA LUA 3D ✨',
          fontFamily: 'Inter',
          fontSize: 20,
          color: '#fbbf24',
          backgroundColor: '#09090b',
          fontWeight: '900',
          align: 'center',
          animation: 'pop',
        },
      },
    },
    {
      id: 'layer-caption-text',
      name: 'Legenda SRT (Animada)',
      type: 'text',
      visible: true,
      locked: false,
      transform: { x: 50, y: 70, scale: 1.0, rotation: 0, opacity: 1, blendMode: 'normal', zIndex: 3 },
      filters: { brightness: 100, contrast: 100, saturation: 100, blur: 0, sepia: 0, hueRotate: 0, removeBackground: false },
      content: {
        textData: {
          text: 'Procurando peças em 3D de alta precisão? ✨',
          fontFamily: 'Inter',
          fontSize: 13,
          color: '#f59e0b',
          backgroundColor: '#09090b',
          fontWeight: 'bold',
          align: 'center',
          animation: 'none',
        },
      },
    },
    {
      id: 'layer-badge',
      name: 'Selo Call to Action',
      type: 'text',
      visible: true,
      locked: false,
      transform: { x: 50, y: 84, scale: 1.0, rotation: 0, opacity: 1, blendMode: 'normal', zIndex: 4 },
      filters: { brightness: 100, contrast: 100, saturation: 100, blur: 0, sepia: 0, hueRotate: 0, removeBackground: false },
      content: {
        textData: {
          text: 'FEITO SOB DEMANDA • PEÇA A SUA',
          fontFamily: 'Inter',
          fontSize: 11,
          color: '#ffffff',
          backgroundColor: '#16a34a',
          fontWeight: 'bold',
          align: 'center',
          animation: 'none',
        },
      },
    },
  ],
  timeline: {
    currentTime: 2.5,
    tracks: [
      {
        id: 'tr-video',
        name: 'Vídeo / Fotos',
        type: 'video',
        muted: false,
        locked: false,
        segments: [
          { id: 'seg-v1', mediaUrl: 'Lua Cheia Foto 1', mediaType: 'image', startTime: 0, duration: 7, mediaOffset: 0, speed: 1.0, volume: 1.0 },
          { id: 'seg-v2', mediaUrl: 'Lua Cheia Foto 2', mediaType: 'image', startTime: 7, duration: 8, mediaOffset: 0, speed: 1.0, volume: 1.0 },
        ],
      },
      {
        id: 'tr-overlays',
        name: 'Títulos & Badges',
        type: 'text',
        muted: false,
        locked: false,
        segments: [
          { id: 'seg-t1', mediaUrl: 'Título & Selo CTA', mediaType: 'text', startTime: 0, duration: 15, mediaOffset: 0, speed: 1.0, volume: 0 },
        ],
      },
      {
        id: 'tr-captions',
        name: 'Legendas (Whisper)',
        type: 'caption',
        muted: false,
        locked: false,
        segments: [
          { id: 'seg-c1', mediaUrl: 'Legendas SRT', mediaType: 'caption', startTime: 0, duration: 15, mediaOffset: 0, speed: 1.0, volume: 0 },
        ],
      },
      {
        id: 'tr-audio',
        name: 'Áudio BGM',
        type: 'audio',
        muted: false,
        locked: false,
        segments: [
          { id: 'seg-a1', mediaUrl: 'Lofi Chill Beats.mp3', mediaType: 'audio', startTime: 0, duration: 15, mediaOffset: 0, speed: 1.0, volume: 0.7 },
        ],
      },
    ],
  },
  captions: {
    words: [
      { word: 'Procurando', start: 0.0, end: 0.8, highlight: false },
      { word: 'peças em 3D', start: 0.8, end: 1.8, highlight: true },
      { word: 'de alta precisão?', start: 1.8, end: 3.2, highlight: true },
      { word: 'Conheça a', start: 3.2, end: 4.2, highlight: false },
      { word: 'Luminária Lua 3D!', start: 4.2, end: 6.5, highlight: true },
    ],
    style: {
      fontFamily: 'Inter',
      fontSize: 15,
      activeColor: '#f59e0b',
      inactiveColor: '#ffffff',
      bgStyle: 'box',
      emojiPlacement: true,
    },
  },
  thumbnail: { timestamp: 2.5 },
  publishing: {
    instagram: {
      enabled: true,
      postType: 'reels',
      customCaption: 'Do arquivo 3D para a sua estante! ✨ Luminária Lua impressa em alta resolução. Peça no link da bio! #impressao3d #decoracao #gltech3d',
      hashtags: ['#impressao3d', '#reelsviral', '#decoracaocriativa', '#gltech3d'],
    },
    tiktok: {
      enabled: true,
      allowDuet: true,
      allowStitch: true,
      customCaption: 'Imprimindo uma Luminária Lua 3D perfeita! 🚀 Deixe seu comentário! #3dprinting #fyp #viral',
      hashtags: ['#3dprinting', '#fyp', '#viral'],
    },
    youtube: {
      enabled: true,
      categoryId: '22',
      privacy: 'public',
      customCaption: 'Luminária Lua 3D em detalhes - Impressão 3D GLTech3D #Shorts',
      hashtags: ['#Shorts', '#Impressao3D', '#GLTech3D'],
    },
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export default function MultichannelVideoEditorPage() {
  const [project, setProject] = useState<VideoProjectState>(INITIAL_PROJECT);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedLayerId, setSelectedLayerId] = useState<string>('layer-title');
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>('seg-v1');
  const [activeTabLeft, setActiveTabLeft] = useState<'media' | 'text' | 'captions' | 'audio'>('media');
  const [activeTabRight, setActiveTabRight] = useState<'properties' | 'publish' | 'layers'>('properties');
  const [showSafeZones, setShowSafeZones] = useState(true);
  const [canvasZoom, setCanvasZoom] = useState(0.85); // 85% compact fit
  const [isPending, startTransition] = useTransition();

  // Carousel Slide State
  const [carouselSlides, setCarouselSlides] = useState<CarouselSlide[]>(DEFAULT_CAROUSEL_SLIDES);
  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(0);

  // Mouse Dragging State
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [dragStartMouse, setDragStartMouse] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragStartLayerPos, setDragStartLayerPos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });

  const canvasBoxRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const animRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  // REAL-TIME PLAYBACK TIMER SYNC (1.000 real-world second = 1.0 second on timer!)
  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = performance.now();

      const step = (now: number) => {
        if (lastTimeRef.current !== null) {
          const deltaSec = (now - lastTimeRef.current) / 1000;
          lastTimeRef.current = now;

          setProject((prev) => {
            const nextTime = prev.timeline.currentTime + deltaSec;
            if (nextTime >= prev.durationSeconds) {
              setIsPlaying(false);
              return { ...prev, timeline: { ...prev.timeline, currentTime: 0 } };
            }
            return { ...prev, timeline: { ...prev.timeline, currentTime: nextTime } };
          });
        }
        animRef.current = requestAnimationFrame(step);
      };

      animRef.current = requestAnimationFrame(step);
    } else {
      lastTimeRef.current = null;
      if (animRef.current) cancelAnimationFrame(animRef.current);
    }
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying]);

  const selectedLayer = project.layers.find((l) => l.id === selectedLayerId);
  const isCarouselMode = project.aspectRatio === '1:1' || project.publishing.instagram.postType === 'carrossel';

  // Compact Proportional Dimensions for Preview Canvas Frame
  const canvasAspectStyles: Record<AspectRatio, string> = {
    '9:16': 'w-[250px] h-[444px]',
    '4:5': 'w-[300px] h-[375px]',
    '1:1': 'w-[340px] h-[340px]',
    '16:9': 'w-[440px] h-[247px]',
  };

  // Helper functions for layer updates
  const updateLayerTransform = useCallback((key: keyof VideoProjectState['layers'][0]['transform'], value: number | string) => {
    if (!selectedLayerId) return;
    setProject((prev) => ({
      ...prev,
      layers: prev.layers.map((l) =>
        l.id === selectedLayerId
          ? { ...l, transform: { ...l.transform, [key]: value } }
          : l
      ),
    }));
  }, [selectedLayerId]);

  const updateLayerFilter = useCallback((key: keyof VideoProjectState['layers'][0]['filters'], value: number | boolean) => {
    if (!selectedLayerId) return;
    setProject((prev) => ({
      ...prev,
      layers: prev.layers.map((l) =>
        l.id === selectedLayerId
          ? { ...l, filters: { ...l.filters, [key]: value } }
          : l
      ),
    }));
  }, [selectedLayerId]);

  const updateLayerContent = useCallback((text: string, color?: string, bg?: string, fontSize?: number) => {
    if (!selectedLayerId) return;
    setProject((prev) => ({
      ...prev,
      layers: prev.layers.map((l) => {
        if (l.id !== selectedLayerId) return l;
        if (l.type === 'text' && l.content.textData) {
          return {
            ...l,
            content: {
              ...l.content,
              textData: {
                ...l.content.textData,
                text,
                color: color ?? l.content.textData.color,
                backgroundColor: bg ?? l.content.textData.backgroundColor,
                fontSize: fontSize ?? l.content.textData.fontSize,
              },
            },
          };
        }
        if (l.type === 'image') {
          return { ...l, content: { ...l.content, src: text } };
        }
        return l;
      }),
    }));
  }, [selectedLayerId]);

  // Actions
  const handleSplitSegment = useCallback(() => {
    const curTime = project.timeline.currentTime;
    let splitDone = false;

    setProject((prev) => ({
      ...prev,
      timeline: {
        ...prev.timeline,
        tracks: prev.timeline.tracks.map((tr) => ({
          ...tr,
          segments: tr.segments.flatMap((seg) => {
            if (curTime > seg.startTime && curTime < seg.startTime + seg.duration) {
              splitDone = true;
              const firstDur = curTime - seg.startTime;
              const secondDur = seg.duration - firstDur;
              return [
                { ...seg, duration: Number(firstDur.toFixed(1)) },
                {
                  ...seg,
                  id: `${seg.id}-part2-${Date.now()}`,
                  startTime: Number(curTime.toFixed(1)),
                  duration: Number(secondDur.toFixed(1)),
                  mediaUrl: `${seg.mediaUrl} (Parte 2)`,
                },
              ];
            }
            return [seg];
          }),
        })),
      },
    }));

    if (splitDone) toast.success(`Corte (Split) realizado no segundo ${curTime.toFixed(1)}s!`);
    else toast.info('Posicione a agulha de tempo sobre um clipe para cortar.');
  }, [project.timeline.currentTime]);

  const handleDuplicateSelected = useCallback(() => {
    if (!selectedLayer) return;
    const newId = `layer-dup-${Date.now()}`;
    setProject((prev) => ({
      ...prev,
      layers: [
        ...prev.layers,
        {
          ...selectedLayer,
          id: newId,
          name: `${selectedLayer.name} (Cópia)`,
          transform: { ...selectedLayer.transform, x: Math.min(90, selectedLayer.transform.x + 5), y: Math.min(90, selectedLayer.transform.y + 5) },
        },
      ],
    }));
    setSelectedLayerId(newId);
    toast.success('Camada duplicada!');
  }, [selectedLayer]);

  const handleDeleteSelected = useCallback((idToDelete?: string) => {
    const targetId = idToDelete || selectedLayerId;
    if (!targetId) return;

    setProject((prev) => {
      const remaining = prev.layers.filter((l) => l.id !== targetId);
      if (selectedLayerId === targetId) {
        setSelectedLayerId(remaining[0]?.id ?? '');
      }
      return { ...prev, layers: remaining };
    });
    toast.success('Camada deletada!');
  }, [selectedLayerId]);

  // GLOBAL KEYBOARD SHORTCUTS
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.getAttribute('contenteditable') === 'true')
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
        return;
      }

      if (e.code === 'Delete' || e.code === 'Backspace') {
        e.preventDefault();
        handleDeleteSelected();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleDuplicateSelected();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        handleSplitSegment();
        return;
      }

      if (e.code === 'ArrowLeft') {
        e.preventDefault();
        setProject((prev) => ({
          ...prev,
          timeline: {
            ...prev.timeline,
            currentTime: Math.max(0, prev.timeline.currentTime - (e.shiftKey ? 0.1 : 1.0)),
          },
        }));
        return;
      }

      if (e.code === 'ArrowRight') {
        e.preventDefault();
        setProject((prev) => ({
          ...prev,
          timeline: {
            ...prev.timeline,
            currentTime: Math.min(
              prev.durationSeconds,
              prev.timeline.currentTime + (e.shiftKey ? 0.1 : 1.0)
            ),
          },
        }));
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDeleteSelected, handleDuplicateSelected, handleSplitSegment]);

  // WINDOW-LEVEL MOUSE DRAG LISTENERS
  function handleCanvasMouseDown(e: React.MouseEvent, layerId: string) {
    e.stopPropagation();
    setSelectedLayerId(layerId);
    const layer = project.layers.find((l) => l.id === layerId);
    if (!layer || !canvasBoxRef.current) return;

    setIsDraggingCanvas(true);
    setDragStartMouse({ x: e.clientX, y: e.clientY });
    setDragStartLayerPos({ x: layer.transform.x, y: layer.transform.y });
  }

  useEffect(() => {
    if (!isDraggingCanvas) return;

    function handleWindowMouseMove(e: MouseEvent) {
      if (!canvasBoxRef.current || !selectedLayerId) return;
      const rect = canvasBoxRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const dxPx = e.clientX - dragStartMouse.x;
      const dyPx = e.clientY - dragStartMouse.y;

      const dxPct = (dxPx / rect.width) * 100;
      const dyPct = (dyPx / rect.height) * 100;

      const newX = Math.round(Math.max(0, Math.min(100, dragStartLayerPos.x + dxPct)));
      const newY = Math.round(Math.max(0, Math.min(100, dragStartLayerPos.y + dyPct)));

      setProject((prev) => ({
        ...prev,
        layers: prev.layers.map((l) =>
          l.id === selectedLayerId
            ? { ...l, transform: { ...l.transform, x: newX, y: newY } }
            : l
        ),
      }));
    }

    function handleWindowMouseUp() {
      setIsDraggingCanvas(false);
    }

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [isDraggingCanvas, dragStartMouse, dragStartLayerPos, selectedLayerId]);

  // File Upload
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    const isVideo = file.type.startsWith('video');
    const newLayerId = `layer-upload-${Date.now()}`;
    const newSegId = `seg-upload-${Date.now()}`;

    setProject((prev) => ({
      ...prev,
      layers: [
        ...prev.layers,
        {
          id: newLayerId,
          name: file.name,
          type: isVideo ? 'video' : 'image',
          visible: true,
          locked: false,
          transform: { x: 50, y: 50, scale: 1.0, rotation: 0, opacity: 1, blendMode: 'normal', zIndex: prev.layers.length + 1 },
          filters: { brightness: 100, contrast: 100, saturation: 100, blur: 0, sepia: 0, hueRotate: 0, removeBackground: false },
          content: { src: objectUrl },
        },
      ],
      timeline: {
        ...prev.timeline,
        tracks: prev.timeline.tracks.map((tr) =>
          tr.type === 'video'
            ? {
                ...tr,
                segments: [
                  ...tr.segments,
                  { id: newSegId, mediaUrl: file.name, mediaType: isVideo ? 'video' : 'image', startTime: prev.timeline.currentTime, duration: 5, mediaOffset: 0, speed: 1.0, volume: 1.0 },
                ],
              }
            : tr
        ),
      },
    }));

    setSelectedLayerId(newLayerId);
    setSelectedSegmentId(newSegId);
    setActiveTabRight('properties');
    toast.success(`Mídia '${file.name}' carregada!`);
  }

  function handlePublishAll() {
    startTransition(() => {
      toast.promise(
        new Promise((resolve) => setTimeout(resolve, 1800)),
        {
          loading: '🚀 Renderizando MP4 1080p60 e disparando para Instagram Reels, TikTok e YouTube Shorts...',
          success: '🎉 Conteúdo publicado com sucesso em todas as redes selecionadas!',
          error: 'Falha na publicação.',
        }
      );
    });
  }

  // Active Carousel Slide Data
  const currentSlide = (carouselSlides[activeSlideIndex] || carouselSlides[0] || DEFAULT_CAROUSEL_SLIDES[0])!;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col bg-background text-foreground overflow-hidden font-sans">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* ── HEADER SUPERIOR COMPACTO (H-12) ────────────────────────────── */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card px-4 shadow-xs z-10">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500 text-zinc-950 shadow-md">
            <FilmStrip size={18} weight="bold" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs font-bold text-foreground truncate max-w-[200px] md:max-w-md">
                {project.title}
              </h1>
              <Badge variant="secondary" className="bg-amber-500/15 text-amber-600 dark:text-amber-400 font-mono text-[9px] px-1.5 py-0.2 border border-amber-500/30">
                1080p60 • {project.durationSeconds}s
              </Badge>
            </div>
          </div>
        </div>

        {/* Format Selector (Reels vs Feed vs Carrossel vs YouTube) */}
        <div className="hidden sm:flex items-center gap-1 rounded-xl border border-border bg-muted p-0.5">
          {[
            { ratio: '9:16', postType: 'reels', label: '📱 Reels / TikTok / Stories' },
            { ratio: '4:5', postType: 'feed', label: '📸 Feed (4:5)' },
            { ratio: '1:1', postType: 'carrossel', label: '⬛ Carrossel (Slides)' },
            { ratio: '16:9', postType: 'feed', label: '🎬 YouTube (16:9)' },
          ].map((item) => (
            <button
              key={item.ratio}
              onClick={() => {
                setProject((prev) => ({
                  ...prev,
                  aspectRatio: item.ratio as AspectRatio,
                  publishing: {
                    ...prev.publishing,
                    instagram: { ...prev.publishing.instagram, postType: item.postType as 'reels' | 'story' | 'feed' | 'carrossel' },
                  },
                }));
                toast.success(`Formato: ${item.label}`);
              }}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                project.aspectRatio === item.ratio
                  ? 'bg-amber-500 text-zinc-950 shadow-xs'
                  : 'text-muted-foreground hover:bg-card hover:text-foreground'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="hidden lg:flex items-center gap-1 text-[9px] font-mono border-border text-muted-foreground">
            <Keyboard size={12} /> Atalhos Ativos
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              toast.promise(
                new Promise((resolve) => setTimeout(resolve, 1000)),
                {
                  loading: 'Exportando mídia...',
                  success: '🎉 Mídia exportada e baixada!',
                  error: 'Erro.',
                }
              );
            }}
            className="h-7 text-xs gap-1 font-semibold"
          >
            <DownloadSimple size={13} />
            Exportar Mídia
          </Button>
          <Button
            size="sm"
            onClick={handlePublishAll}
            disabled={isPending}
            className="h-7 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-zinc-950 shadow-md gap-1"
          >
            <Sparkles size={13} weight="bold" />
            Publicar
          </Button>
        </div>
      </header>

      {/* ── WORKSPACE PRINCIPAL (FLEX 3 COLUNAS) ────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ── 1. PAINEL ESQUERDO: BIBLIOTECA & ASSETS (LARGURA FIXA 300PX) ───── */}
        <div className="w-[300px] shrink-0 border-r border-border bg-card flex flex-col h-full overflow-hidden">
          <Tabs value={activeTabLeft} onValueChange={(v) => setActiveTabLeft(v as typeof activeTabLeft)} className="flex flex-1 flex-col min-h-0">
            <TabsList className="mx-2 mt-2 grid grid-cols-4 bg-muted border border-border">
              <TabsTrigger value="media" className="text-[10px] font-bold">Mídias</TabsTrigger>
              <TabsTrigger value="text" className="text-[10px] font-bold">Textos</TabsTrigger>
              <TabsTrigger value="captions" className="text-[10px] font-bold">Legendas</TabsTrigger>
              <TabsTrigger value="audio" className="text-[10px] font-bold">Áudio</TabsTrigger>
            </TabsList>

            {/* Tab Mídias */}
            <TabsContent value="media" className="flex-1 overflow-y-auto p-3 space-y-3">
              <div>
                <Label className="text-[11px] font-bold text-foreground mb-1.5 block">Upload do Dispositivo</Label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/40 p-3 text-center hover:border-amber-500 transition-colors cursor-pointer"
                >
                  <UploadSimple size={20} className="text-amber-500 mb-0.5" />
                  <span className="text-[11px] font-bold text-foreground">Enviar foto ou vídeo</span>
                  <span className="text-[9px] text-muted-foreground">PNG, JPG, MP4, MOV</span>
                </div>
              </div>

              <div>
                <Label className="text-[11px] font-bold text-foreground mb-1.5 block">Produtos 3D do CRM</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { name: 'Luminária Lua', img: '/images/Luminarias/Lua Cheia/luminarialuacheia1.png' },
                    { name: 'Vaso Geométrico', img: '/images/Vasos Decoração/Vaso Geometrico Moderno/VasoG1.png' },
                    { name: 'Action Figure', img: '/images/Action Figure/Batman/Batman.png' },
                    { name: 'Lua Cheia 2', img: '/images/Luminarias/Lua Cheia/luminarialuacheia2.png' },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        const newLayerId = `layer-crm-${Date.now()}`;
                        setProject((prev) => ({
                          ...prev,
                          layers: [
                            ...prev.layers,
                            {
                              id: newLayerId,
                              name: item.name,
                              type: 'image',
                              visible: true,
                              locked: false,
                              transform: { x: 50, y: 50, scale: 0.9, rotation: 0, opacity: 1, blendMode: 'normal', zIndex: prev.layers.length + 1 },
                              filters: { brightness: 100, contrast: 100, saturation: 100, blur: 0, sepia: 0, hueRotate: 0, removeBackground: false },
                              content: { src: item.img },
                            },
                          ],
                        }));
                        setSelectedLayerId(newLayerId);
                        setActiveTabRight('properties');
                        toast.success(`'${item.name}' inserido!`);
                      }}
                      className="group relative aspect-square rounded-xl border border-border bg-background overflow-hidden cursor-pointer hover:border-amber-500 shadow-xs"
                    >
                      {/* eslint-disable-next-next/no-img-element */}
                      <img src={item.img} alt={item.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                      <div className="absolute inset-x-0 bottom-0 bg-background/90 p-0.5 text-[9px] font-bold text-foreground truncate text-center border-t border-border">
                        {item.name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Tab Textos */}
            <TabsContent value="text" className="flex-1 overflow-y-auto p-3 space-y-2">
              <Label className="text-[11px] font-bold text-foreground block">Presets de Texto &amp; Títulos</Label>
              {[
                { title: 'LUMINÁRIA LUA 3D ✨', bg: '#09090b', color: '#fbbf24', style: 'Selo Título Destaque' },
                { title: 'PROMOÇÃO LIMITADA 🔥', bg: '#dc2626', color: '#ffffff', style: 'Badge Vermelho' },
                { title: 'IMPRESSÃO SOB DEMANDA', bg: '#2563eb', color: '#ffffff', style: 'Badge Azul Tech' },
                { title: 'LINK NA BIO 🛒', bg: '#16a34a', color: '#ffffff', style: 'Call to Action Verde' },
              ].map((preset, i) => (
                <button
                  key={i}
                  onClick={() => {
                    const newLayerId = `layer-text-${Date.now()}`;
                    setProject((prev) => ({
                      ...prev,
                      layers: [
                        ...prev.layers,
                        {
                          id: newLayerId,
                          name: preset.style,
                          type: 'text',
                          visible: true,
                          locked: false,
                          transform: { x: 50, y: 30 + i * 12, scale: 1, rotation: 0, opacity: 1, blendMode: 'normal', zIndex: prev.layers.length + 1 },
                          filters: { brightness: 100, contrast: 100, saturation: 100, blur: 0, sepia: 0, hueRotate: 0, removeBackground: false },
                          content: {
                            textData: {
                              text: preset.title,
                              fontFamily: 'Inter',
                              fontSize: 18,
                              color: preset.color,
                              backgroundColor: preset.bg,
                              fontWeight: 'bold',
                              align: 'center',
                              animation: 'pop',
                            },
                          },
                        },
                      ],
                    }));
                    setSelectedLayerId(newLayerId);
                    setActiveTabRight('properties');
                    toast.success(`Texto inserido!`);
                  }}
                  className="w-full text-left p-2 rounded-xl border border-border bg-background hover:border-amber-500 transition-all flex items-center justify-between shadow-xs"
                >
                  <span style={{ backgroundColor: preset.bg, color: preset.color }} className="px-2 py-0.5 rounded text-[10px] font-bold">
                    {preset.title}
                  </span>
                  <Plus size={14} className="text-muted-foreground" />
                </button>
              ))}
            </TabsContent>

            {/* Tab Legendas */}
            <TabsContent value="captions" className="flex-1 overflow-y-auto p-3 space-y-3">
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                  <MagicWand size={14} />
                  <span>Legendas Dinâmicas Whisper</span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Legendas animadas estilo CapCut por IA.
                </p>
                <Button size="sm" onClick={() => toast.success('Legendas sincronizadas!')} className="w-full h-6 text-[10px] font-bold bg-amber-500 hover:bg-amber-600 text-zinc-950">
                  Sincronizar Áudio
                </Button>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold text-foreground">Estilo da Legenda</Label>
                <Select
                  value={project.captions?.style.bgStyle}
                  onValueChange={(v) =>
                    setProject((prev) => ({
                      ...prev,
                      captions: prev.captions ? { ...prev.captions, style: { ...prev.captions.style, bgStyle: v as 'box' | 'outline' | 'shadow' | 'none' } } : undefined,
                    }))
                  }
                >
                  <SelectTrigger className="h-7 text-[11px] border-border bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="box">Palavra Amarela + Caixa Preta</SelectItem>
                    <SelectItem value="outline">Texto Neon + Borda Branca</SelectItem>
                    <SelectItem value="shadow">Sombra Projetada</SelectItem>
                    <SelectItem value="none">Texto Simples</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            {/* Tab Áudio */}
            <TabsContent value="audio" className="flex-1 overflow-y-auto p-3 space-y-2">
              <Label className="text-[11px] font-bold text-foreground block">Trilhas Sonoras &amp; SFX</Label>
              {[
                { title: 'Lofi Chill Beats', duration: '2:45', tag: 'Trend Reels' },
                { title: 'Upbeat Tech Showcase', duration: '1:30', tag: 'Energético' },
                { title: 'Transição Whoosh', duration: '0:02', tag: 'SFX' },
                { title: 'Pop Click', duration: '0:01', tag: 'SFX' },
              ].map((track, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-xl border border-border bg-background text-xs shadow-xs">
                  <div className="flex items-center gap-1.5">
                    <MusicNote size={15} className="text-amber-500 shrink-0" />
                    <div>
                      <p className="font-bold text-foreground text-[11px]">{track.title}</p>
                      <span className="text-[9px] text-muted-foreground">{track.tag} • {track.duration}</span>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => toast.success(`Trilha '${track.title}' adicionada!`)} className="h-5 px-1.5 text-[9px] font-bold text-amber-600 dark:text-amber-400 border-amber-500/30">
                    + Usar
                  </Button>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </div>

        {/* ── 2. ÁREA CENTRAL: CANVAS VIEWPORT & CARROSSEL MULTI-CARD ──────── */}
        <div className="flex-1 flex flex-col items-center justify-between p-3 bg-muted/30 overflow-hidden relative h-full select-none">
          {/* Top Info Bar */}
          <div className="w-full flex items-center justify-between mb-1 px-1">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <Eye size={15} className="text-amber-500" />
              <span>
                {isCarouselMode
                  ? `Carrossel Multicard (Card ${activeSlideIndex + 1} de ${carouselSlides.length})`
                  : `Preview (${project.aspectRatio})`}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Zoom Viewport Control */}
              <div className="flex items-center gap-1 bg-card border border-border px-2 py-0.5 rounded-lg text-xs">
                <button onClick={() => setCanvasZoom((z) => Math.max(0.6, z - 0.05))} className="text-muted-foreground hover:text-foreground">
                  <MagnifyingGlassMinus size={13} />
                </button>
                <span className="font-mono text-[10px] font-bold text-amber-600 dark:text-amber-400">{Math.round(canvasZoom * 100)}%</span>
                <button onClick={() => setCanvasZoom((z) => Math.min(1.3, z + 0.05))} className="text-muted-foreground hover:text-foreground">
                  <MagnifyingGlassPlus size={13} />
                </button>
              </div>

              {!isCarouselMode && (
                <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground cursor-pointer">
                  <Switch checked={showSafeZones} onCheckedChange={setShowSafeZones} />
                  <span>Guias Safe Zone</span>
                </label>
              )}
            </div>
          </div>

          {/* CARROSSEL SLIDE NAVIGATION STRIP (Exibido apenas em modo Carrossel) */}
          {isCarouselMode && (
            <div className="w-full flex items-center justify-center gap-2 mb-2 bg-card border border-border rounded-xl p-1.5 shadow-xs">
              <button
                onClick={() => setActiveSlideIndex((i) => Math.max(0, i - 1))}
                disabled={activeSlideIndex === 0}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground disabled:opacity-30"
              >
                <CaretLeft size={16} />
              </button>

              <div className="flex items-center gap-1.5 overflow-x-auto">
                {carouselSlides.map((slide, sIdx) => (
                  <button
                    key={slide.id}
                    onClick={() => setActiveSlideIndex(sIdx)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                      activeSlideIndex === sIdx
                        ? 'bg-amber-500 text-zinc-950 border-amber-500 shadow-xs'
                        : 'bg-muted border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <SquaresFour size={12} />
                    <span>Card {sIdx + 1}</span>
                  </button>
                ))}
                <button
                  onClick={() => {
                    const newSlideId = `slide-${carouselSlides.length + 1}`;
                    setCarouselSlides((prev) => [
                      ...prev,
                      {
                        id: newSlideId,
                        title: `Card ${prev.length + 1}`,
                        imageSrc: '/images/Luminarias/Lua Cheia/luminarialuacheia1.png',
                        textOverlay: 'NOVO CARD CARROSSEL',
                      },
                    ]);
                    setActiveSlideIndex(carouselSlides.length);
                    toast.success(`Card ${carouselSlides.length + 1} adicionado ao Carrossel!`);
                  }}
                  className="px-2 py-1 rounded-lg text-[10px] font-bold border border-dashed border-amber-500/50 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                >
                  + Novo Card
                </button>
              </div>

              <button
                onClick={() => setActiveSlideIndex((i) => Math.min(carouselSlides.length - 1, i + 1))}
                disabled={activeSlideIndex === carouselSlides.length - 1}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground disabled:opacity-30"
              >
                <CaretRight size={16} />
              </button>
            </div>
          )}

          {/* Canvas Viewport Frame */}
          <div className="flex-1 flex items-center justify-center w-full min-h-0 overflow-hidden p-1">
            <div
              style={{ transform: `scale(${canvasZoom})`, transformOrigin: 'center center' }}
              className="transition-transform duration-100"
            >
              <div
                ref={canvasBoxRef}
                className={`relative rounded-3xl border-4 border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden transition-all ${canvasAspectStyles[project.aspectRatio]}`}
              >
                {/* Render Canvas Elements / Slide Content */}
                {isCarouselMode ? (
                  // CAROUSEL CARD SLIDE VIEWPORT
                  <div className="relative w-full h-full flex flex-col items-center justify-center">
                    {/* eslint-disable-next-next/no-img-element */}
                    <img
                      src={currentSlide.imageSrc}
                      alt={currentSlide.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-4 inset-x-3 text-center">
                      <span className="bg-zinc-950/90 text-amber-400 font-extrabold px-3 py-1 rounded-xl text-xs border border-amber-500/40 shadow-lg">
                        {currentSlide.textOverlay}
                      </span>
                    </div>
                    <div className="absolute bottom-3 right-3 bg-zinc-950/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/20">
                      {activeSlideIndex + 1} / {carouselSlides.length}
                    </div>
                  </div>
                ) : (
                  // STANDARD REELS / TIKTOK / FEED VIEWPORT
                  project.layers.map((layer) => {
                    if (!layer.visible) return null;
                    const isSelected = layer.id === selectedLayerId;

                    return (
                      <div
                        key={layer.id}
                        onMouseDown={(e) => handleCanvasMouseDown(e, layer.id)}
                        style={{
                          position: 'absolute',
                          left: `${layer.transform.x}%`,
                          top: `${layer.transform.y}%`,
                          transform: `translate(-50%, -50%) scale(${layer.transform.scale}) rotate(${layer.transform.rotation}deg)`,
                          opacity: layer.transform.opacity,
                          mixBlendMode: layer.transform.blendMode as React.CSSProperties['mixBlendMode'],
                          zIndex: layer.transform.zIndex,
                        }}
                        className={`cursor-move transition-shadow select-none ${
                          isSelected ? 'ring-2 ring-amber-500 ring-offset-2 ring-offset-zinc-950' : 'hover:ring-1 hover:ring-white/40'
                        }`}
                      >
                        {layer.type === 'image' && layer.content.src && (
                          <div className="relative w-[240px] flex items-center justify-center">
                            {/* eslint-disable-next-next/no-img-element */}
                            <img
                              src={layer.content.src}
                              alt={layer.name}
                              className="w-full h-auto max-w-none max-h-none object-contain rounded-lg shadow-lg pointer-events-none"
                              style={{
                                filter: `brightness(${layer.filters.brightness}%) contrast(${layer.filters.contrast}%) saturate(${layer.filters.saturation}%) blur(${layer.filters.blur}px)`,
                              }}
                            />
                            {isSelected && (
                              <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-amber-500 text-zinc-950 text-[9px] font-extrabold px-1.5 py-0.2 rounded shadow whitespace-nowrap z-50">
                                {layer.name}
                              </div>
                            )}
                          </div>
                        )}

                        {layer.type === 'text' && layer.content.textData && (
                          <div className="relative">
                            <span
                              style={{
                                fontFamily: layer.content.textData.fontFamily,
                                fontSize: `${layer.content.textData.fontSize}px`,
                                color: layer.content.textData.color,
                                backgroundColor: layer.content.textData.backgroundColor,
                                fontWeight: layer.content.textData.fontWeight as React.CSSProperties['fontWeight'],
                              }}
                              className="px-3 py-1 rounded-xl shadow-2xl whitespace-nowrap block border border-white/20 text-center"
                            >
                              {layer.content.textData.text}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}

                {/* Safe Zones Overlay (Exibido apenas em vídeos Reels/TikTok 9:16) */}
                {showSafeZones && !isCarouselMode && project.aspectRatio === '9:16' && (
                  <div className="absolute inset-0 border-2 border-dashed border-amber-500/40 pointer-events-none flex flex-col justify-between p-2.5 z-30">
                    <div className="flex justify-between items-center text-[9px] font-bold text-amber-400 bg-zinc-950/80 px-2 py-0.5 rounded border border-amber-500/30">
                      <span>Área Segura Topo</span>
                      <span>1080 x 1920</span>
                    </div>
                    <div className="flex justify-between items-end text-[9px] font-bold text-amber-400 bg-zinc-950/80 px-2 py-0.5 rounded border border-amber-500/30">
                      <span>Botões Curtir / Instagram</span>
                      <span>Margem 110px</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Real-Time Playback Scrubbing Bar */}
          <div className="flex items-center gap-3 mt-1 bg-card border border-border rounded-full px-4 py-1 shadow-xs shrink-0 z-10">
            <button
              onClick={() => setProject((prev) => ({ ...prev, timeline: { ...prev.timeline, currentTime: Math.max(0, prev.timeline.currentTime - 1) } }))}
              className="text-muted-foreground hover:text-foreground font-bold text-xs transition-colors"
            >
              -1s
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-zinc-950 font-extrabold shadow-md hover:scale-105 transition-transform"
            >
              {isPlaying ? <Pause size={15} weight="bold" /> : <Play size={15} weight="bold" className="ml-0.5" />}
            </button>
            <button
              onClick={() => setProject((prev) => ({ ...prev, timeline: { ...prev.timeline, currentTime: Math.min(prev.durationSeconds, prev.timeline.currentTime + 1) } }))}
              className="text-muted-foreground hover:text-foreground font-bold text-xs transition-colors"
            >
              +1s
            </button>
            <span className="font-mono text-xs text-amber-600 dark:text-amber-400 font-extrabold border-l border-border pl-2.5">
              {project.timeline.currentTime.toFixed(1)}s / {project.durationSeconds}.0s
            </span>
          </div>
        </div>

        {/* ── 3. PAINEL DIREITO: INSPETOR & PUBLICAÇÃO (LARGURA FIXA 320PX) ───── */}
        <div className="w-[320px] shrink-0 border-l border-border bg-card flex flex-col h-full overflow-hidden">
          <Tabs value={activeTabRight} onValueChange={(v) => setActiveTabRight(v as typeof activeTabRight)} className="flex flex-1 flex-col min-h-0">
            <TabsList className="mx-2 mt-2 grid grid-cols-3 bg-muted border border-border">
              <TabsTrigger value="properties" className="text-[10px] font-bold">Propriedades</TabsTrigger>
              <TabsTrigger value="layers" className="text-[10px] font-bold">Camadas</TabsTrigger>
              <TabsTrigger value="publish" className="text-[10px] font-bold text-amber-600 dark:text-amber-400">Publicação</TabsTrigger>
            </TabsList>

            {/* Aba Propriedades */}
            <TabsContent value="properties" className="flex-1 overflow-y-auto p-3 space-y-3">
              {isCarouselMode ? (
                <div className="space-y-3">
                  <div className="border-b border-border pb-2">
                    <h3 className="text-xs font-bold text-foreground">Edição do Card {activeSlideIndex + 1}</h3>
                    <span className="text-[10px] text-muted-foreground">Slide do Carrossel</span>
                  </div>

                  <div>
                    <Label className="text-[11px] font-bold text-foreground mb-1 block">Título / Texto Overlay</Label>
                    <Input
                      value={currentSlide.textOverlay}
                      onChange={(e) => {
                        const nextText = e.target.value;
                        setCarouselSlides((prev) =>
                          prev.map((s, idx) => (idx === activeSlideIndex ? { ...s, textOverlay: nextText } : s))
                        );
                      }}
                      className="h-8 text-xs bg-background border-border font-bold"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] font-bold text-foreground mb-1 block">Caminho da Imagem do Slide</Label>
                    <Input
                      value={currentSlide.imageSrc}
                      onChange={(e) => {
                        const nextSrc = e.target.value;
                        setCarouselSlides((prev) =>
                          prev.map((s, idx) => (idx === activeSlideIndex ? { ...s, imageSrc: nextSrc } : s))
                        );
                      }}
                      className="h-8 text-xs bg-background border-border"
                    />
                  </div>
                </div>
              ) : selectedLayer ? (
                <>
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <div>
                      <h3 className="text-xs font-bold text-foreground">{selectedLayer.name}</h3>
                      <span className="text-[10px] text-muted-foreground">ID: {selectedLayer.id}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteSelected(selectedLayer.id)}
                        className="h-6 px-1.5 text-xs text-red-500 hover:bg-red-500/10"
                        title="Deletar camada"
                      >
                        <Trash size={13} />
                      </Button>
                      <Badge variant="outline" className="text-[9px] uppercase font-bold border-amber-500/40 text-amber-600 dark:text-amber-400">
                        {selectedLayer.type}
                      </Badge>
                    </div>
                  </div>

                  {/* Text Layer Controls */}
                  {selectedLayer.type === 'text' && selectedLayer.content.textData && (
                    <div className="space-y-2 border-b border-border pb-3">
                      <Label className="text-[11px] font-bold text-foreground">Texto do Elemento</Label>
                      <Input
                        value={selectedLayer.content.textData.text}
                        onChange={(e) => updateLayerContent(e.target.value)}
                        className="h-8 text-xs bg-background border-border font-bold"
                      />

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[10px] font-bold text-muted-foreground block mb-1">Cor do Texto</Label>
                          <input
                            type="color"
                            value={selectedLayer.content.textData.color}
                            onChange={(e) => updateLayerContent(selectedLayer.content.textData!.text, e.target.value)}
                            className="h-7 w-full rounded border border-border cursor-pointer bg-background"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] font-bold text-muted-foreground block mb-1">Cor de Fundo</Label>
                          <input
                            type="color"
                            value={selectedLayer.content.textData.backgroundColor || '#000000'}
                            onChange={(e) => updateLayerContent(selectedLayer.content.textData!.text, undefined, e.target.value)}
                            className="h-7 w-full rounded border border-border cursor-pointer bg-background"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-muted-foreground font-medium">Tamanho da Fonte</span>
                          <span className="font-bold text-foreground">{selectedLayer.content.textData.fontSize}px</span>
                        </div>
                        <input
                          type="range"
                          min={12}
                          max={50}
                          value={selectedLayer.content.textData.fontSize}
                          onChange={(e) => updateLayerContent(selectedLayer.content.textData!.text, undefined, undefined, Number(e.target.value))}
                          className="w-full accent-amber-500 cursor-pointer"
                        />
                      </div>
                    </div>
                  )}

                  {/* Transform Controls */}
                  <div className="space-y-2 border-b border-border pb-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px] font-bold text-foreground">Posição &amp; Tamanho</Label>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          updateLayerTransform('x', 50);
                          updateLayerTransform('y', 50);
                          updateLayerTransform('scale', 1.0);
                        }}
                        className="h-5 text-[9px] font-bold text-amber-600 dark:text-amber-400"
                      >
                        Centralizar
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="flex justify-between text-[10px] mb-0.5">
                          <span className="text-muted-foreground">Posição X</span>
                          <span className="font-mono text-foreground font-bold">{selectedLayer.transform.x}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={selectedLayer.transform.x}
                          onChange={(e) => updateLayerTransform('x', Number(e.target.value))}
                          className="w-full accent-amber-500 cursor-pointer"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] mb-0.5">
                          <span className="text-muted-foreground">Posição Y</span>
                          <span className="font-mono text-foreground font-bold">{selectedLayer.transform.y}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={selectedLayer.transform.y}
                          onChange={(e) => updateLayerTransform('y', Number(e.target.value))}
                          className="w-full accent-amber-500 cursor-pointer"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[10px] mb-0.5">
                        <span className="text-muted-foreground font-medium">Escala / Zoom</span>
                        <span className="font-mono text-foreground font-bold">{Math.round(selectedLayer.transform.scale * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min={0.3}
                        max={2.5}
                        step={0.05}
                        value={selectedLayer.transform.scale}
                        onChange={(e) => updateLayerTransform('scale', Number(e.target.value))}
                        className="w-full accent-amber-500 cursor-pointer"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-6">Selecione uma camada para editar.</p>
              )}
            </TabsContent>

            {/* Aba Camadas */}
            <TabsContent value="layers" className="flex-1 overflow-y-auto p-3 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <Label className="text-[11px] font-bold text-foreground">Camadas do Projeto</Label>
                <span className="text-[9px] text-muted-foreground font-mono">{project.layers.length} itens</span>
              </div>

              <div className="space-y-1.5">
                {project.layers.map((layer) => (
                  <div
                    key={layer.id}
                    onClick={() => setSelectedLayerId(layer.id)}
                    className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                      selectedLayerId === layer.id
                        ? 'border-amber-500 bg-amber-500/10 font-bold shadow-xs'
                        : 'border-border bg-background hover:border-muted-foreground/40'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <Badge variant="outline" className="text-[8px] uppercase px-1 py-0 border-zinc-500">
                        {layer.type}
                      </Badge>
                      <span className="text-[11px] truncate text-foreground">{layer.name}</span>
                    </div>

                    <div className="flex items-center gap-0.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setProject((prev) => ({
                            ...prev,
                            layers: prev.layers.map((l) => (l.id === layer.id ? { ...l, visible: !l.visible } : l)),
                          }));
                        }}
                        className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
                      >
                        <Eye size={13} className={layer.visible ? 'text-amber-500' : 'text-muted-foreground opacity-40'} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSelected(layer.id);
                        }}
                        className="h-5 w-5 p-0 text-red-500 hover:bg-red-500/10"
                      >
                        <Trash size={13} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Aba Publicação Multicanal */}
            <TabsContent value="publish" className="flex-1 overflow-y-auto p-3 space-y-3">
              <div>
                <Label className="text-[10px] font-bold text-foreground uppercase tracking-wider block mb-1.5">
                  Destinos de Publicação
                </Label>
                <div className="space-y-2">
                  <div className="p-2.5 rounded-xl border border-border bg-background space-y-1.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <InstagramLogo size={18} className="text-pink-500" />
                        <span className="text-[11px] font-bold text-foreground">Instagram</span>
                      </div>
                      <Switch
                        checked={project.publishing.instagram.enabled}
                        onCheckedChange={(checked) =>
                          setProject((prev) => ({
                            ...prev,
                            publishing: { ...prev.publishing, instagram: { ...prev.publishing.instagram, enabled: checked } },
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl border border-border bg-background flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-1.5">
                      <TiktokLogo size={18} className="text-cyan-500" />
                      <span className="text-[11px] font-bold text-foreground">TikTok</span>
                    </div>
                    <Switch
                      checked={project.publishing.tiktok.enabled}
                      onCheckedChange={(checked) =>
                        setProject((prev) => ({
                          ...prev,
                          publishing: { ...prev.publishing, tiktok: { ...prev.publishing.tiktok, enabled: checked } },
                        }))
                      }
                    />
                  </div>

                  <div className="p-2.5 rounded-xl border border-border bg-background flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-1.5">
                      <YoutubeLogo size={18} className="text-red-500" />
                      <span className="text-[11px] font-bold text-foreground">YouTube Shorts</span>
                    </div>
                    <Switch
                      checked={project.publishing.youtube.enabled}
                      onCheckedChange={(checked) =>
                        setProject((prev) => ({
                          ...prev,
                          publishing: { ...prev.publishing, youtube: { ...prev.publishing.youtube, enabled: checked } },
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              <Button
                onClick={handlePublishAll}
                disabled={isPending}
                className="w-full h-9 font-extrabold bg-amber-500 hover:bg-amber-600 text-zinc-950 shadow-md text-xs mt-1"
              >
                🚀 Publicar em Todas Simultaneamente
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* ── RODAPÉ COMPACTO: LINHA DO TEMPO MULTIPISTA REAL (ALTURA H-40) ──── */}
      <footer className="h-40 shrink-0 border-t border-border bg-card flex flex-col overflow-hidden shadow-lg z-10">
        {/* Timeline Toolbar */}
        <div className="flex items-center justify-between border-b border-border px-3 py-1 bg-muted/50">
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" onClick={handleSplitSegment} className="h-6 text-[10px] font-bold gap-1 text-foreground">
              <Scissors size={12} className="text-amber-500" /> Corte (Ctrl+X)
            </Button>
            <Button size="sm" variant="outline" onClick={handleDuplicateSelected} className="h-6 text-[10px] font-bold gap-1 text-foreground">
              <Copy size={12} className="text-blue-500" /> Duplicar (Ctrl+C)
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleDeleteSelected()} className="h-6 text-[10px] font-bold gap-1 text-red-500 border-red-200 dark:border-red-900">
              <Trash size={12} /> Deletar
            </Button>
          </div>
        </div>

        {/* Tracks Area */}
        <div
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left - 130;
            if (clickX > 0) {
              const width = rect.width - 130;
              const pct = Math.max(0, Math.min(1, clickX / width));
              const newTime = Number((pct * project.durationSeconds).toFixed(1));
              setProject((prev) => ({ ...prev, timeline: { ...prev.timeline, currentTime: newTime } }));
            }
          }}
          className="flex-1 overflow-x-auto overflow-y-auto p-2 space-y-1.5 relative bg-background cursor-pointer"
        >
          {/* Playhead Needle Line */}
          <div
            style={{ left: `calc(130px + ${(project.timeline.currentTime / project.durationSeconds) * 82}%)` }}
            className="absolute top-0 bottom-0 w-0.5 bg-amber-500 z-30 pointer-events-none flex flex-col items-center"
          >
            <div className="w-2.5 h-2.5 bg-amber-500 rotate-45 -mt-1 shadow-md" />
          </div>

          {project.timeline.tracks.map((track) => (
            <div key={track.id} className="flex items-center gap-2 text-xs">
              <div className="w-28 shrink-0 flex items-center justify-between px-2 py-0.5 rounded-lg bg-card border border-border shadow-xs">
                <span className="font-bold text-foreground truncate text-[10px]">{track.name}</span>
                {track.type === 'audio' ? <SpeakerHigh size={13} className="text-emerald-500" /> : <Layers size={13} className="text-amber-500" />}
              </div>

              <div className="flex-1 h-6 rounded-lg bg-muted/60 border border-border relative overflow-hidden flex items-center px-1">
                {track.segments.map((seg) => {
                  const leftPct = (seg.startTime / project.durationSeconds) * 100;
                  const widthPct = (seg.duration / project.durationSeconds) * 100;
                  const isSelected = selectedSegmentId === seg.id;

                  const trackColors: Record<string, string> = {
                    video: 'bg-blue-500/20 border-blue-500 text-blue-700 dark:text-blue-300',
                    image: 'bg-blue-500/20 border-blue-500 text-blue-700 dark:text-blue-300',
                    text: 'bg-purple-500/20 border-purple-500 text-purple-700 dark:text-purple-300',
                    caption: 'bg-amber-500/20 border-amber-500 text-amber-700 dark:text-amber-300',
                    audio: 'bg-emerald-500/20 border-emerald-500 text-emerald-700 dark:text-emerald-300',
                  };

                  return (
                    <div
                      key={seg.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSegmentId(seg.id);
                      }}
                      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                      className={`absolute h-5 rounded-md border px-1.5 text-[9px] font-bold flex items-center justify-between cursor-pointer truncate shadow-xs transition-transform ${
                        isSelected ? 'ring-2 ring-amber-500 scale-[1.01]' : ''
                      } ${trackColors[seg.mediaType] || 'bg-card border-border'}`}
                    >
                      <span className="truncate">{seg.mediaUrl}</span>
                      <span className="text-[8px] font-mono opacity-80">{seg.duration}s</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </footer>
    </div>
  );
}
