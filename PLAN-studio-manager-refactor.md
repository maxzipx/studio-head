# Studio Manager Refactor Plan

## Current State

`studio-manager.ts` is **2,901 lines** containing the `StudioManager` class with:
- **~40 public state fields** (cash, reputation, projects, talent, rivals, etc.)
- **3 existing service delegates** (ProjectLifecycleService, FranchiseService, RivalAiService) — thin wrappers that call `ForManager()` functions
- **~80 remaining methods** spanning talent negotiation, release/revenue, events/crises, genre cycles, awards, festivals, milestones, IP marketplace, and rival memory
- **1 monolithic test file** (`studio-manager.test.ts`, 2,333 lines) with a single `describe('StudioManager')` block

The existing pattern: domain logic lives in `*.service.ts` files as pure functions (`fooForManager(manager, ...)`), and service classes in `services/` wrap them. But the `StudioManager` class still has ~60 private methods that are just pass-throughs plus ~20 methods with inline logic that should have been extracted.

## Goal

Extract **3 new services** — TalentService, ReleaseService, EventService — following the same pattern as the existing 3, then split tests to match. The remaining StudioManager should be ~400-500 lines of state declarations, constructor, `endWeek`/`endTurn` orchestration, and thin public delegation.

---

## Phase 1: Extract TalentService

**New file:** `src/domain/services/talent.service.ts`

**Methods to move** (currently on StudioManager, lines 385–520 + 2448–2578 + 2580–2757):

| Method | Visibility | Strategy |
|--------|-----------|----------|
| `getTalentMemory` | private | delegate |
| `syncLegacyRelationship` | private | delegate |
| `getTalentTrustLevel` | public | delegate |
| `getTalentNegotiationOutlook` | public | delegate |
| `canOpenTalentNegotiation` | public | delegate (has inline logic, move it) |
| `recordTalentInteraction` | public | delegate |
| `getNegotiationChance` | public | delegate |
| `getQuickCloseChance` | public | delegate |
| `getNegotiationSnapshot` | public | delegate |
| `previewTalentNegotiationRound` | public | delegate |
| `adjustTalentNegotiation` | public | delegate |
| `startTalentNegotiation` | public | delegate |
| `startTalentNegotiationRound` | public | delegate |
| `dismissTalentNegotiation` | public | move inline logic into service |
| `negotiateAndAttachTalent` | public | delegate |
| `getAvailableTalentForRole` | public | move inline logic |
| `findNegotiation` | private | delegate |
| `defaultNegotiationTerms` | private | delegate |
| `buildQuickCloseTerms` | private | delegate |
| `readNegotiationTerms` | private | delegate |
| `normalizeNegotiation` | private | delegate |
| `demandedNegotiationTerms` | private | delegate |
| `computeDealMemoCost` | private | delegate |
| `computeQuickCloseAttemptFee` | private | delegate |
| `setNegotiationCooldown` | private | delegate |
| `talentDealChance` | private | delegate |
| `evaluateNegotiation` | private | delegate |
| `negotiationPressurePoint` | private | delegate |
| `composeNegotiationPreview` | private | delegate |
| `composeNegotiationSignal` | private | delegate |
| `finalizeTalentAttachment` | private | delegate |
| `resolveTalentPoachCrisis` | private | move inline logic (~40 lines) |
| `updateTalentAvailability` | private | move inline logic |
| `releaseTalent` | public | move inline logic (~25 lines) |
| `processPlayerNegotiations` | private | delegate |

**Talent Market methods** (lines 2580–2757, ~180 lines of inline logic):

| Method | Strategy |
|--------|----------|
| `talentCompensationValue` | move to service |
| `estimateRoleMarketComp` | move to service |
| `castCountsForProject` / `getProjectCastStatus` / `meetsCastRequirements` | move to service |
| `marketWindowDuration` | move to service |
| `isTalentMarketEligible` | move to service |
| `addTalentToMarket` | move to service |
| `addNextEligibleFromPool` | move to service |
| `ageOutExpiredMarketWindows` | move to service |
| `trickleNewMarketEntrants` | move to service |
| `populateInitialMarket` | move to service |
| `refreshTalentMarket` | move to service |

**Estimated removal from StudioManager:** ~650 lines

**Rename note:** The existing `src/domain/talent.service.ts` contains the pure `ForManager` functions. The new service class goes into `src/domain/services/talent.service.ts` (different directory), consistent with the existing pattern where `project.service.ts` (pure functions) and `services/project-lifecycle.service.ts` (class wrapper) coexist.

---

## Phase 2: Extract ReleaseService

**New file:** `src/domain/services/release.service.ts`

**Methods to move** (lines 1849–2010 + 1913–1965 + 2012–2038 + 2040–2176 + 2271–2337):

| Method | Visibility | Strategy |
|--------|-----------|----------|
| `tickReleasedFilms` | private | move (~60 lines inline logic) |
| `buildReleaseReport` | private | move (~25 lines) |
| `buildReleaseBreakdown` | private | move (~25 lines) |
| `tickMerchandiseRevenue` | private | move (~12 lines) |
| `maybeStartMerchandiseStream` | private | move (~12 lines) |
| `settleTrackingLeverage` | private | move (~16 lines) |
| `checkMilestones` | private | move (~25 lines) |
| `processAnnualAwards` | private | move (~135 lines — largest single method) |
| `resolveFestivalCircuit` | private | move (~65 lines) |
| `getLatestReleaseReport` | public | delegate |
| `getActiveMilestones` | public | delegate |
| `getProjectedForProject` | public | delegate |
| `getProjectedForProjectAtWeek` | public | delegate |
| `buildProjection` | private | move (~50 lines) |
| `estimateWeeklyBurn` | public | delegate |
| `projectedBurnForProject` | private | move |
| `applyWeeklyBurn` | private | move (~15 lines) |
| `applyHypeDecay` | private | move (~6 lines) |
| `projectOutcomes` | private | move |
| `calendarPressureMultiplier` | private | move (~12 lines) |

**Estimated removal from StudioManager:** ~500 lines

---

## Phase 3: Extract EventService

**New file:** `src/domain/services/event.service.ts`

**Methods to move** (lines 1760–1840 + 2178–2269 + 1400–1498):

| Method | Visibility | Strategy |
|--------|-----------|----------|
| `tickDecisionExpiry` | private | delegate (already calls ForManager) |
| `tickScriptMarketExpiry` | private | delegate |
| `refillScriptMarket` | private | delegate |
| `rollForCrises` | private | delegate |
| `generateEventDecisions` | private | delegate |
| `pickWeightedEvent` | private | delegate |
| `eventWeight` | private | delegate |
| `getEventArcId` | private | delegate |
| `getArcPressureFromRivals` | private | delegate |
| `getEventProjectCandidates` | private | delegate |
| `chooseProjectForEvent` | private | delegate |
| `hasStoryFlag` | public | delegate |
| `matchesArcRequirement` | private | delegate |
| `ensureArcState` | private | delegate |
| `applyArcMutation` | private | delegate |
| `applyStoryFlagMutations` | private | delegate |
| `getDecisionTargetProject` | private | delegate |
| `buildOperationalCrisis` | private | delegate |
| `resolveCrisis` | public | move inline logic (~45 lines) |
| `resolveDecision` | public | move inline logic (~45 lines) |
| `dismissDecision` | public | move (1 line) |
| `injectCrisis` | public | move (1 line) |
| `triggerGenreShock` | private | move (~35 lines) |
| `tickGenreCycles` | private | move (~55 lines) |
| `getGenreCycleSnapshot` | public | move (~15 lines) |
| `getGenreDemandMultiplier` | public | move (1 line) |
| `evaluateScriptPitch` | public | move (~30 lines) |
| `getArcOutcomeModifiers` | public | move (~70 lines) |

**Estimated removal from StudioManager:** ~400 lines

---

## Phase 4: Simplify StudioManager

After extraction, StudioManager retains:

1. **State declarations** (~70 lines) — all public fields stay on the class
2. **Constructor** (~30 lines)
3. **Computed getters** — `studioHeat`, `studioTier`, `legacyScore`, `projectCapacityLimit`, `projectCapacityUsed`, `canEndWeek` (~40 lines)
4. **Studio action methods** — `setTurnLengthWeeks`, `setStudioName`, `setStudioSpecialization`, `investDepartment`, `upgradeMarketingTeam`, `upgradeStudioCapacity`, `poachExecutiveTeam`, `signExclusiveDistributionPartner` (~120 lines)
5. **IP/Script acquisition** — `refreshIpMarketplace`, `acquireIpRights`, `developProjectFromIp`, `acquireScript`, `passScript` (~180 lines) — these could stay or become a later extraction target
6. **Orchestration** — `endWeek`, `endTurn`, `advanceUntilDecision` (~120 lines)
7. **Public delegation stubs** to all 6 services (~80 lines)
8. **Inbox/notification helpers** — `queueInboxNotification`, `dismissInboxNotification`, `addChronicleEntry` (~20 lines)
9. **Rival memory** — `getRivalMemory`, `getRivalStance`, `recordRivalInteraction`, `applyRivalDecisionMemory`, `applyRivalMemoryReversion` (~60 lines) — these stay because RivalAiService already owns the heavier rival logic

**Estimated final size:** ~700-800 lines (down from 2,901)

---

## Phase 5: Split Tests

**Current:** Single `describe('StudioManager')` in `studio-manager.test.ts` (2,333 lines).

**Target:** Split into focused test files that test each service in isolation:

| New test file | Tests |
|--------------|-------|
| `services/talent.service.test.ts` | Negotiation flows, talent market rotation, trust/memory, poach resolution |
| `services/release.service.test.ts` | Release run decay, awards season, festival circuit, milestones, merchandise |
| `services/event.service.test.ts` | Crisis resolution, decision resolution, genre cycles, genre shocks, script evaluation, arc modifiers |
| `studio-manager.test.ts` (trimmed) | Orchestration: endWeek/endTurn sequencing, bankruptcy, auto-advance, studio upgrades, IP acquisition |

Each new test file instantiates its service with a `StudioManager` (as existing services do), but tests only that service's surface area. This allows:
- Running a focused test suite when touching only one domain
- Catching regressions at the service boundary rather than through the full orchestration

---

## Execution Order & Safety

1. **Phase 1 (TalentService)** — largest extraction, most method count. Do this first because talent logic is the most self-contained (negotiation + market are internally coupled but don't touch release/events).
2. **Phase 2 (ReleaseService)** — second-largest. Awards + festivals + release resolution form a natural cluster.
3. **Phase 3 (EventService)** — mostly pass-throughs already, plus genre cycle + crisis/decision resolution logic.
4. **Phase 4 (Cleanup)** — remove dead private methods, verify no remaining inline logic that should have moved.
5. **Phase 5 (Tests)** — split test file after all services are stable.

**Each phase should be a separate commit** with green tests between commits. The public API of `StudioManager` stays identical — callers (game-store, UI components) are unaffected because all public methods remain on the class as delegation stubs.

**Risk mitigation:**
- Serialization (`persistence.ts`) reads/writes StudioManager fields directly — no impact since state fields stay on the class
- Zustand store (`game-store.ts`) calls StudioManager public methods — no API change
- UI selectors go through the store — no impact
- Each phase can be landed and reverted independently

---

## What Stays Out of Scope

- **IP/Script marketplace extraction** — `acquireScript`, `acquireIpRights`, `developProjectFromIp`, `refreshIpMarketplace` could form an AcquisitionService but they're only ~180 lines total. Not worth a dedicated service yet.
- **Rival memory methods** — `getRivalMemory`, `getRivalStance`, `recordRivalInteraction` (~50 lines). These are used by RivalAiService and EventService. Moving them would create circular dependencies. Keep on StudioManager as shared infrastructure.
- **Studio action methods** — upgrade/invest methods (~120 lines). Simple, self-contained, and rarely change. No value in extracting.
- **Dependency injection refactor** — replacing `new Service(this)` with a DI container. Useful long-term but adds complexity with no immediate test benefit.
