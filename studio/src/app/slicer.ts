import { slices } from '../shared/geometry';
import type { Project } from '../shared/model';

export interface LoadedImage {
  file: File;
  url: string;
  width: number;
  height: number;
  element: HTMLImageElement;
}

export async function loadImage(file: File): Promise<LoadedImage> {
  const url = URL.createObjectURL(file);
  const element = new Image();
  element.src = url;
  await element.decode();
  return { file, url, width: element.naturalWidth, height: element.naturalHeight, element };
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar a fatia.'))), type, quality);
  });
}

/** Recorta todas as fatias no navegador. Retorna mapa nome do arquivo → Blob. */
export async function sliceAll(
  image: LoadedImage,
  project: Project,
  onProgress?: (done: number, total: number) => void,
): Promise<Map<string, Blob>> {
  const refs = slices(project);
  const out = new Map<string, Blob>();
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) throw new Error('Canvas indisponível.');
  let done = 0;
  for (const r of refs) {
    canvas.width = r.width;
    canvas.height = r.height;
    ctx.clearRect(0, 0, r.width, r.height);
    if (r.format === 'jpeg') {
      // JPEG não tem transparência: preenche com a cor de fundo do email.
      ctx.fillStyle = project.backgroundColor || '#ffffff';
      ctx.fillRect(0, 0, r.width, r.height);
    }
    ctx.drawImage(image.element, r.x, r.y, r.width, r.height, 0, 0, r.width, r.height);
    const blob =
      r.format === 'jpeg' ? await toBlob(canvas, 'image/jpeg', project.jpegQuality) : await toBlob(canvas, 'image/png');
    out.set(r.filename, blob);
    done += 1;
    onProgress?.(done, refs.length);
  }
  return out;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
