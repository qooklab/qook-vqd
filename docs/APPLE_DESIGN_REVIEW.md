# Apple Design Skill application

## Context and design review

Source: https://github.com/dickwu/apple-design-skill (SKILL.md and bundled references).
This is a responsive Next.js web dashboard for Korean equity research. Apply the skill's foundations and craft principles; native Apple window controls, tab bars and App Store conventions do not apply.

The screen's single job is to compare stock valuation evidence without confusing missing coverage with poor performance. The signature is the paired score/assessment-coverage display, grounded in the existing VQD scoring model.

### Findings addressed

- **Critical / legibility:** previous utility text reached 6–10px. All CSS font sizes now have a 12px-equivalent rem floor; primary desktop body is 15px, mobile body is 17px, mobile stock titles 16px. `typography.md › Ensuring legibility`: “Use font sizes that most people can read easily.”
- **Critical / contrast:** #65745A on #F1EBDD is 4.21:1. Small text uses #56634F (5.36:1) or stronger, while sage remains in non-text accents. `accessibility.md › Vision`: “Strive to meet color contrast minimum standards.”
- **High / craft:** remove nonsequential 01/02/03 labels and repeated English eyebrows. Use product language, restrained system typography, rounded groups and fewer hard rules. This is studio judgment from the skill's craft lens.
- **Medium / interactions:** 44px control targets, press/hover/focus states, active navigation, inline search with a clear button and Escape-to-clear. `buttons.md › Best practices`: “Always include a press state for a custom button.” `search-fields.md › Best practices`: “If possible, start search immediately when a person types.”
- **Medium / adaptability:** semantic CSS roles, system dark appearance, increased/forced contrast, reduced motion and reduced transparency. No custom glass surfaces. `color.md › Best practices`: “Make sure all your app’s colors work well in light, dark, and increased contrast contexts.”

### What works and remains

Keep sortable columns, instant search, explicit unrated/partial/complete labels, separate assessment weight, mobile detail navigation and progressively disclosed administration. The original six-color brand palette remains. Data fetching, KIS/DART/Supabase integration, authentication and calculations remain unchanged.

## Compact token plan

Six palette anchors: ink #17251F, forest #344B3A, sage #65745A, olive #A6A078, sand #D6C99A, paper #F1EBDD. Accessible text and surface derivatives supplement these anchors.

| Role | Light | Dark | Text contrast |
| --- | --- | --- | --- |
| Canvas / main content | #F1EBDD / #17251F | #17251F / #F1EBDD | 13.38:1 |
| Group / main content | #FAF7EF / #17251F | #223129 / #F1EBDD | Dark 11.48:1 |
| Secondary text | #56634F | #CDCDBA | Light canvas 5.36:1; dark group 8.47:1 |
| Accent text | #344B3A | #D6C99A | Light group 8.86:1; dark group 8.24:1 |
| Action boundary / focus | #65745A / #344B3A | #A6A078 / #D6C99A | Dark boundary on group 5.15:1 |
| Coverage graphics | #D6C99A / #65745A | #65745A / #D6C99A | Text labels carry meaning independently |

Type: system sans stack throughout, tabular numbers for financial data, 12/13/14/15/16/17px-equivalent utility/body steps, 24px score, responsive 34–52px display. Use rem units to respect browser text preferences.

Layout: keep research comparison central, group related data in cards, and stack the same information as available width decreases.

```text
Regular                         Compact
[Brand   Research | Criteria]    [Brand   Research | Criteria]
[Intro           V/Q/D]          [Intro]
[Universe | Collected | Rated]   [V/Q/D]
[Research table group        ]  [Universe / Collected / Rated]
[Filters        Search       ]  [Filters / Search / Sort]
[Stock | Price | Score | ... ]  [Stock / Price / Score / Status]
[Collapsed data management    ]  [Collapsed data management]
```

Plan critique: rounded cards alone could fit any app. Keep the VQD score and assessed weight together as the product-specific element, reduce brand decoration, and use the same familiar search/sort/navigation controls across sizes. No added motion is necessary for repeated financial comparisons.

## Verification

- Typecheck and production build passed after the changes.
- Browser: dark appearance overview and detail inspected at desktop, 390px and 320px. No page-level horizontal overflow at either compact width.
- Browser: search for 삼성전자 returned two rows; clear restored results; completed-assessment filter produced the expected empty state; reset restored the universe; mobile stock navigation opened the correct detail.
- Browser: Escape cleared search, repeated column-heading clicks toggled ascending/descending; no browser console errors were captured.
- Light/dark text contrast calculated from tokens. Light appearance, 200% text sizing and forced-colors visual QA are not claimed as tested.
- Live authenticated refresh and external data collection remain untested because API credentials are absent.
