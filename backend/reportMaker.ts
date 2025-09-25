export function buildReport(timeline: any, opt: any): { downloadUrl: string; preview: any } {
  const filtered = filterTimeline(timeline, opt);
  const excelPath = saveXlsx(filtered, 'FILTER');
  return { downloadUrl: `/reports/${excelPath}`, preview: filtered };
}

// 필요한 함수들을 import하거나 구현해야 합니다
declare function filterTimeline(timeline: any, opt: any): any;
declare function saveXlsx(data: any, prefix: string): string;