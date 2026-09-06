# 워치 스크린샷 캡처 절차 (2026-09-06 확인)

지난 두 라운드 동안 "watchOS 시뮬레이터가 합성 탭을 무시한다"고 보고됐지만 **사실이 아니다**.
아래 순서면 탭이 정상 동작한다. 실패했던 이유는 (a) 시뮬레이터에 답하지 않은 시스템 알림이
쌓여 있었고 (b) 첫 탭이 한 번 타임아웃한 뒤 재시도하지 않았기 때문이다.

## 1. 시뮬레이터 초기화 (쌓인 시스템 알림 제거)
    xcrun simctl shutdown <WATCH_UDID>
    xcrun simctl erase <WATCH_UDID>
    xcrun simctl boot <WATCH_UDID>      # 부팅 20초 대기

## 2. 설치 + 온보딩 건너뛰기 (탭 없이)
    xcrun simctl install <WATCH_UDID> <path>/SportsDashboard.app
    C=$(xcrun simctl get_app_container <WATCH_UDID> com.curara.SportsDashboard.watchkitapp data)
    # <C>/Library/Preferences/com.curara.SportsDashboard.watchkitapp.plist 에
    # didOnboardWatch=true, isDeveloperGodMode=true, planDaysPerWeek=3 을 plistlib 로 기록

## 3. 실행 — 환경변수는 반드시 SIMCTL_CHILD_ 접두사
    SIMCTL_CHILD_RUNVIS_SCREENSHOT=1 \
    SIMCTL_CHILD_RUNVIS_DASH_PAGE=0 \
    xcrun simctl launch <WATCH_UDID> com.curara.SportsDashboard.watchkitapp

- `RUNVIS_SCREENSHOT=1` → 알림 권한 요청을 건너뛴다(DashboardViewModel.NotificationManager).
- `RUNVIS_DASH_PAGE=n` → 크라운 페이지 n 으로 바로 연다(DashboardView). 탭 없이 페이지 이동.
  0=오늘의 결정 1=근거 2=플랜 3=참고 4=더보기 (실제 순서는 DashboardView 의 TabView 확인)

## 4. 건강 권한은 한 번만 탭으로 (자동화 불가 — simctl privacy 에 health 서비스가 없다)
쓰기 시트: "검토" → "아래 요청된 모든 데이터" 토글 → 스크롤 → "다음"
읽기 시트: 같은 토글 → 스크롤 → "완료"
좌표는 이미지 픽셀의 절반(디바이스 포인트). 첫 탭이 timed out 으로 실패하면 **한 번 재시도**하면 된다.

## 5. 캡처
    xcrun simctl io <WATCH_UDID> screenshot out.png     # 422×514

## 6. 언어 전환
    SIMCTL_CHILD_RUNVIS_SCREENSHOT=1 SIMCTL_CHILD_RUNVIS_DASH_PAGE=0 \
    xcrun simctl launch <WATCH_UDID> com.curara.SportsDashboard.watchkitapp \
      -AppleLanguages "(de)" -AppleLocale de_DE

## 7. 베젤 합성
    tools/composite_lang.py 가 기존 한국어 프레임을 도너로 유리 부분만 다시 칠한다.
