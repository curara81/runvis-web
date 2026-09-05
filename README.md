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
node tools/prerender.mjs      # /en /ja /es /zh /de 재생성 (4페이지 × 5언어)
node tools/check-content.mjs  # 드리프트 검사 — 실패하면 커밋하지 말 것
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
- [ ] 히어로 15초 워치 구동 영상 삽입 (현재는 라이브 SVG 목업)
- [ ] 베타 신청 폼 → Tally/Formspree 실제 연동
- [ ] /privacy · /terms 서브 페이지
- [ ] 실기기 스크린샷으로 SVG 목업 교체
- [ ] App Store 버튼 (출시 후)

## 실사/영상 에셋 슬롯 (저작권 프리 채우기)
지금은 CSS 시네마틱 배경 + SVG 목업으로 채워둠. 나중에 교체할 자리:
- **히어로 배경**: `.hero-bg` div → 저작권 프리 러닝 영상(Pexels·Coverr·Mixkit, 상업적 무료·출처표기 불필요) mp4를 다운받아 `hero.mp4`로 넣고 `<video>` 배경으로. 또는 3D 워치 렌더 영상.
- **워치 3-up / iPhone 프레임**: 현재 SVG → 실기기 스크린샷 PNG로 교체 가능(프레임 CSS는 그대로).
- 저작권 프리 영상 소스: pexels.com/videos, coverr.co, mixkit.co (전부 상업적 무료). 핫링크 말고 다운로드해서 저장소에 두는 게 안정적.
