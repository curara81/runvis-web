# 홈페이지 기기 목업 이미지 재생성 절차

홈페이지의 기기 이미지(`assets/framed-*.png`)는 **Apple 공식 제품 베젤**에
앱 화면을 합성한 것. 앱 화면 데이터/디자인이 바뀌면 아래 순서로 재생성.

## ✅ 아이폰 30장 재촬영 완료 (2026-09-06 14:0x 빌드)
라운드 12에서 30장 전부 다시 찍었다. **`sc.build` 사과 문단은 이제 필요 없고 이미
삭제됐다**(index.html + `t-*.js` 6개 모두 `sc.build` 0건). 재촬영이 고친 것:

- **`오늘의 결정` 카드 안의 근거 3행이 사라졌다.** 옛 캡처에는 수면 7.2h·HRV 48ms·
  어제 부하 TRIMP 70 세 행이 있었는데, `iOSApp/Views/Home/HomeDecisionHero.swift`가
  라운드 9에 지웠다(그 근거는 바로 아래 `오늘의 근거` 섹션이 맡는다). 새 캡처엔 없다.
- **준비도 링이 무지개 → 상태색 2색 그라데이션.** 옛 캡처는 94점인데 빨강→주황→초록으로
  돌았다. 지금은 `readinessStatus.color` 하나로 초록 두 단계(HomeDecisionHero `ring`).
- **`Achtung`(de)·`Atención`(es) 줄바꿈이 사라졌다.** 한 줄로 나온다.
- **레이스 예측 VDOT 카드의 하프·풀 범위가 넓어졌다.** 옛 캡처 `1:45:07–1:54:22` /
  `3:38:04–3:56:34` → 지금 `1:40:47–1:58:18` / `3:28:46–4:05:05`, 꼬리말도
  "VDOT ±2 기준 범위 · 추정" → "VDOT ±2 기준 · 5K 기록에서 먼 거리는 외삽 폭 때문에
  최대 ±8% 범위".

다음에 또 찍을 때 함께 처리할 것:
  1. `tools/app-facts.json`의 `screensCapturedAt`을 촬영 날짜로 올린다.
  2. `node tools/prerender.mjs && node tools/check-content.mjs`.
  3. 화면 구성이 바뀌었으면 `t-*.js`의 `alt.phone.*` 6개 언어를 맞춰라(아래 "alt 텍스트" 참고).

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
- **먼저 홈 상단의 `구독으로 열린 것` 카드를 닫아라.** DEBUG 빌드는
  `CoachEngine.canSeeDeepAnalysis`가 열려 있어 `CoachUnlockedCard`
  (`iOSApp/Views/Home/HomeCoachCards.swift`)가 뜨고, 그게 `오늘의 결정` 히어로를
  화면 밖으로 밀어낸다. 컨테이너 prefs 에 `coachUnlockedDismissed=true`(사용자가 ×를
  누른 것과 같은 상태)를 쓰고 **cfprefsd 를 죽인다** — watch-capture.md 2단계와 같은
  이유로, 죽이지 않으면 앱이 캐시된 옛 값을 계속 읽는다:
      D=$(xcrun simctl get_app_container <UDID> com.curara.SportsDashboard data)
      # $D/Library/Preferences/com.curara.SportsDashboard.plist 에 plistlib 로 기록
      xcrun simctl spawn <UDID> launchctl kill 9 system/com.apple.cfprefsd.xpc.daemon
  한 번 쓰면 언어를 바꿔 가며 다시 띄워도 유지된다.
- **화면 이동 경로**(iPhone 17, 402×874pt. 탭바 y=822, 홈 x=73·플랜 158·기록 243·더보기 327):
  dash = 실행 후 15초 대기 · plan = 플랜 탭 · race = 더보기 → 2번째 행(y=229) → 위로 390pt ·
  glance = 홈 탭 → 위로 500pt → "몸·러닝 리포트" 링크(x=341) → **상태바 탭(200,12)으로
  맨 위로** → 아래 "느린 드래그" 640pt 한 번 ·
  detail = glance에서 훈련 부하 타일(x=240, 파란 아이콘 상단 + 42pt).
- **스와이프에 관성이 붙어 스크롤량이 매번 달라진다.** 같은 `swipe`를 두 번 줘도
  60~90pt씩 어긋나서 언어별 프레이밍이 흔들린다. 재현이 필요한 곳(glance)은
  **상태바 탭으로 맨 위로 리셋한 뒤, `touch_path`로 120ms 간격 8~10점을 찍는 느린
  드래그**를 써라. 관성이 거의 안 붙어 드래그 거리 ≈ 스크롤 거리가 된다.
- **링크·타일의 y는 언어마다 다르다. 좌표를 박지 말고 픽셀에서 찾아라.** 눈으로
  세지 말고 색으로 찾으면 된다(1206×2622 픽셀 → 3으로 나누면 pt):
  - **"몸·러닝 리포트" 링크** = 강조 시안 `RGB(76,203,217)`. `x∈[850,1185]`에서
    그 색 픽셀이 25개 이상인 행들을 묶고 **가장 아래 묶음**을 고른다. 위쪽 묶음은
    "날씨를 가져오지 못했어요 — 다시 시도" 링크라 ja·es·de 에서 같이 잡힌다.
    타일 그리드의 시안 아이콘(VO₂max 등)은 x<850 이라 안 걸린다.
    실측 y(pt): ko 241 · en 258 · ja 238 · es 261 · zh-Hant 214 · de 300.
  - **훈련 부하 타일** = 그 타일의 파란 아이콘/꺾은선 `b>200, b−r>120, b−g>60, g>110`.
    `x∈[620,1190]`의 최상단 파란 픽셀이 아이콘 위쪽이고, 그 **+42pt**가 "24 CTL"
    숫자 줄이다(제목 옆 ⓘ 를 누르면 용어 팝오버가 열려 버리니 숫자 줄을 눌러라).
    실측 아이콘 상단 y(pt): ko 344 · en 365 · ja 343 · es 334 · zh-Hant 328 · de 365.
- **합성은 `tools/composite_lang.py`.** Apple 베젤 DMG(각 300MB)를 다시 받지 않고,
  `tools/bezel-donors/` 의 프레임을 도너로 써서 유리 부분만 다시 칠한다(assets/ 에서
  읽으면 안 된다 — 그 파일들은 이 스크립트의 출력이기도 해서 팔레트 오차가 세대마다
  쌓인다). 기하는
  추정이 아니라 정규화 상호상관으로 풀었다(`--fit`): 1206×2622 → 560×1218 @ (40,64),
  상태바 밴드와 탭바 밴드가 같은 답을 낸다(피크 0.9995 / 0.8404). 도너 바깥은
  픽셀을 건드리지 않는다 — 스크린 박스 밖 최대 차이는 PNG8 팔레트가 파일마다
  달라서 생기는 양자화 오차뿐이다(워치 36장 실측 max 54, 평균 0.21; **폰 30장은
  2026-09-06 재촬영분 실측 max 20, 평균 0.023~0.233**; 참고로 **이미 배포 중인**
  한국어 프레임 두 장 사이의 같은 측정값이 85다).
  출력은 원본과 같은 PNG8(팔레트+알파, 37~55KB).
  워치 프레임까지 같이 덮어쓰기 싫으면 `<scratchpad>/shots/`에서 `w-*.png`를 치워라
  (스크립트가 있는 파일만 만든다). 실제로 그렇게 돌려 워치 36장 md5 총합이
  `c48005f7bba99245516f43eda88cff13`으로 그대로인 것을 확인했다.
- **`race.de`만 다른 지점에서 잘랐다 — 앱 버그를 액자에 넣지 않으려고.**
  `WatchApp/Views/RacePredictionView.swift:1043`의 `예측 페이스` 표가 거리 라벨을
  `.frame(width: 30, alignment: .leading)`로 고정한다. `5K`·`10K`·`하프`·`풀`은 들어가지만
  독일어 `Halbmarathon`·`Marathon`은 30pt 를 넘어 **글자 단위로 3줄씩 쪼개진다**
  ("Halb / mar / atho / n"). 앱을 고칠 때까지 독일어 race 캡처는 VDOT 카드에서 끝나도록
  스크롤을 맞췄다(다른 5개 언어는 페이스 표까지 들어간다). 앱에서 고쳐지면 독일어도
  다른 언어와 같은 위치에서 자를 것.
- **워치 6종도 6개 언어 전부 실캡처 완료(2026-09-06).** 파일명 규칙은 폰과 같다
  (`framed-watch-hero.png` = 한국어, `framed-watch-hero.en.png` …). 절차는
  **`tools/watch-capture.md`** 에 있다.
- **alt 텍스트는 캡처가 바뀌면 같이 늙는다.** `t-*.js`의 `alt.phone.*` 6개 언어가
  화면 내용을 문장으로 적어 두기 때문에, 화면이 바뀌면 alt 가 먼저 거짓이 된다.
  2026-09-06 재촬영 시점에 어긋난 것 한 건: `alt.phone.glance`가 첫 타일을
  "training status"라고 부르는데, 앱은 그 타일 이름을 **`훈련 부하 흐름`**
  (en `Training load fl…` / de `Trainingslast-V…` / ja `トレーニング負荷…` /
  es `Evolución de la…` / zh-Hant `訓練負荷走勢`)으로 바꿨다. 나머지 네 장의 alt 는
  재촬영 뒤에도 그대로 맞는다 — hero 는 여전히 휴식 판정이고, detail 은 여전히
  7일 CTL 추세 + 28일 기준 + 지표 설명이다.
- **폐기된 오해:** "watchOS 시뮬레이터가 합성 탭을 무시한다"는 두 라운드짜리 오진이었다.
  탭은 정상 동작한다. 실제 원인은 두 가지였다 — (1) 컨테이너 plist 를 직접 고친 뒤
  **cfprefsd 를 죽이지 않아** 앱이 캐시된 옛 값을 계속 읽었고, (2) 끝나지 않은
  HKWorkoutSession 때문에 앱이 켤 때마다 "중단된 운동 복구" 화면으로 들어갔다.
  둘 다 watch-capture.md 의 2·7단계로 해결된다.
- **주의: 운동을 찍고 나면 반드시 종료 → 폐기까지 하고 10초 뒤에 terminate 할 것.**
  저장하면 HealthKit 주간 거리가 늘어 다음 언어의 플랜·결정이 달라지고, 바로 죽이면
  다음 실행이 복구 화면으로 들어간다(`recoverActiveSession`, WorkoutManager.swift).

## ⚠️ 이전 상태 (2026-07-26)
- **폰 4종(dash·detail·plan·race)은 실기기 스크린샷으로 교체됨.** 아래 "A. 실기기
  경로"를 쓸 것. SVG 목업은 앱과 어긋나기 시작했다(탭 3개 vs 실제 4개).
- **워치 6종(hero=오늘의 결정·evidence=오늘의 근거·start=운동 시작·pace·hr·map)도
  2026-09-05부터 워치 시뮬레이터 실캡처.** (2026-09-06 에 6개 언어로 재촬영했다 —
  위 "현재 상태"와 `tools/watch-capture.md` 참고.) Ultra 3 시뮬 `xcrun simctl io <UDID> screenshot`
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
