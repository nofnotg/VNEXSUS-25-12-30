import fs from 'fs';
import path from 'path';

const tempDir = path.join(process.cwd(), 'temp');

console.log('=== 수동 JSON 파일 수정 ===\n');

// PowerShell ConvertTo-Json 결과를 직접 파싱
function parsePowerShellJson(content) {
    // 줄 단위로 분리
    const lines = content.split('\n').map(line => line.trim()).filter(line => line);
    
    let result = '';
    let inString = false;
    let braceCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        
        // 속성 이름 처리 (따옴표 없는 경우)
        if (line.match(/^\w+:\s+/)) {
            line = line.replace(/^(\w+):\s+/, '"$1": ');
        }
        
        // 값 처리
        line = line.replace(/:\s+(\d+\.?\d*)([,}]|$)/, ': $1$2');  // 숫자
        line = line.replace(/:\s+(true|false|null)([,}]|$)/, ': $1$2');  // boolean/null
        
        result += line;
        if (i < lines.length - 1) {
            result += '\n';
        }
    }
    
    return result;
}

const jsonFiles = [
    'case1_simple_test_result.json',
    'hybrid_test_result.json'
];

for (const filename of jsonFiles) {
    const filepath = path.join(tempDir, filename);
    if (fs.existsSync(filepath)) {
        try {
            console.log(`처리 중: ${filename}`);
            
            // 파일을 텍스트로 읽기
            let content = fs.readFileSync(filepath, 'utf8');
            
            // 간단한 방법: eval을 사용하여 PowerShell 객체를 JavaScript 객체로 변환
            // 보안상 위험하지만 로컬 테스트용으로만 사용
            try {
                // PowerShell 형식을 JavaScript 객체 형식으로 변환
                let jsContent = content
                    .replace(/(\w+):\s+/g, '$1: ')  // 속성 이름 정리
                    .replace(/:\s+([^,\]\}]+)/g, (match, value) => {
                        // 값이 숫자인지 확인
                        if (/^\d+\.?\d*$/.test(value.trim())) {
                            return `: ${value.trim()}`;
                        }
                        // 값이 boolean이나 null인지 확인
                        if (/^(true|false|null)$/.test(value.trim())) {
                            return `: ${value.trim()}`;
                        }
                        // 문자열인 경우 따옴표로 감싸기
                        return `: "${value.trim()}"`;
                    });
                
                // eval 대신 JSON.parse 시도를 위해 더 안전한 방법 사용
                const obj = Function('"use strict"; return (' + jsContent + ')')();
                
                // 표준 JSON으로 저장
                const fixedPath = filepath.replace('.json', '_fixed.json');
                fs.writeFileSync(fixedPath, JSON.stringify(obj, null, 2), 'utf8');
                
                console.log(`✓ ${filename} → ${path.basename(fixedPath)} 변환 완료`);
                
                // 간단한 요약 출력
                if (obj.success) {
                    console.log(`  - 처리 시간: ${obj.processingTime}ms`);
                    if (obj.result?.dates) {
                        console.log(`  - 추출된 날짜: ${obj.result.dates.length}개`);
                    }
                    if (obj.result?.medical) {
                        const medical = obj.result.medical;
                        console.log(`  - 의료 정보: 질병 ${medical.conditions?.length || 0}개, 약물 ${medical.medications?.length || 0}개`);
                    }
                }
                
            } catch (evalError) {
                console.log(`✗ JavaScript 변환 실패: ${evalError.message}`);
                
                // 대안: 정규식으로 직접 파싱
                try {
                    const simpleObj = {
                        success: content.includes('"success": true') || content.includes('success: true'),
                        processingTime: parseInt(content.match(/processingTime[:\s]+(\d+)/)?.[1] || '0'),
                        dates: [],
                        medical: { conditions: [], medications: [], procedures: [], symptoms: [] }
                    };
                    
                    // 날짜 추출
                    const dateMatches = content.match(/"date":\s*"([^"]+)"/g);
                    if (dateMatches) {
                        simpleObj.dates = dateMatches.map(match => {
                            const date = match.match(/"date":\s*"([^"]+)"/)[1];
                            return { date, confidence: 0.6 };
                        });
                    }
                    
                    const fixedPath = filepath.replace('.json', '_simple.json');
                    fs.writeFileSync(fixedPath, JSON.stringify(simpleObj, null, 2), 'utf8');
                    
                    console.log(`✓ ${filename} → ${path.basename(fixedPath)} 간단 변환 완료`);
                    console.log(`  - 추출된 날짜: ${simpleObj.dates.length}개`);
                    
                } catch (simpleError) {
                    console.log(`✗ 간단 변환도 실패: ${simpleError.message}`);
                }
            }
            
        } catch (error) {
            console.log(`✗ ${filename} 처리 실패: ${error.message}`);
        }
    } else {
        console.log(`- ${filename} 파일 없음`);
    }
}

console.log('\n=== 수동 JSON 수정 완료 ===');