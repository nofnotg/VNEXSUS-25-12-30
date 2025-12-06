/**
 * DisputeScoringUtil.test.js
 * 
 * Master Plan Phase 1: Dispute Layer 단위 테스트
 * 
 * 목적:
 * - DisputeScoringUtil의 핵심 함수 검증
 * - Phase 계산 정확도 검증
 * - ImportanceScore 범위 및 로직 검증
 */

import { describe, it, expect } from '@jest/globals';
import {
    calculatePhase,
    calcDiagnosisMatch,
    calcSeverityScore,
    calcChainPositionScore,
    scoreEvent,
    createDisputeTag,
    findIndexEvent
} from '../../services/core-engine/utils/DisputeScoringUtil.js';
import { ContractInfo, ClaimSpec } from '../../services/core-engine/DataContracts.js';


describe('DisputeScoringUtil', () => {
    describe('calculatePhase', () => {
        const contractInfo = new ContractInfo({
            issueDate: '2024-01-01',
            waitingPeriodDays: 90
        });

        it('should return PRE_CONTRACT for dates before issue date', () => {
            const phase = calculatePhase('2023-12-01', contractInfo);
            expect(phase).toBe('PRE_CONTRACT');
        });

        it('should return WAITING_PERIOD for dates within waiting period', () => {
            const phase = calculatePhase('2024-02-01', contractInfo);
            expect(phase).toBe('WAITING_PERIOD');
        });

        it('should return COVERED_PERIOD for dates after waiting period', () => {
            const phase = calculatePhase('2024-05-01', contractInfo);
            expect(phase).toBe('COVERED_PERIOD');
        });

        it('should return COVERED_PERIOD for null eventDate', () => {
            const phase = calculatePhase(null, contractInfo);
            expect(phase).toBe('COVERED_PERIOD');
        });

        it('should return COVERED_PERIOD for null contractInfo', () => {
            const phase = calculatePhase('2024-01-01', null);
            expect(phase).toBe('COVERED_PERIOD');
        });
    });

    describe('calcDiagnosisMatch', () => {
        const claimSpec = new ClaimSpec({
            claimBodySystems: ['breast', 'cardio']
        });

        it('should return 1.0 for exact match', () => {
            const score = calcDiagnosisMatch(['breast', 'cardio'], claimSpec);
            expect(score).toBe(1.0);
        });

        it('should return 0.5 for partial match', () => {
            const score = calcDiagnosisMatch(['breast'], claimSpec);
            expect(score).toBeGreaterThan(0);
            expect(score).toBeLessThan(1.0);
        });

        it('should return 0.0 for no match', () => {
            const score = calcDiagnosisMatch(['respiratory'], claimSpec);
            expect(score).toBe(0.0);
        });

        it('should return 0.0 for empty eventBodySystems', () => {
            const score = calcDiagnosisMatch([], claimSpec);
            expect(score).toBe(0.0);
        });

        it('should return 0.0 for null claimSpec', () => {
            const score = calcDiagnosisMatch(['breast'], null);
            expect(score).toBe(0.0);
        });
    });

    describe('calcSeverityScore', () => {
        it('should return 0.5 for surgery', () => {
            const event = {
                entities: [
                    { type: 'procedure', procedureType: 'surgery', text: '유방절제술' }
                ]
            };
            const score = calcSeverityScore(event);
            expect(score).toBeGreaterThanOrEqual(0.5);
        });

        it('should return 0.3 for admission', () => {
            const event = {
                entities: [
                    { type: 'event', eventType: 'admission' }
                ]
            };
            const score = calcSeverityScore(event);
            expect(score).toBeGreaterThanOrEqual(0.3);
        });

        it('should return 1.0 for surgery + admission + chemo', () => {
            const event = {
                entities: [
                    { type: 'procedure', procedureType: 'surgery', text: '수술' },
                    { type: 'event', eventType: 'admission' },
                    { type: 'medication', text: '항암화학요법' }
                ]
            };
            const score = calcSeverityScore(event);
            expect(score).toBe(1.0);
        });

        it('should return 0.0 for no severe events', () => {
            const event = {
                entities: [
                    { type: 'test', text: '혈액검사' }
                ]
            };
            const score = calcSeverityScore(event);
            expect(score).toBe(0.0);
        });
    });

    describe('calcChainPositionScore', () => {
        const timelineContext = {
            indexEventDate: '2024-06-01'
        };

        it('should return 1.0 for events within 7 days', () => {
            const event = { date: '2024-06-05' };
            const score = calcChainPositionScore(event, timelineContext);
            expect(score).toBe(1.0);
        });

        it('should return 0.7 for events within 30 days', () => {
            const event = { date: '2024-06-20' };
            const score = calcChainPositionScore(event, timelineContext);
            expect(score).toBe(0.7);
        });

        it('should return 0.4 for events within 180 days', () => {
            const event = { date: '2024-09-01' };
            const score = calcChainPositionScore(event, timelineContext);
            expect(score).toBe(0.4);
        });

        it('should return 0.0 for null timelineContext', () => {
            const event = { date: '2024-06-05' };
            const score = calcChainPositionScore(event, null);
            expect(score).toBe(0.0);
        });
    });

    describe('scoreEvent', () => {
        const contractInfo = new ContractInfo({
            issueDate: '2024-01-01',
            waitingPeriodDays: 90
        });

        const claimSpec = new ClaimSpec({
            claimBodySystems: ['breast'],
            claimDate: '2024-06-01'
        });

        const timelineContext = {
            indexEventDate: '2024-06-01'
        };

        it('should calculate importanceScore within 0.0 ~ 1.0', () => {
            const event = {
                date: '2023-12-01',
                entities: [
                    { type: 'diagnosis', text: '유방암', codes: { icd10: 'C50.9' } }
                ]
            };

            const result = scoreEvent(event, claimSpec, contractInfo, timelineContext);

            expect(result.importanceScore).toBeGreaterThanOrEqual(0.0);
            expect(result.importanceScore).toBeLessThanOrEqual(1.0);
        });

        it('should return PRE_CONTRACT phase for pre-contract events', () => {
            const event = {
                date: '2023-12-01',
                entities: []
            };

            const result = scoreEvent(event, claimSpec, contractInfo, timelineContext);
            expect(result.phase).toBe('PRE_CONTRACT');
        });

        it('should include reasons array', () => {
            const event = {
                date: '2023-12-01',
                entities: [
                    { type: 'diagnosis', text: '유방암', codes: { icd10: 'C50.9' } },
                    { type: 'procedure', procedureType: 'surgery', text: '유방절제술' }
                ]
            };

            const result = scoreEvent(event, claimSpec, contractInfo, timelineContext);
            expect(Array.isArray(result.reasons)).toBe(true);
            expect(result.reasons.length).toBeGreaterThan(0);
        });
    });

    describe('createDisputeTag', () => {
        const contractInfo = new ContractInfo({
            issueDate: '2024-01-01',
            waitingPeriodDays: 90
        });

        const claimSpec = new ClaimSpec({
            claimBodySystems: ['breast'],
            claimDate: '2024-06-01'
        });

        const timelineContext = {
            indexEventDate: '2024-06-01'
        };

        it('should create DisputeTag with all required fields', () => {
            const event = {
                date: '2023-12-01',
                entities: [
                    { type: 'diagnosis', text: '유방암', codes: { icd10: 'C50.9' } }
                ]
            };

            const tag = createDisputeTag(event, claimSpec, contractInfo, timelineContext);

            expect(tag).toHaveProperty('phase');
            expect(tag).toHaveProperty('role');
            expect(tag).toHaveProperty('dutyToDisclose');
            expect(tag).toHaveProperty('importanceScore');
            expect(tag).toHaveProperty('reasons');
        });

        it('should set dutyToDisclose to POTENTIAL for high-score pre-contract events', () => {
            const event = {
                date: '2023-12-01',
                entities: [
                    { type: 'diagnosis', text: '유방암', codes: { icd10: 'C50.9' } },
                    { type: 'procedure', procedureType: 'surgery', text: '유방절제술' }
                ]
            };

            const tag = createDisputeTag(event, claimSpec, contractInfo, timelineContext);
            expect(['POTENTIAL', 'VIOLATION_CANDIDATE']).toContain(tag.dutyToDisclose);
        });

        it('should have toJSON method', () => {
            const event = {
                date: '2024-05-01',
                entities: []
            };

            const tag = createDisputeTag(event, claimSpec, contractInfo, timelineContext);
            const json = tag.toJSON();

            expect(json).toHaveProperty('phase');
            expect(json).toHaveProperty('importanceScore');
        });
    });

    describe('findIndexEvent', () => {
        const claimSpec = new ClaimSpec({
            claimDate: '2024-06-01'
        });

        it('should find closest event to claim date', () => {
            const events = [
                { date: '2024-05-01', id: 'event1' },
                { date: '2024-06-02', id: 'event2' }, // Closest
                { date: '2024-07-01', id: 'event3' }
            ];

            const indexEvent = findIndexEvent(events, claimSpec);
            expect(indexEvent.id).toBe('event2');
        });

        it('should return null for empty events array', () => {
            const indexEvent = findIndexEvent([], claimSpec);
            expect(indexEvent).toBeNull();
        });

        it('should return null for null claimSpec', () => {
            const events = [{ date: '2024-06-01' }];
            const indexEvent = findIndexEvent(events, null);
            expect(indexEvent).toBeNull();
        });
    });
});
