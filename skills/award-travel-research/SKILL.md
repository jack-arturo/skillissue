---
name: award-travel-research
description: Research award flights with mandatory live verification, optional provider-specific accelerators, normalized comparisons, and transfer-safe recommendations.
license: MIT
tags: [travel, awards, flights, miles, points, research]
agents: [codex]
category: travel
metadata:
  version: "1.1.0"
capabilities:
  network: true
  filesystem: readonly
requires-secrets:
  - name: SEATS_AERO_API_KEY
    description: Optional Seats.aero API key when the account and provider terms permit API use.
    required: false
resources:
  - path: story.md
    type: file
---

# Award Travel Research

Use this workflow for miles, points, award seats, redemptions, transfer bonuses, or comparisons between an award and a cash fare.

## Non-negotiable rule: search live inventory

Every answer about availability, price, fees, or transfer value must include a live search performed during the current task for the requested route and dates. Static tables, cached results, old screenshots, blogs, prior searches, and examples in this skill are context only.

Use the best live source available:

1. The booking program's own website or app.
2. A live award-search provider, API, or agent tool.
3. A browser or web search that reaches a current provider result.

Provider-specific tools such as an award-search wrapper or Seats.aero are optional accelerators, not prerequisites. If one is unavailable, continue with another live source. If no live source can be reached, state that current availability could not be verified, provide direct booking-program links and a verification checklist, and do not recommend a transfer.

## Inputs

Collect or infer:

- Origin and destination; prefer IATA codes.
- Departure date and optional return date.
- Passenger count.
- Cabin.
- Relevant booking programs and point balances.
- Known fallback offer, if any.
- Flexibility on dates, airports, mixed cabins, and positioning flights.

Call out any assumption that could materially change the result.

## Search workflow

1. Search the exact route, date, cabin, and passenger count live.
2. Expand to flexible dates or nearby airports only after recording the exact-search outcome.
3. Treat cached discovery results as leads until a live provider or the booking program confirms them.
4. Check the operating carrier, every segment's cabin, seat count, taxes, surcharges, and cancellation rules.
5. Check current transfer partners, transfer ratios, transfer times, and any bonus with a live authoritative source.
6. Compare against a live cash fare when making a value claim.
7. Recheck the chosen itinerary immediately before advising a transfer.

Never invent availability, infer a seat from a route schedule, or present a stale price as current.

## Transfer safety

Do not recommend transferring bank points unless a live source confirms the same:

- Route and date.
- Cabin on every relevant segment.
- Passenger count and available seats.
- Points price and taxes or fees.
- Booking program.

Explain that transfers are commonly irreversible and that availability can disappear. Name the final verification step the traveler must complete before transferring.

## Normalized result

For each option, record:

- `program`
- `points_per_person`
- `total_points`
- `taxes_fees`
- `seats`
- `cabin`
- `segments`
- `transfer_partners`
- `source`
- `checked_at`
- `confidence`
- `verification_status`

Then provide the best verified option, the best unverified lead if useful, a live benchmark comparison, the transfer-risk note, and direct next-step links.

## Historical figures are not inventory

An old route, points price, tax figure, or transfer promotion can help explain a
comparison method, but it is never a quote. Re-search every program, cash fare,
and promotion live for each request. Never claim historical availability is
still bookable or competitive without current evidence.
