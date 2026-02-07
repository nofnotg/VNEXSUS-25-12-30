#!/usr/bin/env python3
"""
HTML 보고서 게시 및 브라우저 프리뷰 유틸리티

사용법:
    from scripts.publish_html_report import publish_report

    info = publish_report(
        html_content='<html>...</html>',
        filename='my-report.html',
        title='My Report'
    )

    print(info['github_raw_url'])
    print(info['local_path'])

CLI 사용법:
    python scripts/publish_html_report.py my-report.html "My Report"
"""

import os
import sys
import shutil
import subprocess
import webbrowser
from pathlib import Path
from typing import Dict, Optional


class ReportPublisher:
    """HTML 보고서 게시 클래스"""

    def __init__(self, reports_dir: str = 'reports'):
        self.reports_dir = Path(reports_dir)
        self.ensure_reports_dir()

    def ensure_reports_dir(self):
        """reports 디렉토리 생성"""
        if not self.reports_dir.exists():
            self.reports_dir.mkdir(parents=True, exist_ok=True)
            print(f"📁 Created reports directory: {self.reports_dir}")

    def get_git_info(self) -> Dict[str, str]:
        """GitHub 저장소 정보 가져오기"""
        try:
            # remote URL 가져오기
            result = subprocess.run(
                ['git', 'config', '--get', 'remote.origin.url'],
                capture_output=True,
                text=True,
                check=True
            )
            remote_url = result.stdout.strip()

            # branch 가져오기
            result = subprocess.run(
                ['git', 'rev-parse', '--abbrev-ref', 'HEAD'],
                capture_output=True,
                text=True,
                check=True
            )
            branch = result.stdout.strip()

            # URL 파싱
            owner, repo = self._parse_github_url(remote_url)

            return {
                'owner': owner,
                'repo': repo,
                'branch': branch
            }
        except Exception as e:
            print(f"⚠️  Could not get git info: {e}")
            return {
                'owner': 'nofnotg',
                'repo': 'VNEXSUS-25-12-30',
                'branch': 'claude/medical-ocr-event-pipeline-dnReg'
            }

    def _parse_github_url(self, url: str) -> tuple:
        """GitHub URL 파싱"""
        import re

        # SSH format: git@github.com:owner/repo.git
        ssh_pattern = r'git@github\.com:(.+?)/(.+?)\.git'
        ssh_match = re.match(ssh_pattern, url)
        if ssh_match:
            return ssh_match.group(1), ssh_match.group(2)

        # HTTPS format: https://github.com/owner/repo.git
        https_pattern = r'https://github\.com/(.+?)/(.+?)(\.git)?$'
        https_match = re.match(https_pattern, url)
        if https_match:
            return https_match.group(1), https_match.group(2).replace('.git', '')

        # 기본값
        return 'nofnotg', 'VNEXSUS-25-12-30'

    def open_in_browser(self, file_path: Path):
        """브라우저로 파일 열기"""
        try:
            webbrowser.open(f'file://{file_path.absolute()}')
            print(f"🌐 Opened in browser: {file_path}")
        except Exception as e:
            print(f"⚠️  Could not open browser: {e}")
            print(f"📄 Please open manually: {file_path}")

    def publish(
        self,
        html_content: Optional[str] = None,
        html_file: Optional[str] = None,
        filename: Optional[str] = None,
        title: str = 'Report',
        open_browser: bool = True
    ) -> Dict[str, str]:
        """
        HTML 보고서 게시

        Args:
            html_content: HTML 내용 (문자열)
            html_file: HTML 파일 경로 (html_content 대신 사용)
            filename: 저장할 파일명
            title: 보고서 제목
            open_browser: 브라우저 자동 열기

        Returns:
            보고서 정보 딕셔너리
        """
        print(f"\n📊 Publishing HTML Report...")
        print(f"   Title: {title}")

        # HTML 내용 가져오기
        if html_file:
            html_file_path = Path(html_file)
            if not html_file_path.exists():
                raise FileNotFoundError(f"HTML file not found: {html_file}")

            if not filename:
                filename = html_file_path.name

            # 파일 복사
            dest_path = self.reports_dir / filename
            shutil.copy(html_file_path, dest_path)
        elif html_content:
            if not filename:
                raise ValueError("filename is required when using html_content")

            # HTML 내용 저장
            dest_path = self.reports_dir / filename
            dest_path.write_text(html_content, encoding='utf-8')
        else:
            raise ValueError("Either html_content or html_file must be provided")

        print(f"✅ Saved: {dest_path}")

        # GitHub 정보
        git_info = self.get_git_info()
        owner = git_info['owner']
        repo = git_info['repo']
        branch = git_info['branch']

        # GitHub URLs
        github_raw_url = f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/reports/{filename}"
        github_repo_url = f"https://github.com/{owner}/{repo}/blob/{branch}/reports/{filename}"

        # 브라우저 열기
        if open_browser:
            self.open_in_browser(dest_path)

        # 결과
        result = {
            'title': title,
            'filename': filename,
            'local_path': str(dest_path.absolute()),
            'github_raw_url': github_raw_url,
            'github_repo_url': github_repo_url,
            'relative_path': f'reports/{filename}'
        }

        print("\n📋 Report Information:")
        print(f"   Local Path: {result['local_path']}")
        print(f"   GitHub Raw: {result['github_raw_url']}")
        print(f"   GitHub Repo: {result['github_repo_url']}")
        print("\n💡 Tip: Commit and push to GitHub to make the raw URL accessible.\n")

        return result


# 싱글톤 인스턴스
_publisher = None


def get_publisher() -> ReportPublisher:
    """ReportPublisher 싱글톤 인스턴스 가져오기"""
    global _publisher
    if _publisher is None:
        _publisher = ReportPublisher()
    return _publisher


def publish_report(
    html_content: Optional[str] = None,
    html_file: Optional[str] = None,
    filename: Optional[str] = None,
    title: str = 'Report',
    open_browser: bool = True
) -> Dict[str, str]:
    """
    HTML 보고서 게시 (편의 함수)

    Args:
        html_content: HTML 내용 (문자열)
        html_file: HTML 파일 경로 (html_content 대신 사용)
        filename: 저장할 파일명
        title: 보고서 제목
        open_browser: 브라우저 자동 열기

    Returns:
        보고서 정보 딕셔너리
    """
    publisher = get_publisher()
    return publisher.publish(
        html_content=html_content,
        html_file=html_file,
        filename=filename,
        title=title,
        open_browser=open_browser
    )


def main():
    """CLI 메인 함수"""
    if len(sys.argv) < 2:
        print("❌ Error: HTML file path required")
        print(f"Usage: {sys.argv[0]} <html-file> [title]")
        sys.exit(1)

    html_file = sys.argv[1]
    title = sys.argv[2] if len(sys.argv) > 2 else 'Report'

    try:
        info = publish_report(html_file=html_file, title=title)
        print("✅ Report published successfully!")
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
