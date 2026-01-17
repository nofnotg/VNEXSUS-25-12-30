import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';

async function uploadPdfAndCheck() {
  const filePath = './test-sample.pdf';
  const uploadUrl = 'http://localhost:3030/api/ocr/upload';

  try {
    if (!fs.existsSync(filePath)) {
      console.error(`❌ 파일이 존재하지 않습니다: ${filePath}`);
      process.exit(1);
    }

    const fileStream = fs.createReadStream(filePath);
    const form = new FormData();
    form.append('files', fileStream, {
      filename: 'test-sample.pdf',
      contentType: 'application/pdf',
    });

    console.log('📤 PDF 업로드 시작:', filePath);
    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: form,
      headers: {
        // 프론트엔드 유사 환경에서 테스트할 때 CORS 참조용 헤더
        Origin: 'http://localhost:8080',
      },
    });

    const text = await response.text();
    console.log('📡 업로드 응답 상태:', response.status);
    console.log('📄 업로드 응답 내용:', text);

    if (!response.ok) {
      console.error('❌ 업로드 실패');
      return;
    }

    const data = JSON.parse(text);
    const { jobId, statusUrl, resultUrl } = data;
    console.log('🆔 jobId:', jobId);
    console.log('🔗 statusUrl:', statusUrl);
    console.log('🔗 resultUrl:', resultUrl);

    // 상태 확인
    const statusRes = await fetch(`http://localhost:3030${statusUrl}`);
    const statusText = await statusRes.text();
    console.log('📊 상태 응답:', statusRes.status, statusText);

    // 결과 확인
    const resultRes = await fetch(`http://localhost:3030${resultUrl}`);
    const resultText = await resultRes.text();
    console.log('📦 결과 응답:', resultRes.status, resultText);

    try {
      const resultJson = JSON.parse(resultText);
      const file1 = resultJson?.results?.file_1;
      if (file1) {
        console.log('📝 OCR 결과 요약:', {
          filename: file1.filename,
          mimeType: file1.mimeType,
          pageCount: file1.pageCount,
          textLength: file1.textLength,
          processingSteps: file1.processingSteps,
          textSource: file1.textSource,
        });
      }
    } catch (e) {
      // 결과가 JSON이 아니면 원문 출력으로 대체
    }
  } catch (err) {
    console.error('💥 테스트 중 오류:', err.message);
  }
}

uploadPdfAndCheck();

