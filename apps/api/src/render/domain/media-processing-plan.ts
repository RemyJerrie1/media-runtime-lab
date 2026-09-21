import { WATERMARK_PRESENTATION, type CreateRenderJob } from '@media-lab/contracts';

export type MediaProcessingPlan = { ffprobeArgs: string[]; ffmpegArgs: string[] };

type ProcessingCommand = Pick<
  CreateRenderJob,
  'encoding' | 'processing' | 'trimStartSeconds' | 'durationSeconds'
>;

export function createMediaProcessingPlan(command: ProcessingCommand): MediaProcessingPlan {
  const { encoding, processing } = command;
  const watermark = WATERMARK_PRESENTATION;
  const filters: string[] = [];
  if (processing.subtitleMode === 'burn-in') filters.push('subtitles=subtitles.srt');
  if (processing.watermarkMode === 'visible')
    filters.push(
      `drawtext=text='${watermark.fixedText}':x=w-tw-${watermark.edgeOffset}:y=h-th-${watermark.edgeOffset}:fontsize=${watermark.fontSize}:fontcolor=white:box=1:boxcolor=black@${watermark.boxOpacity}:boxborderw=${watermark.boxPadding}`,
    );
  if (processing.watermarkMode === 'dynamic')
    filters.push(
      `drawtext=text='%{pts\\:hms} · ${watermark.dynamicSuffix}':x=w-tw-${watermark.edgeOffset}:y=${watermark.edgeOffset}:fontsize=${watermark.fontSize}:fontcolor=white:box=1:boxcolor=black@${watermark.boxOpacity}:boxborderw=${watermark.boxPadding}`,
    );
  const ffmpegArgs = [
    '-ss',
    String(command.trimStartSeconds),
    '-i',
    'input.mp4',
    '-t',
    String(command.durationSeconds),
  ];
  if (filters.length) ffmpegArgs.push('-vf', filters.join(','));
  ffmpegArgs.push('-c:v', encoding.codec, '-preset', encoding.preset);
  ffmpegArgs.push(
    encoding.rateControl === 'crf' ? '-crf' : '-b:v',
    encoding.rateControl === 'crf' ? String(encoding.crf) : `${encoding.bitrateKbps}k`,
    '-g',
    String(encoding.gop),
  );
  if (processing.frameRateMode === 'cfr')
    ffmpegArgs.push('-r', String(encoding.fps), '-fps_mode', 'cfr');
  ffmpegArgs.push('-c:a', 'aac', '-ar', String(processing.audioSampleRate));
  if (processing.audioSync === 'async-resample')
    ffmpegArgs.push('-af', 'aresample=async=1:first_pts=0');
  if (processing.fastStart) ffmpegArgs.push('-movflags', '+faststart');
  if (processing.subtitleMode === 'webvtt') ffmpegArgs.push('-c:s', 'webvtt');
  if (processing.adInsertion !== 'none')
    ffmpegArgs.push('-metadata', `ad_insertion=${processing.adInsertion}`);
  ffmpegArgs.push('-pix_fmt', 'yuv420p', 'output.mp4');
  return {
    ffprobeArgs: ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', 'input.mp4'],
    ffmpegArgs,
  };
}

export function createRenditionProcessingPlan(
  command: ProcessingCommand,
  rendition: { width: number; height: number; bitrateKbps: number },
): MediaProcessingPlan {
  const plan = createMediaProcessingPlan({
    ...command,
    encoding: { ...command.encoding, rateControl: 'bitrate', bitrateKbps: rendition.bitrateKbps },
  });
  const args = plan.ffmpegArgs;
  const scale = `scale=${rendition.width}:${rendition.height}:force_original_aspect_ratio=decrease,pad=${rendition.width}:${rendition.height}:(ow-iw)/2:(oh-ih)/2`;
  const filterIndex = args.indexOf('-vf');
  if (filterIndex >= 0) args[filterIndex + 1] = `${scale},${args[filterIndex + 1]}`;
  else args.splice(args.length - 1, 0, '-vf', scale);
  args.splice(
    args.length - 1,
    0,
    '-maxrate',
    `${Math.round(rendition.bitrateKbps * 1.07)}k`,
    '-bufsize',
    `${rendition.bitrateKbps * 2}k`,
    '-keyint_min',
    String(command.encoding.gop),
    '-sc_threshold',
    '0',
  );
  return plan;
}
