/**
 * Modelo de uma campanha de email fatiado.
 *
 * Todas as coordenadas (y, height, x, width) são em pixels da imagem
 * ORIGINAL enviada pela Kátia. A conversão para a largura de exibição do
 * email (displayWidth, normalmente 600) acontece só na geração do HTML.
 */

export type ImageFormat = 'jpeg' | 'png';

export interface Cell {
  id: string;
  /** Deslocamento horizontal dentro da linha, em px da imagem original. */
  x: number;
  /** Largura em px da imagem original. */
  width: number;
  /** URL de destino. Vazio = imagem sem link. */
  href: string;
  /** Texto alternativo. */
  alt: string;
  format: ImageFormat;
}

export interface Row {
  id: string;
  /** Posição vertical do topo, em px da imagem original. */
  y: number;
  /** Altura em px da imagem original. */
  height: number;
  /** Colunas ordenadas da esquerda para a direita; somam a largura da imagem. */
  cells: Cell[];
}

export interface Project {
  version: 1;
  name: string;
  slug: string;
  createdAt: string;
  source: { width: number; height: number; filename: string };
  /** Largura em que o email é exibido (px CSS). */
  displayWidth: number;
  /** Cor de fundo ao redor do email. */
  backgroundColor: string;
  /** Texto oculto exibido na prévia da caixa de entrada. */
  preheader: string;
  /** Qualidade JPEG de 0 a 1. */
  jpegQuality: number;
  rows: Row[];
  /** Preenchidos pelo servidor ao publicar. */
  publishedBy?: string;
  publishedAt?: string;
  /** Base das imagens com que o HTML foi gerado (ex.: https://cdn.mktassets.com). */
  cdnBaseUrl?: string;
}

export interface SliceRef {
  cellId: string;
  rowIndex: number;
  colIndex: number;
  /** Nome do arquivo no bucket (ex.: 02-b.png). */
  filename: string;
  format: ImageFormat;
  /** Retângulo na imagem original. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PublishResult {
  slug: string;
  previewUrl: string;
  cdnBaseUrl: string;
}

export interface CampaignSummary {
  slug: string;
  name: string;
  createdAt: string;
}

let counter = 0;
export function newId(prefix = 'id'): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function newCell(x: number, width: number, format: ImageFormat = 'jpeg'): Cell {
  return { id: newId('c'), x, width, href: '', alt: '', format };
}

export function newRow(y: number, height: number, imageWidth: number): Row {
  return { id: newId('r'), y, height, cells: [newCell(0, imageWidth)] };
}

export function newProject(
  name: string,
  slug: string,
  source: Project['source'],
): Project {
  return {
    version: 1,
    name,
    slug,
    createdAt: new Date().toISOString(),
    source,
    displayWidth: defaultDisplayWidth(source.width),
    backgroundColor: '#ffffff',
    preheader: '',
    jpegQuality: 0.85,
    rows: [newRow(0, source.height, source.width)],
  };
}

/** Artes de 1200px (retina) exibem a 600px; artes menores exibem no tamanho real até 600px. */
export function defaultDisplayWidth(sourceWidth: number): number {
  return Math.min(600, sourceWidth >= 1000 ? Math.round(sourceWidth / 2) : sourceWidth);
}
