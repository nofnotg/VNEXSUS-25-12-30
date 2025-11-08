const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');

const inputPath = path.join(__dirname, 'documents', 'fixtures', 'Case1_report.txt');
const outputPath = path.join(__dirname, 'temp', 'Case1_report_fixed.txt');

console.log('Fixing Case1_report.txt encoding...');

try {
    // Read the file as buffer first
    const buffer = fs.readFileSync(inputPath);
    
    // Try different encodings
    const encodings = ['utf8', 'euc-kr', 'cp949', 'iso-8859-1'];
    let bestContent = '';
    let bestEncoding = '';
    
    let bestKoreanChars = 0;
    
    for (const encoding of encodings) {
        try {
            let content;
            if (encoding === 'utf8') {
                content = buffer.toString('utf8');
            } else {
                content = iconv.decode(buffer, encoding);
            }
            
            // Check if the content looks reasonable (contains Korean characters)
            const koreanChars = (content.match(/[가-힣]/g) || []).length;
            const totalChars = content.length;
            const koreanRatio = koreanChars / totalChars;
            
            console.log(`${encoding}: Korean ratio = ${koreanRatio.toFixed(3)}, Korean chars = ${koreanChars}`);
            
            if (koreanChars > bestKoreanChars) {
                bestContent = content;
                bestEncoding = encoding;
                bestKoreanChars = koreanChars;
            }
        } catch (err) {
            console.log(`Failed to decode with ${encoding}: ${err.message}`);
        }
    }
    
    if (bestContent) {
        // Clean up the content
        bestContent = bestContent
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .trim();
        
        // Save the fixed content
        fs.writeFileSync(outputPath, bestContent, 'utf8');
        
        console.log(`Best encoding: ${bestEncoding}`);
        console.log(`Fixed content saved to: ${outputPath}`);
        console.log(`Content length: ${bestContent.length} characters`);
        console.log(`First 200 characters:`);
        console.log(bestContent.substring(0, 200));
        
        // Also create a JSON version for API testing
        const jsonData = {
            document: {
                text: bestContent
            },
            options: {
                detailed: true,
                performance: true,
                qualityThreshold: 0.8
            }
        };
        
        const jsonPath = path.join(__dirname, 'temp', 'case1_request.json');
        fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2), 'utf8');
        console.log(`JSON request saved to: ${jsonPath}`);
        
    } else {
        console.log('Could not find suitable encoding for the file');
    }
    
} catch (error) {
    console.error('Error:', error.message);
}