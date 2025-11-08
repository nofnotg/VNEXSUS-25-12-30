import fs from 'fs';
import path from 'path';

const tempDir = path.join(process.cwd(), 'temp');

console.log('=== JSON 파일 형식 수정 ===\n');

const jsonFiles = [
    'case1_simple_test_result.json',
    'hybrid_test_result.json',
    'case1_hybrid_final_result.json'
];

for (const filename of jsonFiles) {
    const filepath = path.join(tempDir, filename);
    if (fs.existsSync(filepath)) {
        try {
            console.log(`처리 중: ${filename}`);
            
            // 파일을 텍스트로 읽기
            let content = fs.readFileSync(filepath, 'utf8');
            
            // PowerShell JSON 형식을 표준 JSON으로 변환
            // PowerShell은 속성 이름에 따옴표를 사용하지 않고 들여쓰기가 다름
            content = content
                .replace(/(\w+):\s+/g, '"$1": ')  // 속성 이름에 따옴표 추가
                .replace(/:\s+true/g, ': true')   // boolean 값 정리
                .replace(/:\s+false/g, ': false')
                .replace(/:\s+null/g, ': null')
                .replace(/:\s+(\d+\.?\d*)/g, ': $1')    // 숫자 값 정리 (소수점 포함)
                .replace(/:\s+"([^"]+)"/g, ': "$1"') // 문자열 값 정리
                .replace(/,\s*\]/g, ']')          // 배열 끝의 쉼표 제거
                .replace(/,\s*\}/g, '}')          // 객체 끝의 쉼표 제거
                .replace(/\s+/g, ' ')             // 여러 공백을 하나로
                .replace(/\{\s+/g, '{ ')          // 객체 시작 정리
                .replace(/\s+\}/g, ' }')          // 객체 끝 정리
                .replace(/\[\s+/g, '[ ')          // 배열 시작 정리
                .replace(/\s+\]/g, ' ]');         // 배열 끝 정리
            
            // JSON 파싱 시도
            const parsed = JSON.parse(content);
            
            // 표준 JSON으로 다시 저장
            const fixedPath = filepath.replace('.json', '_fixed.json');
            fs.writeFileSync(fixedPath, JSON.stringify(parsed, null, 2), 'utf8');
            
            console.log(`✓ ${filename} → ${path.basename(fixedPath)} 변환 완료`);
            
        } catch (error) {
            console.log(`✗ ${filename} 변환 실패: ${error.message}`);
            
            // 원본 파일 내용의 일부를 보여줌
            try {
                const content = fs.readFileSync(filepath, 'utf8');
                console.log('파일 시작 부분:');
                console.log(content.substring(0, 200));
                console.log('...');
            } catch (readError) {
                console.log('파일 읽기 실패:', readError.message);
            }
        }
    } else {
        console.log(`- ${filename} 파일 없음`);
    }
}

console.log('\n=== JSON 형식 수정 완료 ===');