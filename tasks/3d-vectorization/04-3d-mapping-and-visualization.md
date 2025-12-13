# Task 04: 3D Mapping & Visualization

## Objective
- 고차원 벡터를 3D로 투영(UMAP/PCA)하고 케이스/에피소드 뷰를 제공하는 시각화 모듈을 설계합니다.

## Deliverables
- 3D 투영 유틸(오프라인/온디맨드)
- 시각화 스펙(좌표, 컬러링, 태그, 상호작용)

## Design
- Projection: 서버측 오프라인 배치 + 요청시 캐시 조회.
- Visualization: 프론트엔드(React/Three.js 또는 Plotly) 사양 정의.

## Acceptance Criteria
- 샘플 200건 케이스의 군집이 의미/시간/신뢰도 축에서 해석 가능.
- 마우스오버/클릭으로 에피소드 정보·태그 표시.

## Tests
- 좌표 안정성/분포 테스트.
- 성능: 투영 p95 ≤ 300ms, 렌더 p95 ≤ 200ms.

## Risks
- 3D 과밀/오버플롯 → LOD/클러스터링/필터 UI 필요.

