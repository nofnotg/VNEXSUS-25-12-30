@echo off
chcp 65001 >nul
echo ========================================
echo VNEXSUS 브라우저 열기 (SSH 터널)
echo ========================================
echo.

REM 포트 설정
set MAIN_PORT=3030
set DEV_PORT=8088

echo SSH 터널이 이미 연결되어 있다고 가정합니다.
echo.
echo connect-ssh-tunnel.bat를 먼저 실행해야 합니다!
echo.

REM 터널 연결 확인
netstat -ano | findstr ":%MAIN_PORT%.*LISTENING" >nul 2>&1
if %errorLevel% neq 0 (
    echo [경고] 포트 %MAIN_PORT%가 열려있지 않습니다.
    echo         connect-ssh-tunnel.bat를 먼저 실행하세요.
    echo.
    pause
    exit /b 1
)

echo ✓ SSH 터널이 연결되어 있습니다.
echo.

REM 브라우저 열기
echo 브라우저를 엽니다...
echo.

REM 메인 페이지
start http://localhost:%MAIN_PORT%

REM 잠시 대기
timeout /t 2 /nobreak >nul

REM 개발 관리자 페이지
start http://localhost:%DEV_PORT%

echo.
echo ========================================
echo ✓ 브라우저가 열렸습니다!
echo ========================================
echo.
echo 접속 URL:
echo   메인 애플리케이션:  http://localhost:%MAIN_PORT%
echo   파일 업로드:        http://localhost:%MAIN_PORT%/hybrid-interface.html
echo   개발 관리자:        http://localhost:%DEV_PORT%
echo.
echo SSH 터널을 종료하려면 connect-ssh-tunnel.bat 창에서 Ctrl+C를 누르세요.
echo.
pause
