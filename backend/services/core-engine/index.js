// core-engine/index.js - 코어엔진 컴포넌트 인덱스
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import TextIngestor from './TextIngestor.js';
import AnchorDetector from './AnchorDetector.js';
import EntityNormalizer from './EntityNormalizer.js';
import TimelineAssembler from './TimelineAssembler.js';
import DiseaseRuleEngine from './DiseaseRuleEngine.js';
import DisclosureAnalyzer from './DisclosureAnalyzer.js';
import ConfidenceScorer from './ConfidenceScorer.js';
import ReportSynthesizer from './ReportSynthesizer.js';
import EvidenceBinder from './EvidenceBinder.js';
import PipelineStateMachine from './PipelineStateMachine.js';
import * as DataContracts from './DataContracts.js';

// Core Components
export { TextIngestor };
export { AnchorDetector };
export { EntityNormalizer };
export { TimelineAssembler };
export { DiseaseRuleEngine };
export { DisclosureAnalyzer };
export { ConfidenceScorer };
export { ReportSynthesizer };
export { EvidenceBinder };
export { PipelineStateMachine };
export { DataContracts };