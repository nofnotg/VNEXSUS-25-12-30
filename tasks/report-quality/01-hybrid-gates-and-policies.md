# Task 01: Hybrid Gates & Policies

## 목표
LLM 보조 사용을 최소화하고 일관성을 확보하기 위한 룰 기반 게이트 정책을 수립/적용합니다.

## 산출물
- Ambiguity/Completeness/Compliance/RuleConfidence 정책 정의 및 임계값(소수점 1자리) 설정.
- 파이프라인 게이트 적용 가이드 및 테스트 케이스.

## 수용 기준
- 게이트가 실패 시 LLM Partial fill 또는 보류 경로로 안전하게 전환.
- 규정 경계(공개기간 등) 위반 시 보고서에 명시적 경고.

## 테스트
- 모호성 문구, 결측 필드, 경계 날짜, 비표준 병원명, 약어 진단 케이스.

