export const ERRORS = {
  INVALID_REQUEST_SCHEMA: {
    code: 'INVALID_REQUEST_SCHEMA',
    status: 400,
    message: '요청 스키마가 유효하지 않습니다.',
  },
  INVALID_RESPONSE_SCHEMA: {
    code: 'INVALID_RESPONSE_SCHEMA',
    status: 500,
    message: '응답 스키마가 유효하지 않습니다.',
  },
  REPORT_DOWNLOAD_NOT_FOUND: {
    code: 'NOT_FOUND',
    status: 404,
    message: '요청한 보고서 파일을 찾을 수 없습니다.',
  },
  REPORT_DOWNLOAD_ERROR: {
    code: 'DOWNLOAD_ERROR',
    status: 500,
    message: '파일 다운로드 중 오류가 발생했습니다.',
  },
  INTERNAL_ERROR: {
    code: 'INTERNAL_ERROR',
    status: 500,
    message: '보고서 생성 중 오류가 발생했습니다.',
  },
};

