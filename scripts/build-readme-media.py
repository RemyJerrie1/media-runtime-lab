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
COMPOSITION_FRAMES = MEDIA / "composition-frames"
COST_FRAMES = MEDIA / "cost-frames"


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
    overview_image = Image.open(frames[-1]).convert("RGB")
    frame_width, frame_height = Image.open(frames[0]).size
    overview_image = overview_image.crop((0, 0, frame_width, frame_height))
    overview_image.save(overview, format="PNG", optimize=True)
    images = [Image.open(path).convert("P", palette=Image.Palette.ADAPTIVE, colors=128) for path in frames]
    images[0].save(MEDIA / "product-demo.gif", save_all=True, append_images=images[1:], duration=160, loop=0, optimize=True)
    encode_video(frames, MEDIA / "product-demo.mp4", fps=6)

    lifecycle_dir = MEDIA / "lifecycle-frames"
    lifecycle_dir.mkdir(parents=True, exist_ok=True)
    lifecycle_frames: list[Path] = []
    for index, path in enumerate(frames):
        source = Image.open(path).convert("RGB")
        width, height = source.size
        crop = source.crop((width * 0.42, height * 0.26, width * 0.98, height * 0.78))
        crop = crop.resize((1120, 680), Image.Resampling.LANCZOS)
        target = lifecycle_dir / f"frame-{index:02d}.png"
        crop.save(target, optimize=True)
        lifecycle_frames.append(target)
    lifecycle_images = [Image.open(path).convert("P", palette=Image.Palette.ADAPTIVE, colors=128) for path in lifecycle_frames]
    lifecycle_images[0].save(MEDIA / "render-lifecycle.gif", save_all=True, append_images=lifecycle_images[1:], duration=160, loop=0, optimize=True)
    encode_video(lifecycle_frames, MEDIA / "render-lifecycle.mp4", fps=6)


def build_composition_media() -> None:
    frames = sorted(COMPOSITION_FRAMES.glob("frame-*.png"))
    images = [Image.open(path).convert("P", palette=Image.Palette.ADAPTIVE, colors=128) for path in frames]
    images[0].save(MEDIA / "composition-showcase.gif", save_all=True, append_images=images[1:], duration=300, loop=0, optimize=True)
    encode_video(frames, MEDIA / "composition-showcase.mp4", fps=4)


def build_cost_media() -> None:
    frames = sorted(COST_FRAMES.glob("frame-*.png"))
    images = [Image.open(path).convert("P", palette=Image.Palette.ADAPTIVE, colors=128) for path in frames]
    images[0].save(MEDIA / "ai-cost-governance.gif", save_all=True, append_images=images[1:], duration=360, loop=0, optimize=True)
    encode_video(frames, MEDIA / "ai-cost-governance.mp4", fps=3)


def api_contract_frame(step: int, target: Path) -> None:
    width, height = 1440, 820
    image = Image.new("RGB", (width, height), "#080b12")
    draw = ImageDraw.Draw(image)
    draw.text((72, 64), "RENDER CONTROL PLANE", font=font(23, True), fill="#5bd7e8")
    draw.text((72, 108), "One contract · four verification surfaces", font=font(38, True), fill="#f3eee8")
    endpoints = [
        ("POST", "/v1/render-jobs", "Idempotent command", "#79d29d"),
        ("GET", "/v1/render-jobs/:id", "Authoritative state", "#5bd7e8"),
        ("SSE", "/v1/render-jobs/:id/events", "Progress + recovery", "#f1ae79"),
    ]
    for index, (method, path, purpose, color) in enumerate(endpoints):
        y = 205 + index * 150
        active = index <= step
        outline = color if active else "#26364a"
        text_color = "#f3eee8" if active else "#657487"
        draw.rounded_rectangle((72, y, 1368, y + 112), radius=18, fill="#0e1623", outline=outline, width=3 if active else 2)
        draw.rounded_rectangle((98, y + 28, 220, y + 83), radius=12, fill=outline if active else "#172232")
        draw.text((120, y + 43), method, font=font(20, True), fill="#081018" if active else "#657487")
        draw.text((258, y + 26), path, font=font(24, True), fill=text_color)
        draw.text((258, y + 65), purpose, font=font(18), fill="#9eacba" if active else "#657487")
    labels = ["ZOD SCHEMA", "NESTJS", "NEXT.JS", "BRUNO"]
    for index, label in enumerate(labels):
        x = 72 + index * 322
        enabled = step >= 3 + index
        draw.rounded_rectangle((x, 690, x + 280, 752), radius=14, fill="#122131" if enabled else "#0e1623", outline="#b993e8" if enabled else "#26364a", width=2)
        draw.text((x + 24, 710), label, font=font(18, True), fill="#e8d9ff" if enabled else "#657487")
    image.save(target, optimize=True)


def build_api_contract_media() -> None:
    frame_dir = MEDIA / "api-contract-frames"
    frame_dir.mkdir(parents=True, exist_ok=True)
    frames: list[Path] = []
    for index in range(7):
        target = frame_dir / f"frame-{index:02d}.png"
        api_contract_frame(index, target)
        frames.append(target)
    images = [Image.open(path).convert("P", palette=Image.Palette.ADAPTIVE, colors=128) for path in frames]
    images[0].save(MEDIA / "api-contract.gif", save_all=True, append_images=images[1:], duration=520, loop=0, optimize=True)
    encode_video(frames, MEDIA / "api-contract.mp4", fps=2)


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
    build_composition_media()
    build_cost_media()
    build_api_contract_media()
    build_bruno_media()
    for artifact in sorted(MEDIA.glob("*")):
        if artifact.is_file():
            print(f"{artifact.name}: {artifact.stat().st_size:,} bytes")
