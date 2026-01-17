#!/usr/bin/env python3
"""
Gemini Flash vs GPT-4o-mini 비교 검증 스크립트

GPT-4o-mini와 Gemini Flash의 결과를 비교하여:
1. 날짜 검증 통과율 비교
2. 내용 유사도 비교
3. 보고서 품질 비교
"""
import re
import sys
from pathlib import Path
from typing import Set, Dict, List

def extract_dates(text: str) -> Set[str]:
    """텍스트에서 날짜 추출 (YYYY-MM-DD 또는 YYYY.MM.DD 형식)"""
    patterns = [
        r'(\d{4})[-./](\d{1,2})[-./](\d{1,2})',  # YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD
        r'(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일',  # YYYY년 MM월 DD일
    ]

    dates = set()
    for pattern in patterns:
        for match in re.finditer(pattern, text):
            year, month, day = match.groups()
            # 정규화: YYYY-MM-DD 형식으로 통일
            normalized = f"{year}-{month.zfill(2)}-{day.zfill(2)}"
            dates.add(normalized)

    return dates

def calculate_jaccard_similarity(set1: Set[str], set2: Set[str]) -> float:
    """Jaccard 유사도 계산"""
    if not set1 and not set2:
        return 1.0

    intersection = len(set1 & set2)
    union = len(set1 | set2)

    return intersection / union if union > 0 else 0.0

def analyze_report(report_path: Path) -> Dict:
    """보고서 분석"""
    if not report_path.exists():
        return {"error": f"파일을 찾을 수 없습니다: {report_path}"}

    text = report_path.read_text(encoding='utf-8')
    dates = extract_dates(text)

    # 단어 수
    words = len(text.split())

    # 섹션 수 (### 헤더 기준)
    sections = len(re.findall(r'^#{1,3}\s+', text, re.MULTILINE))

    return {
        "dates": dates,
        "date_count": len(dates),
        "word_count": words,
        "section_count": sections,
        "char_count": len(text),
    }

def compare_case(case_name: str, baseline_path: Path, gpt_path: Path, gemini_path: Path) -> Dict:
    """케이스 비교"""

    # Baseline 분석
    baseline_result = analyze_report(baseline_path)
    if "error" in baseline_result:
        return {"case": case_name, "error": baseline_result["error"]}

    # GPT-4o-mini 분석
    gpt_result = analyze_report(gpt_path)
    if "error" in gpt_result:
        return {"case": case_name, "error": gpt_result["error"]}

    # Gemini Flash 분석
    gemini_result = analyze_report(gemini_path)
    if "error" in gemini_result:
        return {"case": case_name, "error": gemini_result["error"]}

    # 날짜 비교
    baseline_dates = baseline_result["dates"]
    gpt_dates = gpt_result["dates"]
    gemini_dates = gemini_result["dates"]

    # GPT-4o-mini 정확도
    gpt_coverage = (len(baseline_dates & gpt_dates) / len(baseline_dates) * 100) if baseline_dates else 100.0

    # Gemini Flash 정확도
    gemini_coverage = (len(baseline_dates & gemini_dates) / len(baseline_dates) * 100) if baseline_dates else 100.0

    # 날짜 유사도 (GPT vs Gemini)
    date_similarity = calculate_jaccard_similarity(gpt_dates, gemini_dates)

    return {
        "case": case_name,
        "baseline": baseline_result,
        "gpt": gpt_result,
        "gemini": gemini_result,
        "gpt_coverage": gpt_coverage,
        "gemini_coverage": gemini_coverage,
        "date_similarity": date_similarity,
        "gpt_missing": len(baseline_dates - gpt_dates),
        "gemini_missing": len(baseline_dates - gemini_dates),
        "coverage_diff": gemini_coverage - gpt_coverage,
    }

def main():
    # 데이터 레포 경로
    data_repo = Path("/home/user/VNEXSUS_reports_pdf/offline_ocr_samples/offline_ocr_samples/2025-12-26T02-18-51-219Z")

    # 출력 디렉토리
    gpt_output = Path("/home/user/VNEXSUS-25-12-30/outputs/validation-full")
    gemini_output = Path("/home/user/VNEXSUS-25-12-30/outputs/gemini-comparison")

    # 비교 케이스 (난이도별 6개)
    cases = {
        "상 (High)": [
            "KB손해보험_김태형_안정형_협심증_",
            "현대해상_조윤아_태아보험__엄마_이주희_",
        ],
        "중 (Medium)": [
            "이정희",
            "장유찬",
        ],
        "하 (Low)": [
            "농협손해보험_김인화_후유장해_",
            "농협손해보험_이광욱_고지의무_위반_심질환_",
        ],
    }

    results = []

    print("=" * 100)
    print("Gemini Flash vs GPT-4o-mini 비교 검증")
    print("=" * 100)
    print()

    for difficulty, case_list in cases.items():
        print(f"\n{'='*100}")
        print(f"{difficulty} 난이도 케이스")
        print(f"{'='*100}\n")

        for case in case_list:
            # Baseline
            baseline_path = data_repo / case / f"{case}_report.txt"

            # GPT-4o-mini
            gpt_path = gpt_output / f"{case}_blocks" / "app_report.md"

            # Gemini Flash
            gemini_path = gemini_output / f"{case}_blocks" / "app_report.md"

            result = compare_case(case, baseline_path, gpt_path, gemini_path)
            results.append(result)

            if "error" in result:
                print(f"❌ {result['case']}")
                print(f"   오류: {result['error']}")
                continue

            print(f"📋 {result['case']}")
            print()
            print(f"   Baseline 날짜 수: {result['baseline']['date_count']}")
            print()
            print(f"   📊 GPT-4o-mini:")
            print(f"      - 날짜 수: {result['gpt']['date_count']}")
            print(f"      - 포함률: {result['gpt_coverage']:.1f}%")
            print(f"      - 누락: {result['gpt_missing']}개")
            print(f"      - 단어 수: {result['gpt']['word_count']:,}")
            print()
            print(f"   📊 Gemini Flash:")
            print(f"      - 날짜 수: {result['gemini']['date_count']}")
            print(f"      - 포함률: {result['gemini_coverage']:.1f}%")
            print(f"      - 누락: {result['gemini_missing']}개")
            print(f"      - 단어 수: {result['gemini']['word_count']:,}")
            print()
            print(f"   🔄 비교:")
            print(f"      - 날짜 유사도 (GPT ↔ Gemini): {result['date_similarity']:.1%}")
            print(f"      - 포함률 차이: {result['coverage_diff']:+.1f}% {'✅' if result['coverage_diff'] >= 0 else '⚠️'}")
            print()

    # 전체 통계
    print("\n" + "=" * 100)
    print("전체 통계")
    print("=" * 100)
    print()

    valid_results = [r for r in results if "error" not in r]

    if valid_results:
        avg_gpt_coverage = sum(r["gpt_coverage"] for r in valid_results) / len(valid_results)
        avg_gemini_coverage = sum(r["gemini_coverage"] for r in valid_results) / len(valid_results)
        avg_date_similarity = sum(r["date_similarity"] for r in valid_results) / len(valid_results)

        print(f"평균 GPT-4o-mini 포함률: {avg_gpt_coverage:.1f}%")
        print(f"평균 Gemini Flash 포함률: {avg_gemini_coverage:.1f}%")
        print(f"평균 날짜 유사도: {avg_date_similarity:.1%}")
        print(f"포함률 평균 차이: {avg_gemini_coverage - avg_gpt_coverage:+.1f}%")
        print()

        # 우수 케이스
        better_count = sum(1 for r in valid_results if r["coverage_diff"] > 0)
        same_count = sum(1 for r in valid_results if r["coverage_diff"] == 0)
        worse_count = sum(1 for r in valid_results if r["coverage_diff"] < 0)

        print(f"Gemini가 더 우수: {better_count}/{len(valid_results)}")
        print(f"동일: {same_count}/{len(valid_results)}")
        print(f"GPT가 더 우수: {worse_count}/{len(valid_results)}")

    print("\n" + "=" * 100)

    return 0

if __name__ == "__main__":
    sys.exit(main())
