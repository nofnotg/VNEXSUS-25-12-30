#!/usr/bin/env python3
"""
Disease Code Index Builder

이 스크립트는 다양한 형식의 질병 코드북 파일을 읽어 통합 인덱스를 생성합니다.
지원 형식: CSV, Excel, PDF (표 형식)

출력:
- /data/disease_codes.json: 전체 정보 포함
- /data/disease_codes_brief.json: 코드와 한글 이름만 포함
"""

import os
import sys
import json
import glob
import logging
from pathlib import Path
from typing import Dict, List, Any, Optional, Union

import pandas as pd
import tabula
from tqdm import tqdm

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('DiseaseIndexBuilder')

# 입력 및 출력 경로 설정
INPUT_DIR = Path("uploads/codebooks")
OUTPUT_DIR = Path("data")
OUTPUT_FULL = OUTPUT_DIR / "disease_codes.json"
OUTPUT_BRIEF = OUTPUT_DIR / "disease_codes_brief.json"
DEPRECATED_CODES_FILE = INPUT_DIR / "신구대조표(20220720).xlsx"

# 데이터 필드 정의
REQUIRED_FIELDS = ["code", "korName"]
OPTIONAL_FIELDS = ["engName", "category", "subcategory", "description", "deprecated", "replacedBy"]

class DiseaseIndexBuilder:
    def __init__(self):
        self.disease_data = {}  # 코드를 키로 하는 딕셔너리
        self.deprecated_codes = {}  # 폐기된 코드 매핑
        
        # 디렉토리 확인 및 생성
        if not INPUT_DIR.exists():
            logger.error(f"입력 디렉토리가 존재하지 않습니다: {INPUT_DIR}")
            sys.exit(1)
            
        if not OUTPUT_DIR.exists():
            OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
            logger.info(f"출력 디렉토리 생성: {OUTPUT_DIR}")
    
    def load_deprecated_codes(self) -> None:
        """신구대조표에서 폐기된 코드 정보를 로드합니다."""
        if not DEPRECATED_CODES_FILE.exists():
            logger.warning(f"신구대조표 파일을 찾을 수 없습니다: {DEPRECATED_CODES_FILE}")
            return
            
        try:
            logger.info(f"신구대조표 로딩 중: {DEPRECATED_CODES_FILE}")
            df = pd.read_excel(DEPRECATED_CODES_FILE)
            
            # 열 이름 표준화 예시 (실제 파일 구조에 맞게 조정 필요)
            if '구코드' in df.columns and '신코드' in df.columns:
                for _, row in df.iterrows():
                    old_code = str(row['구코드']).strip()
                    new_code = str(row['신코드']).strip()
                    if old_code and new_code and old_code != 'nan' and new_code != 'nan':
                        self.deprecated_codes[old_code] = new_code
                
                logger.info(f"폐기 코드 {len(self.deprecated_codes)}개 로드 완료")
            else:
                logger.warning("신구대조표 형식이 예상과 다릅니다. 열 이름을 확인하세요.")
        except Exception as e:
            logger.error(f"신구대조표 로딩 중 오류 발생: {str(e)}")
    
    def process_files(self) -> None:
        """모든 코드북 파일을 찾아 처리합니다."""
        # 모든 파일 형식 처리
        for ext in ['*.csv', '*.xlsx', '*.xls', '*.pdf']:
            files = list(INPUT_DIR.glob(ext))
            if files:
                logger.info(f"{ext} 파일 {len(files)}개 발견")
                
            for file_path in files:
                # 신구대조표는 별도 처리하므로 건너뜀
                if "신구대조표" in file_path.name:
                    continue
                    
                try:
                    logger.info(f"처리 중: {file_path}")
                    if file_path.suffix.lower() == '.csv':
                        self.process_csv(file_path)
                    elif file_path.suffix.lower() in ['.xlsx', '.xls']:
                        self.process_excel(file_path)
                    elif file_path.suffix.lower() == '.pdf':
                        self.process_pdf(file_path)
                except Exception as e:
                    logger.error(f"{file_path} 처리 중 오류 발생: {str(e)}")
    
    def process_csv(self, file_path: Path) -> None:
        """CSV 파일에서 질병 코드 데이터를 추출합니다."""
        df = pd.read_csv(file_path, encoding='utf-8-sig')
        self._process_dataframe(df, file_path.name)
    
    def process_excel(self, file_path: Path) -> None:
        """Excel 파일에서 질병 코드 데이터를 추출합니다."""
        df = pd.read_excel(file_path)
        self._process_dataframe(df, file_path.name)
    
    def process_pdf(self, file_path: Path) -> None:
        """PDF 파일에서 표 형식의 질병 코드 데이터를 추출합니다."""
        # PDF에서 모든 테이블 추출
        tables = tabula.read_pdf(file_path, pages='all', multiple_tables=True)
        
        for i, df in enumerate(tables):
            if not df.empty:
                logger.info(f"{file_path.name}에서 표 {i+1} 처리 중 (행 {len(df)}개)")
                self._process_dataframe(df, f"{file_path.name} (Table {i+1})")
    
    def _process_dataframe(self, df: pd.DataFrame, source_name: str) -> None:
        """데이터프레임에서 질병 코드 정보를 추출하여 통합합니다."""
        # 열 이름 표준화 (실제 데이터에 맞게 조정 필요)
        column_mapping = self._guess_column_mapping(df.columns)
        
        if not column_mapping or 'code' not in column_mapping:
            logger.warning(f"{source_name}: 필수 열(code)을 찾을 수 없습니다. 열: {', '.join(df.columns)}")
            return
            
        # 데이터 추출 및 병합
        for _, row in df.iterrows():
            try:
                code = str(row[column_mapping['code']]).strip()
                
                # 코드가 비어있거나 유효하지 않은 경우 건너뜀
                if not code or code == 'nan' or len(code) < 2:
                    continue
                
                # 기존 데이터가 있으면 업데이트, 없으면 새로 생성
                if code not in self.disease_data:
                    self.disease_data[code] = {
                        'code': code,
                        'source': source_name
                    }
                
                # 각 필드 추출 및 병합
                for field, col in column_mapping.items():
                    if field != 'code':  # 코드는 이미 처리됨
                        value = row[col]
                        # NaN이나 None이 아닌 경우에만 값 설정
                        if pd.notna(value):
                            self.disease_data[code][field] = str(value).strip()
            except Exception as e:
                logger.warning(f"{source_name} 행 처리 중 오류: {str(e)}")
    
    def _guess_column_mapping(self, columns: List[str]) -> Dict[str, str]:
        """열 이름을 추측하여 표준 필드에 매핑합니다."""
        mapping = {}
        
        # 열 이름 소문자로 변환하여 비교
        col_lower = [c.lower() for c in columns]
        
        # 코드 열 찾기
        code_candidates = ['code', 'kcd', 'icd', '코드', '질병코드', 'disease_code', 'kcd_code', 'icd_code']
        for candidate in code_candidates:
            for i, col in enumerate(col_lower):
                if candidate in col:
                    mapping['code'] = columns[i]
                    break
            if 'code' in mapping:
                break
                
        # 한글 이름 열 찾기
        kor_candidates = ['korname', 'kor_name', 'korean', '한글명', '한글이름', '질병명', '병명', 'name', '이름']
        for candidate in kor_candidates:
            for i, col in enumerate(col_lower):
                if candidate in col:
                    mapping['korName'] = columns[i]
                    break
            if 'korName' in mapping:
                break
                
        # 영문 이름 열 찾기
        eng_candidates = ['engname', 'eng_name', 'english', '영문명', '영문이름', 'english_name']
        for candidate in eng_candidates:
            for i, col in enumerate(col_lower):
                if candidate in col:
                    mapping['engName'] = columns[i]
                    break
                    
        # 카테고리 열 찾기
        cat_candidates = ['category', 'cat', '분류', '대분류', '카테고리']
        for candidate in cat_candidates:
            for i, col in enumerate(col_lower):
                if candidate in col:
                    mapping['category'] = columns[i]
                    break
                    
        # 하위 카테고리 열 찾기
        subcat_candidates = ['subcategory', 'sub_category', 'subcat', '소분류', '하위분류']
        for candidate in subcat_candidates:
            for i, col in enumerate(col_lower):
                if candidate in col:
                    mapping['subcategory'] = columns[i]
                    break
                    
        # 설명 열 찾기
        desc_candidates = ['description', 'desc', '설명', '비고', 'note', '참고']
        for candidate in desc_candidates:
            for i, col in enumerate(col_lower):
                if candidate in col:
                    mapping['description'] = columns[i]
                    break
                    
        return mapping
    
    def apply_deprecated_codes(self) -> None:
        """폐기된 코드 정보를 데이터에 적용합니다."""
        if not self.deprecated_codes:
            return
            
        for old_code, new_code in self.deprecated_codes.items():
            if old_code in self.disease_data:
                self.disease_data[old_code]['deprecated'] = True
                self.disease_data[old_code]['replacedBy'] = new_code
                logger.debug(f"폐기 코드 처리: {old_code} -> {new_code}")
    
    def generate_output(self) -> None:
        """최종 데이터를 JSON 파일로 출력합니다."""
        # 전체 정보 포함 파일
        with open(OUTPUT_FULL, 'w', encoding='utf-8') as f:
            json.dump(list(self.disease_data.values()), f, ensure_ascii=False, indent=2)
            
        logger.info(f"전체 데이터 저장 완료: {OUTPUT_FULL} (항목 {len(self.disease_data)}개)")
        
        # 간략 정보만 포함 파일
        brief_data = []
        for code, data in self.disease_data.items():
            brief = {'code': code}
            if 'korName' in data:
                brief['korName'] = data['korName']
            brief_data.append(brief)
            
        with open(OUTPUT_BRIEF, 'w', encoding='utf-8') as f:
            json.dump(brief_data, f, ensure_ascii=False, indent=2)
            
        logger.info(f"간략 데이터 저장 완료: {OUTPUT_BRIEF} (항목 {len(brief_data)}개)")
    
    def run(self) -> None:
        """전체 프로세스를 실행합니다."""
        logger.info("=== 질병 코드 인덱스 빌더 시작 ===")
        
        self.load_deprecated_codes()
        self.process_files()
        self.apply_deprecated_codes()
        
        if not self.disease_data:
            logger.error("처리된 질병 코드 데이터가 없습니다!")
            return
            
        self.generate_output()
        logger.info("=== 질병 코드 인덱스 빌더 완료 ===")


if __name__ == "__main__":
    builder = DiseaseIndexBuilder()
    builder.run() 