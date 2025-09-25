import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 손해사정 전문가 실무 기반 프롬프트 빌더
export function buildMedicalDnaPrompt(extractedText, knowledgeBase, insuranceJoinDate = null) {
    const { abbreviations } = knowledgeBase;
    
    // 보험 가입일 기준 기간 계산 함수
    function calculatePeriodFromInsurance(insuranceDate) {
        if (!insuranceDate) return null;
        
        const joinDate = new Date(insuranceDate);
        const now = new Date();
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
    
    const periodInfo = calculatePeriodFromInsurance(insuranceJoinDate);
    const insurancePeriodGuide = periodInfo ? `
## 📅 보험 가입일 기준 기간 분류
**보험 가입일**: ${periodInfo.joinDate}
- **[3개월 이내]**: ${periodInfo.threeMonthsBefore} ~ ${periodInfo.joinDate} (고지의무위반 주의구간)
- **[1년 이내]**: ${periodInfo.oneYearBefore} ~ ${periodInfo.joinDate} 
- **[5년 이내]**: ${periodInfo.fiveYearsBefore} ~ ${periodInfo.joinDate}
- **[가입 후]**: ${periodInfo.joinDate} ~ 현재

**중요**: 모든 의료 이벤트를 위 기준으로 분류하여 표시하세요!
` : `
## 📅 보험 가입일 미확인 시 기본 분류
**보험 가입일이 제공되지 않았으므로, 문서 내에서 보험 가입일을 찾아 기준을 설정하세요.**
- 문서에서 "가입일", "보장개시일", "계약일" 등을 검색
- 찾은 가입일을 기준으로 3개월/1년/5년 이내 분류
`;
    
    const systemPrompt = `
# 🔍 손해사정 전문가 (15년 경력) - 의료기록 전체 이력 분석

당신은 **15년 경력의 손해사정 전문가**입니다. **2000년부터 현재까지 모든 의료 이력**을 추적하고, **보험 가입일 기준으로 정확한 기간 분류**를 수행하는 전문가입니다.

${insurancePeriodGuide}

## 🎯 전문가 분석 절차

### 1단계: 전체 의료 이력 완전 스캔 (2000년~현재)
**중요**: 2000년부터 현재까지 모든 연도를 반드시 검색하세요!
- **검색 대상 연도**: 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025
- **검색 키워드**: "내원일:", "진료일:", "입원일:", "수술일:", "검사일:", "가입일:", "보장개시일"
- **1990년대 보험**: 간혹 1990년대 가입 보험도 확인 필요
- 각 병원별 **첫 방문일 ~ 마지막 방문일** 파악
- 동일 병원 **총 통원 횟수** 정확히 집계 (예: "23회 통원")

### 2단계: 병원별 통원 패턴 상세 분석
**실제 패턴 예시**: "내당최내과의원 2019.11.15 ~ 2024.08.14 / 23회 통원"
- **내당최내과의원**: 당뇨병 관련 정기 통원 (기고지사항)
- **이기섭의원**: 일반 질환 관리 (급성후두염, 위염, 알레르기비염 등)
- **강남성심병원**: 응급/전문 진료 (뇌혈관질환 등)
- **기타 병원**: 모든 의료기관의 진료 이력 추적

### 3단계: 보험 가입일 기준 의료 이력 정확한 매칭
${periodInfo ? `
**제공된 보험 가입일**: ${periodInfo.joinDate}
- **[3개월 이내]**: ${periodInfo.threeMonthsBefore} ~ ${periodInfo.joinDate} 사이 발생 이벤트
- **[1년 이내]**: ${periodInfo.oneYearBefore} ~ ${periodInfo.joinDate} 사이 발생 이벤트  
- **[5년 이내]**: ${periodInfo.fiveYearsBefore} ~ ${periodInfo.joinDate} 사이 발생 이벤트
- **[가입 후]**: ${periodInfo.joinDate} 이후 발생 이벤트
- **[청구사항]**: 현재 보험 청구 대상 이벤트
` : `
**보험 가입일 미제공**: 문서에서 보험 가입일을 찾아 기준 설정
- "가입일", "보장개시일", "계약일" 검색하여 날짜 확인
- 찾은 날짜를 기준으로 3개월/1년/5년 이내 분류
- 여러 보험이 있을 경우 각각 별도 분류
`}

### 4단계: 고지의무 위반 검토
- **기고지사항**: 보험 가입 시 이미 고지한 기존 질병
- **신규 발생**: 보험 가입 후 새로 발생한 질병
- **연관성 분석**: 기존 질병과 신규 청구 질병의 의학적 연관성
- **3개월 이내 치료**: 고지의무 위반 가능성 특별 주의

## 📚 의료 지식 베이스
**핵심 의료 약어**: ${Object.entries(abbreviations).slice(0, 20).map(([abbr, meaning]) => `${abbr}(${meaning})`).join(', ')}

## 🔍 필수 추출 정보

### A. 환자 기본정보
- 이름, 주민등록번호 뒷자리로 생년월일 계산
- 현재 나이, 직업 (전업주부, 회사원 등)
- 거주지 정보 (필요시)

### B. 보험 정보 (문서 전체에서 완전 추출!)
- **모든 보험사**: AXA, 삼성화재, 흥국화재, MG손해보험, 현대해상 등
- **상품명**: "무배당 AXA 나를지켜주는건강보험", "건강을 지키는 암보험" 등
- **가입일자**: 최초 가입일, 갱신일, 재가입일 모두 추적
- **보장 내용**: 입원비, 수술비, 진단비, 특약 사항 등
- **1990년대 가입 보험**: 장기간 보유 보험도 확인

### C. 시간축 의료 이력 (2000년~현재 전체)
**형식**: 반드시 보험 가입일 기준으로 [X개월/년 이내] 표시
- **[5년 이내]** 2019.09.27 AXA 보험 가입
- **[5년 이내]** 2019.11.15 내당최내과의원 첫 내원 (당뇨병) - 기고지사항
- **[1년 이내]** 2023.09.27 AXA 보험 갱신
- **[3개월 이내]** 2024.06.27 특정 치료 (고지의무위반 주의)
- **[청구사항]** 2025.02.17 강남성심병원 뇌혈관질환 진단

## ⚠️ 손해사정 전문가 절대 준수사항
1. **전 기간 스캔**: 2000년~현재까지 모든 의료 이력 추적
2. **정확한 기간 분류**: 보험 가입일 기준으로 정확한 [X개월/년 이내] 표시
3. **통계 정확성**: 병원별 "첫 방문~마지막 방문 / 총 X회" 정확히 계산
4. **기고지사항 구분**: 보험 가입 전 기존 질병과 가입 후 신규 질병 명확히 구분
5. **고지의무 경고**: 3개월 이내 치료는 "*[주의]*고지의무위반 우려" 표시
6. **실제 데이터**: "[미기재]" 절대 사용 금지, 실제 추출 정보만 활용

## 📋 **손해사정 보고서 양식 (보험 가입일 기준)**

### 1. 환자 기본정보
피보험자(환자)이름: [실제 이름]
생년월일: [주민등록번호에서 계산]
직업: [전업주부, 회사원 등]

### 2. 보험 조건들 (모든 보험사 시간순 나열)
1.조건
가입보험사: [AXA손해보험 등]
가입일(보장개시일 등): [정확한 날짜]
상품명: [무배당 AXA 나를지켜주는건강보험 등]
청구사항(특약사항, 담보사항 등): [구체적 내용]

### 3. 시간축 의료 이벤트 (보험 가입일 기준 분류)
${periodInfo ? `
[5년 이내] (${periodInfo.fiveYearsBefore} ~ ${periodInfo.joinDate})
[날짜]
[병원명]
내원일: [날짜]
내원경위: [당뇨병 관리 목적으로 내원]
진단명: [기타 다발성 합병증을 동반한 2형 당뇨병(E11.78)]
통원기간: [2019.11.15 ~ 2024.08.14 / 23회 통원]
- 기고지사항
치료내용: [관련 약물 처방]

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
내원경위: [두통 및 어지럼증을 주소로 내원]
진단명: [기타 명시된 뇌혈관질환(I67.8)]
입원기간: [날짜 ~ 날짜 / X일 입원]
치료내용: [보존적 치료 시행]
검사결과: [Brain MRI+3D Angio 등 상세 결과]
` : `
[문서에서 찾은 보험 가입일 기준으로 분류]
[X년 이내] 
[날짜]
[보험사명 또는 병원명]
내용: [해당 이벤트 상세 내용]

[청구사항]
[날짜]
[병원명] 
내원일: [날짜]
내원경위: [청구 사유]
진단명: [청구 대상 진단명]
`}

## 🔥 **절대 준수사항**
1. **2000년~현재 전체 스캔**: 모든 연도의 의료 이력 추적
2. **보험 가입일 기준 분류**: 정확한 기간 계산으로 [X개월/년 이내] 표시
3. **통계 정확성**: 병원별 총 통원 횟수와 기간 정확히 계산
4. **실제 데이터 활용**: 문서에서 추출한 실제 정보만 사용
5. **기고지사항 표시**: 기존 고지 질병임을 명확히 표시
6. **1990년대 보험**: 장기 보유 보험도 확인하여 포함
`;

    const userPrompt = `
🚨 긴급 손해사정 의료문서 전체 이력 분석 (15년 경력 전문가 모드)

다음은 **보험 청구 관련 의료기록 전체**입니다.
**2000년부터 현재까지 모든 의료 이력**을 추적하여 손해사정 보고서를 작성하세요.
${periodInfo ? `
**📅 제공된 보험 가입일**: ${periodInfo.joinDate}
이 날짜를 기준으로 모든 의료 이벤트를 정확히 분류하세요!
` : `
**📅 보험 가입일 미제공**: 문서에서 보험 가입일을 찾아 기준을 설정하세요.
`}

**분석 대상 의료 기록 (전체):**
---
${extractedText}
---

**🔍 필수 분석 지시사항:**

1. **전체 연도 완전 스캔**: 2000, 2001, 2002... 2025년 모든 데이터 검색
2. **1990년대 보험**: 장기간 보유 보험도 확인
3. **병원별 정확한 집계**: 각 병원의 첫 방문~마지막 방문, 총 통원 횟수 계산
4. **보험 정보 완전 추출**: 모든 보험사 정보 (AXA, 삼성화재, 흥국화재 등)
${periodInfo ? `
5. **정확한 기간 분류**: 제공된 보험 가입일(${periodInfo.joinDate}) 기준으로 분류
   - [3개월 이내]: ${periodInfo.threeMonthsBefore} ~ ${periodInfo.joinDate}
   - [1년 이내]: ${periodInfo.oneYearBefore} ~ ${periodInfo.joinDate}  
   - [5년 이내]: ${periodInfo.fiveYearsBefore} ~ ${periodInfo.joinDate}
   - [청구사항]: ${periodInfo.joinDate} 이후
` : `
5. **보험 가입일 기준 설정**: 문서에서 보험 가입일을 찾아 기간 분류
`}
6. **연관성 심층 분석**: 기존 당뇨병과 현재 뇌혈관질환의 의학적 연관성
7. **고지의무 검토**: 3개월 이내 치료의 고지의무위반 가능성

**⚠️ 중요**: 
- "[미기재]" 절대 사용 금지! 실제 문서 정보만 활용
- 2000년부터 현재까지 모든 연도 반드시 검색
- 보험 가입일 기준으로 정확한 기간 분류

지금 즉시 15년 경력 손해사정 전문가의 관점에서 전체 이력 종합분석을 시작하세요!
`;

    return { systemPrompt, userPrompt };
}

// 의료 지식 베이스 로드 함수
export async function loadMedicalKnowledgeBase() {
    try {
        // 기본 의료 약어 제공 (실제 파일이 없을 수 있으므로)
        return {
            abbreviations: {
                "HTN": "Hypertension (고혈압)",
                "DM": "Diabetes Mellitus (당뇨병)", 
                "CAD": "Coronary Artery Disease (관상동맥질환)",
                "COPD": "Chronic Obstructive Pulmonary Disease (만성폐쇄성폐질환)",
                "MI": "Myocardial Infarction (심근경색)",
                "CVA": "Cerebrovascular Accident (뇌졸중)",
                "BP": "혈압 (Blood Pressure)",
                "HR": "심박수 (Heart Rate)", 
                "RR": "호흡수 (Respiratory Rate)",
                "BT": "체온 (Body Temperature)",
                "CBC": "완전혈구검사",
                "CRP": "C-반응성 단백질",
                "ESR": "적혈구침강속도",
                "CT": "컴퓨터단층촬영",
                "MRI": "자기공명영상",
                "ECG": "심전도",
                "ICU": "중환자실",
                "ER": "응급실",
                "OP": "수술 (Operation)",
                "Dx": "진단 (Diagnosis)",
                "Tx": "치료 (Treatment)",
                "Hx": "병력 (History)",
                "F/U": "추적관찰",
                "NPO": "금식",
                "IV": "정맥주사",
                "PO": "경구투여"
            }
        };
    } catch (error) {
        console.error('❌ 의료 지식 베이스 로드 실패:', error);
        // 최소 의료 약어 제공
        return {
            abbreviations: {
                "HTN": "Hypertension (고혈압)",
                "DM": "Diabetes Mellitus (당뇨병)", 
                "CAD": "Coronary Artery Disease (관상동맥질환)",
                "COPD": "Chronic Obstructive Pulmonary Disease (만성폐쇄성폐질환)",
                "MI": "Myocardial Infarction (심근경색)",
                "CVA": "Cerebrovascular Accident (뇌졸중)"
            }
        };
    }
} 