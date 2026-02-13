import crypto from 'crypto';

// Generate a unique share code for albums
export function generateShareCode() {
  return crypto.randomBytes(8).toString('hex');
}

// Generate a verification token
export function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Format date for display
export function formatDate(date) {
  return new Date(date).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Calculate default expiry (24 hours from now)
export function getDefaultExpiry() {
  const date = new Date();
  date.setHours(date.getHours() + 24);
  return date;
}

// Format file size
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Generate album title with current timestamp
export function generateAlbumTitle() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}`;
}
