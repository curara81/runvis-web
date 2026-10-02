---
name: design-md-library
description: Library of 74 DESIGN.md references (colors, typography, spacing, components) extracted from well-known sites such as Linear, Stripe, Apple, Vercel, Notion, Airbnb, Tesla. Use when starting or restyling a website/landing page and the user wants a concrete visual direction ("Linear 느낌으로", "애플처럼 미니멀하게", "Stripe 스타일"), or when no design system exists yet and one must be picked.
---

# DESIGN.md Library

Reference design specs live in `references/<site>.md` (source: VoltAgent/awesome-design-md, MIT).

## How to use

1. Pick 1–2 references that fit the project's tone. If the user named a site, use it; otherwise propose 2–3 candidates with one line each and let the user choose.
2. Read only the chosen file(s) — do not load the whole folder.
3. Copy the chosen spec into the project root as `DESIGN.md` and adapt it: replace brand colors, fonts (Korean sites: pair with Pretendard or a similar Hangul font), and logo usage to fit the client. Never copy another company's logo or trademarked assets.
4. Follow the project `DESIGN.md` for all subsequent UI work, and pair it with `design-taste-frontend` for layout quality.

## Rough tone guide

- Minimal / premium: apple, linear.app, vercel, raycast, superhuman, framer
- Friendly SaaS: notion, airtable, cal, intercom, zapier, webflow
- Fintech / trust: stripe, wise, revolut, mastercard, coinbase
- Bold / luxury / automotive: ferrari, lamborghini, bugatti, bmw, tesla, spacex
- Consumer / lifestyle: airbnb, nike, spotify, starbucks, pinterest
- Editorial / media: theverge, wired

Run `ls references/` for the full list.
