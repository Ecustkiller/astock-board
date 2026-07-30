#!/usr/bin/env python3
# 生成 A股题材·涨停看板 网站图标（苹果极简风：蓝底 + 白色向上走势线）
# 用法: python gen_icon.py <output_dir>
import sys
from PIL import Image, ImageDraw

BLUE = (0, 113, 227)      # 系统蓝 #0071e3
BLUE2 = (10, 132, 255)    # 渐变高光 #0a84ff
WHITE = (255, 255, 255)
SIZE = 64  # 设计坐标系，viewBox 64

def make(size):
    img = Image.new("RGBA", (size, size), BLUE)
    d = ImageDraw.Draw(img)
    s = size / SIZE  # 缩放
    lw = int(5 * s)  # 线宽 5
    pts = [(16, 45), (28, 33), (37, 39), (50, 19)]
    pts = [(int(x * s), int(y * s)) for x, y in pts]
    # 折线（每段画，端点补圆使转折圆滑）
    for i in range(len(pts) - 1):
        d.line([pts[i], pts[i + 1]], fill=WHITE, width=lw, joint="curve")
    for p in pts:
        d.ellipse([p[0] - lw / 2, p[1] - lw / 2, p[0] + lw / 2, p[1] + lw / 2],
                  fill=WHITE)
    # 末端大圆点 + 蓝心
    r = int(5 * s)
    d.ellipse([pts[-1][0] - r, pts[-1][1] - r, pts[-1][0] + r, pts[-1][1] + r],
              fill=WHITE)
    r2 = int(2.2 * s)
    d.ellipse([pts[-1][0] - r2, pts[-1][1] - r2, pts[-1][0] + r2, pts[-1][1] + r2],
              fill=BLUE)
    return img

out = sys.argv[1]
make(180).save(f"{out}/apple-touch-icon.png", "PNG")
# 兼容 ICO（16/32/48）
make(16).save(f"{out}/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)], format="ICO")
make(32).save(f"{out}/favicon-32.png", "PNG")
print("icons generated")
