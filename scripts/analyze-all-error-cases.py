#!/usr/bin/env python3
"""
전체 오류 케이스 종합 분석
"""
import json
import re
from pathlib import Path
from typing import Set, Dict, List
from collections import defaultdict

def extract_dates_comprehensive(text: str) -> Dict[str, str]:
    """모든 날짜 패턴 추출"""
    patterns = [
        (r'(\d{4})[-](\d{1,2})[-](\d{1,2})', '-'),
        (r'(\d{4})[.](\d{1,2})[.](\d{1,2})', '.'),
        (r'(\d{4})[/](\d{1,2})[/](\d{1,2})', '/'),
        (r'(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일', '년'),
    ]

    dates = {}
    for pattern, sep in patterns:
        for match in re.finditer(pattern, text):
            year, month, day = match.groups()
            normalized = f"{year}-{month.zfill(2)}-{day.zfill(2)}"
            original = match.group(0)
            if normalized not in dates:
                dates[normalized] = original

    return dates

def analyze_case(case_name: str, baseline_file: Path, ocr_file: Path) -> Dict:
    """케이스 분석"""
    # Baseline
    baseline_text = baseline_file.read_text(encoding='utf-8')
    baseline_dates = extract_dates_comprehensive(baseline_text)

    # OCR
    with open(ocr_file, encoding='utf-8') as f:
        data = json.load(f)

    ocr_text = '\n'.join([block.get('text', '') for block in data['blocks']])
    ocr_dates = extract_dates_comprehensive(ocr_text)

    # 비교
    baseline_only = set(baseline_dates.keys()) - set(ocr_dates.keys())
    ocr_only = set(ocr_dates.keys()) - set(baseline_dates.keys())
    common = set(baseline_dates.keys()) & set(ocr_dates.keys())

    # 누락된 날짜의 컨텍스트 찾기
    missing_contexts = []
    for date in sorted(baseline_only):
        original = baseline_dates[date]
        for i, line in enumerate(baseline_text.split('\n'), 1):
            if original in line:
                missing_contexts.append({
                    'date': date,
                    'original': original,
                    'line_num': i,
                    'context': line.strip()[:150]
                })
                break

    return {
        'case_name': case_name,
        'baseline_count': len(baseline_dates),
        'ocr_count': len(ocr_dates),
        'matched': len(common),
        'ocr_missed': len(baseline_only),
        'ocr_extra': len(ocr_only),
        'accuracy': len(common) / len(baseline_dates) * 100 if baseline_dates else 100,
        'missing_contexts': missing_contexts
    }

# Load cases
cases_json = Path("/home/user/VNEXSUS-25-12-30/validation_cases_28.json")
with open(cases_json) as f:
    cases = json.load(f)

# Load validation results
results_path = Path("/home/user/VNEXSUS-25-12-30/outputs/quick_validation_28.json")
with open(results_path) as f:
    results = json.load(f)

# 하 등급 + 중 등급 케이스 분석
error_cases = [r for r in results if r['grade'] in ['하', '중']]

print("=" * 100)
print("오류 케이스 종합 분석 (하/중 등급)")
print("=" * 100)
print(f"\n분석 대상: {len(error_cases)}개 케이스")
print()

all_analyses = []
all_missing_contexts = []

for case_result in error_cases:
    case_name = case_result['case_name']

    # Find case info
    case_info = next((c for c in cases if c['name'] == case_name), None)
    if not case_info:
        continue

    baseline_file = Path(case_info['baseline_file'])
    ocr_file = Path(case_info['ocr_file'])

    if not baseline_file.exists() or not ocr_file.exists():
        continue

    analysis = analyze_case(case_name, baseline_file, ocr_file)
    all_analyses.append(analysis)

    print(f"\n{'='*80}")
    print(f"{case_name} (등급: {case_result['grade']})")
    print(f"{'='*80}")
    print(f"Baseline: {analysis['baseline_count']}개 | OCR: {analysis['ocr_count']}개 | 매칭: {analysis['matched']}개")
    print(f"OCR 누락: {analysis['ocr_missed']}개 | OCR 추가: {analysis['ocr_extra']}개")
    print(f"정확도: {analysis['accuracy']:.1f}%")

    if analysis['missing_contexts']:
        print(f"\n📍 OCR이 누락한 날짜 컨텍스트:")
        for ctx in analysis['missing_contexts'][:5]:
            print(f"  • {ctx['date']} (Line {ctx['line_num']})")
            print(f"    {ctx['context']}")
            all_missing_contexts.append({
                'case': case_name,
                **ctx
            })

# 패턴 분석
print("\n" + "=" * 100)
print("누락 패턴 분석")
print("=" * 100)

# 키워드 빈도
keyword_freq = defaultdict(int)
for ctx in all_missing_contexts:
    context = ctx['context']
    keywords = ['보험기간', '계약', '가입', '보험', '담보', '기간', '~', '①', '②']
    for keyword in keywords:
        if keyword in context:
            keyword_freq[keyword] += 1

print(f"\n📊 누락된 날짜가 나타나는 문맥 키워드:")
for keyword, count in sorted(keyword_freq.items(), key=lambda x: -x[1])[:10]:
    print(f"  {keyword}: {count}회")

# 날짜 범위 분석
future_dates = [ctx for ctx in all_missing_contexts if int(ctx['date'].split('-')[0]) >= 2026]
past_dates = [ctx for ctx in all_missing_contexts if int(ctx['date'].split('-')[0]) < 2024]

print(f"\n📅 누락된 날짜 시간대 분석:")
print(f"  미래 날짜 (2026+): {len(future_dates)}개")
print(f"  과거 날짜 (<2024): {len(past_dates)}개")
print(f"  최근 날짜 (2024-2025): {len(all_missing_contexts) - len(future_dates) - len(past_dates)}개")

if future_dates:
    print(f"\n  미래 날짜 샘플:")
    for ctx in future_dates[:3]:
        print(f"    {ctx['date']} - {ctx['context'][:100]}")

# 종합 통계
print("\n" + "=" * 100)
print("종합 통계")
print("=" * 100)

total_baseline = sum(a['baseline_count'] for a in all_analyses)
total_ocr = sum(a['ocr_count'] for a in all_analyses)
total_matched = sum(a['matched'] for a in all_analyses)
total_missed = sum(a['ocr_missed'] for a in all_analyses)
total_extra = sum(a['ocr_extra'] for a in all_analyses)

print(f"\n총 Baseline 날짜: {total_baseline}개")
print(f"총 OCR 날짜: {total_ocr}개")
print(f"총 매칭: {total_matched}개")
print(f"총 OCR 누락: {total_missed}개 ({total_missed/total_baseline*100:.1f}%)")
print(f"총 OCR 추가: {total_extra}개")

avg_accuracy = sum(a['accuracy'] for a in all_analyses) / len(all_analyses)
print(f"\n평균 정확도: {avg_accuracy:.1f}%")

# Save results
output_path = Path("/home/user/VNEXSUS-25-12-30/outputs/comprehensive_error_analysis.json")
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump({
        'summary': {
            'total_cases': len(all_analyses),
            'total_baseline': total_baseline,
            'total_ocr': total_ocr,
            'total_matched': total_matched,
            'total_missed': total_missed,
            'total_extra': total_extra,
            'average_accuracy': avg_accuracy
        },
        'cases': all_analyses,
        'missing_contexts': all_missing_contexts,
        'patterns': {
            'keyword_frequency': dict(keyword_freq),
            'future_dates_count': len(future_dates),
            'past_dates_count': len(past_dates)
        }
    }, f, indent=2, ensure_ascii=False)

print(f"\n✅ 상세 분석 저장: {output_path}")

print("\n" + "=" * 100)
print("100% 정확도 달성 인사이트")
print("=" * 100)
print()
print("🔍 핵심 발견:")
print()
print("1. '오류'로 분류된 날짜들은 실제로 OCR 인식 오류가 아니라 **OCR 누락 (False Negative)**")
print("   - OCR이 문서에 있는 날짜를 추출하지 못함")
print("   - Baseline 보고서는 사람이 검토하여 작성한 정확한 날짜")
print()
print("2. 누락 패턴:")
print(f"   - 주로 '보험기간', '계약' 관련 문맥에서 발생")
print(f"   - 표 구조나 특수 레이아웃에서 OCR 실패 가능성")
print(f"   - 미래 날짜({len(future_dates)}개)는 보험 만기일 등 중요 정보")
print()
print("3. OCR이 추가로 검출한 날짜({total_extra}개):")
print("   - 문서 전체에서 모든 날짜 형식을 추출")
print("   - 하지만 Baseline에서 중요한 날짜만 선별한 것과 대조")
print()
print("💡 개선 전략:")
print()
print("A. 단기 (Quick Win - 1주):")
print("   ✅ 날짜 정규화: 다양한 포맷 통일 (점/하이픈/슬래시)")
print("   ✅ 날짜 유효성 검증: 불가능한 날짜 필터링")
print("   ✅ LLM 후처리: OCR 결과에서 누락된 중요 날짜 복원")
print()
print("B. 중기 (Medium Win - 1개월):")
print("   🔄 문맥 기반 날짜 추출:")
print("      - '보험기간', '계약일', '가입일' 등 키워드 주변 날짜 우선 추출")
print("      - 표 구조 파싱 강화")
print("   🔄 날짜 시퀀스 검증:")
print("      - 보험기간 시작~종료 날짜 쌍 인식")
print("      - 연대순 정렬 후 이상치 탐지")
print()
print("C. 장기 (Long-term - 3개월):")
print("   🚀 하이브리드 접근:")
print("      - OCR + LLM 날짜 추출 조합")
print("      - LLM이 의료보험 도메인 지식 활용하여 누락 날짜 추론")
print("      - 예: '보험기간 30년' → 시작일 + 30년 = 종료일 계산")
print("   🚀 문서 구조 이해:")
print("      - 표, 섹션, 헤더 인식 강화")
print("      - 중요 정보 영역 (계약사항, 청구사항) 우선 처리")
print()
