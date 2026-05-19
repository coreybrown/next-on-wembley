# Next on Wembley — Design System & Spec

**Status:** Draft v1 — 2026-05-15
**Companion to:** `PROD_REQS.md` (Draft v4, 2026-05-15)
**Owner:** Corey Brown
**Synthesizes:** UI-designer system spec + frontend-architect aesthetic direction.

This doc is the *technical specification* that sits between the PRD and the implementation. It locks the visual identity, design tokens, component inventory, key organism specs, state patterns, accessibility implementation, and Tailwind plumbing — enough that any of M1–M5 can be built without re-deciding visual or system-level questions.

---

## 0. Reader's guide

| If you are… | Read these sections |
|---|---|
| Picking colors, fonts, motion | §1 Identity · §2 Tokens · §8 Motion |
| Building a screen | §3 Inventory · §4 Organism specs · §5 Responsive matrix · §6 State patterns |
| Wiring up accessibility | §7 Accessibility |
| Setting up the project | §10 Tailwind plumbing · §11 Token CSS sketch |
| Tracking open questions | §12 Flagged ambiguities |

---

## 1. Aesthetic identity

**Committed aesthetic: Editorial-Magazine** — the "weekend culture supplement" register. Reference points: *The Criterion Collection* booklet, *NYT Watching* column, a printed TV guide reimagined for a couple's coffee table.

**Why this app:**
- Two readers, one couch, evening light — the app is **consulted**, not scrolled. Editorial pacing rewards that.
- "Next on Wembley" sounds like a column byline already.
- Streaming services are slick, dense, retention-engineered. A household tool can afford to feel curated and slow on purpose — the anti-Netflix.
- Quietly literate, Canadian. No SV hype gradient. CBC-Arts, not Vercel.
- Dim-room evenings: a richly inked dark mode (deep aubergine + warm cream) reads like a printed page under a lamp, not a phone screen.
- Co-watch deserves a "cover story" feeling — Editorial gives it that naturally.

**Rejected aesthetics:**
- **Glassmorphism** — too SaaS-2022; indistinguishable from streaming services.
- **Neobrutalism** — anti-corporate spine, but chunky black borders + hot-yellow blocks would fight the posters (which are the actual content) and feel hostile in a dim room.

**Anti-slop self-check.** No Inter/Roboto/Open Sans. No `#000`/`#FFF`. No purple-to-blue startup gradient. No Material drop-shadow cards (elevation by surface color, not shadow). No Corporate Memphis. One aesthetic, fully committed.

**Design temptation resisted:** a page-turn animation on rec-tab switch. Rejected — it would briefly obscure which tab is active and cost reduced-motion users a meaningful affordance.

---

## 2. Design tokens

All tokens are **semantic** (role-based), exposed as CSS custom properties on `:root` (light) and `[data-theme="dark"]`, then surfaced through `tailwind.config.ts`.

**Rule (per PRD §7.1):** every state token must pair with an icon or text label. Token color alone is never the sole carrier of meaning.

### 2.1 Color tokens — light mode (`:root`) — "newsprint cream"

```css
:root {
  /* Surfaces */
  --color-surface:           #F4EFE6; /* warm cream, like uncoated paper */
  --color-surface-elevated:  #FBF7EE; /* card stock */
  --color-surface-overlay:   #ECE5D7; /* drawer / modal scrim panel */

  /* Borders */
  --color-border:            #2A1F2C1A; /* aubergine ink @ 10% — hairline */
  --color-border-strong:     #2A1F2C40; /* focus-adjacent emphasis */

  /* Text */
  --color-text-primary:      #1F1622; /* deep aubergine-black ink */
  --color-text-secondary:    #4B3A4F;
  --color-text-muted:        #7A6A78;

  /* Accents */
  --color-accent:            #3C1F4A; /* aubergine — the dominant ink */
  --color-accent-fg:         #FBF7EE;
  --color-accent-sharp:      #D9442A; /* signal red-orange — editorial stamp */

  /* Semantic */
  --color-success:           #2F6F4A;
  --color-warning:           #B57A1B;
  --color-danger:            #B23A2A;

  /* Vote palette — always paired with iconography */
  --color-vote-agree:        #2F6F4A; /* circled-check */
  --color-vote-disagree:     #B23A2A; /* slashed-circle */
  --color-vote-maybe:        #B57A1B; /* dotted-circle */

  /* Status palette — always paired with icon + label */
  --color-status-want:       #3C1F4A; /* aubergine — bookmarked */
  --color-status-watching:   #D9442A; /* live red-orange — "on air" */
  --color-status-paused:     #7A6A78; /* muted, no-signal */
  --color-status-completed:  #2F6F4A; /* shelved */
  --color-status-dropped:    #4B3A4F; /* archived ink */

  /* Badge */
  --color-badge-unavailable: #5C4A5E; /* gray-aubergine, not alarmist */
}
```

**Contrast check (light):** `--color-text-primary` on `--color-surface` ≈ **14.8:1**. Body + metadata clear 4.5:1 by a wide margin.

### 2.2 Color tokens — dark mode (`[data-theme="dark"]`) — "lamp-lit study"

```css
[data-theme="dark"] {
  --color-surface:           #1A1218; /* very deep aubergine-black */
  --color-surface-elevated:  #241A25;
  --color-surface-overlay:   #2E2330;

  --color-border:            #F4EFE61F; /* cream @ 12% */
  --color-border-strong:     #F4EFE640;

  --color-text-primary:      #F1E8DA; /* warm cream, not stark white */
  --color-text-secondary:    #C8B9AF;
  --color-text-muted:        #8E8079;

  --color-accent:            #E9C9A1; /* warm parchment — "page" in dark */
  --color-accent-fg:         #1A1218;
  --color-accent-sharp:      #F26A3D; /* signal red-orange, brighter for dark */

  --color-success:           #6DBE8C;
  --color-warning:           #E0A857;
  --color-danger:            #E07A66;

  --color-vote-agree:        #6DBE8C;
  --color-vote-disagree:     #E07A66;
  --color-vote-maybe:        #E0A857;

  --color-status-want:       #E9C9A1;
  --color-status-watching:   #F26A3D;
  --color-status-paused:     #8E8079;
  --color-status-completed:  #6DBE8C;
  --color-status-dropped:    #6B5A6B;

  --color-badge-unavailable: #B0A2A8;
}
```

**Contrast check (dark):** `--color-text-primary` on `--color-surface` ≈ **15.1:1**. Clear pass.

### 2.3 Typography

Three families, all Google Fonts. Role split is the magazine convention: **serif speaks, sans organizes, mono annotates.**

- **Display — `Fraunces`** (variable). Roman, with slight `opsz` + `SOFT` axis tilt for "weekly column" softness rather than newspaper severity. Weights: 300, 500, 700, 900. Italics 500/700 for show titles (proper-noun convention).
- **Body & UI — `Chivo`** (variable, 100–900). Latin-American grotesk with humanist warmth — distinct from Inter/Roboto. Used for nav, vote-pill text, buttons, body.
- **Mono — `JetBrains Mono`** for technical metadata: timestamps ("Generated 4 hours ago"), production-status caveat ("Per TMDb — may change"), TMDb IDs, episode counts, dev-mode cost lines.

**Type scale (8 steps)**

| Token       | Size              | Line-height | Tracking | Family / weight              | Role |
|-------------|------------------:|------------:|---------:|------------------------------|------|
| `text-mono` | 0.75rem  (12px)   | 1.4         | +0.04em  | JetBrains Mono 400           | Timestamps, caveats, cost lines, IDs |
| `text-xs`   | 0.8125rem (13px)  | 1.5         | +0.01em  | Chivo 500                    | Vote-pill label, platform chip, partner-vote indicator |
| `text-sm`   | 0.875rem (14px)   | 1.55        | 0        | Chivo 400                    | Filter labels, secondary metadata |
| `text-base` | 1rem (16px)       | 1.6         | 0        | Chivo 400                    | Long LLM explanation (≤300 char), body |
| `text-md`   | 1.0625rem (17px)  | 1.5         | 0        | Chivo 500                    | Short LLM explanation (≤100 char) on compact rec card |
| `text-lg`   | 1.375rem (22px)   | 1.3         | -0.005em | Fraunces 500 italic          | Rec-card title |
| `text-2xl`  | 2rem (32px)       | 1.15        | -0.01em  | Fraunces 700                 | Section labels: "Co-watch", "Corey", "Jaimie" |
| `text-4xl`  | 3.5rem (56px)     | 1.0         | -0.02em  | Fraunces 900 + `opsz 144`    | List-page title / masthead |

**Hierarchy roles:**
- **List-page title** → `text-4xl` Fraunces 900, with a 2px `--color-accent-sharp` rule beneath, 12px gap.
- **Rec-card title** → `text-lg` Fraunces 500 *italic*. Print convention for work titles.
- **Rec-card short explanation** → `text-md` Chivo 500. Pull-quote voice.
- **Rec-card long explanation (expanded)** → `text-base` Chivo 400. Body-copy voice.
- **Timestamp / metadata / caveat** → `text-mono`, `--color-text-muted`, often prefixed with `·` or framed in `[brackets]`.
- **Vote-pill label** → `text-xs` Chivo 500, uppercase with `+0.04em` tracking — "AGREE", "MAYBE", "DISAGREE".

**Extreme contrast in use:** the 56px masthead sits two visual rows above a 12px mono timestamp — "**Co-watch** · *Generated 4 hours ago*" — a ~4.6× size ratio. That's the editorial signature.

### 2.4 Spacing (4px base)

`--space-0: 0; --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px; --space-6: 24px; --space-8: 32px; --space-12: 48px; --space-16: 64px; --space-24: 96px;`

Tailwind's default scale already aligns; only `theme.extend.spacing` non-standard steps if needed.

### 2.5 Radius

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 2px | Inputs (deliberately tight — print form feel) |
| `--radius-md` | 4px | Cards, posters (just enough to not feel like a print sample) |
| `--radius-lg` | 8px | Buttons (non-pill) |
| `--radius-xl` | 20px | Drawer top edge, modal corners |
| `--radius-pill` | 9999px | Vote pills, identity chip, nav pill |

Drawer: `0px` on the shared/edge-anchored side, `--radius-xl` on the outer corners.

### 2.6 Elevation (no drop-shadow culture)

Elevation is communicated by `--color-surface-elevated` color shift, **not** drop-shadow. The aesthetic forbids generic Material card shadows.

| Token | Use | Light | Dark |
|---|---|---|---|
| `--shadow-sm` | Resting card | none (surface-elevated alone) | none |
| `--shadow-md` | Hover card | hairline border darkens to `--color-border-strong` | same |
| `--shadow-lg` | Drawer, modal | hairline `--color-border-strong` + scrim | hairline + scrim |
| `--shadow-focus` | Focus ring | 2px ring `--color-accent` at offset 2px | 2px ring at offset 2px |

The single deliberate exception: keyboard-focused rec card gets a 2px `--color-accent-sharp` ring at 2px offset — a "marked" feel that earns the visual weight.

### 2.7 Motion

| Token | Duration | Easing | Use |
|---|---|---|---|
| `--motion-fast` | 150ms | `ease-out` | Pill press, hover color, chip toggle |
| `--motion-base` | 250ms | `cubic-bezier(0.22, 0.61, 0.36, 1)` | Drawer slide, tab content fade |
| `--motion-slow` | 520ms | `cubic-bezier(0.22, 0.61, 0.36, 1)` | Signature `ink-in` rec-card reveal |

**`prefers-reduced-motion`:** all three durations collapse to **0ms**; transitions become instant state swaps; signature `ink-in` is skipped (cards appear opaque, no translate, no blur); skeleton shimmer becomes a static striped fill. See §8 for the full motion-language detail.

---

## 3. Background atmosphere

The aesthetic explicitly forbids plain `#FFF`/`#000` flats. Three non-flat treatments rotate by surface role:

```css
/* (1) Rec list view — subtle 12-column "column rules" + paper noise */
.bg-page {
  background-color: var(--color-surface);
  background-image:
    repeating-linear-gradient(
      to right,
      transparent 0 calc(100% / 12 - 1px),
      var(--color-border) calc(100% / 12 - 1px) calc(100% / 12)
    ),
    url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2' seed='3'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.025 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
  background-blend-mode: multiply;
}

/* (2) Login card — letterpress feel: cream with a faint masthead rule */
.bg-login {
  background: radial-gradient(120% 80% at 50% 0%,
    color-mix(in oklab, var(--color-surface) 92%, var(--color-accent) 8%) 0%,
    var(--color-surface) 60%);
}
.bg-login::after {
  content: ""; height: 2px; background: var(--color-accent);
  display: block; width: 64px; margin: 0 auto;
}

/* (3) Empty states — wide-spaced dot pattern, like printer's register marks */
.bg-empty {
  background-color: var(--color-surface);
  background-image: radial-gradient(
    circle at center,
    color-mix(in oklab, var(--color-text-muted) 60%, transparent) 1px,
    transparent 1.5px
  );
  background-size: 28px 28px;
}
```

The 12-column rule pattern in (1) is **barely visible** (10–12% opacity) — present at peripheral attention, invisible when reading a card. All three treatments are static (reduced-motion safe).

---

## 4. Atomic component inventory

Format: **Name** — purpose. *Variants/props.* States. A11y notes.

### 4.1 Atoms

- **Button** — primary text action. *`primary` | `secondary` | `ghost` | `danger`. Sizes `sm` | `md` | `lg`. Optional `leadingIcon`/`trailingIcon`.* States: default, hover, focus-visible, active, disabled, loading (spinner replaces label, `aria-busy`). A11y: native `<button>`, real `disabled` attr.
- **IconButton** — icon-only action (overflow menu, drawer close X, +1/-1 season). *Sizes `sm` (32px) | `md` (44px touch-min).* States as Button. A11y: **mandatory** `aria-label`.
- **Pill** — small toggleable affordance. *`vote` (exclusive within VotePillGroup), `filter` (multi-select), `genre` (display-only or filter), `platform` (display-only).* States: default, hover, focus-visible, selected (paired with icon/check), disabled. A11y: `<button aria-pressed>` for toggles; display-only renders as `<span>`.
- **Chip** — compact metadata tag. *`platform` (with provider icon), `genre`, `badge`.* States: default, hover (if clickable), disabled. A11y: `<span>` unless clickable.
- **Input** — single-line text. *`default`, `search` (leading icon + clearing X).* States: default, hover, focus-visible, filled, error (red border + helper text), disabled. A11y: associated `<label>`, `aria-invalid` + `aria-describedby`.
- **Textarea** — notes on WatchEntry, MoodInput. Same states/A11y as Input. `resize-y` only.
- **Select** — native `<select>` styled to system; swap to Radix `Select` if M3+ needs custom items. Same states/A11y as Input.
- **Avatar** — user initial / image. *Sizes `sm` (24px), `md` (32px in IdentityChip), `lg` (48px in switch dialog).* Identity chips render as **printer's-mark monograms** (see §9.3). A11y: `<img alt>` or `aria-label` for initial fallback.
- **Badge** — inline status pill. *`unavailable` ("Unavailable on your subscriptions"), `watched` ("Watched"), `caveat` ("Per TMDb — may change"), `count` ("+N more").* Display-only `<span>` with icon + text (state-not-color).
- **Skeleton** — loading placeholder. *`text`, `block`, `card`, `poster`.* Slow horizontal "wipe" of paper-noise texture, 1400ms cycle, very low contrast. Reduced-motion: static striped fill. A11y: `aria-hidden="true"` (parent sets `aria-busy="true"`).
- **Spinner** — inline loader (autocomplete in-flight). A11y: `role="status"` + visually-hidden "Loading."
- **FocusRing** — utility, not a component. Tailwind: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-surface)]`. Expose as a `focus-ring` plugin shorthand.

### 4.2 Molecules

- **VotePillGroup** — three pills (Agree / Disagree / Maybe), exclusive. *Props: `value`, `onChange`, `canVote` (false → renders read-only per PRD §6.4.4 list-owner rule), `partnerVote?` (display-only sibling chip, Co-watch only, M4 Phase 25), `partnerLabel?` (e.g. "Jaimie"), `isContinuation?` + `inWatchHistory?` (together gate the Disagree-on-continuation prompt — M4 Phase 27).* When `canVote === false`, pills render with `disabled` + 60% opacity and a "Only the list owner can vote here" tooltip; `aria-pressed` still reflects the owner's selection so AT users see the value, just can't change it. When `partnerVote` is set, a bordered "{partnerLabel}: {Vote}" chip renders inline beside the pills using accent/danger/border tints for agree/disagree/maybe — no interaction. When Disagree is clicked on a card with `isContinuation && inWatchHistory`, a Radix Dialog opens ("Step back from "{title}"?") with **Move to Paused** (outline button), **Move to Dropped** (danger button), **Cancel** — the vote is only persisted via `disagreeOnContinuationAction` after the user picks an outcome. A11y: `role="group"` with `aria-label="Vote on {title}"` (active) or `"{title} vote (read-only)"` (disabled); active pills use `aria-pressed`; arrow keys move selection when active.
- **PlatformChipRow** — top-N platform chips + "+N more". *Props: `platforms`, `max=2` (compact) | `max=Infinity` (expanded), `unavailable?`.* Overflow trigger expands inline. A11y: `<button aria-expanded>`.
- **StatusSelect** — 5-status picker (Want / Watching / Paused / Completed / Dropped). *Props: `value`, `onChange`, `compact?` (icon-only on mobile).* Each status paired with an icon. A11y: Radix Select or native; aria-label per status.
- **SeasonStepper** — -1 / current / +1 control. *Props: `current`, `total?`, `onChange`.* States: -1 disabled at S1; +1 disabled at total. A11y: two `<button>` with `aria-label`; current value in a `<span aria-live="polite">`.
- **MoodInput** — single-line free-text "something light tonight" field. *Props: `value`, `onChange`, `persistsAcrossFailures: true`.* State held at the Recommendations route level so rec-gen failures don't lose it (PRD §6.4.7). Cleared only on `runStatus === "succeeded"` or explicit user clear. A11y: associated label "Mood for this refresh (optional)."
- **FilterChipGroup** — multi-select chip set per facet (platform / genre; status / whose-pick are deferred per PRD §6.4.6). *Props: `facet`, `options`, `selected[]`, `onChange`.* On /recs the group lives inline above the list (a single bordered section with one row per facet + a Clear button); URL state via `?platform=…&genre=…`. The persistent FilterRail / FilterSheet variants are deferred — the inline row covers both breakpoints adequately for M3c. A11y: `role="group"` with `aria-label` naming the facet; each chip is `<button aria-pressed>`.
- **IdentityChip** — current user monogram; tap opens a Radix `DropdownMenu` with three items: **Settings** (link to /settings), **Switch user** (opens the Radix Dialog with passcode entry — the same flow as before), **Log out** (calls `logoutAction`). *Props: `currentUser`.* See §9.3 for visual treatment. A11y: trigger `<button aria-label="Signed in as Corey. Open user menu."/>`; menu items as `role="menuitem"`.
- **SearchInput** — TMDb-debounced search (200ms per PRD §6.6.2). *Props: `value`, `onChange`, `onSelect(result)`, `loading`.* States: default, focus, loading (inline spinner), error ("Search unavailable — try again" inline). A11y: `role="combobox"` with `aria-expanded` + `aria-controls`.

### 4.3 Organisms

- **RecCard** — see §5.1. Compact + expanded × mobile + desktop.
- **InProgressEntry** — row for a `Watching` show. Poster thumb, title, current season, episodes-remaining indicator, production-status line w/ "may change" caveat, "Unavailable" badge if applicable, SeasonStepper, **Resume/Done toggle**, "Finished it" Button. States: default, hover, focus-within. A11y: row inside `<ul role="list">`.
- **Resume/Done toggle** — single button that flips `currentSeasonCompleted`. Visual treatment tracks **action polarity, not toggle state**: "Done with S{n}" (forward action when mid-season) renders filled-accent like a CTA; "Resume S{n}" (backward action when the season's marked finished) renders outline / neutral so it doesn't read as the inviting next step. `aria-pressed` still reflects the toggle state honestly for AT.
- **WatchHistoryRow** — full-history list row. Title, poster, status pill, rating, plus two IconButtons in the right-side rail: an **Edit** pencil (opens the edit dialog) and a **Remove** trash. Remove opens a Radix Dialog confirm with copy that spells out the neutral semantics — *"Removes this show from your list with no signal either way — it can still be recommended in the future."* — to distinguish it from the negative-signal `Dropped` status (PRD §6.3). Same row-pattern A11y as InProgressEntry.
- **ShowDetailPanel** — see §5.2. Drawer + full-page variants; rec-context overlay adds long LLM explanation + VotePillGroup.
- **RefreshHeader** — see §5.3. Timestamp + Refresh Button + MoodInput + nav pill state.
- **FilterRail** (desktop) — persistent left/right rail, scrollable on overflow, sticky relative to rec list. A11y: `<aside aria-label="Filters">`.
- **FilterSheet** (mobile) — bottom-sheet variant. Triggered by a "Filters" Button in the header. Radix `Dialog` styled as bottom sheet, swipe-down close. A11y: focus trap, Esc closes, scroll restored on close.
- **NavBar** — see §5.4. Mobile bottom tabs + top header; desktop top nav + secondary tab row inside Recs.
- **LoginCard** — passcode entry. Identifies user (Corey or Jaimie), prompts shared-secret, submits to set HTTP-only cookie. States: default, submitting, error ("Incorrect passcode"). A11y: form with `<label>`, autofocus, `aria-describedby` for error.
- **SubscriptionEditor** — toggle list of streaming platforms. On change, runs `toggleSubscriptionAction` then fires a background rec-gen through the layout `RefreshProvider` (PRD §6.4.7 auto-refresh). The layout pill activates immediately so the user sees a refresh is running even while still on /settings. A11y: each platform is a `<button aria-pressed>` toggle.
- **BudgetStatusCard** — surfaces the current month's logged Anthropic spend against the PRD §10 cap. Three visual states keyed to `BudgetStatus.state` from `lib/llm-budget.ts`: `ok` (accent-tinted progress bar, "On budget" check), `warning` at ≥75% (yellow, "Slow down"), `exceeded` at ≥100% (danger red, "Cap reached — refresh paused"). Always includes a "Resets at the start of next month (UTC)" footnote. The card is read-only; the budget gate itself lives in `generateRecommendations` so a partner navigating without /settings open still gets the typed `budget_exceeded` refresh failure.
- **EmptyState** — generic, configurable. *Props: `title`, `description`, `actionLabel`, `actionHref` | `onAction`, `illustration?`.* Used by the 5 empty contexts in PRD §6.6.1. Illustrations: woodcut-line glyphs in `--color-text-muted` (see §9.2).
- **DisagreesInspector** — collapsible "Buried disagrees" panel rendered at the bottom of the viewer's own user-scoped Picks tab (M4 Phase 28). Surfaces every show the viewer has Disagreed on with a tiny poster thumb, the title, and a "Bring back" pill that calls `clearOwnVoteOnShowAction(showId)` to delete the vote. Optimistic removal from the list on click. Dashed-border container, collapsed by default (header reads "Buried disagrees (N)" with a caret). Only renders when `viewerUsername === active scope` so the partner doesn't see the owner's hidden picks.

---

## 5. Key organism specs

### 5.1 RecCard

Two presentations (compact / expanded) × two breakpoints (mobile / desktop).

#### Compact — Desktop (>768px)

```
[poster 96x144] | Title (Fraunces italic) — TMDb rating       [More v]
                | Top-2 platform chips · +N more
                | "Short LLM explanation, ≤100 chars."  (Chivo 500)
                | [AGREE] [DISAGREE] [MAYBE]  Partner: [AGREE] (M4+)
                | [Add to Want to Watch]
```

- Poster: `--radius-md`, 96×144 (2:3), 1px `--color-border` hairline frame. Tappable → opens ShowDetailPanel.
- Title: `text-lg`, Fraunces 500 italic, single line, truncate with full-text `title` attribute.
- "More" affordance: ghost IconButton with chevron; expands the card **inline** (no route change).
- VotePillGroup + "Add to Want to Watch" live in the same footer row, **never collapsed** on desktop.
- Hover: 1px `--color-accent-sharp` underline draws under the title, left-to-right, 220ms. Poster does a `rotate(-0.5deg) translateY(-2px)` (220ms ease-out). Card itself does not lift or shadow.

#### Compact — Mobile (≤768px), 375px width — poster-first hero

```
[ Poster, full card width, 2:3, 1px hairline frame                      ]
[ Title (Fraunces italic) — ≤2 lines, text-base                         ]
[ [AGREE] [DISAGREE] [MAYBE]    [More v]                                ]
```

- Vote pills + "More" are the **only** affordances on the compact mobile card.
- Platform chips, partner vote, LLM explanation, and "Add to WTW" appear only on expand.
- *(Flagged ambiguity — see §12.)* Mobile compact hides the short LLM explanation, which is the rationale users need to vote.

#### Expanded — both breakpoints

Adds in order: long LLM explanation (≤300 chars), seasons/episodes count, all genre chips, all platform chips, trailer link, "Add to Want to Watch" (mobile only — desktop already has it in compact), and a "Less ^" affordance.

#### States

| State | Treatment |
|---|---|
| Default | `--color-surface-elevated`, 1px `--color-border` |
| Hover (desktop) | Border darkens to `--color-border-strong`; title underline + poster tilt |
| Focus-within | 2px `--color-accent-sharp` ring at 2px offset |
| Stale (during rec-gen) | `opacity: 0.5`, `pointer-events: auto` — votes still recordable on stale cards (PRD §6.4.7) |
| Continuation rec | Small "Continuing" Badge near title; Disagree opens prompt (M4+, PRD §6.4.4) |
| Unavailable on subs | "Unavailable on your subscriptions" Badge under chips; poster gets duotone filter (see §9.4) |
| Vote pills — read-only (partner viewing owner's tab) | Pills render with `disabled` + 60% opacity, `cursor: not-allowed`. The active selection still reads `aria-pressed="true"` so AT confirms the owner's pick. Tooltip on each pill: "Only the list owner can vote here." See PRD §6.4.4. |
| Already on user's list | "Add to Want to Watch" button is replaced by an inline "On your list" tag (Check glyph + Chivo small caps). Continuations skip the WTW button entirely. |
| Entrance animation | `ink-in` (see §8) on first paint after rec-gen |

#### A11y

- Wrapper: `<article aria-labelledby="rec-{id}-title">`.
- Poster + title each tappable; only the title is announced. Poster is `aria-hidden="true"` to avoid duplicate AT output.
- VotePillGroup gains `aria-describedby` pointing to the partner-vote indicator when M4 ships.

### 5.2 ShowDetailPanel

Per PRD §6.6.

#### Current shape (Phase 20) — full-page route only

- Reached via direct route push (`/show/[tmdbId]`) from RecCard poster/title; full-page framed by the app shell. Optional `?recItem=N` adds the rec-context section.
- **Back affordance:** persistent "Back to recs" link at the top-left of the main content. Browser back also works.
- **Layout (vertical):** Title (Fraunces 700) + optional Continuation badge → poster + metadata grid (TMDb rating, genres, season-count split, status with caveat, trailer link) → Where-to-watch chip row with "Not on your subscriptions" badge → optional rec-context block (long LLM explanation + VoteControlsRow) → "About the show" block (TMDb `overview`, displayed verbatim, with a small "Source: TMDb" attribution underneath) → "Your list" read-only summary with pointer to dashboard for edits.

#### Drawer + parallel-route variant (Phase 20b, deferred)

- **Desktop (>768px):** right-side panel, ~480px wide, slides in from right (`--motion-base`, 240ms ease-out). No scrim — list stays scannable. Originating list scroll position preserved.
- **Mobile (≤768px):** bottom sheet, full width, top-anchored at ~85vh. Slides up from below (`--motion-base`). Drag handle at top edge, `--radius-xl` top corners. Swipe-down close threshold: >40% sheet height OR velocity > 0.5; below threshold snaps back. Scrim `--color-surface-overlay` at appropriate alpha; tap-to-close.
- **Focus management:** on open focus moves to drawer close IconButton, Radix `Dialog` traps. On close restores focus to the originating card (`document.activeElement` snapshot) and `scrollY`.

#### Inline-edit affordances (Phase 20c — shipped)

`ShowDetailWatchControls` renders inside the "Your list" section. Two states:

- **Empty:** "Not on your list yet. Add it as…" + a row of 5 quick-add status pills (Want to Watch / Watching / Paused / Completed / Dropped). Click fires `addWatchEntry`; Watching auto-seeds `currentSeason: 1`.
- **Populated:** Status pill row (active pill filled-accent, others outline). Season stepper (− S{n} +, capped at the show's `airedSeasons`) renders only for Watching/Paused. Rating pills (Like / Dislike / Meh — click again to clear). A separate `Remove` button at the bottom-right opens a confirm dialog ("Removes this show from your list with no signal either way") matching the WatchEntryCard pattern.

All edits auto-save inline (no Save/Cancel buttons) and trigger `router.refresh()` so the server-rendered page picks up new state. Inline error message appears below if an action fails.

#### Rec-context variant

Opened with `?recItem=N`. Adds at the top: long LLM explanation (≤300 chars) inside its own section, plus the VoteControlsRow (same component the RecCard uses) carrying vote pills + "Add to Want to Watch". Pill `canVote` honors the Phase 15.1 ownership rule.

### 5.3 RefreshHeader + rec-gen flow

Anchors the top of the Recommendations view (PRD §6.4.7).

Desktop layout:
```
[Refresh] · Generated 4 hours ago · [Mood input ____________________]
                                                          [pill state]
```

Mobile: wraps to two rows; MoodInput drops to its own row.

#### Latency / error states

| Window | UI state |
|---|---|
| Idle | Refresh button (primary), timestamp, MoodInput empty/filled. Nav pill: hidden. |
| 0–30s (pending) | Refresh disabled + spinning; stale list dimmed `opacity: 0.5`; skeleton RecCards (3 stacked) appear above stale list inside a `border-dashed` section labelled "Generating new recommendations…"; nav pill shows "Refreshing recommendations…" with a spinning glyph (see §9.1 for the pill's personality). |
| 30–60s (long_running) | Inline note adjacent to skeletons: "Taking longer than usual — the LLM is busy. Hang tight." Nav pill copy switches to "Still generating…" |
| 60s (timed_out) | Skeletons replaced by error card with the typed timeout message + **Retry** and **Dismiss** buttons. Stale list **remains** dimmed-but-visible below. Server action keeps running; stale results are dropped via an invocation token. |
| Error (failure code) | Error card with the folded SDK message + Retry / Dismiss; layout pill switches to "Refresh failed" (danger border). |
| Success | Layout pill briefly switches to "Recs updated — view" (Check glyph) for ~4s, then disappears. Inline error/timeout card is cleared. |
| Transient errors | Anthropic SDK auto-retries once (PRD §6.4.7); on second failure surface the error card. Rate-limit responses propagate directly. |
| Off-page during refresh | Nav pill stays in the layout header so a refresh fired from /recs is still observable from /settings, /in-progress, etc. (PRD §6.4.7 "navigate freely"). |

#### Skeleton card spec

- Same dimensions as a real RecCard (compact variant per breakpoint).
- Shapes: poster block, two text bars (title, short explanation), three pill blocks, one button block.
- Animation: slow horizontal "wipe" of the paper-noise texture, 1400ms cycle, very low contrast (`--color-border` → `--color-border-strong`).
- **Reduced-motion:** static diagonal stripe pattern at low contrast (`motion-reduce:animate-none motion-reduce:bg-[striped-pattern]`).

#### Mood input persistence

State lives at the Recommendations route level, not inside RefreshHeader, so unmount/remount during rec-gen failures preserves it. Cleared only on `runStatus === "succeeded"` or explicit user clear.

### 5.4 NavBar

Per PRD §6.1 + §7.2.

#### Current shape (M3c — fixed top header)

**Top-left:** the Next on Wembley logo (the house line drawing) as a `Link` to `/`. Universal home affordance — replaces the per-page "Back to list" arrow links that used to anchor /recs, /in-progress, and /settings. Rendered as an inline-SVG React component (`src/components/logo.tsx`) so the strokes use `currentColor` — set the wrapping link's `text-…` class and the logo follows the theme without a CSS filter. The wrapper carries the same `bg-surface-elevated border border-border-strong rounded-sm px-3` treatment as the icon buttons across the top so it stays self-contained against content scrolling underneath (it's `position: fixed`). Wrapper is `h-10`; the SVG inside is `h-8` with horizontal padding for breathing room. The login card uses the bare logo (no badge) at `h-40` / `sm:h-48` since there's no scroll-overlap concern on a centered hero.

**Top-right:** three icon controls + IdentityChip, anchored on every authenticated page:

1. **In-Progress** (FilmReel) — leftmost, the most-used affordance day-to-day.
2. **Recommendations** (Sparkle).
3. **IdentityChip** — dropdown menu (Radix `DropdownMenu`) carrying **Settings**, **Switch user** (opens the existing passcode dialog), **Log out**. Settings no longer has its own header icon — it lives behind the avatar to keep the rail at three slots.

`RefreshIndicator` slots ahead of the icon row when an in-flight refresh is active (PRD §6.4.7). The Show Detail page keeps its own contextual "Back to recs" affordance since the logo jumps to the dashboard root, not to the originating list. The deferred Mobile bottom-tab-bar + Desktop top-nav-row layouts below remain the longer-term target.

#### Mobile (≤768px) — deferred bottom-tab variant

- **Top header (fixed):** masthead "Next on Wembley" (left, Fraunces 700, smaller than the list-page title), IdentityChip (right), overflow IconButton (kebab) for Watch History / Search / Settings. `safe-area-inset-top` padding.
- **Bottom tab bar (fixed):** three primary tabs — **Co-watch** (default) / Corey / Jaimie. Each tab is 44×44px min, icon + label, active state uses a 2px `--color-accent-sharp` indicator bar above the tab + `aria-current="page"`. `safe-area-inset-bottom` padding to clear the home indicator.
- **Co-watch tab subtitle:** Co-watch gets a Fraunces italic subtitle beneath its label — *"This week, together."* The other two tabs (Corey / Jaimie) show the user's monogram mark in line with the label, no subtitle. Subtle enough not to break tab symmetry; specific enough that Co-watch reads as the front page.
- **Pre-M3 note (PRD §7.2):** before rec lists ship, the bottom tab bar surfaces History / Search / Settings as the primary triad. *(Flagged — see §12.)*

#### Desktop (>768px)

- **Top nav (fixed):** masthead left, primary nav links (Watch History / Recommendations / Search / Settings — center or left-aligned), IdentityChip right.
- Within the Recommendations route, a secondary tab row sits below: Co-watch / Corey / Jaimie (Radix `Tabs`).
- Active link uses a 2px `--color-accent-sharp` underline + `aria-current="page"`.

#### A11y

- `<nav aria-label="Primary">` wraps the primary navigation.
- Tabs are `role="tab"` inside `role="tablist"` (Radix `Tabs`).
- IdentityChip per §4.2.

---

## 6. Responsive matrix

| Aspect | Mobile (≤768px) | Desktop (>768px) |
|---|---|---|
| Primary nav | Bottom tab bar (3 rec tabs) + top header w/ overflow | Top nav + secondary tabs inside Recs |
| RecCard | Poster-first hero; compact = poster + title + votes + More | Standard compact: poster | title + meta + chips + votes + More + WTW |
| Filters | Bottom sheet behind "Filters" Button | Persistent FilterRail |
| Show Detail | Bottom sheet drawer (or full page on cold) | Right-side drawer, no scrim (or full page on cold) |
| Touch target floor | 44×44px on all interactive controls | 32×32px acceptable for non-touch-primary controls |
| Safe-area insets | `env(safe-area-inset-top/bottom)` on header + tab bar | n/a |
| Scrim under drawer | Yes (tap-to-close) | No (drawer is side panel) |

Breakpoint implementation: Tailwind's default `md:` prefix marks the desktop boundary at 768px.

---

## 7. State patterns

### 7.1 Loading (PRD §6.6.2)

Show skeleton **only** if operation expected to exceed 200ms.

| Context | Skeleton |
|---|---|
| Watch History first load | `WatchHistoryRowSkeleton` × N |
| Show Detail open | `ShowDetailSkeleton` (poster + 3 text bars + chip row + button row) |
| In-Progress first load | `InProgressEntrySkeleton` × N (row + season stepper block + status block) |
| Rec-gen | `RecCardSkeleton` × ~10 — see §5.3 |

TMDb autocomplete: inline `Spinner` in `SearchInput`; 200ms debounce on keystroke. In-memory filtering / cached data: **no indicator** (avoid spinner flicker). Set `aria-busy="true"` on the parent list/region.

### 7.2 Empty (PRD §6.6.1)

All empty states use the `EmptyState` organism. CTA pattern: action verb + link target. Each gets a woodcut-line illustration (see §9.2).

| Context | Title | CTA | Illustration |
|---|---|---|---|
| Watch History (zero) | "Add your first show" | "Search shows" → focuses SearchInput | TV antenna with single rabbit ear |
| In-Progress (none) | "Nothing on the air just yet." | "See your Picks" → /recs | empty armchair, lamp on |
| Rec list (pre-first-gen) | "Not enough history yet" | "Add shows you've watched" → /history | stack of paperbacks |
| Filtered rec list (zero) | "No recommendations match these filters." | "Clear filters" → clears active chips | crossed-out reading glasses |
| Co-watch (asymmetric signal) | (inline note above recs, not full empty state) "Co-watch gets stronger as {partner} adds more shows." | — | — |
| Co-watch (both insufficient) | "Co-watch needs more from both of you." | "Add shows you've watched" → /history | pair of armchairs facing the same direction |

### 7.3 Error (PRD §6.6.3)

Pattern: **inline error with Retry, never block the screen.**
- TMDb autocomplete fails → "Search unavailable — try again" under input; input stays usable.
- Show Detail fetch fails → error card inside the drawer with Retry; drawer stays open.
- Provider data missing on a rec → platform-chip area renders "Availability unknown" chip; rest of card normal.
- Rec-gen errors → handled by RefreshHeader (§5.3).

### 7.4 Partial data (PRD §6.6.4)

Pattern: **hide missing fields silently; show only what we have.**
- No trailer → trailer link hidden, no placeholder text.
- No poster → render default poster (genre-tinted block with Fraunces 700 title overlay, two lines max, `--color-accent-fg` ink, a faint horizontal column-rule beneath the title).
- Provider data missing → "Availability unknown" chip in place of platform chips.
- Production status null → hide the status line on InProgressEntry.
- Total episode count null on ongoing → "Season X, ongoing" without remaining-episode count.

---

## 8. Motion language

### 8.1 Signature moment — "ink-in" rec reveal

When new recs land, the dimmed stale list fades out as the new column of cards **rises and inks in** — each card translated up 12px, faded from 0 → 1, with a staggered `animation-delay`. It feels like ink hitting paper, top-to-bottom — the way a freshly-printed page is read.

```css
@keyframes ink-in {
  from { opacity: 0; transform: translateY(12px); filter: blur(2px); }
  to   { opacity: 1; transform: translateY(0);    filter: blur(0); }
}

.rec-card {
  animation: ink-in 520ms cubic-bezier(0.22, 0.61, 0.36, 1) both;
}

/* Stagger by position — 60ms steps */
.rec-list > .rec-card:nth-child(1)  { animation-delay:   0ms; }
.rec-list > .rec-card:nth-child(2)  { animation-delay:  60ms; }
.rec-list > .rec-card:nth-child(3)  { animation-delay: 120ms; }
.rec-list > .rec-card:nth-child(4)  { animation-delay: 180ms; }
.rec-list > .rec-card:nth-child(5)  { animation-delay: 240ms; }
.rec-list > .rec-card:nth-child(6)  { animation-delay: 300ms; }
.rec-list > .rec-card:nth-child(7)  { animation-delay: 360ms; }
.rec-list > .rec-card:nth-child(8)  { animation-delay: 420ms; }
.rec-list > .rec-card:nth-child(9)  { animation-delay: 480ms; }
.rec-list > .rec-card:nth-child(10) { animation-delay: 540ms; }
/* Total reveal: ~1.1s for 10 cards — feels like reading down a column */
```

### 8.2 Small moments worth keeping

- **Vote-pill press:** 120ms compression (`scale(0.96)`), pill "blooms" from outline-only to filled. Releases on `:active` end.
- **"Add to Want to Watch" confirmation:** button label crossfades to "Added — *{Show Title}*" for 1.8s, then reverts. **No toast.**
- **Rec-card hover (desktop only):** 1px `--color-accent-sharp` underline draws under the title, left-to-right, 220ms; poster nudges with `rotate(-0.5deg) translateY(-2px)`.
- **Drawer open/close:** 240ms ease-out slide (right panel on desktop, bottom sheet on mobile).
- **Skeleton "wipe":** slow horizontal sweep of paper-noise texture, 1400ms cycle.
- **Like / Dislike / Meh stamp press:** 90ms scale-down on press, like a real rubber stamp.

### 8.3 `prefers-reduced-motion`

```css
@media (prefers-reduced-motion: reduce) {
  .rec-card  { animation: none; opacity: 1; transform: none; filter: none; }
  .vote-pill { transition: none; }
  .drawer    { transition: none; } /* drawer becomes instant */
  .skeleton  { background-image: none; background-color: var(--color-surface-overlay); }
}
```

Everything becomes **instant**. Skeletons remain (still useful for layout) but the wipe stops. Vote-pill press still re-colors, just without scale tween. Hover underline/tilt → none.

---

## 9. Delight moments

Five places where the aesthetic shows up beyond the palette. These ship in M3+ unless noted otherwise.

### 9.1 The "Refreshing recommendations…" pill — letterpress press run

Instead of a spinner, the pill shows a JetBrains Mono caption with a moving printer's-rule character: `[ ━━ Composing column ━━ ]`. The middle text rotates through 4 phrases at ~3s each (no jitter):

1. *"Composing column"*
2. *"Setting type"*
3. *"Inking the page"*
4. *"Reading proofs"*

When done, it becomes `[ Edition ready — view ↗ ]` in `--color-accent-sharp`. Marquee-free; transition is a slow text crossfade. Affectionate, not cute.

### 9.2 Empty-state illustrations — woodcut-line drawings

Single-weight (1.5px) line-art SVG glyphs in `--color-text-muted`, drawn as if printed (no fills, no anti-aliasing tricks, faint texture). Each empty state has its own glyph (see §7.2 table). Beneath each: a Fraunces-italic caption + Chivo 14px helper line + a single Button.

### 9.3 Identity chips — printer's-mark monograms

Each user gets a small square mark instead of a generic circular avatar:
- **Corey** → embossed serif **C** in `--color-accent`-on-cream (light) / cream-on-`--color-accent` (dark), with the underline rule.
- **Jaimie** → same treatment with **J**.

Same typographic family, never the same color simultaneously. When both appear on a Co-watch partner-vote row, they read as **two bylines**, not two emoji.

### 9.4 Co-watch as the cover story

Co-watch is the only one of the three rec tabs with a Fraunces italic subtitle beneath its label: *"This week, together."* The other tabs (Corey / Jaimie) show the user's monogram mark in line with the label, no subtitle. Subtle, but Co-watch reads as the front page.

### 9.5 The Wembley Easter egg on login

The login masthead shows "**Next on Wembley**" in Fraunces 900. Hovering or long-pressing the word "Wembley" for >1s reveals a small footnoted aside in JetBrains Mono beneath it:

> `¹ [a quiet borough, a louder cat, depending on whom you ask]`

Stays for 4s, then fades. No tooltip chrome, no link — a printed marginal note.

### 9.6 Like / Dislike / Meh as editorial stamps

Replace thumbs with three small ink-stamp glyphs, always paired with a text label below (preserves §7.1 no-color-alone):

- **Like** → circled star (`✶` in a hairline circle), `--color-vote-agree`
- **Dislike** → slashed circle (`⊘`), `--color-vote-disagree`
- **Meh** → half-filled circle (`◐`), `--color-vote-maybe`

Stamps "click into place" with a 90ms scale-down on press.

---

## 10. Iconography & poster treatment

### 10.1 Icons

- **Library:** **Phosphor** (`@phosphor-icons/react`), `regular` weight by default. Phosphor's slightly humanist curves match Chivo + Fraunces better than Lucide's geometric grid.
- **Active/selected:** `bold` weight.
- **Duotone:** reserved for empty-state hero glyphs only.
- **Default stroke:** 1.5px at 20px size; 1.75px at 24px.
- **Sizing scale:** 14 / 16 / 20 / 24 / 32 — matches the 4px grid. Never 18 or 22.

### 10.2 Posters

Posters are the loudest visual element. Aesthetic frames them as **art plates in a printed feature**, not thumbnails in a grid.

- **Aspect & sizing.** Native TMDb 2:3 always. Mobile poster-first card: 100% card width, `--radius-md`, 1px `--color-border` hairline. Desktop compact: 96×144px on the leading edge.
- **Hard borders, no shadow.** Single 1px `--color-border` hairline frames every poster — the "matte" of a printed plate.
- **Hover tilt (desktop only).** `rotate(-0.5deg) translateY(-2px)`, 220ms ease-out. Reduced-motion: none.
- **Duotone for unavailable.** Shows carrying the "Unavailable on your subscriptions" badge get:
  - Light: `filter: grayscale(0.6) sepia(0.15)` (warms toward cream)
  - Dark: `filter: grayscale(0.6) brightness(0.85)`
  Poster stays legible — *availability* is what's muted, not the show. Paired with the textual Badge.
- **Dark-mode global desaturation.** Apply `[data-theme="dark"] .poster img { filter: saturate(0.92) brightness(0.96); }` to prevent the "neon billboard in a dark room" effect.
- **Missing-poster fallback (PRD §6.6.4).** `--color-accent`-tinted 2:3 block with Fraunces 700 show title (two lines max, centered, `--color-accent-fg`), faint horizontal column-rule beneath title.

---

## 11. Accessibility implementation

Anchored to PRD §7.1. Concrete Tailwind / library guidance.

- **Focus ring.** Compose `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-surface)]` on all interactive elements. Expose via a Tailwind plugin shorthand `focus-ring`.
- **Reduced motion.** Apply `motion-reduce:transition-none motion-reduce:animate-none` on every animated element; pair with static fallback for skeleton.
- **Toggle pills.** `<button aria-pressed={selected}>` on vote pills and filter chips. Selected state pairs background color with a check icon, underline, or inset border — never color alone.
- **Icon-only controls.** Mandatory `aria-label`. Examples: `"Open show details"`, `"Decrease current season"`, `"Close show details"`.
- **Drawer / modal.** Use **Radix UI `Dialog`** — gives focus trap, Esc-to-close, scroll lock, ARIA wiring for free.
  - `Dialog` → ShowDetailPanel drawer, IdentityChip switch dialog, FilterSheet, Disagree-on-continuation prompt.
  - `Popover` → overflow menus.
  - `Toggle` / `ToggleGroup` → vote pills (built-in arrow-key support).
  - `Tabs` → Recommendations sub-tabs (Co-watch / Corey / Jaimie).
- **shadcn/ui.** Recommended as a fast scaffolding layer over Radix — generates Tailwind-styled components *into* the codebase (not a runtime dep) and aligns naturally with the token system in §2.
- **Color-not-alone.** Every status, vote state, and badge token ships with an icon or text label. Enforced at the component level via prop contracts (e.g., `<Badge variant="unavailable">` always renders icon + label, no color-only mode exposed).
- **Contrast.** Verified in §2.1/§2.2: text-primary on surface clears 4.5:1 by a wide margin in both modes. Re-verify for any token added later.

---

## 12. Tailwind config + token plumbing

```ts
// tailwind.config.ts
import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: ["class", "[data-theme='dark']"],
  theme: {
    extend: {
      colors: {
        surface: "var(--color-surface)",
        "surface-elevated": "var(--color-surface-elevated)",
        "surface-overlay": "var(--color-surface-overlay)",
        border: "var(--color-border)",
        "border-strong": "var(--color-border-strong)",
        "text-primary": "var(--color-text-primary)",
        "text-secondary": "var(--color-text-secondary)",
        "text-muted": "var(--color-text-muted)",
        accent: "var(--color-accent)",
        "accent-fg": "var(--color-accent-fg)",
        "accent-sharp": "var(--color-accent-sharp)",
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        danger: "var(--color-danger)",
        "vote-agree": "var(--color-vote-agree)",
        "vote-disagree": "var(--color-vote-disagree)",
        "vote-maybe": "var(--color-vote-maybe)",
        "status-want": "var(--color-status-want)",
        "status-watching": "var(--color-status-watching)",
        "status-paused": "var(--color-status-paused)",
        "status-completed": "var(--color-status-completed)",
        "status-dropped": "var(--color-status-dropped)",
        "badge-unavailable": "var(--color-badge-unavailable)",
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        body:    ["Chivo", "ui-sans-serif", "system-ui", "sans-serif"],
        mono:    ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        pill: "var(--radius-pill)",
      },
      transitionDuration: {
        fast: "150ms",
        base: "250ms",
        slow: "520ms",
      },
      transitionTimingFunction: {
        editorial: "cubic-bezier(0.22, 0.61, 0.36, 1)",
      },
      keyframes: {
        "ink-in": {
          from: { opacity: "0", transform: "translateY(12px)", filter: "blur(2px)" },
          to:   { opacity: "1", transform: "translateY(0)",    filter: "blur(0)" },
        },
      },
      animation: {
        "ink-in": "ink-in 520ms cubic-bezier(0.22, 0.61, 0.36, 1) both",
      },
    },
  },
} satisfies Config;
```

```css
/* app/globals.css */
@import url("https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,500;9..144,700;9..144,900&family=Chivo:wght@400;500;700&family=JetBrains+Mono:wght@400;500&display=swap");

:root {
  /* …color tokens from §2.1… */
  --radius-sm: 2px;
  --radius-md: 4px;
  --radius-lg: 8px;
  --radius-xl: 20px;
  --radius-pill: 9999px;
  --motion-fast: 150ms;
  --motion-base: 250ms;
  --motion-slow: 520ms;
}

[data-theme="dark"] {
  /* …color overrides from §2.2… */
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
    /* same dark overrides as [data-theme="dark"] */
  }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0ms !important;
    transition-duration: 0ms !important;
  }
}

body {
  background-color: var(--color-surface);
  color: var(--color-text-primary);
  font-family: theme("fontFamily.body");
}
```

**Theme override (PRD §7.3).** Settings writes `data-theme="light" | "dark" | ""` to `<html>`. Empty string falls back to OS `prefers-color-scheme`. Persist via cookie so server-rendered pages don't flash the wrong theme.

---

## 13. Flagged ambiguities & open questions

Raised during this synthesis. Each is parked here pending a PRD update or an M3+ polish decision.

1. **Mobile compact rec card hides the LLM short explanation.** PRD §7.2 specifies poster-first hero on mobile with vote pills + "More" as the only affordances. The trade-off: most voting decisions require expanding the card first, because the *short LLM explanation is the rationale users need to vote*. **Suggested resolution:** add a single truncated short-explanation line (`text-xs`, 1 line, `text-overflow: ellipsis`) directly beneath the mobile title. Track as M3 polish decision; do not block M1/M2.

2. **Pre-M3 mobile bottom tab bar composition.** PRD §7.2 says "Watch History, Search, and Settings live in a secondary top-right menu" once rec lists ship, but "pre-M3 builds will surface History/Search as primary since the rec tabs have no content yet." It does not confirm whether Settings is the third slot. **Suggested resolution:** History / Search / Settings as the pre-M3 triad — keeps three slots so the layout doesn't shift when rec tabs swap in at M3.

3. **Default-poster genre-tint palette.** PRD §6.6.4 specifies a default poster as "a genre-colored block with the title text overlaid." The exact genre→hue mapping is unspecified. **Suggested resolution:** derive tint from a hash of the first genre string, constrained to a curated palette (8–10 muted aubergine-warm hues so default posters still feel like the rest of the system). Track as M3 polish.

4. **Co-watch tab subtitle ("This week, together.") on mobile** — does the subtitle fit in a 44×44px bottom-tab slot, or should it only appear on desktop? **Suggested resolution:** desktop only; mobile Co-watch tab gets the same label as the others but with `--color-accent-sharp` indicator bar pre-selected as the default tab. Track as M3 polish.

5. **Settings home for the theme override toggle (PRD §7.3).** Settings page is not specified in detail in the PRD — placement of the Light / Dark / System toggle, subscription editor, and passcode-management UI is open. **Suggested resolution:** address in a Settings-screen wireframe pass before M1 ends; not blocking for M1's foundational settings.

---

*End of v1 design spec. Aesthetic identity, design tokens, atomic inventory, organism specs, state patterns, accessibility implementation, and Tailwind plumbing are locked. Five flagged ambiguities deferred to M3 polish or a focused PRD update.*
