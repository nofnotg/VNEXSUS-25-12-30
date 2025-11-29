/**
 * ReportBuilder Module
 * 
 * 역할:
 * 1. 날짜별 그룹화 → 동일 날짜 & 다른 병원이 있으면 가로 열(Column) 추가
        reportId,
        format: opts.format,
        timestamp: new Date().toISOString(),
        patientInfo,
        preview: summary  // 요약 데이터를 미리보기로 사용
      };
    } catch (error) {
      console.error('보고서 생성 중 오류 발생:', error);
      throw new Error(`보고서 생성 실패: ${error.message}`);
    }
  }

  /**
   * Excel 보고서 생성
   * @param {Object} reportData 보고서 데이터
   * @param {string} baseFilename 기본 파일명
   * @param {Object} options 옵션
   * @returns {Promise<Object>} 생성된 보고서 정보
   * @private
   */
  async _generateExcelReport(reportData, baseFilename, options) {
  const filename = `${baseFilename}.xlsx`;
  const filePath = path.join(this.reportsDir, filename);

  // Excel 워크북 생성
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MediAI 문서분석시스템';
  workbook.lastModifiedBy = 'MediAI 문서분석시스템';
  workbook.created = new Date();
  workbook.modified = new Date();

  // 병력사항 시트 생성
  const sheet = workbook.addWorksheet('병력사항 요약', {
    properties: { tabColor: { argb: '4F81BD' } }
  });

  // 컬럼 설정
  sheet.columns = [
    { header: '날짜', key: 'date', width: 15 },
    { header: '병원', key: 'hospital', width: 20 },
    { header: '진단/처치내용', key: 'content', width: 50 },
    { header: '주요 키워드', key: 'keywords', width: 20 },
    { header: '비고', key: 'note', width: 20 }
  ];

  // 헤더 스타일 설정
  sheet.getRow(1).font = { bold: true, size: 12 };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'DCE6F1' }
  };

  // 환자 정보 행 추가
  const patientInfoRow = sheet.addRow([`환자명: ${reportData.patientInfo.name}`, `생년월일: ${reportData.patientInfo.birthDate || ''}`, `보험 가입일: ${reportData.patientInfo.enrollmentDate || ''}`]);
  patientInfoRow.font = { bold: true };
  sheet.mergeCells(`A${patientInfoRow.number}:E${patientInfoRow.number}`);

  // 공백 행 추가
  sheet.addRow([]);

  // 데이터 행 추가
  reportData.items.forEach(item => {
    const row = sheet.addRow([
      item.date,
      item.hospital,
      item.content,
      item.keywordMatches.join(', '),
      ''  // 비고
    ]);

    // 행 스타일링
    if (item.isWithin3Months) {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFDDDD' }  // 3개월 이내 항목은 옅은 빨강
      };
    } else if (item.isWithin5Years) {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFCC' }  // 5년 이내 항목은 옅은 노랑
      };
    }

    // 자동 줄바꿈 설정
    row.getCell('content').alignment = { wrapText: true };
  });

  // 설명 행 추가
  sheet.addRow([]);
  const legend1 = sheet.addRow(['', '빨간색 배경: 가입일 기준 3개월 이내 항목']);
  const legend2 = sheet.addRow(['', '노란색 배경: 가입일 기준 5년 이내 항목']);
  sheet.mergeCells(`B${legend1.number}:E${legend1.number}`);
  sheet.mergeCells(`B${legend2.number}:E${legend2.number}`);

  // 합계 행 추가
  const summaryRow = sheet.addRow([
    '합계',
    '',
    `총 ${reportData.items.length}개 항목`,
    `3개월 이내: ${reportData.stats.within3Months}개, 5년 이내: ${reportData.stats.within5Years}개`
  ]);
  summaryRow.font = { bold: true };
  sheet.mergeCells(`A${summaryRow.number}:B${summaryRow.number}`);
  sheet.mergeCells(`C${summaryRow.number}:E${summaryRow.number}`);

  // 파일 저장
  await workbook.xlsx.writeFile(filePath);

  return {
    filename,
    filePath,
    downloadUrl: `${this.publicReportsDir}/${filename}`
  };
}

  /**
   * 텍스트 보고서 생성
   * @param {Object} reportData 보고서 데이터
   * @param {string} baseFilename 기본 파일명
   * @param {Object} options 옵션
   * @returns {Promise<Object>} 생성된 보고서 정보
   * @private
   */
  async _generateTextReport(reportData, baseFilename, options) {
  const filename = `${baseFilename}.txt`;
  const filePath = path.join(this.reportsDir, filename);

  // 텍스트 내용 작성
  let content = '';

  // 제목
  content += '======================================================\n';
  content += `       ${options.title}\n`;
  content += '======================================================\n\n';
  reportData.items.forEach(item => {
    // 3개월/5년 이내 표시
    const marker = item.isWithin3Months ? '[3M] ' : item.isWithin5Years ? '[5Y] ' : '     ';

    // 내용 포맷팅
    content += `${marker}${item.date} | ${item.hospital.padEnd(20)} | ${item.content.replace(/\n/g, ' ')}\n`;

    // 키워드 표시
    if (item.keywordMatches.length > 0) {
      content += `     | 주요 키워드: ${item.keywordMatches.join(', ')}\n`;
    }

    content += '------------------------------------------------------\n';
  });

  // 범례
  content += '\n[3M]: 가입일 기준 3개월 이내 항목\n';
  content += '[5Y]: 가입일 기준 5년 이내 항목\n';

  // 파일 저장
  await fs.writeFile(filePath, content, 'utf8');

  return {
    filename,
    filePath,
    downloadUrl: `${this.publicReportsDir}/${filename}`
  };
}

  /**
   * JSON 보고서 생성
   * @param {Object} reportData 보고서 데이터
   * @param {string} baseFilename 기본 파일명
   * @param {Object} options 옵션
   * @returns {Promise<Object>} 생성된 보고서 정보
   * @private
   */
  async _generateJsonReport(reportData, baseFilename, options) {
  const filename = `${baseFilename}.json`;
  const filePath = path.join(this.reportsDir, filename);

  // JSON 구조 생성
  const jsonData = {
    title: options.title,
    generatedAt: new Date().toISOString(),
    patientInfo: reportData.patientInfo,
    stats: reportData.stats,
    items: reportData.items.map(item => ({
      date: item.date,
      hospital: item.hospital,
      content: item.content,
      keywordMatches: item.keywordMatches,
      mappedTerms: item.mappedTerms,
      isWithin3Months: item.isWithin3Months,
      isWithin5Years: item.isWithin5Years,
      rawText: options.includeRawText ? item.rawText : undefined
    }))
  };

  // 파일 저장
  await fs.writeFile(filePath, JSON.stringify(jsonData, null, 2), 'utf8');

  return {
    filename,
    filePath,
    downloadUrl: `${this.publicReportsDir}/${filename}`,
    data: jsonData  // JSON 데이터도 함께 반환
  };
}

/**
 * 보고서용 데이터 준비
 * @param {Array} organizedData 정리된 데이터
 * @param {Object} patientInfo 환자 정보
 * @returns {Object} 보고서용 데이터
 * @private
 */
_prepareReportData(organizedData, patientInfo = {}) {
  // 가입일 확인
  const enrollmentDate = patientInfo && patientInfo.enrollmentDate ? new Date(patientInfo.enrollmentDate) : null;

  // 3개월 전 날짜 계산
  const threeMonthsAgo = enrollmentDate ? new Date(enrollmentDate) : null;
  if (threeMonthsAgo) threeMonthsAgo.setMonth(enrollmentDate.getMonth() - 3);

  // 5년 전 날짜 계산
  const fiveYearsAgo = enrollmentDate ? new Date(enrollmentDate) : null;
  if (fiveYearsAgo) fiveYearsAgo.setFullYear(enrollmentDate.getFullYear() - 5);

  // 통계 초기화
  const stats = {
    total: organizedData.length,
    within3Months: 0,
    within5Years: 0
  };

  // 항목 처리
  const items = organizedData.map(item => {
    const itemDate = new Date(item.date);

    // 3개월/5년 이내 확인
    const isWithin3Months = enrollmentDate && threeMonthsAgo
      ? itemDate >= threeMonthsAgo && itemDate <= enrollmentDate
      : false;

    const isWithin5Years = enrollmentDate && fiveYearsAgo
      ? itemDate >= fiveYearsAgo && itemDate <= enrollmentDate
      : false;

    // 통계 업데이트
    if (isWithin3Months) stats.within3Months++;
    if (isWithin5Years) stats.within5Years++;

    // 의미 있는 내용 추출
    let content = item.translatedText || item.rawText;

    // 매핑된 용어가 있는 경우
    const mappedTerms = item.mappedTerms || [];

    // 키워드 매치
    const keywordMatches = item.keywordMatches || [];

    return {
      date: item.date,
      hospital: item.hospital,
      content,
      rawText: item.rawText,
      keywordMatches,
      mappedTerms,
      isWithin3Months,
      isWithin5Years
    };
  });

  return {
    patientInfo,
    stats,
    items
  };
}

  /**
   * 보고서 디렉토리가 존재하는지 확인하고 없으면 생성
   * @returns {Promise<void>}
   * @private
   */
  async _ensureReportDirectory() {
  try {
    await fs.access(this.reportsDir);
  } catch (error) {
    // 디렉토리가 없으면 생성
    await fs.mkdir(this.reportsDir, { recursive: true });
  }
  treatment: [...new Set(r.treatment)]
}))
    .sort((a, b) => {
  const dateA = new Date(a.date).getTime();
  const dateB = new Date(b.date).getTime();
  return dateA - dateB;
});
}

/**
 * 진단 정보 추출
 * @param {Object} item 데이터 항목
 * @returns {Array} 진단 정보 배열
 * @private
 */
_extractDiagnosis(item) {
  const diagnosis = [];

  // 키워드 매치에서 진단 관련 항목 추출
  if (Array.isArray(item.keywordMatches)) {
    const diagnosisKeywords = item.keywordMatches.filter(kw =>
      kw.includes('진단') ||
      kw.includes('질환') ||
      kw.includes('증상') ||
      kw.includes('소견')
    );
    diagnosis.push(...diagnosisKeywords);
  }

  // 내용에서 진단명 추출 (일단 간단한 구현)
  if (item.content) {
    const contentLines = item.content.split('\n');
    contentLines.forEach(line => {
      if (line.includes('진단') || line.includes('질환') || line.includes('증상')) {
        const parts = line.split(':');
        if (parts.length > 1) {
          diagnosis.push(parts[1].trim());
        }
      }
    });
  }

  // 중복 제거
  return [...new Set(diagnosis)];
}

/**
 * 처치/투약 정보 추출
 * @param {Object} item 데이터 항목
 * @returns {Array} 처치/투약 정보 배열
 * @private
 */
_extractTreatment(item) {
  const treatment = [];

  // 키워드 매치에서 처치/투약 관련 항목 추출
  if (Array.isArray(item.keywordMatches)) {
    const treatmentKeywords = item.keywordMatches.filter(kw =>
      kw.includes('처치') ||
      kw.includes('투약') ||
      kw.includes('치료') ||
      kw.includes('수술') ||
      kw.includes('처방')
    );
    treatment.push(...treatmentKeywords);
  }

  // 내용에서 처치/투약 추출 (일단 간단한 구현)
  if (item.content) {
    const contentLines = item.content.split('\n');
    contentLines.forEach(line => {
      if (line.includes('처치') || line.includes('투약') || line.includes('치료') ||
        line.includes('수술') || line.includes('처방')) {
        const parts = line.split(':');
        if (parts.length > 1) {
          treatment.push(parts[1].trim());
        }
      }
    });
  }

  // 중복 제거
  return [...new Set(treatment)];
}
}

export default new ReportBuilder();