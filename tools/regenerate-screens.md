# 홈페이지 기기 목업 이미지 재생성 절차

홈페이지의 기기 이미지(`assets/framed-*.png`)는 **Apple 공식 제품 베젤**에
앱 화면 SVG 렌더를 합성한 것. 앱 화면 데이터/디자인이 바뀌면 아래 순서로 재생성.

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
