from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
MEDIA = ROOT / "docs" / "media"
W, H = 1200, 675
INK = "#10213a"
MUTED = "#597089"
CYAN = "#58cfdf"
PEACH = "#f4ad7a"
MINT = "#78d2a1"
LILAC = "#bca4ea"
CREAM = "#fffaf3"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    name = "msjhbd.ttc" if bold else "msjh.ttc"
    return ImageFont.truetype(str(Path("C:/Windows/Fonts") / name), size)


def base(kicker: str, title: str, step: int, total: int) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    image = Image.new("RGB", (W, H), "#eaf5f7")
    draw = ImageDraw.Draw(image)
    for y in range(H):
        ratio = y / H
        color = (int(234 + 19 * ratio), int(245 + 7 * ratio), int(247 - 4 * ratio))
        draw.line((0, y, W, y), fill=color)
    draw.ellipse((900, -170, 1280, 210), fill="#f7d8c3")
    draw.ellipse((-140, 475, 180, 795), fill="#cdeee5")
    draw.rounded_rectangle((28, 26, W - 28, H - 26), radius=34, fill="#fdfbf8", outline="#b8d9df", width=2)
    draw.text((66, 58), kicker, font=font(17, True), fill="#08788a")
    draw.text((66, 92), title, font=font(34, True), fill=INK)
    draw.text((1030, 66), f"{step + 1:02d} / {total:02d}", font=font(16, True), fill=MUTED)
    return image, draw


def card(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], title: str, detail: str, active: bool, accent: str = CYAN) -> None:
    x1, y1, x2, y2 = box
    draw.rounded_rectangle(box, radius=22, fill="#ffffff" if active else "#f4f7f8", outline=accent if active else "#cfdae2", width=4 if active else 2)
    draw.text((x1 + 24, y1 + 24), title, font=font(20, True), fill=INK if active else MUTED)
    draw.text((x1 + 24, y1 + 67), detail, font=font(15), fill=MUTED)


def encode(frames: list[Path], name: str, duration: int = 560) -> None:
    images = [Image.open(path).convert("P", palette=Image.Palette.ADAPTIVE, colors=128) for path in frames]
    images[0].save(MEDIA / f"{name}.gif", save_all=True, append_images=images[1:], duration=duration, loop=0, optimize=True)
    candidates = list((ROOT / "node_modules" / ".pnpm").glob("ffmpeg-static@*/node_modules/ffmpeg-static/ffmpeg.exe"))
    if not candidates:
        raise RuntimeError("ffmpeg-static executable not found; run pnpm install first")
    ffmpeg = str(candidates[0])
    subprocess.run([
        ffmpeg, "-y", "-framerate", "2", "-i", str(frames[0].parent / "frame-%02d.png"),
        "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(MEDIA / f"{name}.mp4")
    ], check=True, capture_output=True)


def pipeline(name: str, kicker: str, title: str, stages: list[tuple[str, str]], accent: str = CYAN) -> None:
    folder = Path(tempfile.gettempdir()) / f"dreamy-{name}"
    if folder.exists(): shutil.rmtree(folder)
    folder.mkdir()
    frames: list[Path] = []
    gap = 14
    width = (W - 132 - gap * (len(stages) - 1)) // len(stages)
    for step in range(len(stages)):
        image, draw = base(kicker, title, step, len(stages))
        for index, (label, detail) in enumerate(stages):
            x = 66 + index * (width + gap)
            card(draw, (x, 220, x + width, 390), label, detail, index == step, accent)
            if index < len(stages) - 1:
                draw.text((x + width + 2, 284), "→", font=font(22, True), fill=PEACH)
        draw.rounded_rectangle((66, 450, W - 66, 585), radius=22, fill="#10213a")
        draw.text((96, 478), stages[step][0], font=font(18, True), fill=accent)
        draw.text((96, 520), stages[step][1], font=font(25, True), fill="#fffaf3")
        target = folder / f"frame-{step:02d}.png"
        image.save(target, optimize=True)
        frames.append(target)
    encode(frames, name)


def build_api() -> None:
    items = [("POST", "/v1/media"), ("POST", "/v1/media/demo"), ("POST", "/v1/render-jobs"), ("GET", "/v1/render-jobs/:id"), ("SSE", "/v1/render-jobs/:id/events"), ("GET", "/v1/operations"), ("GET", "/media/:assetId"), ("GET", "/artifacts/:jobId.mp4")]
    folder = Path(tempfile.gettempdir()) / "dreamy-api"
    if folder.exists(): shutil.rmtree(folder)
    folder.mkdir()
    frames = []
    for step in range(len(items)):
        image, draw = base("INTERFACE CONTRACT", "從素材進站到成品交付，都有清楚合約", step, len(items))
        for index, (method, path) in enumerate(items):
            row, col = divmod(index, 2)
            x, y = 66 + col * 540, 176 + row * 103
            active = index == step
            draw.rounded_rectangle((x, y, x + 512, y + 82), radius=18, fill="#ffffff", outline=CYAN if active else "#d5e1e6", width=4 if active else 2)
            draw.rounded_rectangle((x + 14, y + 17, x + 104, y + 65), radius=12, fill=CYAN if active else "#e4f4f6")
            draw.text((x + 31, y + 28), method, font=font(15, True), fill=INK)
            draw.text((x + 124, y + 25), path, font=font(18, True), fill=INK)
        target = folder / f"frame-{step:02d}.png"
        image.save(target, optimize=True); frames.append(target)
    encode(frames, "api-contract", 480)


def build_design() -> None:
    folder = Path(tempfile.gettempdir()) / "dreamy-design"
    if folder.exists(): shutil.rmtree(folder)
    folder.mkdir(); frames = []
    sections = [("設計變數", "色彩、間距、字級與圓角"), ("共用元件", "按鈕、狀態、指標與進度"), ("產品採用", "從規範追溯到真實功能")]
    colors = [CYAN, PEACH, MINT, LILAC, "#10213a", "#fffaf3"]
    for step in range(6):
        image, draw = base("DREAMY DESIGN SYSTEM", "統一視覺，也統一互動與無障礙規則", step, 6)
        for index, (label, detail) in enumerate(sections):
            x = 66 + index * 356
            card(draw, (x, 178, x + 326, 300), label, detail, index == min(step // 2, 2), [CYAN, LILAC, MINT][index])
        for index, color in enumerate(colors):
            x = 66 + index * 174
            draw.rounded_rectangle((x, 360, x + 146, 510), radius=20, fill=color, outline="#cbd8de", width=2)
        draw.text((66, 555), "語意角色  →  共用元件  →  影音後台", font=font(25, True), fill=INK)
        target = folder / f"frame-{step:02d}.png"; image.save(target, optimize=True); frames.append(target)
    encode(frames, "design-system-showcase")


def main() -> None:
    pipeline("render-lifecycle", "MEDIA JOB", "每一步都有狀態、進度與可復原證據", [("接受任務", "驗證參數與租戶"), ("合成", "字幕與圖層同步"), ("編碼", "FFmpeg 處理"), ("封裝", "寫入成品與雜湊"), ("可交付", "播放、下載與追蹤")])
    pipeline("composition-showcase", "MEDIA COMPOSITION", "字幕、動畫與聲音共用同一條時間軸", [("來源影片", "療癒倉鼠素材"), ("字幕軌", "逐段提示與同步"), ("動態層", "角色由左向右移動"), ("聲音", "輕柔提示音"), ("合成成品", "可播放也可驗證")], LILAC)
    pipeline("reliability-recovery", "RELIABILITY", "一次請求，從 Trace ID 追到交付結果", [("Trace ID", "W3C traceparent"), ("Job ID", "唯一任務識別"), ("事件序列", "斷線後接續"), ("成品雜湊", "驗證輸出一致"), ("成本歸因", "回到租戶與功能")], MINT)
    pipeline("ai-cost-governance", "COST GOVERNANCE", "把每次模型用量歸因到功能與預算", [("請求脈絡", "租戶與工作區"), ("供應商收據", "輸入與輸出用量"), ("用量帳本", "不可變事件"), ("成本歸因", "功能與專案"), ("預算閘門", "告警、限流與降級")], PEACH)
    pipeline("bruno-contract-tests", "CONTRACT VERIFICATION", "同一份介面合約，由自動化回歸驗證", [("媒體上傳", "格式與大小限制"), ("建立任務", "冪等與配額"), ("狀態讀取", "租戶隔離"), ("事件重播", "游標接續"), ("成品播放", "Range 與雜湊")], CYAN)
    build_api(); build_design()


if __name__ == "__main__": main()
