# CREDITS · 외부 에셋과 라이선스

## 3D 모델 · 그림

- **외부 3D 모델 · 텍스처 파일을 쓰지 않았습니다.** 지형, 건물, 데크로드, 엘리베이터 타워, 나무, 벤치, 정원등, 아바타, 고양이·다람쥐는 모두 이 저장소의 코드로 만든 로우폴리 지오메트리입니다(`src/world/`, `src/scenes/daejeon/`).
- 현판 · 이름표 · 표찰의 글자는 실행 중에 캔버스에 그린 것입니다.
- 확산의 숲 심볼, 버튼 아이콘, 숲 카드 실루엣, 3D 대체 화면의 그림은 직접 그린 SVG입니다(`src/ui/icons.ts`, `src/ui/screens.ts`, `src/ui/fallback.ts`, `public/favicon.svg`).
- 한국산림복지진흥원의 로고 · CI와 공식 안내도 그림은 쓰지 않았습니다. 참고 이미지는 배치를 확인하는 용도로만 보았고 저장소 · 빌드에 포함하지 않습니다.
- 아바타는 원작 캐릭터입니다(둥근 머리 위 새싹 두 장, 털모자와 외투).

## 소리

- **음원 파일을 쓰지 않았습니다.** 숲 앰비언스(바람, 먼 새소리, 풀벌레, 개울 물소리), 바람 한 줄기, 나무 차임, 걷는 소리, 엘리베이터 소리는 모두 Web Audio API로 실행 중에 직접 합성합니다(`src/core/audio.ts`).

## 폰트

| 폰트 | 용도 | 라이선스 | 출처 |
|---|---|---|---|
| Pretendard (가변, 동적 서브셋) 1.3.9 | 본문 · 버튼 | SIL Open Font License 1.1 | https://github.com/orioncactus/pretendard (npm `pretendard`) |
| Noto Serif KR 600 | 제목 · 현판 | SIL Open Font License 1.1 | Google Fonts / npm `@fontsource/noto-serif-kr` 5.3.1 |

폰트 파일은 빌드에 함께 들어가며(자체 호스팅), 외부 CDN을 호출하지 않습니다.

## 라이브러리

| 라이브러리 | 용도 | 라이선스 |
|---|---|---|
| three.js 0.170.0 | 3D 렌더링 (애드온: EffectComposer, UnrealBloomPass, OutputPass, RoundedBoxGeometry, BufferGeometryUtils) | MIT |
| Vite | 개발 서버 · 빌드 도구 | MIT |
| TypeScript | 타입 검사 | Apache-2.0 |

## 참고한 것 (복제하지 않음)

- 퀄리티 기준으로 온라인 절 서비스의 화면 구성을 참고했으나, 디자인 · 캐릭터 · 사찰 소재는 쓰지 않았습니다.
- 국립대전숲체원의 건물 배치와 외관은 팀이 제공한 공식 안내도 · 조감도 이미지를 보고 단순화해 새로 만들었습니다.
