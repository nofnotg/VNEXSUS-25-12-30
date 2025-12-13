# VNEXSUS Improvement Tasks: Hybrid Architecture Implementation

## Phase 1: Foundation - Fact Extraction (HybridNER)
- [ ] **Refactor `coreEngineService.js`**
    - [ ] Disable current "One-Shot" prompt logic.
    - [ ] Enable `PipelineStateMachine` as the default controller.
    - [ ] Implement `extractDates()` using strict Regex (YYYY-MM-DD).
    - [ ] Implement `extractHospitals()` with normalization map.
- [ ] **Data Structure Definition**
    - [ ] Define `MedicalEvent` schema in `structuredOutput.js`.
    - [ ] Define `AnalysisResult` schema for intermediate storage.
- [ ] **Unit Testing (Fact Extraction)**
    - [ ] Create `test-fact-extraction.js` to verify date/count accuracy on Case 1.
    - [ ] Verify 100% accuracy on "Total Visits" count.

## Phase 2: Intelligence - Judgment & Policy
- [ ] **Policy RAG Setup**
    - [ ] Create `policyDatabase.json` with key insurance clauses (Cancer, Stroke, MI).
    - [ ] Implement `retrievePolicyContext(diagnosisCode)` function.
- [ ] **Violation Logic Implementation**
    - [ ] Implement `checkDisclosureViolation(eventDate, contractDate)` in JS.
    - [ ] Implement `calculateDDay(eventDate, contractDate)` in JS.
- [ ] **Integration Testing**
    - [ ] Verify that "Cancer diagnosis 1 month before contract" is flagged as VIOLATION.

## Phase 3: Narrative - The Writer Agent
- [ ] **Prompt Engineering**
    - [ ] Create `WriterAgentPrompt` in `enhancedPromptBuilder.js`.
    - [ ] Instruction: "Convert this JSON to Report. Do not calculate."
- [ ] **Pipeline Integration**
    - [ ] Connect `HybridNER` -> `PolicyLogic` -> `WriterAgent`.
    - [ ] Update `/api/generate-report` to use this new pipeline.
- [ ] **Final Verification**
    - [ ] Run `verify_all_cases.js` again.
    - [ ] Target Similarity > 0.80.
