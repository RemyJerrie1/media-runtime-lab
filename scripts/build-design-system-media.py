from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MEDIA = ROOT / "docs" / "media"
FRAMES = MEDIA / "design-system-frames"


def encode_video(frames: list[Path], target: Path, fps: int = 2) -> None:
    first = Image.open(frames[0]).convert("RGB")
    width, height = first.size
    width -= width % 2
    height -= height % 2
    staging = Path(tempfile.gettempdir()) / "media-runtime-design-system"
    if staging.exists():
        shutil.rmtree(staging)
    staging.mkdir(parents=True)
    for index, frame in enumerate(frames):
        Image.open(frame).convert("RGB").save(staging / f"frame-{index:02d}.png", format="PNG")
    staged_target = staging / "output.mp4"
    subprocess.run([
        "ffmpeg", "-y", "-framerate", str(fps),
        "-i", str(staging / "frame-%02d.png"), "-vf", f"scale={width}:{height}", "-c:v", "libx264",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(staged_target),
    ], check=True, capture_output=True)
    shutil.copy2(staged_target, target)
    shutil.rmtree(staging)


def main() -> None:
    frames = sorted(FRAMES.glob("frame-*.png"))
    if not frames:
        raise RuntimeError("No design-system frames were captured")
    images = [Image.open(path).convert("P", palette=Image.Palette.ADAPTIVE, colors=128) for path in frames]
    durations = [650, 450, 450, 700, 450, 450, 450, 700, 500, 500, 500, 850]
    images[0].save(
        MEDIA / "design-system-showcase.gif", save_all=True, append_images=images[1:],
        duration=durations[:len(images)], loop=0, optimize=True,
    )
    encode_video(frames, MEDIA / "design-system-showcase.mp4")
    for suffix in ("gif", "mp4"):
        target = MEDIA / f"design-system-showcase.{suffix}"
        print(f"{target.name}: {target.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()