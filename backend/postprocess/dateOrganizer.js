/**
 * DateOrganizer Module
 * 
 * 역할:
 * 1. OCR 텍스트가 날짜 역순이든 무관하게 오름차순 정렬
 * 2. 가입일 - 3개월 / 5년 구간에 맞춰 필터
 * 3. 동일 날짜 항목 그룹화(선택적)
 */

class DateOrganizer {
  /**
   * 전처리된 의료 데이터를 날짜별로 정렬 및 필터링
   * @param {Array} preprocessedData Preprocessor에서 반환된 데이터 배열
   * @param {Object} options 정렬 및 필터링 옵션
   * @returns {Array} 정렬 및 필터링된 데이터 배열
   */
  sortAndFilter(preprocessedData, options = {}) {
    try {
      // 기본 옵션 설정
      const opts = {
        enrollmentDate: null,      // 가입일
        periodType: 'all',         // 기간 타입: 'all', '3month', '5year'
        sortDirection: 'asc',      // 정렬 방향: 'asc'(오름차순), 'desc'(내림차순)
        groupByDate: false,        // 날짜별 그룹화 여부
        ...options
      };

      // 날짜가 없는 항목 필터링
      let filteredData = preprocessedData.filter(item => item.date);

      // 날짜 형식이 없거나 유효하지 않은 날짜가 있는 경우
      if (filteredData.length < preprocessedData.length) {
        console.warn(`${preprocessedData.length - filteredData.length}개 항목이 날짜 정보 없음으로 제외됨`);
      }

      // 기간 필터링 (가입일 기준)
      if (opts.enrollmentDate && opts.periodType !== 'all') {
        const enrollmentDate = new Date(opts.enrollmentDate);
        
        // 유효한 가입일 검사
        if (isNaN(enrollmentDate.getTime())) {
          throw new Error(`유효하지 않은 가입일 형식: ${opts.enrollmentDate}`);
        }
        
        // 필터링 기간 계산
        let filterStartDate = null;
        
        if (opts.periodType === '3month') {
          // 3개월 전 계산
          filterStartDate = new Date(enrollmentDate);
          filterStartDate.setMonth(enrollmentDate.getMonth() - 3);
        } else if (opts.periodType === '5year') {
          // 5년 전 계산
          filterStartDate = new Date(enrollmentDate);
          filterStartDate.setFullYear(enrollmentDate.getFullYear() - 5);
        }
        
        // 필터링 적용
        if (filterStartDate) {
          filteredData = filteredData.filter(item => {
            const itemDate = new Date(item.date);
            return itemDate >= filterStartDate && itemDate <= enrollmentDate;
          });
        }
        
        console.log(`기간 필터링 적용: ${opts.periodType}, 가입일 ${opts.enrollmentDate} 기준 ${filteredData.length}개 항목 남음`);
      }

      // 날짜순 정렬
      filteredData.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return opts.sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
      });

      // 날짜별 그룹화
      if (opts.groupByDate) {
        return this._groupByDate(filteredData);
      }

      return filteredData;
    } catch (error) {
      console.error('날짜 정렬 및 필터링 중 오류 발생:', error);
      throw new Error(`날짜 정렬 실패: ${error.message}`);
    }
  }

  /**
   * 특정 날짜 범위 내의 기간을 계산
   * @param {string} startDate 시작 날짜 (YYYY-MM-DD)
   * @param {string} endDate 종료 날짜 (YYYY-MM-DD)
   * @returns {Object} 계산된 기간 정보
   */
  calculatePeriod(startDate, endDate) {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      // 유효한 날짜 검사
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new Error('유효하지 않은 날짜 형식');
      }
      
      // 종료일이 시작일보다 이전인 경우
      if (end < start) {
        throw new Error('종료일이 시작일보다 이전일 수 없습니다');
      }
      
      // 밀리초 단위 차이 계산
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      // 월 차이 계산
      let months = (end.getFullYear() - start.getFullYear()) * 12;
      months += end.getMonth() - start.getMonth();
      
      // 일 조정
      if (end.getDate() < start.getDate()) {
        months--;
      }
      
      // 년 계산
      const years = Math.floor(months / 12);
      const remainingMonths = months % 12;
      
      return {
        days: diffDays,
        months,
        formattedPeriod: years > 0 
          ? `${years}년 ${remainingMonths}개월`
          : `${months}개월`
      };
    } catch (error) {
      console.error('기간 계산 중 오류 발생:', error);
      throw new Error(`기간 계산 실패: ${error.message}`);
    }
  }

  /**
   * 데이터를 날짜별로 그룹화
   * @param {Array} data 그룹화할 데이터 배열
   * @returns {Array} 날짜별로 그룹화된 데이터 배열
   * @private
   */
  _groupByDate(data) {
    const groups = {};
    
    // 날짜별로 그룹화
    data.forEach(item => {
      const date = item.date;
      
      if (!groups[date]) {
        groups[date] = {
          date,
          hospitals: [],
          items: []
        };
      }
      
      // 중복되지 않은 병원만 추가
      if (!groups[date].hospitals.includes(item.hospital)) {
        groups[date].hospitals.push(item.hospital);
      }
      
      groups[date].items.push(item);
    });
    
    // 객체를 배열로 변환
    return Object.values(groups).sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateA - dateB;
    });
  }

  /**
   * 특정 기간 내의 항목 비율 계산
   * @param {Array} data 분석할 데이터 배열
   * @param {string} referenceDate 기준 날짜 (YYYY-MM-DD)
   * @param {Object} options 분석 옵션
   * @returns {Object} 기간별 비율 정보
   */
  analyzePeriodDistribution(data, referenceDate, options = {}) {
    try {
      const refDate = new Date(referenceDate);
      
      // 유효한 날짜 검사
      if (isNaN(refDate.getTime())) {
        throw new Error('유효하지 않은 기준 날짜');
      }
      
      // 3개월 전 날짜 계산
      const threeMonthsAgo = new Date(refDate);
      threeMonthsAgo.setMonth(refDate.getMonth() - 3);
      
      // 5년 전 날짜 계산
      const fiveYearsAgo = new Date(refDate);
      fiveYearsAgo.setFullYear(refDate.getFullYear() - 5);
      
      // 필터링된 데이터 카운트
      const last3MonthsCount = data.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate >= threeMonthsAgo && itemDate <= refDate;
      }).length;
      
      const last5YearsCount = data.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate >= fiveYearsAgo && itemDate <= refDate;
      }).length;
      
      // 전체 항목 수
      const totalCount = data.length;
      
      return {
        total: totalCount,
        last3Months: {
          count: last3MonthsCount,
          percentage: totalCount > 0 ? (last3MonthsCount / totalCount * 100).toFixed(1) : 0
        },
        last5Years: {
          count: last5YearsCount,
          percentage: totalCount > 0 ? (last5YearsCount / totalCount * 100).toFixed(1) : 0
        },
        other: {
          count: totalCount - last5YearsCount,
          percentage: totalCount > 0 ? ((totalCount - last5YearsCount) / totalCount * 100).toFixed(1) : 0
        }
      };
    } catch (error) {
      console.error('기간 분포 분석 중 오류 발생:', error);
      throw new Error(`기간 분포 분석 실패: ${error.message}`);
    }
  }
}

export default DateOrganizer;