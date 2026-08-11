from __future__ import annotations

import re
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parents[1]
MEDIA = ROOT / "docs" / "media"
FRAMES = MEDIA / "product-frames"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    name = "consolab.ttf" if bold else "consola.ttf"
    return ImageFont.truetype(str(Path("C:/Windows/Fonts") / name), size)


def encode_video(frames: list[Path], target: Path, fps: int = 4) -> None:
    first = Image.open(frames[0]).convert("RGB")
    width, height = first.size
    width -= width % 2
    height -= height % 2
    staging = Path(tempfile.gettempdir()) / f"media-runtime-{target.stem}"
    if staging.exists():
        shutil.rmtree(staging)
    staging.mkdir(parents=True)
    for index, frame in enumerate(frames):
        Image.open(frame).convert("RGB").save(staging / f"frame-{index:02d}.png", format="PNG")
    staged_target = staging / "output.mp4"
    command = [
        imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-framerate", str(fps),
        "-i", str(staging / "frame-%02d.png"),
        "-vf", f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(staged_target),
    ]
    subprocess.run(command, check=True, capture_output=True)
    shutil.copy2(staged_target, target)
    shutil.rmtree(staging)


def build_product_media() -> None:
    frames = sorted(FRAMES.glob("frame-*.png"))
    overview = MEDIA / "product-overview.png"
    overview_image = Image.open(overview).convert("RGB")
    frame_width, frame_height = Image.open(frames[0]).size
    overview_image = overview_image.crop((0, 0, frame_width, frame_height))
    overview_image.save(overview, format="PNG", optimize=True)
    images = [Image.open(path).convert("P", palette=Image.Palette.ADAPTIVE, colors=128) for path in frames]
    images[0].save(MEDIA / "product-demo.gif", save_all=True, append_images=images[1:], duration=250, loop=0, optimize=True)
    encode_video(frames, MEDIA / "product-demo.mp4", fps=4)


def bruno_output() -> str:
    command = [str(ROOT / "node_modules" / ".bin" / "bru.cmd"), "run", "render-jobs", "--env", "local"]
    result = subprocess.run(command, cwd=ROOT / "bruno", capture_output=True, text=True, encoding="utf-8")
    output = re.sub(r"\x1b\[[0-9;]*m", "", result.stdout + result.stderr).strip()
    if result.returncode != 0:
        raise RuntimeError(output)
    return output


def terminal_frame(lines: list[str], visible: int, target: Path) -> None:
    width, height = 1440, 900
    image = Image.new("RGB", (width, height), "#080b12")
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((30, 30, width - 30, height - 30), radius=22, fill="#0e1623", outline="#2b3b50", width=2)
    draw.ellipse((62, 60, 78, 76), fill="#ff6b6b")
    draw.ellipse((88, 60, 104, 76), fill="#f1ae79")
    draw.ellipse((114, 60, 130, 76), fill="#5bd7e8")
    draw.text((62, 104), "BRUNO CONTRACT VERIFICATION", font=font(22, True), fill="#5bd7e8")
    draw.text((62, 140), "$ bru run render-jobs --env local", font=font(18), fill="#9eacba")
    y = 190
    for line in lines[:visible]:
        line = line.replace("✓ PASS", "PASS").replace("✓", "[PASS]").replace("✕", "[FAIL]").replace("📊", "")
        color = "#79d29d" if "PASS" in line or "✓" in line else "#f3eee8"
        if "Summary" in line or "Tests" == line.strip():
            color = "#f1ae79"
        draw.text((62, y), line[:112], font=font(17), fill=color)
        y += 27
        if y > height - 70:
            break
    image.save(target)


def build_bruno_media() -> None:
    output = bruno_output()
    lines = [line.rstrip() for line in output.splitlines() if line.strip()]
    frame_dir = MEDIA / "bruno-frames"
    frame_dir.mkdir(parents=True, exist_ok=True)
    frame_count = 14
    for index in range(frame_count):
        visible = max(2, round(len(lines) * (index + 1) / frame_count))
        terminal_frame(lines, visible, frame_dir / f"frame-{index:02d}.png")
    final = frame_dir / f"frame-{frame_count - 1:02d}.png"
    Image.open(final).save(MEDIA / "bruno-contract-tests.png")
    frames = sorted(frame_dir.glob("frame-*.png"))
    images = [Image.open(path).convert("P", palette=Image.Palette.ADAPTIVE, colors=128) for path in frames]
    images[0].save(MEDIA / "bruno-contract-tests.gif", save_all=True, append_images=images[1:], duration=240, loop=0, optimize=True)
    encode_video(frames, MEDIA / "bruno-contract-tests.mp4", fps=4)


if __name__ == "__main__":
    build_product_media()
    build_bruno_media()
    for artifact in sorted(MEDIA.glob("*")):
        if artifact.is_file():
            print(f"{artifact.name}: {artifact.stat().st_size:,} bytes")
