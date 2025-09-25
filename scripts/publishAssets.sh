#!/bin/bash
# --------------------------------------------------------
# 질병 코드 인덱스 압축 및 GCS 업로드 스크립트
# --------------------------------------------------------

set -e  # 오류 발생 시 스크립트 종료

# 설정
DATA_DIR="./data"
FULL_JSON="$DATA_DIR/disease_codes.json"
BRIEF_JSON="$DATA_DIR/disease_codes_brief.json"
COMPRESSED_DIR="$DATA_DIR/compressed"
FULL_COMPRESSED="$COMPRESSED_DIR/disease_codes.json.zst"
BRIEF_COMPRESSED="$COMPRESSED_DIR/disease_codes_brief.json.zst"

# .env 파일에서 환경변수 로드
if [ -f .env ]; then
    echo "환경 변수 로드 중..."
    export $(grep -v '^#' .env | xargs)
else
    echo "ERROR: .env 파일이 없습니다. 환경변수 설정이 필요합니다."
    exit 1
fi

# 필요한 환경변수 확인
if [ -z "$GCS_BUCKET_STATIC" ]; then
    echo "ERROR: GCS_BUCKET_STATIC 환경변수가 설정되지 않았습니다."
    exit 1
fi

# 압축 디렉토리 생성
mkdir -p "$COMPRESSED_DIR"

echo "=== 질병 코드 인덱스 파일 압축 및 배포 시작 ==="

# 입력 파일 존재 여부 확인
if [ ! -f "$FULL_JSON" ] || [ ! -f "$BRIEF_JSON" ]; then
    echo "ERROR: 입력 JSON 파일이 없습니다. buildDiseaseIndex.py를 먼저 실행하세요."
    exit 1
fi

# zstd 설치 여부 확인
if ! command -v zstd &> /dev/null; then
    echo "ERROR: zstd가 설치되어 있지 않습니다."
    echo "Ubuntu: sudo apt-get install zstd"
    echo "macOS: brew install zstd"
    echo "Windows: choco install zstandard"
    exit 1
fi

# gsutil 설치 여부 확인
if ! command -v gsutil &> /dev/null; then
    echo "ERROR: gsutil이 설치되어 있지 않습니다. Google Cloud SDK를 설치하세요."
    echo "https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# 파일 압축
echo "전체 질병 코드 파일 압축 중..."
zstd -19 -f "$FULL_JSON" -o "$FULL_COMPRESSED"

echo "간략 질병 코드 파일 압축 중..."
zstd -19 -f "$BRIEF_JSON" -o "$BRIEF_COMPRESSED"

# 압축률 출력
FULL_SIZE=$(du -h "$FULL_JSON" | cut -f1)
FULL_COMPRESSED_SIZE=$(du -h "$FULL_COMPRESSED" | cut -f1)
BRIEF_SIZE=$(du -h "$BRIEF_JSON" | cut -f1)
BRIEF_COMPRESSED_SIZE=$(du -h "$BRIEF_COMPRESSED" | cut -f1)

echo "압축 결과:"
echo "  전체: $FULL_SIZE → $FULL_COMPRESSED_SIZE"
echo "  간략: $BRIEF_SIZE → $BRIEF_COMPRESSED_SIZE"

# GCS 업로드
echo "GCS 버킷으로 파일 업로드 중..."
gsutil -h "Cache-Control:public,max-age=86400" cp "$FULL_COMPRESSED" "gs://$GCS_BUCKET_STATIC/disease-index/disease_codes.json.zst"
gsutil -h "Cache-Control:public,max-age=86400" cp "$BRIEF_COMPRESSED" "gs://$GCS_BUCKET_STATIC/disease-index/disease_codes_brief.json.zst"

# 공개 URL 생성 (옵션)
if gsutil ls -L "gs://$GCS_BUCKET_STATIC/disease-index/disease_codes.json.zst" | grep -q "PUBLICLY_READABLE"; then
    FULL_URL="https://storage.googleapis.com/$GCS_BUCKET_STATIC/disease-index/disease_codes.json.zst"
    BRIEF_URL="https://storage.googleapis.com/$GCS_BUCKET_STATIC/disease-index/disease_codes_brief.json.zst"
    
    echo "공개 URL:"
    echo "  전체: $FULL_URL"
    echo "  간략: $BRIEF_URL"
    
    # .env 파일 업데이트 (DISEASE_INDEX_URL)
    if grep -q "DISEASE_INDEX_URL" .env; then
        sed -i "s|DISEASE_INDEX_URL=.*|DISEASE_INDEX_URL=$BRIEF_URL|g" .env
    else
        echo "DISEASE_INDEX_URL=$BRIEF_URL" >> .env
    fi
    
    echo ".env 파일의 DISEASE_INDEX_URL이 업데이트되었습니다."
else
    echo "참고: 버킷이 공개 읽기 설정이 아니므로 공개 URL을 생성할 수 없습니다."
    echo "필요한 경우 다음 명령으로 버킷을 공개로 설정할 수 있습니다:"
    echo "gsutil iam ch allUsers:objectViewer gs://$GCS_BUCKET_STATIC"
fi

echo "=== 질병 코드 인덱스 파일 압축 및 배포 완료 ===" 