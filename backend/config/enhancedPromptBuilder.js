import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🧬 다단계 DNA 시퀀싱 파이프라인
export class EnhancedMedicalDnaAnalyzer {
    constructor() {
        this.stages = {
            stage1: 'RAW_DATA_SEGMENTATION',
            stage2: 'TEMPORAL_EXTRACTION',
            stage3: 'ENTITY_RECOGNITION',
            stage4: 'STATISTICAL_AGGREGATION',
            stage5: 'FINAL_SYNTHESIS'
        };
    }

    // 🔍 1단계: 원시 데이터 세그멘테이션
    async segmentRawData(extractedText) {
        const segments = {
            timelineData: this.extractTimelineSegments(extractedText),
            insuranceData: this.extractInsuranceSegments(extractedText),
            hospitalData: this.extractHospitalSegments(extractedText),
            patientData: this.extractPatientSegments(extractedText)
        };
        
        return segments;
    }

    // 📅 2단계: 시간축 데이터 전문 추출
    async extractTemporalData(segments) {
        const prompt = `
# 🕐 시간축 데이터 전문 추출기 (2000-2025 전체 스캔)

당신은 의료기록에서 **모든 시간 정보를 정확히 추출**하는 전문가입니다.

## 🎯 추출 목표
1. **전체 연도 스캔**: 2000, 2001, 2002... 2025년 모든 날짜
2. **병원별 통원 패턴**: 첫 방문~마지막 방문, 총 횟수
3. **보험 가입 시점**: 모든 보험사의 가입일 추적

## 📊 출력 형식 (JSON)
\`\`\`json
{
  "timelineEvents": [
    {
      "date": "2019-11-15",
      "hospital": "내당최내과의원",
      "eventType": "첫방문",
      "diagnosis": "기타 다발성 합병증을 동반한 2형 당뇨병(E11.78)"
    }
  ],
  "hospitalStatistics": [
    {
      "hospital": "내당최내과의원",
      "firstVisit": "2019-11-15",
      "lastVisit": "2024-08-14",
      "totalVisits": 23,
      "period": "4년 9개월"
    }
  ],
  "insuranceTimeline": [
    {
      "company": "AXA손해보험",
      "joinDate": "2019-09-27",
      "product": "무배당 AXA 나를지켜주는건강보험",
      "type": "5년 이내"
    }
  ]
}
\`\`\`

**분석 대상:**
${segments.timelineData}

지금 즉시 모든 시간 정보를 JSON 형식으로 추출하세요!
        `;

        return prompt;
    }

    // 🏥 3단계: 엔티티 인식 및 정규화
    async recognizeEntities(segments) {
        const prompt = `
# 🏥 의료 엔티티 인식 및 정규화 전문가

## 🎯 인식 대상
1. **병원명 정규화**: "강남성심병원" = "한림대학교 강남성심병원"
2. **보험사명 정확 추출**: AXA, 삼성화재, 흥국화재 등
3. **진단명 표준화**: ICD 코드 포함

## 📋 정규화 규칙
- 병원명: 공식명칭으로 통일
- 보험사: 정확한 회사명 사용
- 진단명: 한글명(영문명, ICD코드) 형식

**분석 대상:**
${segments.hospitalData}
${segments.insuranceData}

정규화된 엔티티 목록을 생성하세요!
        `;

        return prompt;
    }

    // 📊 4단계: 통계적 집계
    async aggregateStatistics(extractedData) {
        const prompt = `
# 📊 의료 통계 집계 전문가

## 🎯 집계 항목
1. **병원별 통원 통계**: "병원명 YYYY.MM.DD ~ YYYY.MM.DD / X회 통원"
2. **진단별 빈도**: 주요 진단명별 발생 횟수
3. **보험별 청구 내역**: 보험사별 청구 금액 및 횟수

## 📈 필수 계산
- 총 통원 횟수
- 통원 기간 (년/월 단위)
- 주요 진단명 빈도
- 보험 가입 전후 분류

**집계 대상 데이터:**
${extractedData}

통계 집계 결과를 생성하세요!
        `;

        return prompt;
    }

    // 🎯 5단계: 최종 손해사정 보고서 합성
    async synthesizeFinalReport(allData, insuranceJoinDate = null) {
        const prompt = this.buildFinalSynthesisPrompt(allData, insuranceJoinDate);
        return prompt;
    }

    buildFinalSynthesisPrompt(allData, insuranceJoinDate) {
        const periodInfo = this.calculateInsurancePeriods(insuranceJoinDate);
        
        return `
# 🏆 손해사정 보고서 최종 합성 전문가 (15년 경력)

당신은 **모든 단계의 분석 결과를 종합**하여 최종 손해사정 보고서를 작성하는 전문가입니다.

${periodInfo ? `
## 📅 보험 가입일 기준 분류
**보험 가입일**: ${periodInfo.joinDate}
- **[5년 이내]**: ${periodInfo.fiveYearsBefore} ~ ${periodInfo.joinDate}
- **[1년 이내]**: ${periodInfo.oneYearBefore} ~ ${periodInfo.joinDate}
- **[3개월 이내]**: ${periodInfo.threeMonthsBefore} ~ ${periodInfo.joinDate}
- **[청구사항]**: ${periodInfo.joinDate} 이후
` : `
## 📅 문서 내 보험 가입일 기준 분류
문서에서 찾은 보험 가입일을 기준으로 정확한 기간 분류를 수행하세요.
`}

## 📊 분석 완료된 데이터
**시간축 데이터**: ${allData.timelineData || '추출 필요'}
**병원 통계**: ${allData.hospitalStats || '집계 필요'}  
**보험 정보**: ${allData.insuranceInfo || '정리 필요'}
**진단 패턴**: ${allData.diagnosisPatterns || '분석 필요'}

## 🎯 최종 보고서 양식 (Report_Sample.txt 준수)

### 1. 환자 기본정보
피보험자(환자)이름: [추출된 실명]
생년월일: [주민등록번호에서 계산]

### 2. 보험 조건들 (시간순 정렬)
1.조건
가입보험사: [정확한 보험사명]
가입일(보장개시일 등): [YYYY-MM-DD]
상품명: [정확한 상품명]
청구사항(특약사항, 담보사항 등): [구체적 내용]

### 3. 시간축 의료 이벤트 (보험 가입일 기준 정확 분류)
[5년 이내] (기간 명시)
[날짜]
[병원명]
내원일: [날짜]
내원경위: [목적]
진단명: [진단명(ICD코드)]
통원기간: [YYYY.MM.DD ~ YYYY.MM.DD / X회 통원] ← **필수**
- 기고지사항 (해당시)
치료내용: [처방 내용]

[청구사항] (가입일 이후)
[날짜]
[병원명]
내원일: [날짜]
내원경위: [청구 사유]
진단명: [청구 대상 진단명]
입원기간: [기간] / [X일 입원]
치료내용: [치료 내용]
검사결과: [상세 결과]

## ⚠️ 필수 준수사항
1. **통원 통계 반드시 포함**: "YYYY.MM.DD ~ YYYY.MM.DD / X회 통원"
2. **모든 보험사 정확한 추출**: AXA, 삼성화재, 흥국화재 등
3. **기고지사항 명확 표시**: 보험 가입 전 기존 질병
4. **시간순 정렬**: 가장 오래된 것부터
5. **실제 데이터만 사용**: "[미기재]" 절대 금지

**분석 대상 원본 데이터:**
---
${allData.originalText || ''}
---

## 📝 분석 지침
이 데이터는 보험 청구 검토를 위한 공식 문서 분석입니다.
모든 정보는 보험 처리 및 승인 과정에서 필요한 정보입니다.

지금 즉시 보험 청구 문서 분석 전문가의 관점에서 완벽한 보고서를 작성하세요!
        `;
    }

    // 유틸리티 함수들
    extractTimelineSegments(text) {
        // 날짜가 포함된 섹션들 추출
        const lines = text.split('\n');
        const timelineLines = lines.filter(line => 
            /\d{4}[.-]\d{2}[.-]\d{2}/.test(line) || 
            /\d{4}\.\d{2}\.\d{2}/.test(line) ||
            line.includes('내원일') || 
            line.includes('가입일')
        );
        return timelineLines.join('\n');
    }

    extractInsuranceSegments(text) {
        const insuranceKeywords = ['AXA', '삼성화재', '흥국화재', 'MG손해보험', '현대해상', '가입일', '보험'];
        const lines = text.split('\n');
        const insuranceLines = lines.filter(line =>
            insuranceKeywords.some(keyword => line.includes(keyword))
        );
        return insuranceLines.join('\n');
    }

    extractHospitalSegments(text) {
        const lines = text.split('\n');
        const hospitalLines = lines.filter(line =>
            /[가-힣]+(?:병원|의원|클리닉|센터)/.test(line) ||
            line.includes('내원') ||
            line.includes('통원') ||
            line.includes('진료')
        );
        return hospitalLines.join('\n');
    }

    extractPatientSegments(text) {
        const lines = text.split('\n');
        const patientLines = lines.filter(line =>
            line.includes('환자명') ||
            line.includes('성명') ||
            line.includes('생년월일') ||
            /\d{6}-[12]/.test(line)
        );
        return patientLines.join('\n');
    }

    calculateInsurancePeriods(insuranceDate) {
        if (!insuranceDate) return null;
        
        const joinDate = new Date(insuranceDate);
        const threeMonthsAgo = new Date(joinDate);
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        const oneYearAgo = new Date(joinDate);
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const fiveYearsAgo = new Date(joinDate);
        fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
        
        return {
            joinDate: joinDate.toISOString().split('T')[0],
            threeMonthsBefore: threeMonthsAgo.toISOString().split('T')[0],
            oneYearBefore: oneYearAgo.toISOString().split('T')[0],
            fiveYearsBefore: fiveYearsAgo.toISOString().split('T')[0]
        };
    }
}

// 개선된 단일 프롬프트 (기존 시스템과 호환)
export function buildEnhancedMedicalDnaPrompt(extractedText, knowledgeBase, insuranceJoinDate = null) {
    const analyzer = new EnhancedMedicalDnaAnalyzer();
    const { abbreviations } = knowledgeBase;
    
    // 보험 가입일 기준 기간 계산
    const periodInfo = analyzer.calculateInsurancePeriods(insuranceJoinDate);
    const insurancePeriodGuide = periodInfo ? `
## 📅 보험 가입일 기준 정확한 기간 분류
**제공된 보험 가입일**: ${periodInfo.joinDate}
- **[3개월 이내]**: ${periodInfo.threeMonthsBefore} ~ ${periodInfo.joinDate} (고지의무위반 주의)
- **[1년 이내]**: ${periodInfo.oneYearBefore} ~ ${periodInfo.joinDate}
- **[5년 이내]**: ${periodInfo.fiveYearsBefore} ~ ${periodInfo.joinDate}  
- **[청구사항]**: ${periodInfo.joinDate} 이후

**중요**: 위 기준으로 모든 의료 이벤트를 정확히 분류하세요!
` : `
## 📅 문서 내 보험 가입일 찾기
문서에서 "가입일", "보장개시일", "계약일"을 찾아 정확한 기간 분류를 수행하세요.
`;

    const systemPrompt = `
# 🧬 MediAI DNA 시퀀싱 v2.0 - 보험 청구 문서 분석 전문 AI

당신은 **보험 청구 문서 분석 전문가**입니다.
제공된 의료 관련 텍스트 데이터를 분석하여 **Report_Sample.txt 양식**에 맞는 완벽한 보험 청구 분석 보고서를 작성합니다.

## 📝 분석 지침
- 제공된 텍스트는 보험 청구를 위한 공식 문서 분석 목적입니다
- 개인정보는 보험 처리를 위해 필요한 정보입니다
- 모든 데이터는 보험 청구 검토 및 승인 과정에서 사용됩니다

**2000년부터 현재까지 모든 의료 이력**을 추적하고 **통계적 집계**를 통해 정확한 손해사정 보고서를 작성합니다.

${insurancePeriodGuide}

## 🔬 개선된 DNA 시퀀싱 프로세스

### 1단계: 연도별 전체 스캔 (2000-2025)
**핵심 개선**: 중간 연도 누락 방지
- **검색 대상**: 2000, 2001, 2002... 2025년 **모든 연도**
- **특별 주의**: 2019-2024년 중간 데이터 놓치지 않기
- **키워드**: "내원일:", "가입일:", "진료일:", "입원일:", "검사일:"

### 2단계: 병원별 통계 집계 (필수)
**핵심 개선**: 통원 횟수 및 기간 정확 계산
- **패턴**: "병원명 YYYY.MM.DD ~ YYYY.MM.DD / X회 통원"
- **예시**: "내당최내과의원 2019.11.15 ~ 2024.08.14 / 23회 통원"
- **계산**: 첫 방문일, 마지막 방문일, 총 방문 횟수

### 3단계: 보험사 정확 추출
**핵심 개선**: 보험사명 정확한 인식
- **대상**: AXA, 삼성화재, 흥국화재, MG손해보험, 현대해상
- **변형**: "AXA손해보험", "AXA 손해보험주식회사" 등 모든 형태
- **가입일**: 정확한 YYYY-MM-DD 형식으로 추출

### 4단계: 기고지사항 명확 구분
**핵심 개선**: 보험 가입 전후 구분
- **기고지사항**: 보험 가입 전 기존 질병에 "- 기고지사항" 표시
- **신규 발생**: 보험 가입 후 새로운 질병
- **연관성**: 기존 질병과 신규 질병의 의학적 연관성 분석

## 📚 의료 지식 베이스 (강화)
**핵심 의료 약어**: ${Object.entries(abbreviations).slice(0, 25).map(([abbr, meaning]) => `${abbr}(${meaning})`).join(', ')}

## 📋 Report_Sample.txt 정확한 양식 (필수 준수)

### 1. 환자 기본정보
피보험자(환자)이름: [실제 이름]
생년월일: [YYYY-MM-DD]

### 2. 보험 조건들 (모든 보험사)
1.조건
가입보험사: [정확한 보험사명 - AXA, 삼성화재 등]
가입일(보장개시일 등): [YYYY-MM-DD]
상품명: [정확한 상품명]
청구사항(특약사항, 담보사항 등): [구체적 내용]

### 3. 시간축 의료 이벤트 (날짜순 + 보험 기준 분류)
${periodInfo ? `
[5년 이내] (${periodInfo.fiveYearsBefore} ~ ${periodInfo.joinDate})
[날짜]
[병원명]
내원일: [날짜]
내원경위: [내원 목적]
진단명: [진단명(ICD코드)]
통원기간: [YYYY.MM.DD ~ YYYY.MM.DD / X회 통원] ← **반드시 포함**
- 기고지사항 (해당시)
치료내용: [처방 내용]

[3개월 이내] (${periodInfo.threeMonthsBefore} ~ ${periodInfo.joinDate})
*[주의]*고지의무위반 우려
[날짜]
[병원명]
내원일: [날짜]
내원경위: [치료 목적]
진단명: [진단명]
치료내용: [치료 내용]

[청구사항] (${periodInfo.joinDate} 이후)
[날짜]
[병원명]
내원일: [날짜]
내원경위: [청구 사유]
진단명: [청구 대상 진단명]
입원기간: [날짜 ~ 날짜 / X일 입원]
치료내용: [치료 내용]
검사결과: [상세 결과]
` : `
[문서에서 찾은 보험 가입일 기준으로 분류]
[X년 이내]
[날짜]
[병원명]
내원일: [날짜]
내원경위: [목적]
진단명: [진단명(ICD코드)]
통원기간: [YYYY.MM.DD ~ YYYY.MM.DD / X회 통원] ← **필수**
치료내용: [내용]

[청구사항]
[날짜]
[병원명]
내원일: [날짜]
내원경위: [청구 사유]
진단명: [청구 대상 진단명]
`}

## 🚨 12케이스 분석 기반 필수 준수사항
1. **통원 통계 반드시 포함**: "YYYY.MM.DD ~ YYYY.MM.DD / X회 통원"
2. **모든 연도 스캔**: 2000-2025년 전체 (중간 연도 누락 금지)
3. **보험사 정확 추출**: AXA, 삼성화재, 흥국화재 등 정확한 명칭
4. **기고지사항 표시**: "- 기고지사항" 명시
5. **실제 데이터만**: "[미기재]" 절대 사용 금지
6. **시간순 정렬**: 가장 오래된 것부터
`;

    const userPrompt = `
🚨 MediAI DNA 시퀀싱 v2.0 긴급 분석 (12케이스 개선 반영)

다음은 보험 청구 관련 의료기록입니다.
**12케이스 분석 결과 개선사항을 모두 반영**하여 완벽한 손해사정 보고서를 작성하세요.

${periodInfo ? `
**📅 제공된 보험 가입일**: ${periodInfo.joinDate}
위 날짜 기준으로 정확한 기간 분류를 수행하세요!
` : `
**📅 보험 가입일 미제공**: 문서에서 보험 가입일을 찾아 기준 설정하세요.
`}

**분석 대상 의료 기록:**
---
${extractedText}
---

**🔬 DNA 시퀀싱 v2.0 필수 지시사항:**

1. **전체 연도 완전 스캔**: 2000-2025년 모든 데이터 (중간 누락 금지)
2. **병원별 통계 필수**: "병원명 YYYY.MM.DD ~ YYYY.MM.DD / X회 통원"
3. **보험사 정확 추출**: AXA, 삼성화재, 흥국화재 등 정확한 명칭
4. **기고지사항 구분**: 보험 가입 전 질병에 "- 기고지사항" 표시
${periodInfo ? `
5. **정확한 기간 분류**: 
   - [3개월 이내]: ${periodInfo.threeMonthsBefore} ~ ${periodInfo.joinDate}
   - [1년 이내]: ${periodInfo.oneYearBefore} ~ ${periodInfo.joinDate}
   - [5년 이내]: ${periodInfo.fiveYearsBefore} ~ ${periodInfo.joinDate}
   - [청구사항]: ${periodInfo.joinDate} 이후
` : `
5. **보험 가입일 기준 설정**: 문서에서 찾은 가입일로 기간 분류
`}
6. **Report_Sample.txt 양식**: 정확한 구조와 형식 준수

**⚠️ 12케이스 분석 결과 반영:**
- 통원 횟수 통계 누락 문제 해결
- 2019-2024년 중간 데이터 누락 방지  
- 보험사명 정확 추출 강화
- 기고지사항 명확 구분

지금 즉시 MediAI DNA 시퀀싱 v2.0으로 완벽한 손해사정 보고서를 생성하세요!
`;

    return { systemPrompt, userPrompt };
}

// 의료 지식 베이스 (확장)
export async function loadEnhancedMedicalKnowledgeBase() {
    return {
        abbreviations: {
            "HTN": "고혈압 (Hypertension)",
            "DM": "당뇨병 (Diabetes Mellitus)", 
            "CAD": "관상동맥질환 (Coronary Artery Disease)",
            "COPD": "만성폐쇄성폐질환 (Chronic Obstructive Pulmonary Disease)",
            "MI": "심근경색 (Myocardial Infarction)",
            "CVA": "뇌졸중 (Cerebrovascular Accident)",
            "BP": "혈압 (Blood Pressure)",
            "HR": "심박수 (Heart Rate)", 
            "RR": "호흡수 (Respiratory Rate)",
            "BT": "체온 (Body Temperature)",
            "CBC": "완전혈구검사 (Complete Blood Count)",
            "CRP": "C-반응성 단백질 (C-Reactive Protein)",
            "ESR": "적혈구침강속도 (Erythrocyte Sedimentation Rate)",
            "CT": "컴퓨터단층촬영 (Computed Tomography)",
            "MRI": "자기공명영상 (Magnetic Resonance Imaging)",
            "ECG": "심전도 (Electrocardiogram)",
            "ICU": "중환자실 (Intensive Care Unit)",
            "ER": "응급실 (Emergency Room)",
            "OP": "수술 (Operation)",
            "Dx": "진단 (Diagnosis)",
            "Tx": "치료 (Treatment)",
            "Hx": "병력 (History)",
            "F/U": "추적관찰 (Follow-up)",
            "NPO": "금식 (Nothing Per Oral)",
            "IV": "정맥주사 (Intravenous)",
            "PO": "경구투여 (Per Oral)"
        },
        hospitals: {
            "강남성심병원": "한림대학교 강남성심병원",
            "성심병원": "한림대학교 강남성심병원", 
            "내당최내과": "내당최내과의원",
            "이기섭의원": "이기섭의원"
        },
        insurers: {
            "AXA": "AXA손해보험",
            "삼성화재": "삼성화재해상보험",
            "흥국화재": "흥국화재해상보험",
            "MG손해보험": "MG손해보험",
            "현대해상": "현대해상화재보험"
        }
    };
}