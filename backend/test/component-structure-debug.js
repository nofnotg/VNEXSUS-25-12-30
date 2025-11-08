/**
 * 컴포넌트 구조 디버깅 스크립트
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function debugComponentStructure() {
  const hybridControllerPath = path.join(__dirname, '../controllers/hybridController.js');
  
  console.log('🔍 컴포넌트 구조 디버깅');
  console.log(`파일 경로: ${hybridControllerPath}`);
  console.log(`파일 존재: ${fs.existsSync(hybridControllerPath)}`);
  
  if (!fs.existsSync(hybridControllerPath)) {
    console.log('❌ 파일이 존재하지 않습니다.');
    return;
  }
  
  const controllerContent = fs.readFileSync(hybridControllerPath, 'utf8');
  
  // 필수 클래스 및 메서드 존재 확인
  const requiredElements = [
    'class HybridController',
    'processDocument',
    'getSystemStatus',
    'getPerformanceMetrics',
    'HybridDateProcessor',
    'HybridMedicalNormalizer',
    'ResultMerger',
    'PerformanceMonitor'
  ];
  
  console.log('\n📋 필수 요소 검사:');
  requiredElements.forEach(element => {
    const exists = controllerContent.includes(element);
    console.log(`  ${exists ? '✅' : '❌'} ${element}: ${exists}`);
    
    if (!exists) {
      // 유사한 패턴 찾기
      const lines = controllerContent.split('\n');
      const matchingLines = lines.filter(line => 
        line.toLowerCase().includes(element.toLowerCase()) ||
        line.includes(element.split(/(?=[A-Z])/).join('').toLowerCase())
      );
      
      if (matchingLines.length > 0) {
        console.log(`    🔍 유사한 패턴 발견:`);
        matchingLines.slice(0, 3).forEach(line => {
          console.log(`      "${line.trim()}"`);
        });
      }
    }
  });
  
  // 클래스와 메서드 구조 분석
  console.log('\n🏗️ 클래스 구조 분석:');
  const classMatches = controllerContent.match(/class\s+\w+/g);
  if (classMatches) {
    console.log('  발견된 클래스:', classMatches);
  }
  
  const methodMatches = controllerContent.match(/async\s+\w+\s*\(|^\s*\w+\s*\(/gm);
  if (methodMatches) {
    console.log('  발견된 메서드 (처음 10개):', methodMatches.slice(0, 10));
  }
  
  // import 문 분석
  console.log('\n📦 Import 문 분석:');
  const importMatches = controllerContent.match(/import.*from.*/g);
  if (importMatches) {
    importMatches.forEach(imp => {
      console.log(`  ${imp}`);
    });
  }
}

debugComponentStructure();