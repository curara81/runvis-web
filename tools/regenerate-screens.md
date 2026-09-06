# 홈페이지 기기 목업 이미지 재생성 절차

홈페이지의 기기 이미지(`assets/framed-*.png`)는 **Apple 공식 제품 베젤**에
앱 화면을 합성한 것. 앱 화면 데이터/디자인이 바뀌면 아래 순서로 재생성.

## ⚠️ 지금 있는 30장은 구버전이다 — 재촬영이 밀려 있다
`assets/framed-phone-*.png` 30장은 전부 **2026-09-06 07:30 빌드**다. 그 뒤
`Shared/Views/RunvisDesignSystem.swift`의 FactorRow 상태 라벨에
`.lineLimit(1).minimumScaleFactor(0.8)`이 들어가 줄바꿈이 고쳐졌는데,
캡처에는 안 반영돼 **독일어 `Achtung`과 스페인어 `Atención`이 두 줄로 접힌 채** 박혀 있다.

- 재촬영 전까지는 그 사실을 화면에서 고지한다 — `index.html`의 `sc.build`
  (#today 섹션, `sc.note` 바로 아래, 6개 언어).
- **재촬영을 마치면 세 가지를 함께 처리할 것**:
  1. `sc.build` 문단과 그 키 6개를 지운다(마크업 한 줄 + `t-*.js` 6개).
  2. `tools/app-facts.json`의 `screensCapturedAt`을 촬영 날짜로 올린다.
  3. `node tools/prerender.mjs && node tools/check-content.mjs`.

## ⚠️ 현재 상태 (2026-09-06) — 언어별 캡처
- **아이폰 5종(dash·detail·glance·plan·race)은 6개 언어 전부 실캡처 완료.**
  파일명 규칙: 한국어는 접미사 없음(`framed-phone-dash.png`), 나머지는
  `framed-phone-dash.<code>.png` (`en`·`ja`·`es`·`zh`·`de` — **사이트 코드**라
  번체는 `zh`, 앱 번들의 `zh-Hant`가 아니다). `i18n.js`의 `applyShots()`가
  `img[data-shot]`의 src를 언어에 맞춰 바꾼다. 표(`SHOTS`/`SHOT_LANGS`)에 없는
  이미지는 손대지 않으므로 404가 날 수 없다.
- **언어 전환은 앱 실행 인자로.** 시뮬은 지우지 말 것(erase 금지):
  `xcrun simctl terminate <UDID> com.curara.SportsDashboard`
  `xcrun simctl launch <UDID> com.curara.SportsDashboard -AppleLanguages "(de)" -AppleLocale de_DE`
  (`en_US`는 마일, 나머지는 km로 나온다 — 앱이 로케일 단위를 따르는 것이라 정상.)
- **화면 이동 경로**(iPhone 17, 402×874pt. 탭바 y=822, 홈 x=73·플랜 158·기록 243·더보기 327):
  dash = 실행 직후 · plan = 플랜 탭 · race = 더보기 → 2번째 행(y=229) → 위로 390pt 스와이프 ·
  glance = 홈 탭 → 위로 500pt → "몸·러닝 리포트" 링크(우측 x=350) → 위로 550pt → 위로 180pt ·
  detail = glance에서 훈련 부하 타일(x=296, 파란 꺾은선 위 40pt).
  링크·타일의 y는 언어마다 다르므로 좌표를 박아 두지 말고 스크린샷에서 찾아라
  (2열 카드 그리드의 첫 행 y − 21 = 리포트 링크, 파란 차트 상단 − 40 = 훈련 부하 타일).
- **합성은 `tools/composite_lang.py`.** Apple 베젤 DMG(각 300MB)를 다시 받지 않고,
  이미 저장소에 있는 한국어 프레임을 도너로 써서 유리 부분만 다시 칠한다. 기하는
  추정이 아니라 정규화 상호상관으로 풀었다(`--fit`): 1206×2622 → 560×1218 @ (40,64),
  상태바 밴드와 탭바 밴드가 같은 답을 낸다(피크 0.9995 / 0.8404). 도너 바깥은
  **바이트 단위로 무변경**(검증: 스크린 박스 밖 max diff = 0).
  출력은 원본과 같은 PNG8(팔레트+알파, 38~60KB).
- **워치 6종은 아직 한국어 한 벌뿐.** 이유는 도구 한계다 —
  **watchOS 시뮬레이터가 합성 탭을 무시한다**(스와이프와 하드웨어 버튼은 먹지만
  탭/짧은 터치는 앱·시스템 UI 어디에서도 반응 없음). hero 말고는 전부 탭이 필요한
  화면이고, pace·hr·map은 러닝 세션까지 필요하다. 사람이 시뮬레이터 창에서 직접
  누르거나(마우스), 탭을 넣을 수 있는 도구가 생기면 위 A 경로 그대로 진행하면 된다.
- **주의: 워치 시뮬에 끝나지 않은 HKWorkoutSession이 남아 있다.** 앱을 켤 때마다
  "중단된 운동을 복구했습니다" 화면으로 들어간다. 빨간 정지 버튼을 사람이 한 번
  눌러야 풀린다(`recoverActiveWorkoutSession`, WorkoutManager.swift:1617).

## ⚠️ 이전 상태 (2026-07-26)
- **폰 4종(dash·detail·plan·race)은 실기기 스크린샷으로 교체됨.** 아래 "A. 실기기
  경로"를 쓸 것. SVG 목업은 앱과 어긋나기 시작했다(탭 3개 vs 실제 4개).
- **워치 6종(hero=오늘의 결정·evidence=오늘의 근거·start=운동 시작·pace·hr·map)도
  2026-09-05부터 워치 시뮬레이터 실캡처.** Ultra 3 시뮬 `xcrun simctl io <UDID> screenshot`
  (422×514) → 기존 framed-watch-*.png를 도너로 스크린 구멍(79,178)-(403,590)에 cover-fit 합성
  (PIL, 마스크는 도너 4장의 픽셀 차이로 추출). 러닝 중 화면은
  `xcrun simctl location <UDID> start --speed=3.2 37.52,126.93 37.523,126.932 …`로 이동 시뮬 후
  러닝 시작(위치 권한 → 브리핑 "건너뛰고 바로 달리기") 1~2분 뒤 캡처. 워치 UserDefaults
  `planDaysPerWeek=3`, `c25kStartDate`(이번 주), `isDeveloperGodMode=1`로 오늘의 훈련 카드가
  아이폰과 같은 세션(달리기·걷기 반복)·잠금 해제 상태로 나오게 맞출 것.

---

## A. 실기기 스크린샷 경로 (권장)

앱 리포(`~/Developer/SportsDashboard`)에 `SampleDataSeeder`(DEBUG 전용)가 있다.

1. Debug 빌드 → 시뮬레이터 설치 (iPhone 17 / Runvis Watch Ultra 3)
2. 앱 → 설정 맨 아래 **개발자 — 샘플 데이터** → `샘플 러닝 기록 생성 (10주)`
   → HealthKit 권한 시트에서 **모두 켜기 → 허용** (쓰기·읽기 두 번 뜬다)
   → 러닝 39회 + 일일 지표 70일이 들어간다. 시더는 고정 시드라 **매번 같은 숫자**가
   나오므로 스크린샷이 재현된다.
3. 화면 이동 후 `xcrun simctl io <UDID> screenshot ~/Downloads/Runvis_스크린_실기기/shotDash.png`
   — 파일명은 아래 4단계 스크립트의 키와 맞출 것(`shotDash`·`shotDetail`·`shotPlan`·`shotRace`).
4. `composite_bezels.py`의 `SRC`를 `Runvis_스크린_실기기`로 두고 3~4단계 진행.
5. 다시 찍을 때는 `샘플 데이터 삭제` 먼저 — 지우지 않고 재생성하면 훈련 부하가 두 배가 된다.

주의: 시더는 **앱이 저장한 샘플만** 지운다(HealthKit 제약). 실기기에서 돌려도 실제
건강 데이터는 안전하지만, 굳이 실기기에서 돌릴 이유는 없다.

---

## B. SVG 목업 경로 (워치 4종 — 당분간 유지)

1. **화면 수정**: `tools/screens-source.html`의 SVG 문자열 수정 (브라우저로 열면 미리보기 가능)
2. **화면 PNG 추출**: `python3 tools/extract_screens.py` → `~/Downloads/Runvis_스크린_PNG/*.html` 생성
   → headless Chrome으로 PNG 렌더:
   - 워치 4종: `--window-size=820,1015` (shotHR·shotPace·shotMap·heroPace)
   - 폰 4종: `--window-size=828,1788` (shotDash·shotDetail·shotPlan·shotRace)
   - `--default-background-color=00000000` 필수
3. **베젤 다운로드** (로그인 불필요, 각 300MB 내외 — repo에 커밋 금지, Apple 라이선스상 원본 재배포 불가):
   - https://devimages-cdn.apple.com/design/resources/download/Bezel-Apple-Watch-Ultra-3-2025.dmg
   - https://devimages-cdn.apple.com/design/resources/download/Bezel-iPhone-17.dmg
   - 마운트: `yes Y | hdiutil attach -nobrowse <dmg>` (EULA 자동 동의)
   - 사용 파일: `PNG/Ocean Band/AW Ultra 3 - Natural + Ocean Band Neon Green.png` → `bezel-ultra.png`
     `PNG/iPhone 17/iPhone 17 - Black - Portrait.png` → `bezel-iphone.png`
4. **합성**: `python3 tools/composite_bezels.py` (베젤 경로는 스크립트 상단 SP 변수 참조)
   — 알파 채널에서 스크린 구멍을 자동 검출(라운드 코너·다이내믹 아일랜드 보정 포함)해
   화면을 베젤 아래 레이어로 합성 → `assets/framed-*.png`

주의: Apple 베젤은 "무수정 사용" 조건 — 앱 화면을 스크린 영역에 넣는 것은 허용된 용도,
회전·기울임·색변경 금지. https://developer.apple.com/app-store/marketing/guidelines/

## 지도 화면 (shotMap) 별도 파이프라인
GPS 지도 화면은 SVG가 아니라 실지도 합성: `tools/fetch_map.py`(OSM 타일 25장
스티치+다크 처리, 여의도 한강공원 — 개인 위치 아님) → `tools/draw_route.py`
(강변 경로+시작핀+현위치+메트릭바+© OpenStreetMap 표기) → composite_bezels.py.
OSM 타일은 ODbL — 저작자 표기 필수(이미지에 포함됨), 대량 다운로드 금지(1회 25장 OK).
