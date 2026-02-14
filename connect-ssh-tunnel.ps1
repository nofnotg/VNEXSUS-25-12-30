# VNEXSUS SSH 터널 연결 스크립트 (PowerShell)
# 원격 Linux 서버와 Windows 간 SSH 터널링

# =====================================================
# 설정 부분 - 아래 값들을 실제 환경에 맞게 수정하세요
# =====================================================

$RemoteUser = "your-username"
$RemoteHost = "your-server-ip-or-hostname"
$SshKeyPath = "$env:USERPROFILE\.ssh\id_rsa"

# 포트 설정
$LocalPortMain = 3030
$RemotePortMain = 3030
$LocalPortDev = 8088
$RemotePortDev = 8088

# =====================================================
# 스크립트 시작
# =====================================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "VNEXSUS SSH 터널 연결 (원격 Linux)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 설정 확인
Write-Host "[설정 확인]" -ForegroundColor Yellow
Write-Host ""
Write-Host "  원격 서버:  $RemoteUser@$RemoteHost"
Write-Host "  SSH 키:     $SshKeyPath"
Write-Host ""
Write-Host "  포트 포워딩:"
Write-Host "  - 메인 포트: localhost:$LocalPortMain --> 원격:$RemotePortMain"
Write-Host "  - 개발 포트: localhost:$LocalPortDev --> 원격:$RemotePortDev"
Write-Host ""

# 사용자 입력 확인 (처음 실행 시)
if ($RemoteUser -eq "your-username") {
    Write-Host "[경고] 이 파일은 처음 사용하기 전에 설정이 필요합니다!" -ForegroundColor Red
    Write-Host ""
    Write-Host "메모장이나 텍스트 편집기로 이 파일을 열고"
    Write-Host "아래 항목들을 실제 값으로 변경하세요:"
    Write-Host ""
    Write-Host '  - $RemoteUser: SSH 접속 사용자명'
    Write-Host '  - $RemoteHost: 원격 서버 IP 또는 호스트명'
    Write-Host '  - $SshKeyPath: SSH 키 파일 경로 (선택사항)'
    Write-Host ""
    Write-Host "예시:"
    Write-Host '  $RemoteUser = "ubuntu"'
    Write-Host '  $RemoteHost = "192.168.1.100"'
    Write-Host '  $SshKeyPath = "$env:USERPROFILE\.ssh\id_rsa"'
    Write-Host ""
    Read-Host "계속하려면 Enter를 누르세요"
    exit 1
}

# =====================================================
# SSH 설치 확인
# =====================================================

Write-Host "[1/3] SSH 클라이언트 확인 중..." -ForegroundColor Yellow

$sshCommand = Get-Command ssh -ErrorAction SilentlyContinue

if (-not $sshCommand) {
    Write-Host ""
    Write-Host "[오류] SSH 클라이언트를 찾을 수 없습니다." -ForegroundColor Red
    Write-Host ""
    Write-Host "Windows에 SSH 클라이언트 설치 방법:"
    Write-Host ""
    Write-Host "1. PowerShell을 관리자 권한으로 실행 후:"
    Write-Host "   Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0"
    Write-Host ""
    Write-Host "2. 또는 설정에서 수동 설치:"
    Write-Host "   설정 -> 앱 -> 선택적 기능 -> 기능 추가"
    Write-Host '   "OpenSSH 클라이언트" 검색 및 설치'
    Write-Host ""
    Read-Host "계속하려면 Enter를 누르세요"
    exit 1
}

Write-Host "✓ SSH 클라이언트 사용 가능" -ForegroundColor Green
Write-Host ""

# =====================================================
# 기존 터널 종료
# =====================================================

Write-Host "[2/3] 기존 SSH 터널 확인 중..." -ForegroundColor Yellow

# 기존 포트 사용 중인 프로세스 찾기
$existingProcesses = Get-NetTCPConnection -LocalPort $LocalPortMain -State Listen -ErrorAction SilentlyContinue

if ($existingProcesses) {
    Write-Host "기존 터널이 발견되었습니다. 종료합니다..." -ForegroundColor Yellow
    foreach ($process in $existingProcesses) {
        Stop-Process -Id $process.OwningProcess -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 1
}

Write-Host "✓ 준비 완료" -ForegroundColor Green
Write-Host ""

# =====================================================
# SSH 터널 시작
# =====================================================

Write-Host "[3/3] SSH 터널을 시작합니다..." -ForegroundColor Yellow
Write-Host ""

# SSH 명령 구성
$sshArgs = @(
    "-N",
    "-L", "${LocalPortMain}:localhost:${RemotePortMain}",
    "-L", "${LocalPortDev}:localhost:${RemotePortDev}"
)

# SSH 키 사용 여부 확인
if (Test-Path $SshKeyPath) {
    $sshArgs += @("-i", $SshKeyPath)
    Write-Host "SSH 키 파일을 사용합니다: $SshKeyPath" -ForegroundColor Green
} else {
    Write-Host "SSH 키 파일이 없습니다. 비밀번호 입력이 필요합니다." -ForegroundColor Yellow
}

$sshArgs += "${RemoteUser}@${RemoteHost}"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "터널 연결 중..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "연결 정보:"
Write-Host "  $RemoteUser@$RemoteHost"
Write-Host ""
Write-Host "포트 포워딩:"
Write-Host "  localhost:$LocalPortMain --> 원격:$RemotePortMain"
Write-Host "  localhost:$LocalPortDev --> 원격:$RemotePortDev"
Write-Host ""
Write-Host "참고:" -ForegroundColor Yellow
Write-Host "  - 비밀번호 입력이 필요할 수 있습니다"
Write-Host "  - 연결 후 이 창을 닫지 마세요"
Write-Host "  - 종료하려면 Ctrl+C를 누르세요"
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# SSH 터널 실행
try {
    & ssh $sshArgs
} catch {
    Write-Host ""
    Write-Host "[오류] SSH 연결 실패: $_" -ForegroundColor Red
    Write-Host ""
}

# 연결 종료 시
Write-Host ""
Write-Host "SSH 터널이 종료되었습니다." -ForegroundColor Yellow
Write-Host ""
Read-Host "계속하려면 Enter를 누르세요"
