const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function testFileUpload() {
  console.log('🚀 파일 업로드 자동화 테스트 시작');
  
  let browser;
  let page;
  
  try {
    // 브라우저 실행
    console.log('🌐 브라우저 실행 중...');
    browser = await chromium.launch({ 
      headless: false, // 브라우저 창을 보이게 함
      slowMo: 1000 // 각 액션 사이에 1초 대기
    });
    
    page = await browser.newPage();
    
    // 콘솔 로그 수집
    const logs = [];
    page.on('console', msg => {
      const logText = `[${msg.type()}] ${msg.text()}`;
      console.log('📋 브라우저 로그:', logText);
      logs.push(logText);
    });
    
    // 프론트엔드 페이지 로드
    console.log('📄 프론트엔드 페이지 로드 중...');
    await page.goto('http://localhost:8080/index.html');
    
    // 페이지 로드 완료 대기
    await page.waitForLoadState('networkidle');
    console.log('✅ 페이지 로드 완료');
    
    // 디버그 로그 영역 확인
    const debugLogDiv = await page.$('#debug-log');
    if (debugLogDiv) {
      console.log('✅ 디버그 로그 영역 발견');
      
      // 초기 디버그 로그 내용 확인
      const initialLogs = await debugLogDiv.textContent();
      console.log('📋 초기 디버그 로그:', initialLogs);
    } else {
      console.log('❌ 디버그 로그 영역을 찾을 수 없음');
    }
    
    // 파일 입력 요소 확인
    const fileInput = await page.$('#fileInput');
    if (!fileInput) {
      throw new Error('파일 입력 요소를 찾을 수 없습니다');
    }
    console.log('✅ 파일 입력 요소 발견');
    
    // 업로드 버튼 확인
    const uploadBtn = await page.$('#uploadBtn');
    if (!uploadBtn) {
      throw new Error('업로드 버튼을 찾을 수 없습니다');
    }
    console.log('✅ 업로드 버튼 발견');
    
    // 초기 업로드 버튼 상태 확인
    const initialDisabled = await uploadBtn.isDisabled();
    console.log('🔘 초기 업로드 버튼 상태:', initialDisabled ? '비활성화' : '활성화');
    
    // 테스트 파일 생성
    console.log('📄 테스트 파일 생성 중...');
    let testFilePath = path.join(__dirname, 'test-sample.pdf');
    if (!fs.existsSync(testFilePath)) {
      // 기존 PDF 파일이 있는지 확인
      if (fs.existsSync(path.join(__dirname, 'test-sample.pdf'))) {
        console.log('📄 기존 PDF 파일 사용:', 'test-sample.pdf');
      } else if (fs.existsSync(path.join(__dirname, 'test.pdf'))) {
        console.log('📄 기존 PDF 파일 사용:', 'test.pdf');
        testFilePath = path.join(__dirname, 'test.pdf');
      } else {
        console.log('❌ PDF 파일이 없어서 텍스트 파일로 테스트합니다.');
        testFilePath = path.join(__dirname, 'test-sample-upload.txt');
        fs.writeFileSync(testFilePath, '테스트용 의료 문서 내용입니다.\n환자명: 홍길동\n진료일: 2024-01-15');
        console.log('📄 테스트 파일 생성됨:', testFilePath);
      }
    }
    
    // 파일 선택 (올바른 방법)
    console.log('📁 파일 선택 중...');
    await fileInput.setInputFiles(testFilePath);
    console.log('✅ 파일 선택 완료');
    
    // 파일 선택 후 잠시 대기
    await page.waitForTimeout(2000);
    
    // 디버그 로그 업데이트 확인
    if (debugLogDiv) {
      const updatedLogs = await debugLogDiv.textContent();
      console.log('📋 파일 선택 후 디버그 로그:', updatedLogs);
    }
    
    // 업로드 버튼 상태 재확인
    const finalDisabled = await uploadBtn.isDisabled();
    console.log('🔘 파일 선택 후 업로드 버튼 상태:', finalDisabled ? '비활성화' : '활성화');
    
    // 업로드 버튼이 활성화되었다면 클릭
    if (!finalDisabled) {
      console.log('🚀 업로드 버튼 클릭');
      await uploadBtn.click();
      
      // 업로드 후 잠시 대기
      await page.waitForTimeout(3000);
      
      // 최종 디버그 로그 확인
      if (debugLogDiv) {
        const finalLogs = await debugLogDiv.textContent();
        console.log('📋 업로드 후 디버그 로그:', finalLogs);
      }
    } else {
      console.log('❌ 업로드 버튼이 여전히 비활성화되어 있음');
    }
    
    // 스크린샷 저장
    await page.screenshot({ path: 'frontend-test-result.png', fullPage: true });
    console.log('📸 스크린샷 저장됨: frontend-test-result.png');
    
    console.log('✅ 테스트 완료');
    
  } catch (error) {
    console.error('❌ 테스트 실행 중 오류:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// 테스트 실행
testFileUpload().catch(console.error);