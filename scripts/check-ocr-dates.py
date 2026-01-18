#!/usr/bin/env python3
"""
OCR에서 특정 날짜 찾기 - 다양한 포맷으로
"""
import json
from pathlib import Path

ocr_file = Path("/home/user/VNEXSUS_reports_pdf/offline_ocr_samples/offline_ocr_samples/2025-12-26T06-20-25-463Z/Case10/Case10_offline_ocr.json")

with open(ocr_file, encoding='utf-8') as f:
    data = json.load(f)

# 모든 블록 텍스트 수집
all_text = []
for i, block in enumerate(data['blocks']):
    text = block.get('text', '')
    all_text.append(text)

    # 2054 또는 2025-11, 2025.11 포함하는 블록 찾기
    if '2054' in text or '2025-11' in text or '2025.11' in text or '2024.05.01' in text:
        print(f"Block {i}: {text[:200]}")

# 전체 텍스트에서 검색
full_text = '\n'.join(all_text)
print(f"\n전체 텍스트에서 2054 검색:")
for line in full_text.split('\n'):
    if '2054' in line:
        print(f"  {line[:150]}")

print(f"\n전체 텍스트에서 2025.11.10 검색:")
for line in full_text.split('\n'):
    if '2025.11.10' in line or '2025-11-10' in line:
        print(f"  {line[:150]}")
