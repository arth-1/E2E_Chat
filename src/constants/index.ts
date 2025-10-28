export const LIGHT_COLORS = {
  primary: '#6366f1',
  secondary: '#8b5cf6',
  accent: '#ec4899',
  background: '#f8fafc',
  surface: '#f1f5f9',
  surfaceLight: '#e2e8f0',
  text: '#1e293b',
  textSecondary: '#64748b',
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
  border: '#cbd5e1',
};

export const DARK_COLORS = {
  primary: '#7c83ff',
  secondary: '#a78bfa',
  accent: '#f472b6',
  background: '#0b1220',
  surface: 'rgba(17, 25, 40, 0.65)',
  surfaceLight: 'rgba(255, 255, 255, 0.06)',
  text: '#e5e7eb',
  textSecondary: '#9ca3af',
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
  border: 'rgba(148, 163, 184, 0.25)',
  glassBorder: 'rgba(255, 255, 255, 0.12)',
  glassOverlay: 'rgba(255, 255, 255, 0.06)',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const FONT_SIZE = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const STORAGE_BUCKETS = {
  USER_AVATARS: 'user-avatars',
  MESSAGE_MEDIA: 'message-media',
  STICKERS: 'stickers',
};

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB (legacy default)
export const MAX_FILE_SIZE_NATIVE = 25 * 1024 * 1024; // 25MB for mobile (to reduce OOM risk)
export const MAX_FILE_SIZE_WEB = 200 * 1024 * 1024; // 200MB for browser uploads
export const SUPPORTED_IMAGE_FORMATS = ['image/jpeg', 'image/png', 'image/webp'];
export const SUPPORTED_VIDEO_FORMATS = ['video/mp4', 'video/quicktime'];
