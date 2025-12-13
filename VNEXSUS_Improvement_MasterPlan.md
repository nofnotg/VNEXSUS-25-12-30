# VNEXSUS Improvement Master Plan: The Hybrid Architecture Pivot

## 1. Executive Summary
This document outlines the strategic pivot for VNEXSUS v2.0, moving from a "Prompt-Driven" approach to an "Architecture-Driven" Hybrid model. The core objective is to achieve **95% accuracy** in medical report generation by strictly separating "Fact Extraction" (Code/Rule Engine) from "Narrative Generation" (LLM).

## 2. Core Philosophy: "Fact-First, Write-Second"
- **The Problem**: Current low similarity (0.05) is due to LLM hallucinations in date calculations, counting, and entity normalization.
- **The Solution**:
    1.  **Code (Rule Engine)**: Extracts, normalizes, and calculates all quantitative data (Dates, Counts, D-Days).
    2.  **DB (JSON)**: Stores these facts in a rigid, structured format.
    3.  **LLM (Writer)**: Reads the JSON and generates the narrative report based on provided facts and RAG-retrieved policies.

## 3. Architecture Overview

### Layer 1: Fact Extraction (The "HybridNER" Engine)
*   **Input**: Raw OCR Text
*   **Components**:
    *   **Regex Matchers**: For strict patterns (Dates `YYYY-MM-DD`, ICD Codes `[A-Z]\d{2}`, Hospital Names).
    *   **NLP Normalizer**: Standardizes hospital names (e.g., "강남성심" -> "한림대학교 강남성심병원").
    *   **Logic Calculator**: Computes "Total Visits", "Treatment Period", "D-Day from Contract".
*   **Output**: `MedicalEvents.json` (Strictly typed array of events).

### Layer 2: Judgment & Policy (The "Investigator" Brain)
*   **Input**: `MedicalEvents.json` + `Contract Info`
*   **Components**:
    *   **Policy RAG**: Retrieves relevant insurance clauses based on diagnosis codes (e.g., "Cancer diagnosis within 90 days").
    *   **Violation Detector**: Code-based logic to flag potential non-disclosure (e.g., `DiagnosisDate < ContractDate`).
*   **Output**: `AnalysisResult.json` (Includes flags, warnings, and citations).

### Layer 3: Narrative Generation (The "Writer" Agent)
*   **Input**: `AnalysisResult.json` + `Policy Context`
*   **Components**:
    *   **Report Generator**: LLM (GPT-4o) instructed to *only* convert the JSON data into the specific `Report_Sample.txt` format.
    *   **Strict Constraints**: "Do not calculate dates. Do not infer counts. Use provided values only."
*   **Output**: Final HTML/Text Report.

## 4. Implementation Phases

### Phase 1: Resurrection of HybridNER (Days 1-2)
*   **Goal**: Replace the current "One-Shot Prompt" with the `coreEngineService.js` pipeline.
*   **Tasks**:
    *   Refactor `coreEngineService.js` to prioritize Rule-based extraction.
    *   Implement strict Regex for Date/ICD extraction.
    *   Create the `MedicalEvent` JSON schema.

### Phase 2: Policy RAG & Judgment Logic (Days 3-4)
*   **Goal**: Add the "Brain" that knows insurance rules.
*   **Tasks**:
    *   Build a simple Vector Store (or JSON lookup) for key insurance terms.
    *   Implement `analyzeDisclosure` logic in JavaScript (not LLM).
    *   Verify "3-month/1-year/5-year" logic with unit tests.

### Phase 3: The Writer Agent (Days 5-6)
*   **Goal**: Generate the high-quality report.
*   **Tasks**:
    *   Create a new Prompt Template that takes JSON input.
    *   Implement the "Writer" logic in `enhancedPromptBuilder.js`.
    *   Connect the full pipeline: OCR -> HybridNER -> Writer -> Report.

## 5. Success Metrics
*   **Similarity Score**: Target > 0.80 (currently 0.05).
*   **Fact Accuracy**: 100% on Dates and Counts (verified by unit tests).
*   **Processing Time**: < 30 seconds per case.
