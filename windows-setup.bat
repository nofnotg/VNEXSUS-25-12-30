@echo off
chcp 65001 >nul
echo ========================================
echo VNEXSUS Windows 로컬 환경 자동 설정
echo ========================================
echo.

:: 관리자 권한 확인
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [경고] 관리자 권한이 필요할 수 있습니다.
    echo 일부 기능이 제한될 수 있습니다.
    echo.
)

:: Node.js 설치 확인
echo [1/7] Node.js 버전 확인 중...
node --version >nul 2>&1
if %errorLevel% neq 0 (
    echo [오류] Node.js가 설치되지 않았습니다.
    echo https://nodejs.org 에서 Node.js LTS 버전을 다운로드하여 설치하세요.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo Node.js 버전: %NODE_VERSION% ✓
echo.

:: npm 버전 확인
for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
echo npm 버전: %NPM_VERSION% ✓
echo.

:: .env 파일 생성
echo [2/7] 환경변수 파일 설정 중...
if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo .env 파일이 생성되었습니다. ✓
        echo [중요] .env 파일을 열어서 API 키를 설정하세요.
    ) else (
        echo [경고] .env.example 파일을 찾을 수 없습니다.
    )
) else (
    echo .env 파일이 이미 존재합니다. ✓
)
echo.

:: 필수 폴더 생성
echo [3/7] 필수 폴더 생성 중...
if not exist "backend\uploads" mkdir "backend\uploads"
if not exist "credentials" mkdir "credentials"
if not exist "..\reports_pdf" mkdir "..\reports_pdf"
if not exist "..\test_data" mkdir "..\test_data"
echo 폴더 생성 완료 ✓
echo.

:: 백엔드 의존성 설치
echo [4/7] 백엔드 패키지 설치 중...
echo 이 작업은 5-10분 정도 걸릴 수 있습니다.
cd backend
call npm install
if %errorLevel% neq 0 (
    echo [오류] npm install 실패
    pause
    exit /b 1
)
echo 백엔드 패키지 설치 완료 ✓
echo.
cd ..

:: 환경변수 확인
echo [5/7] 환경변수 설정 확인 중...
findstr /C:"PORT=" .env >nul
if %errorLevel% neq 0 (
    echo PORT=3030 >> .env
    echo PORT 설정 추가 완료
)
echo.

:: 방화벽 규칙 추가 (관리자 권한 필요)
echo [6/7] 방화벽 규칙 추가 중...
netsh advfirewall firewall show rule name="VNEXSUS Server Port 3030" >nul 2>&1
if %errorLevel% neq 0 (
    netsh advfirewall firewall add rule name="VNEXSUS Server Port 3030" dir=in action=allow protocol=TCP localport=3030 >nul 2>&1
    if %errorLevel% equ 0 (
        echo 포트 3030 방화벽 규칙 추가 완료 ✓
    ) else (
        echo [경고] 방화벽 규칙 추가 실패 (관리자 권한 필요)
    )
) else (
    echo 포트 3030 방화벽 규칙 이미 존재 ✓
)

netsh advfirewall firewall show rule name="VNEXSUS Dev Port 8088" >nul 2>&1
if %errorLevel% neq 0 (
    netsh advfirewall firewall add rule name="VNEXSUS Dev Port 8088" dir=in action=allow protocol=TCP localport=8088 >nul 2>&1
    if %errorLevel% equ 0 (
        echo 포트 8088 방화벽 규칙 추가 완료 ✓
    ) else (
        echo [경고] 방화벽 규칙 추가 실패 (관리자 권한 필요)
    )
) else (
    echo 포트 8088 방화벽 규칙 이미 존재 ✓
)
echo.

:: 설정 완료
echo [7/7] 설정 검증 중...
echo.
echo ========================================
echo 설정 완료!
echo ========================================
echo.
echo 다음 단계:
echo 1. .env 파일을 열어서 필요한 API 키를 설정하세요
echo    - GOOGLE_CLOUD_VISION_API_KEY (OCR 기능)
echo    - OPENAI_API_KEY (AI 분석 기능)
echo.
echo 2. 서버를 시작하려면 다음 명령어를 실행하세요:
echo    start-server.bat
echo.
echo 또는 직접 실행:
echo    cd backend
echo    npm start
echo.
echo 3. 브라우저에서 다음 주소로 접속:
echo    http://localhost:3030
echo    http://localhost:8088
echo.
echo ========================================
echo.

:: IP 주소 확인
echo 네트워크 정보:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    echo 내부 IP 주소:%%a
    echo 다른 기기에서 접속: http:%%a:3030
)
echo.

pause
