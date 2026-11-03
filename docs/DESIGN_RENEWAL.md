# VQD design renewal

## Visual system

- Swiss-inspired grid, warm paper surfaces, restrained rules and forest ink.
- Palette: `#17251F`, `#344B3A`, `#65745A`, `#A6A078`, `#D6C99A`, `#F1EBDD`.
- System Korean sans-serif typography, tabular numbers, serif framework labels; no remote font request.
- Shared navigation/footer across overview, stock detail and methodology.
- Desktop sortable research table; mobile cards below 600px; responsive tablet layout.
- Search and assessment-state filters, empty results and reset, keyboard focus and skip link.
- Confirmed scores remain out of 100; assessable weight is shown separately. Missing assessment is explicitly unrated. Score bars show confirmed points and available assessment weight without normalization.
- Manual refresh remains available in an expandable management section.

## Preserved behavior

No modifications to `lib/`, `app/api/`, `supabase/`, `app/manual-refresh.tsx` or dependency declarations. KIS/DART requests, retry handling, Supabase queries, authorization and scoring calculations remain unchanged. No new authentication or investment-data behavior is introduced.

## Validation

- `npm run typecheck`: passed.
- `npm run build`: passed, no compilation warnings (Next.js 15.5.28).
- Server checks: `/`, `/stocks/000270`, `/methodology` return 200 with expected content; unknown `/stocks/999999` returns 404.
- React render checks: missing, partial and complete assessments; desktop/mobile markup; formatted prices, detail links and initial sorting semantics passed.
- CSS parser: 402 rules parsed successfully; `git diff --check` passed.
- Browser visual and interactive QA remains unverified: in-app browser could not reach the local server; native browser access timed out awaiting tool approval.
- No API credentials were provided. Live KIS/DART/Supabase collection and authenticated refresh were not exercised.
