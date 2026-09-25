import { Platform } from 'react-native';

export async function compressImageDataUrl(dataUrl: string): Promise<string> {
  if (Platform.OS !== 'web') return dataUrl;
  return new Promise((resolve, reject) => {
    const image = new (window as any).Image();
    image.onload = () => {
      const maxSize = 192;
      const scale = Math.min(maxSize / image.width, maxSize / image.height, 1);
      const w = Math.max(1, Math.round(image.width * scale));
      const h = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('canvas error')); return; }
      ctx.drawImage(image, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.6));
    };
    image.onerror = () => reject(new Error('load error'));
    image.src = dataUrl;
  });
}
