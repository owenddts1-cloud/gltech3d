export type AspectRatio = '9:16' | '4:5' | '1:1' | '16:9';
export type LayerType = 'video' | 'image' | 'text' | 'caption' | 'audio' | 'shape';
export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten';

export interface FilterSettings {
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  sepia: number;
  hueRotate: number;
  removeBackground: boolean;
}

export interface TransformSettings {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
  blendMode: BlendMode;
  zIndex: number;
}

export interface TimelineTrackSegment {
  id: string;
  mediaUrl: string;
  mediaType: LayerType;
  startTime: number;
  duration: number;
  mediaOffset: number;
  speed: number;
  volume: number;
}

export interface TextLayer {
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  backgroundColor?: string;
  fontWeight: 'normal' | 'bold' | '900';
  align: 'left' | 'center' | 'right';
  animation: 'none' | 'fade' | 'pop' | 'typewriter' | 'bounce';
}

export interface CaptionWord {
  word: string;
  start: number;
  end: number;
  highlight: boolean;
}

export interface CaptionTrack {
  words: CaptionWord[];
  style: {
    fontFamily: string;
    fontSize: number;
    activeColor: string;
    inactiveColor: string;
    bgStyle: 'none' | 'box' | 'shadow' | 'outline';
    emojiPlacement: boolean;
  };
}

export interface ChannelPublishingConfig {
  enabled: boolean;
  customCaption: string;
  hashtags: string[];
  scheduledAt?: string;
}

export interface VideoProjectState {
  id: string;
  organizationId: string;
  title: string;
  aspectRatio: AspectRatio;
  resolution: { width: number; height: number };
  durationSeconds: number;
  fps: number;
  layers: Array<{
    id: string;
    name: string;
    type: LayerType;
    visible: boolean;
    locked: boolean;
    transform: TransformSettings;
    filters: FilterSettings;
    content: {
      src?: string;
      textData?: TextLayer;
    };
  }>;
  timeline: {
    currentTime: number;
    tracks: Array<{
      id: string;
      name: string;
      type: LayerType;
      muted: boolean;
      locked: boolean;
      segments: TimelineTrackSegment[];
    }>;
  };
  captions?: CaptionTrack;
  thumbnail: {
    timestamp: number;
    customImageUrl?: string;
  };
  publishing: {
    instagram: ChannelPublishingConfig & { postType: 'reels' | 'story' | 'feed' | 'carrossel' };
    tiktok: ChannelPublishingConfig & { allowDuet: boolean; allowStitch: boolean };
    youtube: ChannelPublishingConfig & { categoryId: string; privacy: 'public' | 'unlisted' };
  };
  createdAt: string;
  updatedAt: string;
}
