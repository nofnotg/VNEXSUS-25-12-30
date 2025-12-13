
class VectorEvaluationService {
    constructor() {
        // X-Axis: Clinical Severity (0-10)
        this.severityMap = {
            // Critical (10)
            'CANCER': 10,
            'MALIGNANT_NEOPLASM': 10,
            'BRAIN_DISEASE': 10,
            'CEREBROVASCULAR': 10,
            'STROKE': 10,
            'HEART_DISEASE': 10,
            'MYOCARDIAL_INFARCTION': 10,
            'ACUTE_MYOCARDIAL_INFARCTION': 10,

            // High (8-9)
            'ANGINA': 9,
            'ARRHYTHMIA': 8,
            'HYPERTENSION': 7,
            'DIABETES': 7,

            // Moderate (4-6)
            'FRACTURE': 5,
            'APPENDICITIS': 4,

            // Low (0-3)
            'COLD': 1,
            'DEFAULT': 3
        };

        // Z-Axis: Medical Certainty (0-10)
        this.certaintyMap = {
            // Confirmed (10)
            'BIOPSY': 10,
            'SURGERY': 10,
            'PATHOLOGY': 10,
            'CONFIRMED_DIAGNOSIS': 10,

            // High (7-9)
            'MRI': 9,
            'CT': 9,
            'ADMISSION': 8,
            'MEDICATION': 7,

            // Moderate (4-6)
            'ULTRASOUND': 6,
            'X-RAY': 5,
            'DOCTOR_OPINION': 4,

            // Low (0-3)
            'SYMPTOM': 2,
            'PATIENT_COMPLAINT': 1,
            'DEFAULT': 3
        };
    }

    /**
     * Calculate the 3D Vector for a given case.
     * @param {Array} events - List of medical events.
     * @param {string} contractDate - Policy contract date (YYYY-MM-DD).
     * @returns {Object} { x, y, z, vectorType }
     */
    evaluate(events, contractDate) {
        if (!events || events.length === 0) {
            return { x: 0, y: 0, z: 0, vectorType: 'EMPTY' };
        }

        // Find the most significant event (prioritizing pre-contract risks)
        const significantEvent = this.findSignificantEvent(events, contractDate);

        const x = this.calculateSeverity(significantEvent);
        const y = this.calculateTemporalRelevance(significantEvent, contractDate);
        const z = this.calculateMedicalCertainty(events); // Certainty is based on the whole case context

        return {
            x,
            y,
            z,
            vectorType: this.determineVectorType(x, y, z),
            significantEvent
        };
    }

    findSignificantEvent(events, contractDate) {
        // 1. Calculate severity and temporal relevance for all events
        const scoredEvents = events.map(e => ({
            ...e,
            severity: this.getSeverityScore(e.content),
            temporal: this.calculateTemporalRelevance(e, contractDate)
        }));

        // 2. Filter for High Severity (>= 7) AND Pre-contract (Temporal < 0)
        const preContractRisks = scoredEvents.filter(e => e.severity >= 7 && e.temporal < 0);

        // 3. If pre-contract risks exist, pick the most severe one
        if (preContractRisks.length > 0) {
            return preContractRisks.reduce((prev, curr) => (curr.severity > prev.severity ? curr : prev));
        }

        // 4. Otherwise, pick the most severe event overall
        return scoredEvents.reduce((prev, curr) => (curr.severity > prev.severity ? curr : prev));
    }

    getSeverityScore(content) {
        if (!content) return 0;
        const upperContent = content.toUpperCase();

        // Check for keywords in content
        for (const [key, score] of Object.entries(this.severityMap)) {
            if (upperContent.includes(key) || this.checkKoreanKeyword(upperContent, key)) {
                return score;
            }
        }
        return this.severityMap['DEFAULT'];
    }

    checkKoreanKeyword(content, key) {
        const koreanMap = {
            'CANCER': ['암', '악성신생물', 'CARCINOMA'],
            'BRAIN_DISEASE': ['뇌졸중', '뇌출혈', '뇌경색', '뇌혈관'],
            'HEART_DISEASE': ['심근경색', '협심증', '심장질환'],
            'ADMISSION': ['입원'],
            'SURGERY': ['수술', '절제술']
        };

        if (koreanMap[key]) {
            return koreanMap[key].some(k => content.includes(k));
        }
        return false;
    }

    calculateSeverity(event) {
        return this.getSeverityScore(event.content);
    }

    calculateTemporalRelevance(event, contractDate) {
        if (!event || !event.date || !contractDate) return 0;

        const eventDateObj = new Date(event.date);
        const contractDateObj = new Date(contractDate);

        // Calculate difference in days
        const diffTime = eventDateObj - contractDateObj;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Y-Axis Logic
        // -10: > 5 years pre-contract (Safe history)
        // -5: Within 5 years pre-contract (Disclosure Duty)
        // 0: Contract Date
        // +1: Exemption Period (e.g., 90 days)
        // +10: Post-contract (Safe coverage)

        if (diffDays < -(365 * 5)) return -10; // Older than 5 years
        if (diffDays < 0) return -5; // Pre-contract (Disclosure Risk)
        if (diffDays === 0) return 0; // D-Day
        if (diffDays <= 90) return 1; // Exemption Period
        return 10; // Post-contract
    }

    calculateMedicalCertainty(events) {
        let maxScore = 0;

        for (const event of events) {
            const content = event.content ? event.content.toUpperCase() : '';
            let score = this.certaintyMap['DEFAULT'];

            // Check keywords
            for (const [key, val] of Object.entries(this.certaintyMap)) {
                if (content.includes(key) || this.checkKoreanKeyword(content, key)) {
                    score = Math.max(score, val);
                }
            }
            maxScore = Math.max(maxScore, score);
        }

        return maxScore;
    }

    determineVectorType(x, y, z) {
        if (x >= 8 && y < 0) return 'VIOLATION_RISK'; // High Severity + Pre-contract
        if (x >= 8 && y > 0) return 'PAYMENT_TARGET'; // High Severity + Post-contract
        if (y > 0 && y <= 90 && x >= 8) return 'EXEMPTION_TARGET'; // High Severity + Exemption Period
        return 'GENERAL_REVIEW';
    }
}

export default new VectorEvaluationService();
