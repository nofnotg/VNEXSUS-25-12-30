@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: 제목 설정
title VNEXSUS 서버 시작

echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║                    VNEXSUS 서버 시작                           ║
echo ║              의료 문서 OCR 및 고지의무 분석 시스템                ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.

:: 현재 디렉토리 확인
if not exist "backend" (
    echo [❌ 오류] backend 폴더를 찾을 수 없습니다.
    echo 현재 디렉토리: %CD%
    echo.
    echo VNEXSUS-25-12-30 프로젝트 루트 폴더에서 실행해주세요.
    echo.
    pause
    exit /b 1
)

:: .env 파일 확인
if not exist ".env" (
    echo [⚠️  경고] .env 파일을 찾을 수 없습니다.
    echo.
    echo 초기 설정이 필요합니다. windows-setup.bat를 실행하시겠습니까?
    echo.
    choice /C YN /M "windows-setup.bat 실행하시겠습니까? (Y/N)"
    if !errorLevel! equ 1 (
        call windows-setup.bat
        if !errorLevel! neq 0 (
            echo [❌ 오류] 초기 설정 실패
            pause
            exit /b 1
        )
    ) else (
        echo 초기 설정 없이 계속할 수 없습니다.
        pause
        exit /b 1
    )
)

:: Node.js 확인
echo [1/5] Node.js 확인 중...
node --version >nul 2>&1
if %errorLevel% neq 0 (
    echo [❌ 오류] Node.js가 설치되지 않았습니다.
    echo.
    echo Node.js를 설치해주세요: https://nodejs.org/
    echo LTS 버전 권장 (18.x 이상)
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo [✓] Node.js !NODE_VERSION! 확인 완료

:: 포트 사용 확인
echo [2/5] 포트 3030 사용 여부 확인 중...
netstat -ano | findstr :3030 >nul 2>&1
if %errorLevel% equ 0 (
    echo [⚠️  경고] 포트 3030이 이미 사용 중입니다.
    echo.
    echo 기존 프로세스를 종료하시겠습니까?
    choice /C YN /M "종료하시겠습니까? (Y/N)"
    if !errorLevel! equ 1 (
        for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3030') do (
            taskkill /PID %%a /F >nul 2>&1
        )
        echo [✓] 기존 프로세스 종료 완료
        timeout /t 2 /nobreak >nul
    ) else (
        echo 포트가 사용 중이면 서버 시작이 실패할 수 있습니다.
    )
) else (
    echo [✓] 포트 3030 사용 가능
)

:: backend 폴더로 이동
cd backend

:: node_modules 확인
echo [3/5] 패키지 설치 확인 중...
if not exist "node_modules" (
    echo [⚠️  경고] node_modules가 없습니다. 패키지를 설치합니다...
    call npm install --silent
    if !errorLevel! neq 0 (
        echo [❌ 오류] 패키지 설치 실패
        pause
        exit /b 1
    )
    echo [✓] 패키지 설치 완료
) else (
    echo [✓] 패키지 이미 설치됨
)

:: 서버 시작
echo [4/5] 서버 시작 중...
echo.
echo ────────────────────────────────────────────────────────────────
echo  🚀 서버가 시작됩니다...
echo ────────────────────────────────────────────────────────────────
echo.
echo  📍 메인 애플리케이션:  http://localhost:3030
echo  📍 Dev Case Manager:   http://localhost:3030/dev-case-manager
echo.
echo  ⏹️  서버를 중지하려면 Ctrl+C를 누르세요
echo ────────────────────────────────────────────────────────────────
echo.

:: 브라우저 자동 실행 (5초 후)
echo [5/5] 브라우저를 5초 후에 자동으로 엽니다...
start "" cmd /c "timeout /t 5 /nobreak >nul && start http://localhost:3030"

:: 서버 시작 (로그 출력)
npm start

:: 서버 종료 시
echo.
echo ────────────────────────────────────────────────────────────────
echo  서버가 종료되었습니다.
echo ────────────────────────────────────────────────────────────────
echo.
pause
