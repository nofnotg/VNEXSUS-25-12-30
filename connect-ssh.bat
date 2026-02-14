@echo off
REM VNEXSUS SSH 접속 스크립트 (Windows)
REM Docker 컨테이너에 SSH로 접속합니다

setlocal enabledelayedexpansion

REM =====================================================
REM 설정 부분 - 필요시 수정
REM =====================================================

REM 로컬 환경 설정
set SSH_HOST=localhost
set SSH_PORT=2222
set SSH_USER=vnexsus
set SSH_KEY=

REM =====================================================
REM 원격 환경 설정 (원격 서버 사용 시)
REM =====================================================
REM 아래 주석을 제거하고 값을 설정하세요
REM set SSH_HOST=192.168.1.100
REM set SSH_PORT=2222
REM set SSH_USER=vnexsus
REM set SSH_KEY=%USERPROFILE%\.ssh\id_rsa_vnexsus

REM =====================================================
REM 스크립트 시작
REM =====================================================

echo ========================================
echo VNEXSUS SSH 접속
echo ========================================
echo.

REM SSH 클라이언트 확인
where ssh >nul 2>&1
if errorlevel 1 (
    echo ❌ 오류: SSH 클라이언트를 찾을 수 없습니다.
    echo.
    echo Windows에 SSH 클라이언트 설치 방법:
    echo.
    echo 1. PowerShell을 관리자 권한으로 실행 후:
    echo    Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0
    echo.
    echo 2. 또는 설정에서 수동 설치:
    echo    설정 -^> 앱 -^> 선택적 기능 -^> 기능 추가
    echo    "OpenSSH 클라이언트" 검색 및 설치
    echo.
    pause
    exit /b 1
)

REM 접속 정보 표시
echo 접속 정보:
echo   호스트: %SSH_HOST%
echo   포트:   %SSH_PORT%
echo   사용자: %SSH_USER%

if defined SSH_KEY (
    echo   인증:   SSH 키 (%SSH_KEY%)
) else (
    echo   인증:   비밀번호 (vnexsus2024)
)

echo.
echo ========================================
echo.

REM SSH 명령 실행
if defined SSH_KEY (
    REM SSH 키 파일 존재 확인
    if not exist "%SSH_KEY%" (
        echo ❌ 오류: SSH 키 파일을 찾을 수 없습니다: %SSH_KEY%
        echo.
        echo 다음 중 하나를 수행하세요:
        echo   1. SSH 키 경로를 수정하세요
        echo   2. SSH_KEY 변수를 비워서 비밀번호 인증을 사용하세요
        echo.
        pause
        exit /b 1
    )

    REM SSH 키로 접속
    ssh -p %SSH_PORT% -i "%SSH_KEY%" %SSH_USER%@%SSH_HOST%
) else (
    REM 비밀번호로 접속
    ssh -p %SSH_PORT% %SSH_USER%@%SSH_HOST%
)

REM 접속 종료 시
echo.
echo SSH 연결이 종료되었습니다.
echo.
pause
