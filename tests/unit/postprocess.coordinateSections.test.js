import postprocess from '../../backend/postprocess/index.js';

describe('PostProcessing coordinateSections 생성', () => {
  test('coordinateBlocks 제공 시 header/footer 비율 계산', async () => {
    const text = [
      '2025-01-10 서울병원 입원',
      '퇴원요약: 안정적 경과',
    ].join('\n');

    const coordinateBlocks = [
      // 상단 영역(헤더) 근처 블록
      {
        text: '2025-01-10 서울병원 입원',
        page: 1,
        blockIndex: 0,
        bbox: { xMin: 10, yMin: 10, xMax: 210, yMax: 30, width: 200, height: 20 }
      },
      // 하단 영역(푸터) 근처 블록: 페이지 높이를 정의하는 최대 yMax 포함
      {
        text: '퇴원요약: 안정적 경과',
        page: 1,
        blockIndex: 1,
        bbox: { xMin: 10, yMin: 980, xMax: 210, yMax: 1000, width: 200, height: 20 }
      }
    ];

    const res = await postprocess.processOCRResult(text, {
      minConfidence: 0.1,
      includeAll: true,
      useHybridApproach: true,
      coordinateBlocks
    });

    expect(res.success).toBe(true);
    const cs = res.pipeline.coordinateSections;
    expect(cs).toBeTruthy();
    expect(typeof cs.headerRatio).toBe('number');
    expect(typeof cs.footerRatio).toBe('number');
    // 헤더/푸터에 각각 1개씩 포함되도록 구성했으므로 두 비율 모두 양수
    expect(cs.headerRatio).toBeGreaterThan(0);
    expect(cs.footerRatio).toBeGreaterThan(0);
  });
});
