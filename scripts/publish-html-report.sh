#!/bin/bash
#
# HTML 보고서 게시 및 브라우저 프리뷰 스크립트
#
# 사용법:
#   ./scripts/publish-html-report.sh <html-file> [title]
#
# 예시:
#   ./scripts/publish-html-report.sh my-report.html "My Report"
#   ./scripts/publish-html-report.sh output/report.html
#

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 인자 확인
if [ -z "$1" ]; then
  echo -e "${RED}❌ Error: HTML file path required${NC}"
  echo "Usage: $0 <html-file> [title]"
  exit 1
fi

HTML_FILE="$1"
TITLE="${2:-Report}"

# 파일 존재 확인
if [ ! -f "$HTML_FILE" ]; then
  echo -e "${RED}❌ Error: File not found: $HTML_FILE${NC}"
  exit 1
fi

# 파일명 추출
FILENAME=$(basename "$HTML_FILE")
REPORTS_DIR="reports"

# reports 디렉토리 생성
if [ ! -d "$REPORTS_DIR" ]; then
  mkdir -p "$REPORTS_DIR"
  echo -e "${GREEN}📁 Created reports directory${NC}"
fi

# HTML 파일 복사
DEST_PATH="$REPORTS_DIR/$FILENAME"
cp "$HTML_FILE" "$DEST_PATH"
echo -e "${GREEN}✅ Copied to: $DEST_PATH${NC}"

# GitHub 정보 가져오기
REMOTE_URL=$(git config --get remote.origin.url || echo "")
BRANCH=$(git rev-parse --abbrev-ref HEAD)

# GitHub URL 파싱
OWNER=""
REPO=""

if [[ "$REMOTE_URL" =~ git@github\.com:(.+)/(.+)\.git ]]; then
  OWNER="${BASH_REMATCH[1]}"
  REPO="${BASH_REMATCH[2]}"
elif [[ "$REMOTE_URL" =~ https://github\.com/(.+)/(.+)(\.git)?$ ]]; then
  OWNER="${BASH_REMATCH[1]}"
  REPO="${BASH_REMATCH[2]%.git}"
fi

# 기본값 설정
OWNER="${OWNER:-nofnotg}"
REPO="${REPO:-VNEXSUS-25-12-30}"

# GitHub URLs 생성
GITHUB_RAW_URL="https://raw.githubusercontent.com/$OWNER/$REPO/$BRANCH/reports/$FILENAME"
GITHUB_REPO_URL="https://github.com/$OWNER/$REPO/blob/$BRANCH/reports/$FILENAME"

# 브라우저로 열기
echo -e "${BLUE}🌐 Opening browser preview...${NC}"
if [[ "$OSTYPE" == "darwin"* ]]; then
  open "$DEST_PATH"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  xdg-open "$DEST_PATH" 2>/dev/null || echo -e "${YELLOW}⚠️  Could not open browser automatically${NC}"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
  start "$DEST_PATH"
fi

# 결과 출력
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}📊 Report Published Successfully!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}Title:${NC}           $TITLE"
echo -e "${BLUE}Local Path:${NC}      $(pwd)/$DEST_PATH"
echo -e "${BLUE}GitHub Raw URL:${NC}  $GITHUB_RAW_URL"
echo -e "${BLUE}GitHub Repo URL:${NC} $GITHUB_REPO_URL"
echo ""
echo -e "${YELLOW}💡 Tip: Commit and push to GitHub to make the raw URL accessible.${NC}"
echo ""
