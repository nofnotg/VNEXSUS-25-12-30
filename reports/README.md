# 📊 VNEXSUS HTML 보고서 시스템

이 디렉토리는 VNEXSUS 프로젝트의 모든 HTML 보고서를 저장하고 관리합니다.

## 🎯 개요

HTML 보고서는 다음과 같은 방식으로 제공됩니다:

1. **브라우저 프리뷰**: 보고서 생성 시 자동으로 브라우저에서 열림
2. **GitHub 링크**: 커밋 후 GitHub에서 직접 접근 가능
3. **로컬 파일**: `reports/` 디렉토리에 저장

## 📝 사용 방법

### Python 스크립트에서 사용

```python
from scripts.publish_html_report import publish_report

# HTML 내용으로 게시
report_info = publish_report(
    html_content='<html>...</html>',
    filename='my-report.html',
    title='내 보고서',
    open_browser=True  # 브라우저 자동 열기
)

# HTML 파일로 게시
report_info = publish_report(
    html_file='path/to/report.html',
    title='내 보고서'
)

# 결과 사용
print(report_info['github_raw_url'])  # GitHub Raw URL
print(report_info['github_repo_url'])  # GitHub Repo URL
print(report_info['local_path'])      # 로컬 경로
```

### JavaScript에서 사용

```javascript
import { publishReport } from './utils/reportPublisher.js';

const reportInfo = await publishReport({
  htmlContent: '<html>...</html>',
  filename: 'my-report.html',
  title: '내 보고서',
  openBrowser: true
});

console.log(reportInfo.githubRawUrl);
console.log(reportInfo.githubRepoUrl);
console.log(reportInfo.localPath);
```

### CLI에서 사용

```bash
# Python 스크립트 사용
python3 scripts/publish_html_report.py my-report.html "내 보고서"

# Shell 스크립트 사용 (Linux/Mac)
./scripts/publish-html-report.sh my-report.html "내 보고서"
```

## 🔧 기능

### 1. 자동 브라우저 프리뷰

보고서를 생성하면 자동으로 시스템 기본 브라우저에서 열립니다.

### 2. GitHub 링크 생성

커밋 후 다음 링크로 접근 가능:

- **Raw URL**: `https://raw.githubusercontent.com/{owner}/{repo}/{branch}/reports/{filename}`
- **Repo URL**: `https://github.com/{owner}/{repo}/blob/{branch}/reports/{filename}`

### 3. reports/ 디렉토리 자동 관리

모든 보고서는 `reports/` 디렉토리에 저장되어 체계적으로 관리됩니다.

## 📂 디렉토리 구조

```
reports/
├── README.md                          # 이 파일
├── OCR_Pipeline_Validation_Report.html
├── ocr_validation_report_28.html
├── test-report-publisher.html
└── evaluation/                        # 평가 관련 보고서
```

## 🚀 예제

### OCR 검증 보고서 생성 예제

```python
#!/usr/bin/env python3
from scripts.publish_html_report import publish_report

# HTML 보고서 생성
html_content = """
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <title>OCR 검증 보고서</title>
</head>
<body>
    <h1>OCR 검증 결과</h1>
    <p>Coverage: 85.3%</p>
    <p>Precision: 92.1%</p>
</body>
</html>
"""

# 보고서 게시
info = publish_report(
    html_content=html_content,
    filename='ocr_validation.html',
    title='OCR 검증 보고서'
)

print(f"✅ 보고서 게시 완료!")
print(f"📍 로컬: {info['local_path']}")
print(f"🌐 GitHub: {info['github_raw_url']}")
```

### JavaScript에서 보고서 생성 예제

```javascript
import { publishReport } from './utils/reportPublisher.js';

async function generateAndPublishReport() {
  // HTML 생성
  const html = `
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <title>파이프라인 보고서</title>
    </head>
    <body>
        <h1>파이프라인 검증 결과</h1>
        <p>모든 테스트 통과</p>
    </body>
    </html>
  `;

  // 보고서 게시
  const info = await publishReport({
    htmlContent: html,
    filename: 'pipeline_report.html',
    title: '파이프라인 검증 보고서'
  });

  console.log('✅ 보고서 게시 완료!');
  console.log(`📍 로컬: ${info.localPath}`);
  console.log(`🌐 GitHub: ${info.githubRawUrl}`);
}

generateAndPublishReport();
```

## 📖 기존 스크립트 업데이트

기존 보고서 생성 스크립트를 업데이트하려면:

### Before (직접 HTML 파일 저장)

```python
html_file = Path("report.html")
html_file.write_text(html_content, encoding='utf-8')
print(f"✅ 보고서 생성: {html_file}")
```

### After (게시 시스템 사용)

```python
from scripts.publish_html_report import publish_report

info = publish_report(
    html_content=html_content,
    filename='report.html',
    title='보고서 제목'
)
print(f"✅ 보고서 게시 완료!")
print(f"🌐 GitHub URL: {info['github_raw_url']}")
```

## 🔗 GitHub에서 보고서 접근하기

1. **커밋 및 푸시**

   ```bash
   git add reports/
   git commit -m "feat: Add new HTML report"
   git push origin claude/medical-ocr-event-pipeline-dnReg
   ```

2. **GitHub에서 확인**

   - Repo URL: 코드 보기 및 다운로드
   - Raw URL: 브라우저에서 직접 HTML 렌더링

## 🛠️ 지원 도구

### Python

- `scripts/publish_html_report.py`: Python 유틸리티

### JavaScript

- `utils/reportPublisher.js`: JavaScript 모듈

### Shell

- `scripts/publish-html-report.sh`: Shell 스크립트

## 📌 참고사항

1. **브라우저 프리뷰**: 로컬 파일을 직접 엽니다 (인터넷 연결 불필요)
2. **GitHub 링크**: 커밋 및 푸시 후 접근 가능
3. **자동 디렉토리 생성**: `reports/` 디렉토리가 없으면 자동 생성

## 🎨 HTML 보고서 스타일 가이드

보고서는 다음과 같은 스타일을 권장합니다:

```html
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>보고서 제목</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans KR', sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 40px 20px;
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>보고서 제목</h1>
        <!-- 내용 -->
    </div>
</body>
</html>
```

## 📞 문의

문제가 발생하면 프로젝트 이슈 트래커에 등록해주세요.
