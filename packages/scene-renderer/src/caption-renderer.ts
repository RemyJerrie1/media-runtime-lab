import { hamsterCaptionLines, type HamsterCaption } from '@media-lab/contracts';

// Preview and future frame export share these coordinates and this rasterizer.
export const CAPTION_FRAME = { width: 1280, height: 720, bottom: 40, padding: 16 } as const;
export const CAPTION_FONT = 'Hamster Noto Sans TC';
export function captionLayout(caption: HamsterCaption) {
  const lines = hamsterCaptionLines(caption.text);
  const lineHeight = caption.fontSize * 1.5;
  const width =
    Math.max(...lines.map((line) => Array.from(line).length)) * caption.fontSize +
    CAPTION_FRAME.padding * 2;
  const height = lines.length * lineHeight + CAPTION_FRAME.padding * 2;
  return {
    lines,
    lineHeight,
    width,
    height,
    x: (CAPTION_FRAME.width - width) / 2,
    y: CAPTION_FRAME.height - CAPTION_FRAME.bottom - height,
  };
}
export async function loadCaptionFont() {
  const face = new FontFace(CAPTION_FONT, 'url("/fonts/NotoSansTC.ttf")', { weight: '400' });
  await face.load();
  document.fonts.add(face);
  return () => document.fonts.delete(face);
}
export function drawCaption(canvas: HTMLCanvasElement, caption: HamsterCaption | null) {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('字幕畫布無法使用');
  context.clearRect(0, 0, CAPTION_FRAME.width, CAPTION_FRAME.height);
  if (!caption) return;
  const layout = captionLayout(caption);
  context.fillStyle = caption.background;
  context.fillRect(layout.x, layout.y, layout.width, layout.height);
  context.fillStyle = caption.color;
  context.font = `400 ${caption.fontSize}px "${CAPTION_FONT}"`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  layout.lines.forEach((line, row) => {
    const characters = Array.from(line);
    const left = (CAPTION_FRAME.width - characters.length * caption.fontSize) / 2;
    characters.forEach((character, column) =>
      context.fillText(
        character,
        left + (column + 0.5) * caption.fontSize,
        layout.y + CAPTION_FRAME.padding + (row + 0.5) * layout.lineHeight,
      ),
    );
  });
}
