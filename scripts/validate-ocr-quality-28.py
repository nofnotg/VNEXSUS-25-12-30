#!/usr/bin/env python3
"""
28개 케이스 OCR 품질 검증
- OCR 원본 데이터에서 날짜 추출
- GT baseline과 비교
"""
import re
import json
import csv
from pathlib import Path
from typing import Set, Dict, List
from dataclasses import dataclass, asdict

@dataclass
class OcrValidationResult:
    case_name: str
    case_type: str
    ocr_dates: Set[str]
    gt_dates: Set[str]
    matched: Set[str]
    missing: Set[str]
    extra: Set[str]
    coverage: float  # GT 대비 OCR 포함률
    precision: float  # OCR 대비 GT 정확도

def extract_dates_from_text(text: str) -> Set[str]:
    """텍스트에서 날짜 추출"""
    patterns = [
        r'(\d{4})[-./](\d{1,2})[-./](\d{1,2})',
        r'(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일',
    ]

    dates = set()
    for pattern in patterns:
        for match in re.finditer(pattern, text):
            year, month, day = match.groups()
            try:
                normalized = f"{year}-{month.zfill(2)}-{day.zfill(2)}"
                # 기본 유효성 검증
                y, m, d = int(year), int(month), int(day)
                if 1950 <= y <= 2100 and 1 <= m <= 12 and 1 <= d <= 31:
                    dates.add(normalized)
            except:
                pass

    return dates

def extract_dates_from_json_ocr(json_path: Path) -> Set[str]:
    """JSON OCR 파일에서 날짜 추출"""
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # JSON 구조 탐색 - text 필드 우선
        full_text = ""
        if isinstance(data, dict):
            # text 필드가 있으면 우선 사용
            if 'text' in data and isinstance(data['text'], str):
                full_text = data['text']
            # text가 없으면 pages/blocks에서 추출
            elif 'pages' in data:
                for page in data['pages']:
                    if isinstance(page, dict):
                        if 'text' in page:
                            full_text += page['text'] + "\n"
                        if 'blocks' in page:
                            for block in page['blocks']:
                                if isinstance(block, dict) and 'text' in block:
                                    full_text += block['text'] + "\n"
            elif 'blocks' in data:
                for block in data['blocks']:
                    if isinstance(block, dict) and 'text' in block:
                        full_text += block['text'] + "\n"

        return extract_dates_from_text(full_text)
    except Exception as e:
        print(f"  ⚠️  Error reading JSON: {e}")
        return set()

def extract_dates_from_csv_blocks(csv_path: Path) -> Set[str]:
    """CSV blocks 파일에서 날짜 추출"""
    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            full_text = ""
            for row in reader:
                if 'text' in row:
                    full_text += row['text'] + "\n"

        return extract_dates_from_text(full_text)
    except Exception as e:
        print(f"  ⚠️  Error reading CSV: {e}")
        return set()

def validate_case(case: dict) -> OcrValidationResult:
    """단일 케이스 검증"""
    case_name = case['name']
    case_type = case['type']
    ocr_file = Path(case['ocr_file'])
    gt_file = Path(case['baseline_file'])

    # OCR 날짜 추출
    if ocr_file.suffix == '.json':
        ocr_dates = extract_dates_from_json_ocr(ocr_file)
    elif ocr_file.suffix == '.csv':
        ocr_dates = extract_dates_from_csv_blocks(ocr_file)
    else:
        ocr_dates = set()

    # GT 날짜 추출
    if gt_file.exists():
        gt_text = gt_file.read_text(encoding='utf-8')
        gt_dates = extract_dates_from_text(gt_text)
    else:
        gt_dates = set()

    # 매칭 계산
    matched = ocr_dates & gt_dates
    missing = gt_dates - ocr_dates
    extra = ocr_dates - gt_dates

    coverage = (len(matched) / len(gt_dates) * 100) if len(gt_dates) > 0 else 100.0
    precision = (len(matched) / len(ocr_dates) * 100) if len(ocr_dates) > 0 else 0.0

    return OcrValidationResult(
        case_name=case_name,
        case_type=case_type,
        ocr_dates=ocr_dates,
        gt_dates=gt_dates,
        matched=matched,
        missing=missing,
        extra=extra,
        coverage=coverage,
        precision=precision
    )

def main():
    # Load cases
    cases_json = Path("/home/user/VNEXSUS-25-12-30/validation_cases_28.json")

    if not cases_json.exists():
        print(f"❌ Cases file not found: {cases_json}")
        return 1

    with open(cases_json) as f:
        cases = json.load(f)

    print("=" * 100)
    print("28개 케이스 OCR 품질 검증 (날짜 기반)")
    print("=" * 100)
    print()

    results = []

    for idx, case in enumerate(cases, 1):
        print(f"[{idx}/28] {case['name']}")
        result = validate_case(case)
        results.append(result)

        print(f"  OCR 날짜: {len(result.ocr_dates)}개")
        print(f"  GT 날짜: {len(result.gt_dates)}개")
        print(f"  매칭: {len(result.matched)}개")
        print(f"  누락: {len(result.missing)}개 (GT에는 있지만 OCR에 없음)")
        print(f"  추가: {len(result.extra)}개 (OCR에는 있지만 GT에 없음)")
        print(f"  Coverage: {result.coverage:.1f}% (GT 대비 OCR 포함률)")
        print(f"  Precision: {result.precision:.1f}% (OCR 대비 GT 정확도)")

        if len(result.matched) > 0:
            sample = sorted(result.matched)[:3]
            print(f"  매칭 샘플: {', '.join(sample)}")

        if len(result.missing) > 0:
            missing_sample = sorted(result.missing)[:3]
            print(f"  ⚠️  누락 샘플: {', '.join(missing_sample)}")

        print()

    # Summary
    print("=" * 100)
    print("통계 요약")
    print("=" * 100)
    print()

    total = len(results)
    avg_coverage = sum(r.coverage for r in results) / total if total > 0 else 0
    avg_precision = sum(r.precision for r in results) / total if total > 0 else 0

    high_coverage = [r for r in results if r.coverage >= 80]
    medium_coverage = [r for r in results if 60 <= r.coverage < 80]
    low_coverage = [r for r in results if r.coverage < 60]

    print(f"총 케이스: {total}개")
    print(f"평균 Coverage: {avg_coverage:.1f}%")
    print(f"평균 Precision: {avg_precision:.1f}%")
    print()
    print("Coverage 등급 분포:")
    print(f"  상 (80-100%): {len(high_coverage)}개 ({len(high_coverage)/total*100:.1f}%)")
    print(f"  중 (60-79%):  {len(medium_coverage)}개 ({len(medium_coverage)/total*100:.1f}%)")
    print(f"  하 (<60%):    {len(low_coverage)}개 ({len(low_coverage)/total*100:.1f}%)")
    print()

    # 케이스 타입별 통계
    case_types = {}
    for r in results:
        if r.case_type not in case_types:
            case_types[r.case_type] = []
        case_types[r.case_type].append(r)

    print("케이스 타입별 통계:")
    for case_type, type_results in case_types.items():
        avg_cov = sum(r.coverage for r in type_results) / len(type_results)
        avg_prec = sum(r.precision for r in type_results) / len(type_results)
        print(f"  {case_type:10s}: {len(type_results):2}개, Coverage {avg_cov:.1f}%, Precision {avg_prec:.1f}%")

    # JSON 출력
    output_file = Path("/home/user/VNEXSUS-25-12-30/ocr_validation_results_28.json")
    output_data = {
        "total_cases": total,
        "avg_coverage": avg_coverage,
        "avg_precision": avg_precision,
        "grade_distribution": {
            "high": len(high_coverage),
            "medium": len(medium_coverage),
            "low": len(low_coverage)
        },
        "cases": [
            {
                "name": r.case_name,
                "type": r.case_type,
                "ocr_dates_count": len(r.ocr_dates),
                "gt_dates_count": len(r.gt_dates),
                "matched_count": len(r.matched),
                "missing_count": len(r.missing),
                "extra_count": len(r.extra),
                "coverage": round(r.coverage, 2),
                "precision": round(r.precision, 2),
                "ocr_dates": sorted(list(r.ocr_dates))[:20],  # 최대 20개
                "gt_dates": sorted(list(r.gt_dates))[:20],
                "matched": sorted(list(r.matched))[:10],
                "missing": sorted(list(r.missing))[:10],
                "extra": sorted(list(r.extra))[:10]
            }
            for r in results
        ]
    }

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)

    print()
    print(f"✅ 상세 결과 저장: {output_file}")

    # HTML 보고서 생성
    html_output = generate_html_report(results, output_data)
    html_file = Path("/home/user/VNEXSUS-25-12-30/ocr_validation_report_28.html")
    html_file.write_text(html_output, encoding='utf-8')
    print(f"✅ HTML 보고서 생성: {html_file}")

    # 보고서 게시 및 브라우저 프리뷰
    try:
        from scripts.publish_html_report import publish_report
        report_info = publish_report(
            html_file=str(html_file),
            filename='ocr_validation_report_28.html',
            title='28개 케이스 OCR 품질 검증 보고서',
            open_browser=True
        )
        print("\n✅ 보고서가 브라우저에서 열렸습니다!")
        print(f"\n📊 GitHub URL (커밋 후 접근 가능):")
        print(f"   {report_info['github_raw_url']}")
    except Exception as e:
        print(f"\n⚠️  보고서 게시 중 오류: {e}")
        print(f"   HTML 파일 직접 확인: {html_file}")

    print()
    return 0

def generate_html_report(results, summary_data):
    """HTML 보고서 생성"""
    from datetime import datetime

    total = summary_data['total_cases']
    avg_coverage = summary_data['avg_coverage']
    avg_precision = summary_data['avg_precision']
    grade_dist = summary_data['grade_distribution']

    # 케이스 타입별 통계
    case_types = {}
    for r in results:
        if r.case_type not in case_types:
            case_types[r.case_type] = []
        case_types[r.case_type].append(r)

    type_stats = []
    for case_type, type_results in case_types.items():
        avg_cov = sum(r.coverage for r in type_results) / len(type_results)
        avg_prec = sum(r.precision for r in type_results) / len(type_results)
        type_stats.append({
            'type': case_type,
            'count': len(type_results),
            'coverage': avg_cov,
            'precision': avg_prec
        })

    # 케이스별 결과 테이블
    case_rows = []
    for r in results:
        coverage_class = 'badge-success' if r.coverage >= 80 else 'badge-warning' if r.coverage >= 60 else 'badge-danger'
        precision_class = 'badge-success' if r.precision >= 80 else 'badge-warning' if r.precision >= 60 else 'badge-danger'

        matched_sample = ', '.join(sorted(r.matched)[:3]) if len(r.matched) > 0 else '-'
        missing_sample = ', '.join(sorted(r.missing)[:3]) if len(r.missing) > 0 else '-'

        case_rows.append(f"""
        <tr>
            <td><strong>{r.case_name}</strong></td>
            <td>{r.case_type}</td>
            <td>{len(r.ocr_dates)}</td>
            <td>{len(r.gt_dates)}</td>
            <td>{len(r.matched)}</td>
            <td><span class="badge {coverage_class}">{r.coverage:.1f}%</span></td>
            <td><span class="badge {precision_class}">{r.precision:.1f}%</span></td>
            <td style="font-size: 0.85em; max-width: 200px;">{matched_sample}</td>
            <td style="font-size: 0.85em; max-width: 200px; color: #c53030;">{missing_sample}</td>
        </tr>
        """)

    return f"""<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>28개 케이스 OCR 품질 검증 보고서</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans KR', sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            padding: 20px;
        }}
        .container {{
            max-width: 1600px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }}
        .header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }}
        .header h1 {{
            font-size: 2.5em;
            margin-bottom: 10px;
        }}
        .content {{
            padding: 40px;
        }}
        .summary-box {{
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
            padding: 30px;
            border-radius: 12px;
            margin-bottom: 40px;
        }}
        .summary-box h2 {{
            margin-bottom: 20px;
        }}
        .stats-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 30px 0;
        }}
        .stat-card {{
            background: white;
            padding: 25px;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            text-align: center;
        }}
        .stat-card h3 {{
            color: #667eea;
            font-size: 0.9em;
            margin-bottom: 10px;
        }}
        .stat-card .value {{
            font-size: 2.5em;
            font-weight: bold;
            color: #2d3748;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }}
        thead {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }}
        th, td {{
            padding: 12px;
            text-align: left;
            font-size: 0.9em;
        }}
        tbody tr {{
            border-bottom: 1px solid #e2e8f0;
        }}
        tbody tr:hover {{
            background: #f7fafc;
        }}
        .badge {{
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 0.85em;
            font-weight: 600;
        }}
        .badge-success {{
            background: #c6f6d5;
            color: #22543d;
        }}
        .badge-warning {{
            background: #fef3c7;
            color: #92400e;
        }}
        .badge-danger {{
            background: #fed7d7;
            color: #742a2a;
        }}
        .section-title {{
            font-size: 1.8em;
            color: #2d3748;
            margin: 40px 0 20px;
            padding-bottom: 10px;
            border-bottom: 3px solid #667eea;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 28개 케이스 OCR 품질 검증 보고서</h1>
            <p>날짜 추출 기반 GT Baseline 비교</p>
            <p>생성일: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
        </div>

        <div class="content">
            <div class="summary-box">
                <h2>Executive Summary</h2>
                <ul style="list-style: none; padding: 0;">
                    <li style="margin: 10px 0;">✓ 총 케이스: {total}개</li>
                    <li style="margin: 10px 0;">✓ 평균 Coverage: {avg_coverage:.1f}% (GT 대비 OCR 포함률)</li>
                    <li style="margin: 10px 0;">✓ 평균 Precision: {avg_precision:.1f}% (OCR 대비 GT 정확도)</li>
                    <li style="margin: 10px 0;">✓ 상위 등급 (80-100%): {grade_dist['high']}개 ({grade_dist['high']/total*100:.1f}%)</li>
                    <li style="margin: 10px 0;">✓ 중위 등급 (60-79%): {grade_dist['medium']}개 ({grade_dist['medium']/total*100:.1f}%)</li>
                    <li style="margin: 10px 0;">✓ 하위 등급 (<60%): {grade_dist['low']}개 ({grade_dist['low']/total*100:.1f}%)</li>
                </ul>
            </div>

            <h2 class="section-title">통계 요약</h2>
            <div class="stats-grid">
                <div class="stat-card">
                    <h3>총 케이스</h3>
                    <div class="value">{total}</div>
                </div>
                <div class="stat-card">
                    <h3>평균 Coverage</h3>
                    <div class="value">{avg_coverage:.1f}%</div>
                </div>
                <div class="stat-card">
                    <h3>평균 Precision</h3>
                    <div class="value">{avg_precision:.1f}%</div>
                </div>
                <div class="stat-card">
                    <h3>상위 등급</h3>
                    <div class="value">{grade_dist['high']}</div>
                </div>
            </div>

            <h2 class="section-title">케이스 타입별 통계</h2>
            <table>
                <thead>
                    <tr>
                        <th>케이스 타입</th>
                        <th>케이스 수</th>
                        <th>평균 Coverage</th>
                        <th>평균 Precision</th>
                    </tr>
                </thead>
                <tbody>
                    {''.join([f'''
                    <tr>
                        <td><strong>{ts['type']}</strong></td>
                        <td>{ts['count']}개</td>
                        <td>{ts['coverage']:.1f}%</td>
                        <td>{ts['precision']:.1f}%</td>
                    </tr>
                    ''' for ts in type_stats])}
                </tbody>
            </table>

            <h2 class="section-title">케이스별 상세 결과</h2>
            <table>
                <thead>
                    <tr>
                        <th>케이스명</th>
                        <th>타입</th>
                        <th>OCR 날짜</th>
                        <th>GT 날짜</th>
                        <th>매칭</th>
                        <th>Coverage</th>
                        <th>Precision</th>
                        <th>매칭 샘플</th>
                        <th>누락 샘플</th>
                    </tr>
                </thead>
                <tbody>
                    {''.join(case_rows)}
                </tbody>
            </table>

            <div style="margin-top: 40px; padding: 20px; background: #edf2f7; border-radius: 12px; text-align: center;">
                <p style="color: #4a5568;">
                    <strong>VNEXSUS OCR Validation System</strong> |
                    28 Cases Analysis |
                    {datetime.now().isoformat()}
                </p>
            </div>
        </div>
    </div>
</body>
</html>"""

if __name__ == "__main__":
    import sys
    sys.exit(main())
