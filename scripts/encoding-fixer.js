import fs from 'fs';
import path from 'path';
import iconv from 'iconv-lite';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 🔧 MediAI 인코딩 문제 해결사
 * 
 * 문제: 케이스 파일들이 한글 깨짐 현상으로 데이터 추출 실패
 * 해결: 다양한 인코딩으로 읽기 시도 후 올바른 인코딩 감지 및 변환
 */

class EncodingFixer {
  constructor() {
    this.fixturesPath = path.join(__dirname, '../documents/fixtures');
    this.backupPath = path.join(__dirname, '../documents/fixtures-backup');
    this.fixedPath = path.join(__dirname, '../documents/fixtures-fixed');
    
    // 시도할 인코딩 목록 (한국어 환경)
    this.encodings = ['utf8', 'euc-kr', 'cp949', 'iso-8859-1', 'ascii'];
  }

  /**
   * 모든 케이스 파일의 인코딩 문제 해결
   */
  async fixAllCases() {
    console.log('🔧 MediAI 인코딩 문제 해결 시작...');
    
    // 백업 및 고정 디렉토리 생성
    this.createDirectories();
    
    // 모든 fulltext 파일 처리
    const files = fs.readdirSync(this.fixturesPath);
    const fulltextFiles = files.filter(f => f.includes('_fulltext.txt'));
    
    console.log(`📁 처리 대상: ${fulltextFiles.length}개 파일`);
    
    const results = {
      total: fulltextFiles.length,
      fixed: 0,
      failed: 0,
      details: []
    };
    
    for (const filename of fulltextFiles) {
      console.log(`\n🔍 ${filename} 처리 중...`);
      
      try {
        const result = await this.fixSingleFile(filename);
        results.details.push(result);
        
        if (result.success) {
          results.fixed++;
          console.log(`✅ ${filename} 수정 완료 (${result.detectedEncoding})`);
        } else {
          results.failed++;
          console.log(`❌ ${filename} 수정 실패`);
        }
      } catch (error) {
        console.error(`❌ ${filename} 처리 중 오류:`, error.message);
        results.failed++;
        results.details.push({
          filename,
          success: false,
          error: error.message
        });
      }
    }
    
    // 결과 리포트
    console.log('\n📊 인코딩 수정 결과:');
    console.log(`   ✅ 성공: ${results.fixed}/${results.total}`);
    console.log(`   ❌ 실패: ${results.failed}/${results.total}`);
    
    // 상세 결과 저장
    fs.writeFileSync(
      path.join(this.fixedPath, 'encoding-fix-report.json'),
      JSON.stringify(results, null, 2),
      'utf8'
    );
    
    return results;
  }

  /**
   * 단일 파일 인코딩 수정
   */
  async fixSingleFile(filename) {
    const originalPath = path.join(this.fixturesPath, filename);
    const backupPath = path.join(this.backupPath, filename);
    const fixedPath = path.join(this.fixedPath, filename);
    
    // 원본 백업
    fs.copyFileSync(originalPath, backupPath);
    
    // 원본 파일을 바이너리로 읽기
    const buffer = fs.readFileSync(originalPath);
    
    // 각 인코딩으로 시도해보기
    let bestResult = null;
    let bestScore = -1;
    
    for (const encoding of this.encodings) {
      try {
        const decoded = iconv.decode(buffer, encoding);
        const score = this.scoreKoreanText(decoded);
        
        console.log(`  📝 ${encoding}: 점수 ${score}`);
        
        if (score > bestScore) {
          bestScore = score;
          bestResult = {
            encoding,
            content: decoded,
            score
          };
        }
      } catch (error) {
        console.log(`  ❌ ${encoding}: 디코딩 실패`);
      }
    }
    
    if (bestResult && bestResult.score > 0) {
      // 최적 결과를 UTF-8로 저장
      fs.writeFileSync(fixedPath, bestResult.content, 'utf8');
      
      // 원본 파일도 수정된 내용으로 교체
      fs.writeFileSync(originalPath, bestResult.content, 'utf8');
      
      return {
        filename,
        success: true,
        detectedEncoding: bestResult.encoding,
        score: bestResult.score,
        preview: bestResult.content.substring(0, 200) + '...'
      };
    } else {
      return {
        filename,
        success: false,
        reason: '적절한 인코딩을 찾을 수 없음'
      };
    }
  }

  /**
   * 한국어 텍스트 품질 점수 계산
   */
  scoreKoreanText(text) {
    if (!text || typeof text !== 'string') return -1;
    
    let score = 0;
    
    // 한글 문자 비율
    const koreanChars = text.match(/[가-힣]/g);
    const koreanRatio = koreanChars ? koreanChars.length / text.length : 0;
    score += koreanRatio * 100;
    
    // 의료 관련 키워드 존재 여부
    const medicalKeywords = [
      '환자', '병원', '진단', '치료', '의사', '간호사', '수술', '검사',
      '처방', '약물', '증상', '질병', '입원', '외래', '응급실', '보험'
    ];
    
    const foundKeywords = medicalKeywords.filter(keyword => 
      text.includes(keyword)
    ).length;
    score += foundKeywords * 5;
    
    // 날짜 패턴 존재 여부
    const datePatterns = [
      /\d{4}[.-]\d{2}[.-]\d{2}/g,
      /\d{4}년\s*\d{1,2}월\s*\d{1,2}일/g,
      /\d{2}[.-]\d{2}[.-]\d{2}/g
    ];
    
    for (const pattern of datePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        score += matches.length * 2;
      }
    }
    
    // 깨진 문자 패널티
    const brokenChars = text.match(/[��]/g);
    if (brokenChars) {
      score -= brokenChars.length * 0.5;
    }
    
    return Math.max(0, score);
  }

  /**
   * 필요한 디렉토리 생성
   */
  createDirectories() {
    if (!fs.existsSync(this.backupPath)) {
      fs.mkdirSync(this.backupPath, { recursive: true });
    }
    if (!fs.existsSync(this.fixedPath)) {
      fs.mkdirSync(this.fixedPath, { recursive: true });
    }
  }

  /**
   * 수정 결과 검증
   */
  async validateFixes() {
    console.log('\n🔍 수정 결과 검증 중...');
    
    const files = fs.readdirSync(this.fixturesPath);
    const fulltextFiles = files.filter(f => f.includes('_fulltext.txt'));
    
    for (const filename of fulltextFiles.slice(0, 3)) { // 처음 3개만 검증
      const filePath = path.join(this.fixturesPath, filename);
      const content = fs.readFileSync(filePath, 'utf8');
      
      console.log(`\n📄 ${filename} 검증:`);
      console.log(`   길이: ${content.length}자`);
      console.log(`   한글 비율: ${this.getKoreanRatio(content).toFixed(1)}%`);
      console.log(`   미리보기: ${content.substring(0, 100).replace(/\n/g, ' ')}...`);
    }
  }

  /**
   * 한글 비율 계산
   */
  getKoreanRatio(text) {
    const koreanChars = text.match(/[가-힣]/g);
    return koreanChars ? (koreanChars.length / text.length) * 100 : 0;
  }
}

// 실행 함수
async function runEncodingFix() {
  const fixer = new EncodingFixer();
  
  try {
    const results = await fixer.fixAllCases();
    
    console.log('\n🎉 인코딩 수정 완료!');
    await fixer.validateFixes();
    
    return results;
  } catch (error) {
    console.error('❌ 인코딩 수정 실패:', error);
    throw error;
  }
}

// 모듈 내보내기
export { EncodingFixer, runEncodingFix };

// 직접 실행 시
if (import.meta.url === `file://${process.argv[1]}`) {
  runEncodingFix().catch(console.error);
} 