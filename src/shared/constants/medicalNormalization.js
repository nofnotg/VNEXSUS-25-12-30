// Medical normalization constants (ESM)
// - Hospital stopwords and canonical mapping
// - Diagnosis synonyms mapping
// Externalized dictionaries (JSON) can override defaults at runtime
import { loadMedicalDictionaries } from "./medicalDictionaryLoader.js";

const DEFAULT_HOSPITAL_STOPWORDS = [
  '병·의원',
  '본 자료는 병·의원',
  '순번 진료시작일 병·의원',
  '초진병원',
  '타 병원',
  '타병원',
  '외부병원',
  '전원병원',
  '의뢰병원',
  '응급센터',
  '방문',
  '방문센터',
  '재활병원',
  '요양병원',
  '종합병원',
  '치과',
  '클리닉',
  // generic visit context tokens
  '외래',
  '입원',
  '퇴원',
  '진료',
  '진료일',
  '내원',
  '경과',
  '사고경위 병원',
  '일자 사고경위 병원',
  '일자사고경위병원',
  '치료병원',
  '검사병원',
  '직장 주변 병원',
  '청구병원',
  '기지급 병원',
  '기 고지 병원',
  '진료기록 및 수술병원',
  '탐문병원',
  '탐 의원',
  '탐의원',
  '해당 병원'
];

// Canonical map: observed noisy variants -> canonical hospital name
const DEFAULT_HOSPITAL_CANONICAL_MAP = new Map([
  ['한림강남성심병원', '강남성심병원'],
  ['강북삼성병원', '강북삼성병원'],
  ['SAMSUNG 강북삼성병원', '강북삼성병원'],
  ['SMMSUNG 강북삼성병원', '강북삼성병원'],
  ['AMSUNG 강북삼성병원', '강북삼성병원'],
  ['smMSUNG 강북삼성병원', '강북삼성병원'],
  ['북삼성병원', '강북삼성병원'],
  ['삼성서울병원', '삼성서울병원'],
  ['신촌세브란스병원', '세브란스병원'],
  ['세브란스병원', '세브란스병원'],
  ['강남세브란스병원', '세브란스병원'],
  ['가톨릭서울성모병원', '서울성모병원'],
  ['서울성모병원', '서울성모병원'],
  ['가톨릭은평성모병원', '은평성모병원'],
  ['은평성모병원', '은평성모병원'],
  ['이대목동병원', '이대목동병원'],
  ['EUMC 이대목동병원', '이대목동병원'],
  ['이화여자의과대학부속 목동병원', '이대목동병원'],
  ['이화여대부속목동병원', '이대목동병원'],
  ['대림성모병원', '대림성모병원'],
  ['명지병원', '명지병원'],
  // SNUH family
  ['서울대학교병원', '서울대병원'],
  ['서울대학병원', '서울대병원'],
  ['서울대병원', '서울대병원'],
  ['분당서울대학교병원', '분당서울대병원'],
  ['분당서울대병원', '분당서울대병원'],
  // ASAN
  ['아산병원', '서울아산병원'],
  ['서울아산병원', '서울아산병원'],
  // Korea Univ.
  ['고려대학교안암병원', '고려대안암병원'],
  ['고려대안암병원', '고려대안암병원'],
  // Chung-Ang Univ.
  ['중앙대학교병원', '중앙대병원'],
  ['중앙대병원', '중앙대병원'],
  // Konkuk Univ.
  ['건국대학교병원', '건국대병원'],
  ['건국대병원', '건국대병원'],
  // Kyung Hee Univ. Medical Center
  ['경희의료원', '경희의료원'],
  // Catholic Univ. St. Vincent
  ['성빈센트병원', '성빈센트병원'],
  // Boramae
  ['서울특별시 보라매병원', '보라매병원'],
  ['서울특별시보라매병원', '보라매병원'],
  ['서울대학교병원운영 서울특별시보라매병원', '보라매병원'],
  ['보라매병원', '보라매병원'],
  // Ilsan Paik
  ['인제대학교 일산백병원', '일산백병원'],
  ['인제대학교일산백병원', '일산백병원'],
  ['일산백병원', '일산백병원'],
  // Ilsan CHA
  ['차의과학대학교 일산차병원', '일산차병원'],
  ['일산차병원', '일산차병원'],
  // Gachon Gil
  ['가천의대 길병원', '가천대길병원'],
  ['가천의과대학교 길병원', '가천대길병원'],
  ['가천대 길병원', '가천대길병원'],
  ['가천대길병원', '가천대길병원'],
  // National Cancer Center
  ['국립암센터', '국립암센터'],
  ['National Cancer Center Korea', '국립암센터'],
  ['National Cancer Center', '국립암센터']
]);

// Diagnosis synonyms: raw text tokens -> normalized keywords
const DEFAULT_DIAGNOSIS_SYNONYMS = new Map([
  ['위염', 'gastritis'],
  ['역류성 식도염', 'gerd'],
  ['위식도역류질환', 'gerd'],
  ['장염', 'enteritis'],
  ['고혈압', 'hypertension'],
  ['HTN', 'hypertension'],
  ['당뇨', 'diabetes'],
  ['당뇨병', 'diabetes'],
  ['DM', 'diabetes'],
  ['고지혈증', 'dyslipidemia'],
  ['이상지질혈증', 'dyslipidemia'],
  ['천식', 'asthma'],
  ['우울증', 'depression'],
  ['불안장애', 'anxiety'],
  ['요추염좌', 'lumbar sprain'],
  ['요추통', 'low back pain'],
  ['디스크', 'ldh'],
  ['요추추간판탈출증', 'ldh'],
  ['척추관협착증', 'spinal stenosis'],
  ['만성폐쇄성폐질환', 'copd'],
  ['만성기관지염', 'copd'],
  ['알레르기비염', 'allergic rhinitis'],
  ['갑상선기능저하증', 'hypothyroidism'],
  ['갑상선결절', 'thyroid nodule'],
  ['빈혈', 'anemia'],
  ['편두통', 'migraine'],
  ['만성콩팥병', 'ckd'],
  ['만성신부전', 'ckd'],
  ['간염', 'hepatitis'],
  ['만성간염', 'hepatitis'],
  ['폐렴', 'pneumonia'],
  ['요로감염', 'uti'],
  ['방광염', 'cystitis'],
  ['신우신염', 'pyelonephritis'],
  ['담석증', 'cholelithiasis'],
  ['담낭염', 'cholecystitis'],
  ['협심증', 'angina'],
  ['관상동맥질환', 'cad'],
  ['심근경색', 'mi'],
  // English forms normalization
  ['GERD', 'gerd']
]);

const external = loadMedicalDictionaries();
export const HOSPITAL_STOPWORDS = Array.isArray(external.hospitalStopwords)
  ? external.hospitalStopwords
  : DEFAULT_HOSPITAL_STOPWORDS;

export const HOSPITAL_CANONICAL_MAP = external.hospitalCanonicalMap && typeof external.hospitalCanonicalMap === 'object'
  ? new Map(Object.entries(external.hospitalCanonicalMap))
  : DEFAULT_HOSPITAL_CANONICAL_MAP;

export const DIAGNOSIS_SYNONYMS = external.diagnosisSynonyms && typeof external.diagnosisSynonyms === 'object'
  ? new Map(Object.entries(external.diagnosisSynonyms))
  : DEFAULT_DIAGNOSIS_SYNONYMS;
