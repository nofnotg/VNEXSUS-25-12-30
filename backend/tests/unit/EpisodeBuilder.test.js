import { jest } from '@jest/globals';
import { EpisodeBuilder } from '../../services/core-engine/utils/EpisodeBuilder.js';

describe('EpisodeBuilder', () => {
    let episodeBuilder;

    beforeEach(() => {
        episodeBuilder = new EpisodeBuilder();
    });

    describe('groupEventsToEpisodes', () => {
        test('should return empty array for empty input', () => {
            const result = episodeBuilder.groupEventsToEpisodes([]);
            expect(result).toEqual([]);
        });

        test('should group events within 30 days into one episode', () => {
            const events = [
                { date: '2024-01-01', description: 'Event 1' },
                { date: '2024-01-15', description: 'Event 2' },
                { date: '2024-01-30', description: 'Event 3' }
            ];

            const episodes = episodeBuilder.groupEventsToEpisodes(events);

            expect(episodes).toHaveLength(1);
            expect(episodes[0].events).toHaveLength(3);
            expect(episodes[0].startDate).toBe('2024-01-01');
            expect(episodes[0].endDate).toBe('2024-01-30');
        });

        test('should separate events exceeding 30 days gap', () => {
            const events = [
                { date: '2024-01-01', description: 'Event 1' },
                { date: '2024-03-01', description: 'Event 2' } // > 30 days gap
            ];

            const episodes = episodeBuilder.groupEventsToEpisodes(events);

            expect(episodes).toHaveLength(2);
            expect(episodes[0].events).toHaveLength(1);
            expect(episodes[1].events).toHaveLength(1);
        });

        test('should pick the highest importance dispute tag', () => {
            const events = [
                {
                    date: '2024-01-01',
                    disputeTag: { importanceScore: 0.5, phase: 'PHASE1' }
                },
                {
                    date: '2024-01-02',
                    disputeTag: { importanceScore: 0.9, phase: 'PHASE2' }
                },
                {
                    date: '2024-01-03',
                    disputeTag: { importanceScore: 0.3, phase: 'PHASE3' }
                }
            ];

            const episodes = episodeBuilder.groupEventsToEpisodes(events);

            expect(episodes).toHaveLength(1);
            expect(episodes[0].disputeTag.importanceScore).toBe(0.9);
            expect(episodes[0].disputeTag.phase).toBe('PHASE2');
        });
    });

    describe('buildEpisodeSummaryText', () => {
        test('should generate correct summary with dispute tag', () => {
            const episode = {
                dateRange: '2024-01-01 ~ 2024-01-05',
                mainDiagnosis: 'Acute Bronchitis',
                disputeTag: {
                    phase: 'COVERED_PERIOD',
                    dutyToDisclose: 'NONE'
                }
            };

            const summary = episodeBuilder.buildEpisodeSummaryText(episode);
            expect(summary).toBe('[2024-01-01 ~ 2024-01-05] Acute Bronchitis (COVERED_PERIOD, NONE)');
        });

        test('should generate correct summary without dispute tag', () => {
            const episode = {
                dateRange: '2024-01-01',
                mainDiagnosis: 'Checkup',
                disputeTag: null
            };

            const summary = episodeBuilder.buildEpisodeSummaryText(episode);
            expect(summary).toBe('[2024-01-01] Checkup');
        });
    });
});
