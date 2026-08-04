#!/usr/bin/env python3
import os
import sys
import shutil
from PIL import Image, ImageDraw, ImageFont
import subprocess

FONT_PATH_REG = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
FONT_PATH_BOLD = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
FONT_MONO = '/usr/share/fonts/truetype/ubuntu/UbuntuMono-B.ttf'

font_title = ImageFont.truetype(FONT_PATH_BOLD, 32)
font_sub = ImageFont.truetype(FONT_PATH_REG, 20)
font_card_title = ImageFont.truetype(FONT_PATH_BOLD, 22)
font_text = ImageFont.truetype(FONT_PATH_REG, 17)
font_bold = ImageFont.truetype(FONT_PATH_BOLD, 17)
font_code = ImageFont.truetype(FONT_MONO, 16)
font_banner = ImageFont.truetype(FONT_PATH_BOLD, 24)
font_banner_sub = ImageFont.truetype(FONT_PATH_REG, 16)

OUT_DIR = '/tmp/mcp_compare_frames'
if os.path.exists(OUT_DIR):
    shutil.rmtree(OUT_DIR)
os.makedirs(OUT_DIR, exist_ok=True)

TOTAL_FRAMES = 270 # 9 seconds at 30 fps

def render_frame(frame_num):
    img = Image.new('RGB', (1920, 1080), color='#090d16')
    draw = ImageDraw.Draw(img)

    # Background subtle grid / glow
    draw.rectangle([(0, 0), (1920, 90)], fill='#0f172a')
    draw.line([(0, 90), (1920, 90)], fill='#1e293b', width=2)

    # Top Header
    draw.text((40, 24), "⚖️ Bare Claude vs. Claude + MCP (seondal-pay) 비교 시나리오", font=font_title, fill='#f3f4f6')
    draw.text((1420, 32), "Solana MPP M2M Payment Standard", font=font_sub, fill='#818cf8')

    # Card dimensions
    # Left Card: Bare Claude
    # Right Card: Claude + MCP
    left_x1, left_y1, left_x2, left_y2 = 40, 110, 940, 920
    right_x1, right_y1, right_x2, right_y2 = 980, 110, 1880, 920

    # Draw Card backgrounds (Glassmorphism terminal style)
    draw.rectangle([(left_x1, left_y1), (left_x2, left_y2)], fill='#111827', outline='#374151', width=2)
    draw.rectangle([(left_x1, left_y1), (left_x2, left_y1 + 45)], fill='#1f2937')
    draw.text((left_x1 + 20, left_y1 + 10), "🔴 Terminal A — Bare Claude (도구 없음)", font=font_card_title, fill='#ef4444')

    draw.rectangle([(right_x1, right_y1), (right_x2, right_y2)], fill='#061325', outline='#1d4ed8', width=2)
    draw.rectangle([(right_x1, right_y1), (right_x2, right_y1 + 45)], fill='#1e3a8a')
    draw.text((right_x1 + 20, right_y1 + 10), "🟢 Terminal B — Claude + MCP (seondal-pay)", font=font_card_title, fill='#10b981')

    # Content rendering based on frame_num progress
    p_prompt = min(1.0, max(0.0, (frame_num - 5) / 25.0))
    p_left_resp = min(1.0, max(0.0, (frame_num - 30) / 40.0))
    
    p_tool1 = min(1.0, max(0.0, (frame_num - 30) / 15.0))
    p_tool2 = min(1.0, max(0.0, (frame_num - 45) / 15.0))
    p_tool3 = min(1.0, max(0.0, (frame_num - 60) / 15.0))
    p_mpp = min(1.0, max(0.0, (frame_num - 85) / 20.0))
    p_tx = min(1.0, max(0.0, (frame_num - 110) / 20.0))
    p_report = min(1.0, max(0.0, (frame_num - 135) / 30.0))

    # --- LEFT TERMINAL CONTENT ---
    draw.text((left_x1 + 20, left_y1 + 65), "$ claude", font=font_code, fill='#6b7280')
    
    prompt_text = "> 유아 롬퍼 한국에서 팔아도 될까요?"
    curr_prompt = prompt_text[:int(len(prompt_text) * p_prompt)]
    draw.text((left_x1 + 20, left_y1 + 95), curr_prompt, font=font_bold, fill='#f3f4f6')

    if p_left_resp > 0:
        draw.line([(left_x1 + 20, left_y1 + 130), (left_x2 - 20, left_y1 + 130)], fill='#374151', width=1)
        resp_lines = [
            "\"원칙적으로 유아복은 마진이 좋은 편입니다만...",
            "시장 경쟁이 심할 수 있으며 도매 사이트(1688 등)",
            "에서 직접 가격을 확인해보아야 합니다.",
            "관세 및 KC 인증 수수료도 별도로 알아보시는",
            "것을 권장합니다.\""
        ]
        y_cursor = left_y1 + 150
        num_chars_to_show = int(120 * p_left_resp)
        tot = 0
        for line in resp_lines:
            if tot < num_chars_to_show:
                sub = line[:num_chars_to_show - tot]
                draw.text((left_x1 + 20, y_cursor), sub, font=font_text, fill='#d1d5db')
                tot += len(line)
                y_cursor += 32

        if p_left_resp >= 1.0:
            # Bad result callout box
            draw.rectangle([(left_x1 + 20, left_y1 + 400), (left_x2 - 20, left_y1 + 540)], fill='#2a1215', outline='#ef4444', width=1)
            draw.text((left_x1 + 35, left_y1 + 415), "❌ 한계점 (Raw LLM)", font=font_bold, fill='#ef4444')
            draw.text((left_x1 + 35, left_y1 + 450), "• 1688 도매가 및 수입원가 실측 불가능", font=font_text, fill='#fca5a5')
            draw.text((left_x1 + 35, left_y1 + 480), "• RCEP 관세율 및 KC 안전인증 검증 미수행", font=font_text, fill='#fca5a5')
            draw.text((left_x1 + 35, left_y1 + 510), "• 모호한 추측으로 1인 셀러 발주 시 손실 위험", font=font_text, fill='#fca5a5')

    # --- RIGHT TERMINAL CONTENT ---
    draw.text((right_x1 + 20, right_y1 + 60), "$ claude mcp add --transport http seondal https://seondal-pay.us-central1.run.app/mcp", font=font_code, fill='#60a5fa')
    draw.text((right_x1 + 20, right_y1 + 95), curr_prompt, font=font_bold, fill='#f3f4f6')

    y_r = right_y1 + 135

    if p_tool1 > 0:
        draw.rectangle([(right_x1 + 20, y_r), (right_x2 - 20, y_r + 42)], fill='#1e293b', outline='#3b82f6')
        draw.text((right_x1 + 30, y_r + 10), "🔧 1. get_product_catalog()", font=font_bold, fill='#60a5fa')
        draw.text((right_x1 + 320, y_r + 10), "➔ 15개 온톨로지 카탈로그 매칭 완료", font=font_text, fill='#93c5fd')
        y_r += 52

    if p_tool2 > 0:
        draw.rectangle([(right_x1 + 20, y_r), (right_x2 - 20, y_r + 42)], fill='#1e293b', outline='#3b82f6')
        draw.text((right_x1 + 30, y_r + 10), "🔧 2. get_market_pie(\"롬퍼\")", font=font_bold, fill='#60a5fa')
        draw.text((right_x1 + 320, y_r + 10), "➔ TOP1 점유율 35.5%, ₩8.9K~18.9K", font=font_text, fill='#93c5fd')
        y_r += 52

    if p_tool3 > 0:
        draw.rectangle([(right_x1 + 20, y_r), (right_x2 - 20, y_r + 42)], fill='#271910', outline='#f59e0b')
        draw.text((right_x1 + 30, y_r + 10), "🛡️ 3. assess_compliance(\"유아\")", font=font_bold, fill='#fbbf24')
        draw.text((right_x1 + 320, y_r + 10), "➔ 🔴 KC 유아섬유 안전확인 필수 규제", font=font_text, fill='#fde68a')
        y_r += 52

    if p_mpp > 0:
        draw.rectangle([(right_x1 + 20, y_r), (right_x2 - 20, y_r + 42)], fill='#2a1738', outline='#a855f7')
        draw.text((right_x1 + 30, y_r + 10), "💳 4. get_payment_challenge(tier=3)", font=font_bold, fill='#c084fc')
        draw.text((right_x1 + 360, y_r + 10), "➔ HTTP 402 Challenge (0.05 SOL)", font=font_text, fill='#e9d5ff')
        y_r += 52

    if p_tx > 0:
        draw.rectangle([(right_x1 + 20, y_r), (right_x2 - 20, y_r + 42)], fill='#064e3b', outline='#10b981')
        draw.text((right_x1 + 30, y_r + 10), "⚡ 5. Solana Devnet Transaction", font=font_bold, fill='#34d399')
        draw.text((right_x1 + 320, y_r + 10), "➔ memo_sig: 5gHTN8...kixb [CONFIRMED]", font=font_code, fill='#a7f3d0')
        y_r += 52

    if p_report > 0:
        # Final Unlocked Sourcing Report Box
        draw.rectangle([(right_x1 + 20, y_r), (right_x2 - 20, y_r + 210)], fill='#042f2e', outline='#14b8a6', width=2)
        draw.text((right_x1 + 35, y_r + 15), "🔓 6. get_sourcing_analysis() — 심층 리포트 해금", font=font_card_title, fill='#2dd4bf')
        draw.text((right_x1 + 35, y_r + 55), "• 1688 공장 도매가: $12.50 (₩17,500)", font=font_text, fill='#ccfbf1')
        draw.text((right_x1 + 35, y_r + 85), "• RCEP 적용 수입원가: ₩24,650 (관세 0% + 배송비 ₩7,150)", font=font_text, fill='#ccfbf1')
        draw.text((right_x1 + 35, y_r + 115), "• 쿠팡 벤치마크 retail가: ₩51,765", font=font_text, fill='#ccfbf1')
        draw.text((right_x1 + 35, y_r + 145), "• 수수료 차감 순마진: ₩21,524 (+87% Net ROI, Grade S)", font=font_bold, fill='#34d399')
        draw.text((right_x1 + 35, y_r + 175), "• KC 안전인증 준비물: 안전확인신고서 및 유아 섬유 시험성적서", font=font_text, fill='#99f6e4')

    # --- BOTTOM SUBTITLE BANNER ---
    banner_y1, banner_y2 = 940, 1050
    draw.rectangle([(40, banner_y1), (1880, banner_y2)], fill='#1e1b4b', outline='#6366f1', width=2)
    draw.text((70, banner_y1 + 18), "💡 필살기 메시지:", font=font_banner, fill='#f59e0b')
    draw.text((270, banner_y1 + 18), "\"같은 Claude인데, 하나는 추측하고 하나는 온체인으로 결제하며 검증한다\"", font=font_banner, fill='#ffffff')
    draw.text((270, banner_y1 + 60), "표준 MCP 규격으로 연결된 제3자 AI 에이전트가 무승인 온체인 결제(Solana MPP)와 온톨로지 소싱을 원스톱으로 수행함을 실증", font=font_banner_sub, fill='#c7d2fe')

    img.save(f"{OUT_DIR}/frame_{frame_num:05d}.png")

print(f"Rendering {TOTAL_FRAMES} frames...")
for f in range(TOTAL_FRAMES):
    render_frame(f)
    if (f + 1) % 50 == 0:
        print(f"  Rendered {f + 1}/{TOTAL_FRAMES} frames")

print("Stitching frames into YouTube-compliant 1080p 30fps MP4 video...")
cmd = [
    'ffmpeg', '-y', '-framerate', '30',
    '-i', f'{OUT_DIR}/frame_%05d.png',
    '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-r', '30',
    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest',
    '-movflags', '+faststart',
    'docs/claude_vs_mcp_comparison.mp4'
]
subprocess.run(cmd, check=True)
print("✅ Successfully generated: docs/claude_vs_mcp_comparison.mp4")
