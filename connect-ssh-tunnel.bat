@echo off
chcp 65001 >nul
echo ========================================
echo VNEXSUS SSH 터널 연결 (원격 Linux)
echo ========================================
echo.

REM =====================================================
REM 설정 부분 - 아래 값들을 실제 환경에 맞게 수정하세요
REM =====================================================

REM 원격 서버 정보
set REMOTE_USER=your-username
set REMOTE_HOST=your-server-ip-or-hostname
set SSH_KEY_PATH=%USERPROFILE%\.ssh\id_rsa

REM 포트 설정
set LOCAL_PORT_MAIN=3030
set REMOTE_PORT_MAIN=3030
set LOCAL_PORT_DEV=8088
set REMOTE_PORT_DEV=8088

REM =====================================================
REM 설정 확인
REM =====================================================

echo [설정 확인]
echo.
echo   원격 서버:  %REMOTE_USER%@%REMOTE_HOST%
echo   SSH 키:     %SSH_KEY_PATH%
echo.
echo   포트 포워딩:
echo   - 메인 포트: localhost:%LOCAL_PORT_MAIN% --^> 원격:%REMOTE_PORT_MAIN%
echo   - 개발 포트: localhost:%LOCAL_PORT_DEV% --^> 원격:%REMOTE_PORT_DEV%
echo.

REM 사용자 입력 확인 (처음 실행 시)
if "%REMOTE_USER%"=="your-username" (
    echo [경고] 이 파일은 처음 사용하기 전에 설정이 필요합니다!
    echo.
    echo 메모장이나 텍스트 편집기로 이 파일을 열고
    echo 아래 항목들을 실제 값으로 변경하세요:
    echo.
    echo   - REMOTE_USER: SSH 접속 사용자명
    echo   - REMOTE_HOST: 원격 서버 IP 또는 호스트명
    echo   - SSH_KEY_PATH: SSH 키 파일 경로 (선택사항)
    echo.
    echo 예시:
    echo   set REMOTE_USER=ubuntu
    echo   set REMOTE_HOST=192.168.1.100
    echo   set SSH_KEY_PATH=%%USERPROFILE%%\.ssh\id_rsa
    echo.
    pause
    exit /b 1
)

REM =====================================================
REM SSH 설치 확인
REM =====================================================

echo [1/3] SSH 클라이언트 확인 중...
where ssh >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo [오류] SSH 클라이언트를 찾을 수 없습니다.
    echo.
    echo Windows에 SSH 클라이언트 설치 방법:
    echo.
    echo 1. Windows 10/11의 경우:
    echo    설정 -^> 앱 -^> 선택적 기능 -^> 기능 추가
    echo    "OpenSSH 클라이언트" 검색 및 설치
    echo.
    echo 2. 또는 PowerShell을 관리자 권한으로 실행 후:
    echo    Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0
    echo.
    echo 3. Git for Windows를 설치하면 SSH가 포함되어 있습니다.
    echo    https://git-scm.com/download/win
    echo.
    pause
    exit /b 1
)
echo ✓ SSH 클라이언트 사용 가능
echo.

REM =====================================================
REM 기존 터널 종료
REM =====================================================

echo [2/3] 기존 SSH 터널 확인 중...

REM 기존 SSH 프로세스 찾기 (포트 포워딩)
for /f "tokens=2" %%a in ('netstat -ano ^| findstr ":%LOCAL_PORT_MAIN%.*LISTENING"') do (
    set PID=%%a
    echo 기존 터널이 발견되었습니다 (PID: !PID!^)
    echo 기존 터널을 종료합니다...
    taskkill /PID !PID! /F >nul 2>&1
)

echo ✓ 준비 완료
echo.

REM =====================================================
REM SSH 터널 시작
REM =====================================================

echo [3/3] SSH 터널을 시작합니다...
echo.

REM SSH 키 사용 여부 확인
set SSH_CMD=ssh -N -L %LOCAL_PORT_MAIN%:localhost:%REMOTE_PORT_MAIN% -L %LOCAL_PORT_DEV%:localhost:%REMOTE_PORT_DEV%

if exist "%SSH_KEY_PATH%" (
    set SSH_CMD=%SSH_CMD% -i "%SSH_KEY_PATH%"
    echo SSH 키 파일을 사용합니다: %SSH_KEY_PATH%
) else (
    echo SSH 키 파일이 없습니다. 비밀번호 입력이 필요합니다.
)

echo.
echo ========================================
echo 터널 연결 중...
echo ========================================
echo.
echo 연결 정보:
echo   %REMOTE_USER%@%REMOTE_HOST%
echo.
echo 포트 포워딩:
echo   localhost:%LOCAL_PORT_MAIN% --^> 원격:%REMOTE_PORT_MAIN%
echo   localhost:%LOCAL_PORT_DEV% --^> 원격:%REMOTE_PORT_DEV%
echo.
echo 참고:
echo   - 비밀번호 입력이 필요할 수 있습니다
echo   - 연결 후 이 창을 닫지 마세요
echo   - 종료하려면 Ctrl+C를 누르세요
echo.
echo ========================================
echo.

REM SSH 터널 실행
%SSH_CMD% %REMOTE_USER%@%REMOTE_HOST%

REM 연결 종료 시
echo.
echo SSH 터널이 종료되었습니다.
echo.
pause
