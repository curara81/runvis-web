# 워치 스크린샷 캡처 절차 (2026-10-19 개정 — 46mm 시뮬레이터 · 앱 v3.1 · 4종 × 6개 언어)

홈페이지가 쓰는 워치 화면은 **4종**이다: `hero`(오늘의 결정) · `pace` · `hr` · `map`
(`tools/i18n-lib.mjs`·`i18n.js`의 `SHOTS`). `evidence`(오늘의 근거)·`start`(운동 시작)는
2026-10-03에 랜딩에서 빠졌고 파일만 assets/ 에 남아 있다(2026-10-19에 evidence 만 같이 갱신).

워치 UDID: `3B58291D-E3A5-4B78-96C1-0B07BE09FAFF` (**Runvis Watch 46** — 이 맥의 유일한
watchOS 시뮬레이터. Ultra 시뮬레이터는 없다). 화면 **208×248pt**, 스크린샷 **416×496px**.
좌표는 전부 포인트다. 옛 Ultra 3(211×257pt, 422×514px)·옛 UDID `66D2DA4E-…` 메모는 폐기.

## 0. 빌드·설치
    xcodebuild -scheme 'SportsDashboard Watch App' -destination 'id=<UDID>' -derivedDataPath /tmp/rv-dd build
    xcrun simctl install <UDID> /tmp/rv-dd/Build/Products/Debug-watchsimulator/SportsDashboard.app

## 1. erase 는 쓰지 말 것
이 시뮬레이터에는 HealthKit 데이터(준비도 93)와 건강·위치 권한이 이미 들어 있다. 상태바의
빨간 '아이폰 연결 끊김' 아이콘은 운동을 한 번 시작하면 박히는데, `shutdown` → `boot` 로 지워진다
(데이터·권한 유지). 그래서 **정지 화면(hero·evidence)은 6개 언어 모두 재부팅 직후, 운동 전에 먼저**
찍고, 러닝 화면은 그 뒤에 언어별로 찍는다. 러닝 화면의 아이콘은 피할 수 없다.

## 2. 컨테이너 prefs — 쓰고 나면 cfprefsd 를 죽인다
`<container>/Library/Preferences/com.curara.SportsDashboard.watchkitapp.plist` 에
`didOnboardWatch=true`, `isDeveloperGodMode=true`, `planDaysPerWeek=3`(월요일이면 결정이 '휴식').
대회 카드가 필요할 때만 `goalRaceKm`·`goalRaceDateTS`. 쓰고 나서
`xcrun simctl spawn <UDID> launchctl kill 9 system/com.apple.cfprefsd.xpc.daemon` —
안 죽이면 앱이 캐시된 옛 값을 읽는다.

## 3. 실행
    xcrun simctl terminate <UDID> com.curara.SportsDashboard.watchkitapp
    SIMCTL_CHILD_RUNVIS_SCREENSHOT=1 SIMCTL_CHILD_RUNVIS_DASH_PAGE=0 \
      xcrun simctl launch <UDID> com.curara.SportsDashboard.watchkitapp \
      -AppleLanguages "(ko)" -AppleLocale ko_KR
12~14초 기다린 뒤 `xcrun simctl io <UDID> screenshot w-hero.ko.png`.
`DASH_PAGE=1` 이면 오늘의 근거(evidence). 둘 다 스와이프 없이 그대로 찍는다.
로케일: `(ko) ko_KR` · `(en) en_US`(마일) · `(ja) ja_JP` · `(es) es_ES` · `(zh-Hant) zh_TW` · `(de) de_DE`.
캡처 파일명은 앱 언어 코드(`w-hero.zh-Hant.png`), 합성 스크립트가 사이트 코드(`.zh`)로 바꾼다.
상태바 시각 고정(`simctl status_bar`)은 watchOS 에서 지원되지 않는다 — 실제 시각이 찍힌다.

## 4. 러닝 화면(pace·hr·map)
탭·스와이프는 Claude Code 의 iOS Simulator control 툴(포인트 좌표).
1. 위치: `xcrun simctl location <UDID> start --speed=3.2 --distance=10 <lat,lon> …`(5점 이상).
   3.2 m/s = 5:13/km(en_US 8:23/mi). **지도는 그 언어의 나라에서 달린다** — Apple 지도 라벨은
   앱 언어가 아니라 지역 표기를 따른다. 강·해자 위를 지나면 점이 물 위에 찍히니 땅 위 경로로.
   2026-10-19에 쓴 경로:
   - ko 여의도공원 `37.5295,126.9234 → 37.5225,126.9207`(남북 8점)
   - en 하이드파크 Rotten Row `51.5028,-0.1560 → 51.5022,-0.1735`
   - ja 황거외원 `35.6840,139.7610 → 35.6768,139.7536`(와다쿠라→사쿠라다몬)
   - es 레티로 `40.4095,-3.6845 → 40.4165,-3.6815`
   - zh 다안삼림공원 `25.0330,121.5330 → 25.0312,121.5372`
   - de 티어가르텐 Straße des 17. Juni `52.5160,13.3730 → 52.5147,13.3550`
2. `DASH_PAGE=0` 으로 실행 → `swipe (104,220)→(104,20)` **한 번**(결정 페이지 바닥까지. 두 번이면
   다음 페이지로 넘어간다) → 바닥 칩 '러닝' `tap (38,162)` → 브리핑 없이 바로 시작.
3. 크라운 페이지: **0 기본 · 1 페이스 · 2 심박(세로 존 기둥) · 3 존 · 4 지도 · 5 제어**.
   `swipe (104,200)→(104,60)` 한 번이 한 페이지, 스와이프 사이 1초. 넘긴 직후 2~3초는 전환 블러가
   남으니 **4초 뒤** 찍는다.
4. 시작 후 **약 4분**(≈0.75km) 뒤에 찍는다. 그 사이 **60초마다 위아래로 한 번씩** 스와이프해
   화면을 깨워 둔다(손을 안 대면 시계 화면으로 돌아간다).

## 5. 운동 정리 — 저장하지 말고, 빠져나온 뒤 15초
제어 페이지 '종료' `tap (104,120)` → 요약에서 휴지통 `tap (179,189)` → 2초 → '삭제' `tap (104,208)`
→ 시작 화면이 뜨면 왼쪽 위 `tap (33,36)` 으로 빠져나오고 **15초** 기다린 뒤 다음 실행.
2026-10-19에 삭제 후 12초 만에 terminate 했더니 다음 실행이 '중단된 운동을 복원했습니다' 배너가
낀 러닝으로 들어갔다(제어 페이지의 '종료'를 배너가 덮는다 — 배너를 한 번 탭하면 사라진다).
저장하면 HealthKit 주간 거리가 늘어 다음 언어의 결정·플랜이 바뀐다.

## 6. 합성·인코딩
    SHOTS_DIR=<캡처 폴더> python3 tools/composite_lang.py
    python3 tools/encode_shots.py
`composite_lang.py` 는 `tools/bezel-donors/` 의 Ultra 베젤 유리에 캡처를 칠한다. 46mm 캡처는
화면비(0.839)가 유리(0.821)와 달라 **cover-fit**(높이 맞춤, 좌우 약 4px 잘림)으로 넣는다 —
`fit()`. 같은 화면비인 아이폰 캡처는 예전 경로 그대로라 바이트가 같다.
캡처 폴더에 폰 파일(`dash.ko.png` 등)이 있으면 폰 프레임도 다시 만드니, 워치만 만들 땐 `w-*.png` 만 둔다.

## 7. 마지막
화면 구성이 바뀌었으면 `t-*.js`의 `alt.watch.*` 6개 언어를 맞추고,
`node tools/sync-inline.mjs && node tools/prerender.mjs && node tools/check-content.mjs`.
`SHOTS`(i18n-lib.mjs)와 `i18n.js`의 `SHOTS` 는 같이 유지한다.
