/**
 * HTML 보고서 게시 및 프리뷰 유틸리티
 *
 * 기능:
 * 1. HTML 보고서를 reports/ 디렉토리에 저장
 * 2. GitHub raw URL 생성
 * 3. 시스템 브라우저로 HTML 파일 열기
 * 4. GitHub 링크 반환
 *
 * 사용법:
 *   import { publishReport } from './utils/reportPublisher.js';
 *
 *   const info = await publishReport({
 *     htmlContent: '<html>...</html>',
 *     filename: 'my-report.html',
 *     title: '내 보고서'
 *   });
 *
 *   console.log(info.githubUrl);
 *   console.log(info.localPath);
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 설정
const CONFIG = {
  reportsDir: path.join(process.cwd(), 'reports'),
  githubRepo: 'nofnotg/VNEXSUS-25-12-30', // GitHub 저장소 (필요시 수정)
  branch: 'claude/medical-ocr-event-pipeline-dnReg'
};

/**
 * reports 디렉토리가 없으면 생성
 */
function ensureReportsDir() {
  if (!fs.existsSync(CONFIG.reportsDir)) {
    fs.mkdirSync(CONFIG.reportsDir, { recursive: true });
    console.log(`📁 Created reports directory: ${CONFIG.reportsDir}`);
  }
}

/**
 * GitHub 저장소 정보 가져오기
 */
async function getGitHubInfo() {
  try {
    const { stdout: remoteUrl } = await execAsync('git config --get remote.origin.url');
    const url = remoteUrl.trim();

    // GitHub URL 파싱
    let owner, repo;
    if (url.startsWith('git@github.com:')) {
      // SSH 형식: git@github.com:owner/repo.git
      const match = url.match(/git@github\.com:(.+?)\/(.+?)\.git/);
      if (match) {
        owner = match[1];
        repo = match[2];
      }
    } else if (url.startsWith('https://github.com/')) {
      // HTTPS 형식: https://github.com/owner/repo.git
      const match = url.match(/https:\/\/github\.com\/(.+?)\/(.+?)(\.git)?$/);
      if (match) {
        owner = match[1];
        repo = match[2];
      }
    }

    if (owner && repo) {
      return { owner, repo: repo.replace('.git', '') };
    }
  } catch (error) {
    console.warn('⚠️  Could not get GitHub info from git remote:', error.message);
  }

  // 기본값 사용
  return { owner: 'nofnotg', repo: 'VNEXSUS-25-12-30' };
}

/**
 * 시스템 브라우저로 HTML 파일 열기
 */
async function openInBrowser(filePath) {
  const platform = process.platform;
  let command;

  if (platform === 'darwin') {
    command = `open "${filePath}"`;
  } else if (platform === 'win32') {
    command = `start "" "${filePath}"`;
  } else {
    // Linux
    command = `xdg-open "${filePath}"`;
  }

  try {
    await execAsync(command);
    console.log(`🌐 Opened in browser: ${filePath}`);
  } catch (error) {
    console.warn(`⚠️  Could not open browser: ${error.message}`);
    console.log(`📄 Please open manually: ${filePath}`);
  }
}

/**
 * HTML 보고서 게시
 *
 * @param {Object} options - 옵션
 * @param {string} options.htmlContent - HTML 내용
 * @param {string} options.filename - 파일명 (예: 'report.html')
 * @param {string} options.title - 보고서 제목
 * @param {boolean} options.openBrowser - 브라우저 자동 열기 (기본: true)
 * @returns {Promise<Object>} - 보고서 정보
 */
export async function publishReport(options) {
  const {
    htmlContent,
    filename,
    title = 'Report',
    openBrowser = true
  } = options;

  if (!htmlContent) {
    throw new Error('htmlContent is required');
  }

  if (!filename) {
    throw new Error('filename is required');
  }

  console.log('\n📊 Publishing HTML Report...');
  console.log(`   Title: ${title}`);
  console.log(`   Filename: ${filename}`);

  // 1. reports 디렉토리 확인/생성
  ensureReportsDir();

  // 2. HTML 파일 저장
  const reportPath = path.join(CONFIG.reportsDir, filename);
  fs.writeFileSync(reportPath, htmlContent, 'utf-8');
  console.log(`✅ Saved: ${reportPath}`);

  // 3. GitHub 정보 가져오기
  const { owner, repo } = await getGitHubInfo();

  // 4. GitHub raw URL 생성
  const githubRawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${CONFIG.branch}/reports/${filename}`;
  const githubRepoUrl = `https://github.com/${owner}/${repo}/blob/${CONFIG.branch}/reports/${filename}`;

  // 5. 브라우저로 열기 (로컬 파일)
  if (openBrowser) {
    await openInBrowser(reportPath);
  }

  // 6. 결과 반환
  const result = {
    title,
    filename,
    localPath: reportPath,
    githubRawUrl,
    githubRepoUrl,
    relativePath: `reports/${filename}`
  };

  console.log('\n📋 Report Information:');
  console.log(`   Local Path: ${result.localPath}`);
  console.log(`   GitHub Raw: ${result.githubRawUrl}`);
  console.log(`   GitHub Repo: ${result.githubRepoUrl}`);
  console.log('\n💡 Tip: Commit and push to GitHub to make the raw URL accessible.\n');

  return result;
}

/**
 * 여러 보고서를 한 번에 게시
 */
export async function publishMultipleReports(reports) {
  const results = [];

  for (const report of reports) {
    const result = await publishReport(report);
    results.push(result);
  }

  return results;
}

/**
 * 보고서 인덱스 HTML 생성
 */
export function generateReportIndex(reports) {
  const reportsList = reports
    .map(r => `
      <li>
        <strong>${r.title}</strong><br>
        <a href="${r.filename}" target="_blank">View Report</a> |
        <a href="${r.githubRepoUrl}" target="_blank">View on GitHub</a>
      </li>
    `)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VNEXSUS Reports Index</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 20px;
      background: #f5f7fa;
    }
    h1 {
      color: #2d3748;
      border-bottom: 3px solid #667eea;
      padding-bottom: 10px;
    }
    ul {
      list-style: none;
      padding: 0;
    }
    li {
      background: white;
      margin: 15px 0;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    a {
      color: #667eea;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <h1>📊 VNEXSUS Reports</h1>
  <p>Generated: ${new Date().toLocaleString('ko-KR')}</p>
  <ul>
    ${reportsList}
  </ul>
</body>
</html>`;
}

export default {
  publishReport,
  publishMultipleReports,
  generateReportIndex
};
