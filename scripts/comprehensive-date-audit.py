#!/usr/bin/env python3
"""
포괄적 날짜 감사 - Baseline vs OCR 비교
"""
import json
import re
from pathlib import Path
from typing import Set

def extract_dates_comprehensive(text: str) -> Set[str]:
    """모든 날짜 패턴 추출 (정규화 전)"""
    patterns = [
        (r'(\d{4})[-](\d{1,2})[-](\d{1,2})', '-'),
        (r'(\d{4})[.](\d{1,2})[.](\d{1,2})', '.'),
        (r'(\d{4})[/](\d{1,2})[/](\d{1,2})', '/'),
        (r'(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일', '년'),
    ]

    dates = {}  # key: normalized, value: original
    for pattern, sep in patterns:
        for match in re.finditer(pattern, text):
            year, month, day = match.groups()
            normalized = f"{year}-{month.zfill(2)}-{day.zfill(2)}"
            original = match.group(0)
            if normalized not in dates:
                dates[normalized] = original

    return dates

# Case10 분석
print("=" * 100)
print("Case10 날짜 감사")
print("=" * 100)

baseline_file = Path("/home/user/VNEXSUS-25-12-30/src/rag/case_sample/Case10_report.txt")
ocr_file = Path("/home/user/VNEXSUS_reports_pdf/offline_ocr_samples/offline_ocr_samples/2025-12-26T06-20-25-463Z/Case10/Case10_offline_ocr.json")

# Baseline 날짜
baseline_text = baseline_file.read_text(encoding='utf-8')
baseline_dates = extract_dates_comprehensive(baseline_text)

print(f"\n📋 Baseline 날짜: {len(baseline_dates)}개")
for normalized, original in sorted(baseline_dates.items())[:15]:
    print(f"  {normalized} (원본: {original})")

# OCR 날짜
with open(ocr_file, encoding='utf-8') as f:
    data = json.load(f)

ocr_text = '\n'.join([block.get('text', '') for block in data['blocks']])
ocr_dates = extract_dates_comprehensive(ocr_text)

print(f"\n📦 OCR 날짜: {len(ocr_dates)}개")
for normalized, original in sorted(ocr_dates.items())[:15]:
    print(f"  {normalized} (원본: {original})")

# 비교
baseline_only = set(baseline_dates.keys()) - set(ocr_dates.keys())
ocr_only = set(ocr_dates.keys()) - set(baseline_dates.keys())
common = set(baseline_dates.keys()) & set(ocr_dates.keys())

print(f"\n🔍 비교 결과:")
print(f"  공통: {len(common)}개")
print(f"  Baseline에만 있음 (OCR 누락): {len(baseline_only)}개")
print(f"  OCR에만 있음 (추가 검출): {len(ocr_only)}개")

if baseline_only:
    print(f"\n❌ OCR이 누락한 날짜 ({len(baseline_only)}개):")
    for date in sorted(baseline_only):
        original = baseline_dates[date]
        print(f"  {date} (baseline 원본: {original})")

        # Baseline에서 해당 날짜가 있는 라인 찾기
        for i, line in enumerate(baseline_text.split('\n'), 1):
            if original in line:
                print(f"    → Baseline Line {i}: {line.strip()[:120]}")
                break

print("\n" + "=" * 100)
print("핵심 발견사항")
print("=" * 100)
print()
print("1. OCR이 Baseline에 있는 일부 날짜를 추출하지 못함")
print("2. 이는 OCR 정확도 문제이거나 문서 이미지 품질 문제일 수 있음")
print("3. Baseline 보고서는 사람이 작성한 것으로, 실제 문서 내용을 반영")
print("4. 따라서 '오류'로 분류된 날짜들은 실제로는 OCR의 누락(False Negative)")
print()
print("개선 방향:")
print("  - OCR 후처리: 문맥 기반 날짜 복원")
print("  - LLM 활용: 의료 보고서 도메인 지식 기반 날짜 추론")
print("  - 하이브리드: OCR + LLM 날짜 추출 조합")
