import type { CreateRenderJob } from '@media-lab/contracts';

export type MediaProcessingPlan = { ffprobeArgs: string[]; ffmpegArgs: string[] };

export function createMediaProcessingPlan(command: CreateRenderJob): MediaProcessingPlan {
  const { encoding, processing } = command;
  const filters: string[] = [];
  if (processing.subtitleMode === 'burn-in') filters.push('subtitles=subtitles.srt');
  if (processing.watermarkMode === 'visible')
    filters.push(
      "drawtext=text='MEDIA LAB':x=w-tw-32:y=h-th-32:fontsize=28:fontcolor=white:box=1:boxcolor=black@0.82:boxborderw=12",
    );
  if (processing.watermarkMode === 'dynamic')
    filters.push(
      "drawtext=text='%{pts\\:hms} · SESSION':x=w-tw-32:y=32:fontsize=28:fontcolor=white:box=1:boxcolor=black@0.82:boxborderw=12",
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
