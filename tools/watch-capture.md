# 워치 스크린샷 캡처 절차 (2026-09-06 실행 검증 — 6개 언어 × 6장 완료)

지난 두 라운드 동안 "watchOS 시뮬레이터가 합성 탭을 무시한다"고 보고됐지만 **사실이 아니다**.
탭·스와이프 모두 정상 동작한다. 아래는 실제로 36장을 찍어 확인한 순서다.

워치 UDID: `66D2DA4E-4021-46BF-A97E-1BE34B8D99D0` (아이폰 `886A3B8D-…`은 건드리지 말 것).

## 0. 빌드는 새로 만들지 않는다
`~/Library/Developer/Xcode/DerivedData/SportsDashboard-*/Build/Products/Debug-watchsimulator/SportsDashboard.app`
가 최신이면 그대로 `xcrun simctl install <UDID> <path>` 한다. 디스크 여유가 빠듯하다.

## 1. erase 는 쓰지 말 것
`erase` 는 건강·위치 권한까지 지워서 시트를 다시 통과해야 한다. 시뮬이 이미
권한을 통과한 상태라면 **erase 없이** 진행한다. 쌓인 알림이 문제면 `shutdown` →
`boot` 로 충분하다(데이터·권한 유지).

## 2. 컨테이너 prefs 주입 — **쓰고 나면 cfprefsd 를 죽여야 한다**
    C=$(xcrun simctl get_app_container <UDID> com.curara.SportsDashboard.watchkitapp data)
    # <C>/Library/Preferences/com.curara.SportsDashboard.watchkitapp.plist 에
    # didOnboardWatch=true, isDeveloperGodMode=true, planDaysPerWeek=3 을 plistlib 로 기록
    xcrun simctl spawn <UDID> launchctl kill 9 system/com.apple.cfprefsd.xpc.daemon

**이 kill 이 이번 라운드의 핵심이었다.** plist 파일만 고치면 cfprefsd 가 캐시한 옛 값을
계속 앱에 넘겨서, 파일에는 새 키가 있는데 화면은 안 바뀐다(주입이 "안 먹는다"고
보고되던 증상). 죽이면 다음 실행 때 파일에서 다시 읽는다.

## 3. 권한은 simctl 로 미리 준다
    xcrun simctl privacy <UDID> grant location-always com.curara.SportsDashboard.watchkitapp
건강(HealthKit)과 동작·피트니스는 `simctl privacy` 에 서비스가 없어 **탭으로 한 번**
통과해야 한다. 시트에서 스크롤 → 버튼 탭이면 되고, 한 번 통과하면 계속 유지된다.

## 4. 실행 — 환경변수는 반드시 SIMCTL_CHILD_ 접두사
    SIMCTL_CHILD_RUNVIS_SCREENSHOT=1 SIMCTL_CHILD_RUNVIS_DASH_PAGE=0 \
      xcrun simctl launch <UDID> com.curara.SportsDashboard.watchkitapp \
      -AppleLanguages "(de)" -AppleLocale de_DE
- `RUNVIS_SCREENSHOT=1` → 알림 권한 요청을 건너뛴다(DashboardViewModel).
- `RUNVIS_DASH_PAGE=n` → 크라운 페이지 n 으로 바로 연다(DashboardView).
  0=오늘의 결정 1=오늘의 근거 2=플랜 3=참고 4=더보기.
- 실행 후 **12~15초** 기다린다(HealthKit 조회가 끝나야 숫자가 채워진다).
- 로케일 코드: ko_KR · en_US · ja_JP · es_ES · zh_TW · de_DE.
  `-AppleLanguages` 의 번체 코드는 **zh-Hant**(사이트 파일명은 `.zh`).

## 5. 탭·스와이프는 Claude Code 의 iOS Simulator control 툴로
좌표 단위는 **디바이스 포인트**(211×257). 스크린샷 픽셀(422×514)의 절반.
- 히어로 프레이밍: 실행 직후 `swipe (105,180)→(105,140)` 한 번.
  헤더 한 줄이 남고 카드 전체가 들어온다.
- 운동 시작 화면: `swipe (105,220)→(105,30)` 로 바닥까지 → 초록 버튼 `tap (105,97)`.
- 화면 캡처는 `xcrun simctl io <UDID> screenshot out.png` (422×514).

## 6. 러닝 중 화면(pace·hr·map)
    xcrun simctl location <UDID> start --speed=3.2 --distance=10 <lat,lon> ... (5점 이상)
`--speed=3.2` m/s = **5:12/km**(en_US 에서는 8:22/mi). 그 다음
운동 시작 → 종목 `tap (105,143)` → 브리핑에서 `swipe (105,220)→(105,40)` 후
"건너뛰고 바로 달리기" `tap (105,209)`.

크라운 페이지 순서(야외 자유 러닝 기본 루프 6장, `WorkoutScreenPrefs.defaultDisabled`):
**0 기본 · 1 페이스 상세 · 2 심박수 · 3 심박존 · 4 지도 · 5 제어**.
`swipe (105,200)→(105,60)` 한 번이 한 페이지다.

- 약 **4분**(≈0.85km) 기다린 뒤 찍으면 아이폰 캡처와 자릿수가 맞는다.
- **75초마다 스와이프 한 번**을 섞어라. 손을 대지 않으면 watchOS 가 운동 중에도
  시계 화면으로 돌아가고, 다시 들어가면 "중단된 운동 복구" 배너가 낀 채로 찍힌다.
- **지도는 그 언어의 나라에서 달려라.** Apple 지도 라벨은 앱 언어가 아니라 그 지역의
  표기를 쓴다 — 서울을 ja 로 찍으면 지도만 한글로 남는다. 이번에 쓴 좌표:
  ko 여의도 · en 런던 하이드파크 · ja 도쿄 황궁 · es 마드리드 레티로 ·
  zh-Hant 타이베이 다안 · de 베를린 티어가르텐.

## 7. 끝나면 운동을 반드시 정리한다
제어 페이지 `tap (105,124)`(종료) → 요약에서 휴지통 `tap (182,194)` → `tap (105,216)`(폐기).
**저장하면 안 된다** — HealthKit 주간 거리가 늘어 다음 언어의 플랜/결정이 바뀐다.
폐기 뒤 `tap (35,38)` 로 빠져나오고 **10초 이상 기다린 뒤** terminate 한다. 바로 죽이면
HKWorkoutSession 이 남아 다음 실행이 "중단된 운동 복구" 화면으로 들어간다.

## 8. 상태바의 빨간 "아이폰 연결 끊김" 아이콘
운동을 한 번 시작하면 워치–아이폰 링크가 끊겨 상태바에 빨간 아이콘이 박힌다.
`shutdown` → `boot`(erase 아님) 하면 사라진다. **정지 화면 3장(hero·evidence·start)은
재부팅 직후, 운동 전에** 찍어라. 러닝 3장은 아이콘을 피할 수 없다(기존 한국어
캡처도 같다).

## 9. 베젤 합성
    python3 tools/composite_lang.py
Apple 베젤 프레임을 도너로 유리 부분만 다시 칠한다. 도너는 **`tools/bezel-donors/`**
에서 읽는다 — assets/ 의 프레임은 이 스크립트의 출력이기도 해서 거기서 읽으면
PNG8 팔레트 오차가 실행할 때마다 한 세대씩 쌓인다(실측: 스크린 박스 밖 max diff
43 → 55). 지금은 몇 번을 다시 돌려도 **바이트가 같다**(검증됨).
입력은 `<scratchpad>/shots/w-<screen>.<locale>.png`. 폰 캡처(`<screen>.<locale>.png`)가
같은 폴더에 있으면 폰 프레임까지 다시 만든다 — 워치만 만들려면 폰 파일을 치워라.

## 10. 마지막
`tools/i18n-lib.mjs` 의 `SHOTS` 와 `i18n.js` 의 `SHOTS` 는 **같이** 유지한다.
그 뒤 `node tools/prerender.mjs && node tools/check-content.mjs`.
