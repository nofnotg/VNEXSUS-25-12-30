#!/bin/bash
# Gemini Flash 비교 분석 실행 스크립트
# 날짜: 2026-01-17
# 목적: 난이도별 6개 케이스를 Gemini Flash로 실행하고 GPT-4o-mini와 비교

set -e

# ============================================================
# 환경 설정
# ============================================================

# .env 파일 로드
if [ -f .env ]; then
    set -a
    source .env
    set +a
    echo "✅ .env 파일 로드 완료"
else
    echo "❌ .env 파일을 찾을 수 없습니다."
    exit 1
fi

# Gemini 모드 활성화
export USE_GEMINI=true

# API 키 확인
if [ -z "$GOOGLE_API_KEY" ] && [ -z "$GOOGLE_GENERATIVE_AI_API_KEY" ]; then
    echo "❌ GOOGLE_API_KEY 또는 GOOGLE_GENERATIVE_AI_API_KEY 환경변수가 설정되지 않았습니다."
    echo ""
    echo "다음 중 하나를 .env 파일에 추가하세요:"
    echo "  GOOGLE_API_KEY=your_api_key_here"
    echo "  또는"
    echo "  GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here"
    exit 1
fi

echo "✅ Gemini API 키 확인 완료"

# ============================================================
# 케이스 정의
# ============================================================

# 상 (High Quality) - 100% 통과
HIGH_CASES=(
    "KB손해보험_김태형_안정형_협심증_"
    "현대해상_조윤아_태아보험__엄마_이주희_"
)

# 중 (Medium Quality) - 80-97% 통과
MED_CASES=(
    "이정희"
    "장유찬"
)

# 하 (Low Quality) - <80% 통과
LOW_CASES=(
    "농협손해보험_김인화_후유장해_"
    "농협손해보험_이광욱_고지의무_위반_심질환_"
)

# 전체 케이스 병합
ALL_CASES=("${HIGH_CASES[@]}" "${MED_CASES[@]}" "${LOW_CASES[@]}")

# 출력 디렉토리
OUTPUT_DIR="outputs/gemini-comparison"

# ============================================================
# 출력 디렉토리 생성
# ============================================================

mkdir -p "$OUTPUT_DIR"
echo "✅ 출력 디렉토리 생성: $OUTPUT_DIR"

# ============================================================
# 케이스 실행
# ============================================================

echo ""
echo "════════════════════════════════════════════════════════"
echo "Gemini Flash 비교 분석 시작"
echo "════════════════════════════════════════════════════════"
echo ""
echo "총 케이스 수: ${#ALL_CASES[@]}"
echo "  - 상 (High): ${#HIGH_CASES[@]}개"
echo "  - 중 (Medium): ${#MED_CASES[@]}개"
echo "  - 하 (Low): ${#LOW_CASES[@]}개"
echo ""

TOTAL=${#ALL_CASES[@]}
CURRENT=0
FAILED=0

for case_name in "${ALL_CASES[@]}"; do
    CURRENT=$((CURRENT + 1))
    echo "────────────────────────────────────────────────────────"
    echo "[$CURRENT/$TOTAL] 실행 중: $case_name"
    echo "────────────────────────────────────────────────────────"

    # 데이터 레포 경로
    DATA_REPO="$REPORTS_PDF_ROOT/offline_ocr_samples/offline_ocr_samples/2025-12-26T02-18-51-219Z"
    CASE_DIR="$DATA_REPO/${case_name}"

    # blocks.csv 파일 경로
    BLOCKS_FILE="$CASE_DIR/${case_name}_blocks.csv"

    if [ ! -f "$BLOCKS_FILE" ]; then
        echo "❌ 파일을 찾을 수 없습니다: $BLOCKS_FILE"
        FAILED=$((FAILED + 1))
        continue
    fi

    echo "📁 입력: $BLOCKS_FILE"
    echo "📁 출력: $OUTPUT_DIR/${case_name}_blocks/"

    # TypeScript 스크립트 실행
    if npm run realtime:llm -- "$BLOCKS_FILE" "$OUTPUT_DIR/${case_name}_blocks"; then
        echo "✅ 완료: $case_name"
    else
        echo "❌ 실패: $case_name"
        FAILED=$((FAILED + 1))
    fi

    echo ""
done

# ============================================================
# 결과 요약
# ============================================================

echo "════════════════════════════════════════════════════════"
echo "실행 완료"
echo "════════════════════════════════════════════════════════"
echo ""
echo "총 케이스: $TOTAL"
echo "성공: $((TOTAL - FAILED))"
echo "실패: $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo "✅ 모든 케이스 실행 완료!"
else
    echo "⚠️  $FAILED개 케이스 실행 실패"
fi

echo ""
echo "다음 단계:"
echo "  1. 날짜 검증: python3 scripts/validate-gemini-comparison.py"
echo "  2. 비교 보고서 생성: node scripts/generate-gemini-comparison-report.js"
echo ""
