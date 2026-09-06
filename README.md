# Runvis — Landing Page

Runvis (런비스) 공식 랜딩/베타모집 페이지. 정적 사이트(단일 `index.html`, 의존성 0).

## 특징
- 실제 앱 UI를 재현한 SVG 목업 (심박존 아크·대시보드·GPS 지도)
- **롱런 시뮬레이터**: 러닝 종류별로 런비스의 개입 시점을 타임라인으로
- **음성 코칭 체험**: Web Speech API로 실제 한국어 멘트 재생
- 다크 프리미엄 톤 · 반응형 · prefers-reduced-motion 대응
- 개인정보보호법 준수 베타 신청 폼(수집목적·보관기간·마케팅동의 분리)

## 빌드 (커밋 전에 반드시)
사이트에 빌드 산출물이 있다. `en/ ja/ es/ zh/ de/` 20개 파일은 **손으로 고치지 말 것** —
루트 페이지(`index.html`·`run.html`·`privacy.html`·`terms.html`)나 사전(`t-<code>.js`)을
고친 뒤 아래 두 명령을 순서대로 돌린다.

```
node tools/prerender.mjs      # /en /ja /es /zh /de 재생성 (4페이지 × 5언어) + sitemap.xml
node tools/check-content.mjs  # 드리프트 검사 — 실패하면 커밋하지 말 것
```

앱 저장소가 움직였을 때(테스트·문자열 개수가 바뀌었을 때)는 그 앞에 한 번 더:

```
node tools/app-facts.mjs      # 앱 리포에서 숫자를 다시 세어 tools/app-facts.json 갱신
```

`check-content.mjs`가 잡는 것:
1. 6개 사전의 키 집합이 같은가
2. 마크업이 쓰는 `data-i18n` 키가 6개 사전에 전부 있는가
3. 각 페이지의 **인라인 기본 텍스트**가 그 페이지 언어의 사전 값과 같은가
   (크롤러와 JS 없는 방문자가 보는 것은 인라인 기본값뿐이다)
4. 정적 FAQ/앱 JSON-LD가 사전과 **문자 단위로** 같은가
   — 라운드 7에서 8문항 중 3문항이 화면과 어긋난 채 검색에 나가던 사고가 이 검사로 막힌다
5. 프리렌더 산출물이 최신인가 (루트만 고치고 재생성을 잊는 사고 방지)
6. hreflang 7줄이 전부 있고 각 대상 파일이 실재하는가
7. index의 섹션 9개 · 태그 균형
8. (7과 같은 블록) 24개 페이지 전부 태그 균형
9. 신뢰 블록이 인용하는 앱 숫자(테스트 506 · 화면 문구 2,118 · 번역표 396 · 지표 설명 40)가
   `tools/app-facts.json`과 같은가 — 502↔506, 2,077↔2,118이 세 라운드 연속으로 어긋난 자리다
10. 페이지 스크립트의 `RunvisT(키, 인라인 폴백)` 폴백이 그 페이지 언어의 사전 값과 같은가
11. `sitemap.xml`이 실제 존재하는 24개 페이지와 정확히 일치하고 `robots.txt`가 그것을 가리키는가

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
  독일어·스페인어 캡처에는 `Achtung` / `Atención`이 두 줄로 접힌 채 남아 있다.
  그 사실을 지금은 `sc.build` 문구로 화면에서 고지하고 있다 — 재촬영하면
  `sc.build`를 지우고 `tools/app-facts.json`의 `screensCapturedAt`을 올릴 것.
  절차: `tools/regenerate-screens.md` → `tools/composite_lang.py`.
- [ ] **애플워치 캡처 6장의 언어별 변형** — 워치 시뮬레이터가 합성 탭을 받지 않아
  아이폰과 같은 파이프라인으로 자동화하지 못했다. 6장 전부 한국어판이고
  `sc.note` / `sc.note.watch`가 그렇게 고지한다.

## 에셋 현황
- **아이폰 프레임 30장**: 실기기(시뮬레이터) 캡처 완료. 언어별 5벌 + 한국어 기본.
  `i18n.js`의 `SHOTS`/`SHOT_LANGS`와 `tools/i18n-lib.mjs`의 `SHOTS`가 같은 목록을 들고 있고,
  프리렌더는 마크업에 이미 해당 언어 파일명을 박아 넣는다.
- **애플워치 프레임 6장**: 한국어판 1벌뿐(위 TODO 참조).
- **히어로 배경**: 아직 CSS 시네마틱. 교체 자리는 `.hero-bg` div — 저작권 프리 러닝 영상
  (pexels.com/videos · coverr.co · mixkit.co, 전부 상업적 무료)을 `hero.mp4`로 내려받아
  `<video>` 배경으로. 핫링크 말고 저장소에 두는 게 안정적이다.
- **공유 카드** `assets/og-card.png`: 어느 언어의 문장도 없는 중립 디자인이라 6개 시장이 공유한다.
