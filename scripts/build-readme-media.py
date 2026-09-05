from __future__ import annotations

import re
import math
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
RELIABILITY_FRAMES = MEDIA / "reliability-frames"


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
    width, height, fps, seconds = 1280, 720, 12, 8
    meadow = Image.open(MEDIA / "demo-assets" / "healing-meadow.png").convert("RGB")
    meadow = meadow.resize((width, height), Image.Resampling.LANCZOS)
    sheet = Image.open(MEDIA / "demo-assets" / "hamster-walk-cycle.png").convert("RGBA")
    cell_width = sheet.width // 6
    poses = [sheet.crop((index * cell_width, 0, (index + 1) * cell_width, sheet.height)) for index in range(6)]
    title_font = ImageFont.truetype("C:/Windows/Fonts/msjhbd.ttc", 42)
    caption_font = ImageFont.truetype("C:/Windows/Fonts/msjh.ttc", 25)
    captions = [
        (0, 32, "帶著好心情，出發。"),
        (32, 64, "每一步，都有可靠流程接住。"),
        (64, 96, "從素材到串流，安心交付。"),
    ]
    staging = Path(tempfile.gettempdir()) / "media-runtime-hamster-walk"
    if staging.exists():
        shutil.rmtree(staging)
    staging.mkdir(parents=True)
    video_frames: list[Path] = []
    gif_images: list[Image.Image] = []
    for index in range(fps * seconds):
        image = meadow.copy().convert("RGBA")
        draw = ImageDraw.Draw(image, "RGBA")
        pose = poses[index % len(poses)]
        pose_height = 350
        pose_width = round(pose.width * pose_height / pose.height)
        pose = pose.resize((pose_width, pose_height), Image.Resampling.LANCZOS)
        progress = index / (fps * seconds - 1)
        x = round(70 + progress * (width - pose_width - 140))
        y = 244 + round(math.sin(index * math.pi / 3) * 5)
        image.alpha_composite(pose, (x, y))
        caption = next(text for start, end, text in captions if start <= index < end)
        box = draw.textbbox((0, 0), caption, font=title_font)
        text_width = box[2] - box[0]
        panel_left = (width - text_width) // 2 - 30
        panel_right = (width + text_width) // 2 + 30
        draw.rounded_rectangle((panel_left, 618, panel_right, 690), radius=20, fill=(8, 23, 33, 205))
        draw.text(((width - text_width) // 2, 630), caption, font=title_font, fill=(255, 255, 255, 255))
        draw.text((42, 34), "DREAMY MEDIA DELIVERY", font=caption_font, fill=(8, 23, 33, 220))
        frame = image.convert("RGB")
        target = staging / f"frame-{index:03d}.png"
        frame.save(target, optimize=True)
        video_frames.append(target)
        if index % 2 == 0:
            gif_images.append(frame.resize((768, 432), Image.Resampling.LANCZOS).convert("P", palette=Image.Palette.ADAPTIVE, colors=128))
    gif_images[0].save(MEDIA / "product-demo.gif", save_all=True, append_images=gif_images[1:], duration=round(2000 / fps), loop=0, optimize=True)
    shutil.copy2(video_frames[-1], MEDIA / "product-overview.png")
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    silent = staging / "silent.mp4"
    subprocess.run([ffmpeg, "-y", "-framerate", str(fps), "-i", str(staging / "frame-%03d.png"), "-c:v", "libx264", "-pix_fmt", "yuv420p", str(silent)], check=True, capture_output=True)
    subprocess.run([
        ffmpeg, "-y", "-i", str(silent), "-f", "lavfi", "-i", "sine=frequency=523:duration=8:sample_rate=48000",
        "-filter_complex", "[1:a]volume=0.035,afade=t=in:st=0:d=0.8,afade=t=out:st=7:d=1[a]",
        "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-shortest", "-movflags", "+faststart", str(MEDIA / "product-demo.mp4")
    ], check=True, capture_output=True)
    shutil.rmtree(staging)

    frames = sorted(FRAMES.glob("frame-*.png"))
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


def reliability_frame(step: int, target: Path) -> None:
    width, height = 1440, 820
    image = Image.new("RGB", (width, height), "#080b12")
    draw = ImageDraw.Draw(image)
    draw.text((66, 55), "RELIABILITY & RECOVERY", font=font(20, True), fill="#5bd7e8")
    draw.text((66, 94), "One job identity across retries and reconnects", font=font(35, True), fill="#f3eee8")
    stages = [
        ("COMMAND", "POST + Idempotency-Key"),
        ("DEDUPLICATION", "same key -> same job"),
        ("JOB STATE", "accepted -> processing"),
        ("LIVE PROGRESS", "SSE stream"),
        ("RECOVERY", "authoritative GET"),
        ("ARTIFACT", "ready + checksum"),
    ]
    active = min(step // 2, len(stages) - 1)
    card_width = 196
    gap = 24
    start_x = 66
    y = 235
    for index, (title, detail) in enumerate(stages):
        x = start_x + index * (card_width + gap)
        color = "#5bd7e8" if index == active else "#2c3e53"
        fill = "#102532" if index == active else "#101724"
        draw.rounded_rectangle((x, y, x + card_width, y + 150), radius=16, fill=fill, outline=color, width=3 if index == active else 2)
        draw.text((x + 18, y + 26), f"0{index + 1}", font=font(14, True), fill=color)
        draw.text((x + 18, y + 56), title, font=font(16, True), fill="#f3eee8")
        draw.text((x + 18, y + 98), detail, font=font(12), fill="#9eacba")
        if index < len(stages) - 1:
            arrow_x = x + card_width + 5
            draw.line((arrow_x, y + 75, arrow_x + gap - 10, y + 75), fill="#5bd7e8", width=3)
            draw.polygon([(arrow_x + gap - 10, y + 69), (arrow_x + gap - 10, y + 81), (arrow_x + gap - 2, y + 75)], fill="#5bd7e8")

    captions = [
        ("ORIGINAL COMMAND", "Render request accepted with job_72C1"),
        ("RETRY-SAFE COMMAND", "A repeated POST carries the same Idempotency-Key"),
        ("NO DUPLICATE WORK", "The existing Job Identity is returned"),
        ("STATE TRANSITION", "The worker advances persisted job state"),
        ("LIVE DELIVERY", "Progress is streamed to the client over SSE"),
        ("CONNECTION INTERRUPTION", "The UI does not invent replacement state"),
        ("AUTHORITATIVE READ", "GET /render-jobs/job_72C1 restores server truth"),
        ("STREAM CONTINUES", "The same Job Identity resumes progress"),
        ("ARTIFACT REGISTRATION", "Checksum and delivery metadata are recorded"),
        ("READY", "One command, one job, one delivery receipt"),
        ("OBSERVABLE RESULT", "Retries and reconnects remain traceable"),
        ("RECOVERY COMPLETE", "No duplicate execution and no lost progress"),
    ]
    label, message = captions[step]
    draw.rounded_rectangle((66, 455, 1374, 650), radius=20, fill="#0e1623", outline="#31465e", width=2)
    draw.text((96, 490), label, font=font(17, True), fill="#f1ae79" if step == 5 else "#5bd7e8")
    draw.text((96, 535), message, font=font(25, True), fill="#f3eee8")
    badges = ["IDEMPOTENCY", "PERSISTED STATE", "SSE + GET RECOVERY", "ARTIFACT RECEIPT"]
    for index, badge in enumerate(badges):
        x = 66 + index * 325
        draw.rounded_rectangle((x, 700, x + 290, 756), radius=12, fill="#111c2a", outline="#38516b", width=2)
        draw.text((x + 22, 718), badge, font=font(15, True), fill="#b9c8d8")
    image.save(target, optimize=True)


def build_reliability_media() -> None:
    RELIABILITY_FRAMES.mkdir(parents=True, exist_ok=True)
    frames: list[Path] = []
    for index in range(12):
        target = RELIABILITY_FRAMES / f"frame-{index:02d}.png"
        reliability_frame(index, target)
        frames.append(target)
    images = [Image.open(path).convert("P", palette=Image.Palette.ADAPTIVE, colors=128) for path in frames]
    images[0].save(MEDIA / "reliability-recovery.gif", save_all=True, append_images=images[1:], duration=650, loop=0, optimize=True)
    encode_video(frames, MEDIA / "reliability-recovery.mp4", fps=2)


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
    build_reliability_media()
    build_api_contract_media()
    build_bruno_media()
    for artifact in sorted(MEDIA.glob("*")):
        if artifact.is_file():
            print(f"{artifact.name}: {artifact.stat().st_size:,} bytes")
