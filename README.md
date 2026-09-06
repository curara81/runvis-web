# Runvis — Landing Page

Runvis (런비스) 공식 랜딩/베타모집 페이지. 정적 사이트, 런타임 의존성 0.
루트 5페이지(`index.html` · `run.html` · `how-it-works.html` · `privacy.html` ·
`terms.html`)와 그것을 5개 언어로 프리렌더한 25페이지, 합쳐서 30페이지다.
빌드는 Node 스크립트 두 개뿐이다.

`how-it-works.html`은 라운드 12에 생겼다. 홈이 1280px 폭에서 16,408px였고
`#beta` 한 섹션이 2,653px였다 — 폼·동의·심박존 계산기·서울 GPX 13개·4단계 절차가
한 제목 밑에 쌓여 있었다. 접는 것(`<details>`)으로는 계층이 늘지 않아서, 참고
자료와 가져갈 도구를 한 단계 아래로 내렸다. 홈에는 한 문장과 링크만 남는다.
문자열 키는 옮기기 전 그대로라 6개 사전에 새로 번역할 것이 없었다.

## 특징
- 실제 앱 UI를 재현한 SVG 목업 (심박존 아크·대시보드·GPS 지도)
- **5km 스크롤 데모**(`run.html`): 스크롤이 곧 러닝. 코치가 언제·왜 개입하는지 큐 단위로
- **음성 코칭 체험**: Web Speech API로 실제 코치 멘트 재생 — 표시 언어를 따라 6개 언어
- 다크 프리미엄 톤 · 반응형 · prefers-reduced-motion 대응
- 개인정보보호법 준수 베타 신청 폼(수집목적·보관기간·마케팅동의 분리)

## 빌드 (커밋 전에 반드시)
사이트에 빌드 산출물이 있다. `en/ ja/ es/ zh/ de/` 25개 파일은 **손으로 고치지 말 것** —
루트 페이지(`index.html`·`run.html`·`how-it-works.html`·`privacy.html`·`terms.html`)나
사전(`t-<code>.js`)을 고친 뒤 아래 두 명령을 순서대로 돌린다.

```
node tools/prerender.mjs      # /en /ja /es /zh /de 재생성 (5페이지 × 5언어) + sitemap.xml
node tools/check-content.mjs  # 드리프트 검사 — 실패하면 커밋하지 말 것
```

페이지를 하나 더 만들 때 손대야 하는 곳은 네 군데다 —
`tools/i18n-lib.mjs`의 `PAGES`와 `PAGE_META`, `i18n.js`의 `PAGE_META`
(?lang= 로 언어를 바꿀 때 JSON-LD를 다시 쓰는 런타임 사본), 그리고 그 페이지의
`<head>`에 hreflang 7줄. 나머지(프리렌더 사본·sitemap·검사)는 따라온다.

앱 저장소가 움직였을 때(테스트·문자열 개수가 바뀌었을 때)는 그 앞에 한 번 더:

```
node tools/app-facts.mjs      # 앱 리포에서 숫자를 다시 세어 tools/app-facts.json 갱신
```

`check-content.mjs`가 잡는 것:
0. `tools/app-facts.json`이 **지금** 앱 저장소를 센 값인가. 9번은 사전과 이 파일만
   비교하므로, 파일이 뒤처지면 사전은 통과하는데 '앱 저장소에서 그대로 세어 나온
   숫자'라는 문구가 거짓이 된다(라운드 12 감점). 앱 체크아웃이 없는 머신에서는
   `skip`을 **소리 내어** 출력한다 — 조용한 통과와 구분하기 위해서다
1. 6개 사전의 키 집합이 같은가
2. 마크업이 쓰는 `data-i18n` 키가 6개 사전에 전부 있는가
3. 각 페이지의 **인라인 기본 텍스트**가 그 페이지 언어의 사전 값과 같은가
   (크롤러와 JS 없는 방문자가 보는 것은 인라인 기본값뿐이다)
4. 정적 JSON-LD가 사전과 **문자 단위로** 같은가 — index의 FAQPage·SoftwareApplication,
   그리고 run/privacy/terms의 WebPage + BreadcrumbList
   — 라운드 7에서 8문항 중 3문항이 화면과 어긋난 채 검색에 나가던 사고가 이 검사로 막힌다
5. 프리렌더 산출물이 최신인가 (루트만 고치고 재생성을 잊는 사고 방지)
6. hreflang 7줄이 전부 있고 각 대상 파일이 실재하는가
7. index의 섹션 9개 · 태그 균형
8. (7과 같은 블록) 30개 페이지 전부 태그 균형
9. 신뢰 블록이 인용하는 앱 숫자(테스트 · 번역표 · 지표 설명)가
   `tools/app-facts.json`과 같은가 — 숫자 자체는 이 문서에도 마크업 주석에도
   적지 않는다. 유일한 출처는 `node tools/app-facts.mjs`가 쓰는 그 JSON이다.
   화면 문구 개수와 큐 개수는 **하한 표기**라
   (`2,100개 이상` / `270개 이상`) 저장소 값이 그 아래로 내려갈 때만 실패한다 —
   502↔506, 2,077↔2,118, 2,118↔2,162가 네 라운드 연속으로 어긋난 자리이고,
   앱이 문자열을 더할 때마다 여섯 사전이 함께 낡는 구조 자체를 없앴다
10. 페이지 스크립트의 `RunvisT(키, 인라인 폴백)` 폴백이 그 페이지 언어의 사전 값과 같은가
11. `sitemap.xml`이 실제 존재하는 30개 페이지와 정확히 일치하고 `robots.txt`가 그것을 가리키는가
12. **조건이 붙은 주장**이 6개 언어에서 그대로 살아 있는가. 사전과 마크업이 일치해도
    문장을 다시 쓰다가 조건만 빠지면 이 검사만 잡는다 —
    `n.faq.a1`은 아이폰 심박존 큐가 블루투스 심박 밴드를 요구한다는 조건을 반드시 담고
    (`PhoneWorkoutManager`의 심박원은 `HeartRateBandManager`(BLE 0x180D) 하나뿐이고
    `PhoneCoachPlan.zoneCue`는 심박 0이면 nil을 돌려준다),
    `r20`은 코치가 실제로 말하지 않는 '2.5km'를 어느 언어에서도 담지 않는다
13. **앱 상수를 산문으로 옮겨 적은 자리**가 아직 앱과 같은 숫자인가.
    큐 토글 개수·30분 예산(8/6)·최소 간격(45초)은 `CoachSessionProfile.swift`의
    리터럴이고 `app-facts.mjs`가 그것을 세어 둔다. 앱은 라운드 7에 페이월 문구를
    `String(format:)` 인자로 바꿔 이 사고를 없앴는데 웹은 6개 언어 문장이라
    그럴 수 없어서, 대신 이 검사로 묶었다. 그래서 여섯 언어 모두 이 숫자들을
    **아라비아 숫자로** 쓴다("eight cues"였으면 검사가 못 본다)
14. 세 가격(₩1,900 · ₩15,000 · ₩39,000)이 6개 사전에서 같은가.
    값 자체(`pr.month`/`pr.year`/`pr.life`)와, 그 값을 문장 안에 인용하는
    `n.hero.note`·`n.why.cost`·`n.price.year`·`n.price.life`까지 본다

## 로컬 미리보기
```
python3 -m http.server 8000
# http://localhost:8000        (한국어 = 루트, x-default)
# http://localhost:8000/de/    (프리렌더된 독일어 사본)
```

## 배포
- **GitHub Pages**: Settings → Pages → main 브랜치, `/` 루트
- **Vercel/Cloudflare Pages**: 이 저장소 연결, 빌드 설정 불필요(정적)
- 도메인: `runvis.app` (구매 후 CNAME 연결)

## TODO (출시 전)
- [x] 베타 신청 폼 → Formspree 실제 연동 (`index.html`의 `formspree.io/f/xnjeyalr`)
- [x] /privacy · /terms 서브 페이지 (6개 언어 프리렌더까지 완료)
- [x] 실기기 스크린샷으로 SVG 목업 교체 (`assets/framed-phone-*.{,en,ja,es,zh,de}.png` 30장)
- [ ] 히어로 15초 워치 구동 영상 삽입 (현재는 CSS 배경 + 실기기 캡처)
- [ ] App Store 버튼 (출시 후)
- [ ] **아이폰 캡처 30장 재촬영** — 지금 있는 30장은 2026-09-06 07:30 빌드다.
  그 뒤 `Shared/Views/RunvisDesignSystem.swift`의 상태 라벨에
  `.lineLimit(1).minimumScaleFactor(0.8)`이 들어가 줄바꿈 버그가 고쳐졌는데,
  독일어·스페인어 캡처에는 `Achtung` / `Atención`이 두 줄로 접힌 채 남아 있을 수 있다.
  절차: `tools/regenerate-screens.md` → `tools/composite_lang.py`.
  재촬영하면 `tools/app-facts.json`의 `screensCapturedAt`을 올릴 것.
  **화면 문구는 손댈 것이 없다** — 라운드 12에서 `sc.build`(특정 결함을 사과하고
  '다시 촬영해서 교체할 자리'라고 적던 문단)를 6개 사전에서 지웠다. 방문자에게
  내부 TODO를 공개하는 문단이었고, 캡처를 바꾸는 순간 내용이 거짓이 되는 문장이라
  다른 세션이 에셋을 갈아 끼울 때마다 손으로 맞춰야 했다. 남은 것은 `sc.note`의
  마지막 절 하나 — "촬영 뒤에도 앱은 계속 고쳐지고 있어서 실제 빌드가 캡처보다
  최신일 수 있다" — 이고, 이 문장은 누가 언제 재촬영하든 참이다.
- [x] **애플워치 캡처 6장의 언어별 변형** — 2026-09-06 완료. 워치 시뮬레이터가
  합성 탭을 받지 않는다는 `regenerate-screens.md`의 메모가 틀렸다(절차:
  `tools/watch-capture.md`). 6화면 × 6언어 36장이 있고 `i18n.js`의 `SHOTS`와
  `tools/i18n-lib.mjs`의 `SHOTS`가 워치 6종을 포함한다.

## 에셋 현황
- **아이폰 프레임 30장**: 실기기(시뮬레이터) 캡처 완료. 언어별 5벌 + 한국어 기본.
  `i18n.js`의 `SHOTS`/`SHOT_LANGS`와 `tools/i18n-lib.mjs`의 `SHOTS`가 같은 목록을 들고 있고,
  프리렌더는 마크업에 이미 해당 언어 파일명을 박아 넣는다.
- **애플워치 프레임 36장**: 6화면 × 6언어. 아이폰과 같은 파이프라인이고
  프리렌더가 마크업에 해당 언어 파일명을 박아 넣는다.
- **히어로 배경**: 아직 CSS 시네마틱. 교체 자리는 `.hero-bg` div — 저작권 프리 러닝 영상
  (pexels.com/videos · coverr.co · mixkit.co, 전부 상업적 무료)을 `hero.mp4`로 내려받아
  `<video>` 배경으로. 핫링크 말고 저장소에 두는 게 안정적이다.
- **공유 카드** `assets/og-card.png`: 어느 언어의 문장도 없는 중립 디자인이라 6개 시장이 공유한다.
  다만 프리렌더(`tools/prerender.mjs` 8b단계)가 `assets/og-card.<code>.png`가
  **있으면** 그 언어 페이지의 og:image·twitter:image·JSON-LD `image`를 그것으로
  바꾼다. 없으면 중립 카드로 남으므로 6장을 한꺼번에 만들 필요가 없다 —
  한 장씩 넣어도 나머지 시장이 깨지지 않는다. 카드에 얹을 문장은 각 언어의
  `n.hero.h1`.
