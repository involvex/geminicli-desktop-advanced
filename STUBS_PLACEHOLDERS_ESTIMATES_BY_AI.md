# Audit: Stubs, Placeholders, Estimates & Erroneous Implementations

Comprehensive audit of stubs, placeholders, estimates, guesses, and erroneous implementations across the repository. Below are all identified instances with precise details and remediation guidance.

## Findings

### 1. Stub

- File: [frontend/src/lib/webApi.ts](frontend/src/lib/webApi.ts:229-258)
- Snippet:
```ts
/**
 * Temporary stub for Step 5: get project discussions.
 * Returns 4–8 mock discussions for the given projectId.
 * Remove/replace with real backend integration in a later step.
 */
export async function get_project_discussions(
  projectId: string
): Promise<{ id: string; title: string; started_at_iso?: string; message_count?: number }[]> {
  // Temporary stub for Step 5: returns mock discussions keyed by projectId
  const count = 6;
  const now = Date.now();
  const items: { id: string; title: string; started_at_iso?: string; message_count?: number }[] =
    Array.from({ length: count }).map((_, i) => {
      const started = new Date(now - i * 5 * 60_000); // every 5 min
      const id = `${projectId.slice(0, 8)}-disc-${i + 1}`;
      const title = `Discussion ${i + 1} for ${projectId.slice(0, 6)}…`;
      const base = {
        id,
        title,
      } as { id: string; title: string; started_at_iso?: string; message_count?: number };
      if (i !== 0) {
        base.started_at_iso = started.toISOString();
      }
      if (i !== 1) {
        base.message_count = 3 + (i % 5);
      }
      return base;
    });
  return items;
}
```

- **Category:** Stub
- **Rationale:** Explicitly marked "Temporary stub" and returns mock discussions rather than querying real data.
- **Potential impact or risk:** UI components may mislead users into thinking discussion data is live; future integration could require refactors in calling sites if response shape diverges.
- **Suggested action:** Replace with a real backend API that lists discussions per project; define contract in server backend and wire via REST route. Add integration tests and type contracts.
- **Recommended owner:** Full-stack dev familiar with server crate and frontend data contracts.

### 2. Placeholder

- File: [frontend/src/pages/ProjectDetail.tsx](frontend/src/pages/ProjectDetail.tsx:18-22)
- Snippet:
```ts
/**
 * Full-page Project Detail (Step 5).
 * Renders discussions for a given projectId using a temporary stub API.
 */
export default function ProjectDetailPage({ projectId }: { projectId: string }) {
```
- **Category:** Placeholder
- **Rationale:** Component explicitly states it uses a temporary stub API; content depends on stubbed data.
- **Potential impact or risk:** Page behavior diverges from production expectations; navigation might suggest a capability that is not yet implemented server-side.
- **Suggested action:** Switch to real API once implemented; add loading/error states for backend failures; document contract.
- **Recommended owner:** Frontend dev working with backend API implementer.

### 3. Placeholder

- File: [frontend/src/pages/Projects.tsx](frontend/src/pages/Projects.tsx:48-52)
- Snippet:
```tsx
<p className="mt-2 text-muted-foreground">
  All of your previous discussions with Gemini Desktop, right here.
</p>
```
- **Category:** Placeholder
- **Rationale:** Marketing-style text implies completeness; underlying data depends on logs discovered by backend, which may not represent “all” discussions if logs are missing or rotated.
- **Potential impact or risk:** UX expectation mismatch if log discovery is incomplete; support burden due to confusion.
- **Suggested action:** Adjust copy to be precise, e.g., “Projects discovered from local RPC logs”; add “last scanned” metadata; link to docs explaining data source.
- **Recommended owner:** Product/UX with frontend developer.

### 4. Estimate / Heuristic

- File: [crates/backend/src/lib.rs](crates/backend/src/lib.rs:355-365)
- Snippet:
```rs
pub fn cleanup_old_logs(&self) -> Result<(), std::io::Error> {
    let parent_dir = self.file_path.parent().unwrap();
    let cutoff_time = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
        - (30 * 24 * 60 * 60); // 30 days
    ...
}
```
- **Category:** Estimate
- **Rationale:** Magic number 30 days without configuration or documentation; arbitrary retention policy.
- **Potential impact or risk:** Unexpected deletion of logs needed for compliance/auditing; or unnecessary disk usage if not aligned to user expectations.
- **Suggested action:** Externalize retention to config (env var or settings file), document default; add unit test to verify behavior. Consider file size thresholds.
- **Recommended owner:** Backend maintainer.

### 5. Estimate / Heuristic

- File: [crates/backend/src/lib.rs](crates/backend/src/lib.rs:171-175, 835-843)
- Snippet:
```rs
"protocolVersion": "0.0.9"
```
- **Category:** Estimate
- **Rationale:** Protocol version hardcoded without negotiation; may be a guess at supported version.
- **Potential impact or risk:** Breakage when CLI changes protocol; silent incompatibilities.
- **Suggested action:** Introduce capability negotiation or fetch version from CLI; centralize protocol version constant with doc; add integration tests.
- **Recommended owner:** Backend developer integrating with Gemini CLI.

### 6. Estimate / Heuristic

- File: [frontend/src/App.tsx](frontend/src/App.tsx:691-700)
- Snippet:
```tsx
// TODO 08/01/2025: Fix this conversation history stuff.
const recentMessages = currentConversation?.messages.slice(-10) || []; // Last 10 messages
```
- **Category:** Estimate
- **Rationale:** Magic number using last 10 messages; TODO indicates a known shortcut.
- **Potential impact or risk:** Context truncation harms response quality; prompt length not tuned per model token limits; could cut off essential context.
- **Suggested action:** Replace with token-based windowing; centralize policy per model; add tests for prompt assembly; remove TODO.
- **Recommended owner:** Frontend developer coordinating with model usage guidelines.

### 7. Placeholder Copy / UI Heuristic

- File: [frontend/src/components/ConversationList.tsx](frontend/src/components/ConversationList.tsx:160-171)
- Snippet:
```tsx
if (diffMins < 1) return "Just now";
if (diffMins < 60) return `${diffMins}m ago`;
if (diffHours < 24) return `${diffHours}h ago`;
return `${diffDays}d ago`;
```
- **Category:** Estimate
- **Rationale:** Simple humanized time heuristic; acceptable UI pattern but unlocalized, no i18n.
- **Potential impact or risk:** Minor; inconsistent display across locales.
- **Suggested action:** Consider i18n-ready date-fns/dayjs or Intl.RelativeTimeFormat; defer if low priority.
- **Recommended owner:** Frontend/app UX.

### 8. Placeholder / Incomplete Feature Gate

- File: [frontend/src/components/ConversationList.tsx](frontend/src/components/ConversationList.tsx:203-221) and [frontend/src/App.tsx](frontend/src/App.tsx:959-1009)
- Snippet: Model select includes “gemini-2.5-flash-lite” with a tooltip “Still waitin'...”; App shows warning banners and blocks send with that model.
- **Category:** Placeholder
- **Rationale:** UI exposes a non-functional model; gating relies on client checks and copy referencing external issues/PRs.
- **Potential impact or risk:** Confusion; future model enabling might forget to remove client-side guard.
- **Suggested action:** Drive availability from server capability endpoint; centralize model metadata; add E2E test ensuring disabled models cannot send.
- **Recommended owner:** Frontend + backend contract owner.

### 9. Security Heuristic / Risk of False Positives

- File: [crates/backend/src/lib.rs](crates/backend/src/lib.rs:415-537)
- Snippet: is_command_safe command allow/deny lists.
- **Category:** Estimate
- **Rationale:** Static string contains checks for dangerous patterns; allow-list based on first token. This is heuristic and may miss dangerous variants or block safe invocations.
- **Potential impact or risk:** Either allows harmful commands through clever quoting/splitting or over-blocks legitimate usage; platform differences.
- **Suggested action:** Replace with structured policy: parse command tokens; explicit per-command allow-list with argument patterns; OS-aware; unit tests with red/green cases; consider shell-escape and blocking shells entirely.
- **Recommended owner:** Security reviewer/Backend developer.

### 10. Placeholder / Fallback Use

- File: [crates/backend/src/lib.rs](crates/backend/src/lib.rs:402-409)
- Snippet:
```rs
/// Dummy RPC logger that does nothing (fallback)
pub struct NoOpRpcLogger;
```
- **Category:** Placeholder
- **Rationale:** NoOp used when file logger fails; silently disables logging.
- **Potential impact or risk:** Loss of diagnostics; difficult supportability.
- **Suggested action:** Emit prominent error event to frontend; surface banner; telemetry or retry policy; configurable opt-in to NoOp.
- **Recommended owner:** Backend maintainer.

### 11. Guess / Speculative Mapping

- File: [crates/backend/src/lib.rs](crates/backend/src/lib.rs:1206-1215)
- Snippet:
```rs
let tool_name = match params.icon.as_str() {
    "folder" => "list_directory",
    "fileSearch" => "read_file",
    "search" => "search_files",
    "terminal" => "execute_command",
    "code" => "write_file",
    _ => &params.icon,
};
```
- **Category:** Guess
- **Rationale:** Infers tool names from icon strings; this is a speculative mapping without documented contract.
- **Potential impact or risk:** Incorrect tool names propagate to UI; mismatched analytics; brittle coupling to visuals.
- **Suggested action:** Have CLI send explicit tool identifiers; treat icons as presentation only; remove mapping.
- **Recommended owner:** Protocol/contract owner.

### 12. Estimate / Heuristic in Project Discovery

- File: [crates/backend/src/lib.rs](crates/backend/src/lib.rs:1616-1623, 1625-1674)
- Snippet: Project logs identified by filename pattern "rpc-log-*.log" or .json; status derived from counts and parse errors; title inferred from first user message words.
- **Category:** Estimate
- **Rationale:** Heuristic parsing and status derivation; best-effort file enumeration.
- **Potential impact or risk:** Missing projects if file patterns differ; false “error” statuses on parsing anomalies; fragile to format changes.
- **Suggested action:** Document format assumptions; add robust schema versioning; unit tests with fixtures; possibly store an index manifest instead of scanning.
- **Recommended owner:** Backend maintainer.

### 13. Guess / Fallback Behavior

- File: [crates/backend/src/lib.rs](crates/backend/src/lib.rs:2171-2259)
- Snippet: generate_conversation_title spawns the gemini CLI and interprets last line of stdout, trimming quotes.
- **Category:** Guess
- **Rationale:** Assumes CLI output format; reliance on last line being the title; lack of protocol.
- **Potential impact or risk:** Flaky titles; accidental leakage of extra content; model cost.
- **Suggested action:** Use formal API for title generation (if CLI supports), or local deterministic title from first messages; add output parsing guardrails and tests.
- **Recommended owner:** Backend + product decision.

### 14. Placeholder / Hardcoded Ports

- File: [crates/server/src/main.rs](crates/server/src/main.rs:553-558) and [frontend/vite.config.ts](frontend/vite.config.ts:41-51)
- Snippet:
```rs
.merge(("port", 1858)).merge(("address", "0.0.0.0"))
...
proxy "/api" -> "http://localhost:1858", "/api/ws" -> "ws://localhost:1858"
```
- **Category:** Placeholder
- **Rationale:** Ports and address hardcoded for dev; no env/config override.
- **Potential impact or risk:** Conflicts on user systems, deployment friction.
- **Suggested action:** Externalize via env variables or config files; document defaults; validate on startup.
- **Recommended owner:** DevOps/backend.

### 15. Placeholder / Author Metadata

- File: [crates/tauri-app/Cargo.toml](crates/tauri-app/Cargo.toml:5)
- Snippet:
```toml
authors = ["you"]
```
- **Category:** Placeholder
- **Rationale:** Placeholder author.
- **Potential impact or risk:** Packaging metadata correctness.
- **Suggested action:** Replace with organization/author list.
- **Recommended owner:** Project maintainer.

### 16. Guess / OS Path Environment Resolution

- File: [crates/backend/src/lib.rs](crates/backend/src/lib.rs:324-332, 1419-1427, 2282-2299)
- Snippet: HOME or USERPROFILE selection; string comparisons of paths if canonicalize fails.
- **Category:** Guess
- **Rationale:** Falls back to string equality when canonicalization fails.
- **Potential impact or risk:** False positives for is_home_directory on different path representations; symlink issues.
- **Suggested action:** Normalize paths robustly; handle errors explicitly; add tests across platforms.
- **Recommended owner:** Backend maintainer with Windows experience.

### 17. Placeholder / Commented-Out UI Code

- File: [frontend/src/components/ToolCallDisplay.tsx](frontend/src/components/ToolCallDisplay.tsx:17-166)
- Snippet: Large block of commented-out icon/description/result rendering.
- **Category:** Placeholder
- **Rationale:** Scaffolding code commented; indicates planned richer handling.
- **Potential impact or risk:** Dead code retains intent but can diverge; readability.
- **Suggested action:** Either implement or remove; track with issue; if kept, add TODO with owner.
- **Recommended owner:** Frontend component owner.

### 18. Guess / State Coupling

- File: [frontend/src/App.tsx](frontend/src/App.tsx:763-797)
- Snippet: When confirming a tool call, the UI injects a local toolCall with guessed name based on presence of confirmation.command and sets status to running.
- **Category:** Guess
- **Rationale:** UI assumes execution semantics without authoritative backend tool call ID/state.
- **Potential impact or risk:** UI state may drift from backend; duplicate/mismatched tool call IDs.
- **Suggested action:** Drive all tool-call lifecycle from backend events only; avoid client-side insertion except for optimistic UI with rollback.
- **Recommended owner:** Frontend + backend event contract owner.

### 19. Placeholder / Incomplete Error Handling

- File: [crates/server/src/main.rs](crates/server/src/main.rs:471-482)
- Snippet:
```rs
let contents = backend
  .list_directory_contents(request.path.clone())
  .await
  .unwrap();
Json(contents)
```
- **Category:** Erroneous
- **Rationale:** unwrap() on a BackendResult within HTTP handler can panic; this is production server code.
- **Potential impact or risk:** Server crash on IO errors; denial-of-service potential via problematic paths.
- **Suggested action:** Return Result<Json<_>, Status> and map errors to Status codes; log errors; add tests.
- **Recommended owner:** Backend/server developer.

### 20. Placeholder / Assumption on FRONTEND_DIR

- File: [crates/server/src/main.rs](crates/server/src/main.rs:21, 257-270)
- Snippet: Embeds frontend/dist via include_dir; serves by extension. Assumes index.html exists and ContentType resolvable by last extension segment.
- **Category:** Placeholder/Guess
- **Rationale:** No fallback or 404/SPA redirect handling; content-type derived by extension may be None and unwrap() would panic.
- **Potential impact or risk:** 500/panic if extension missing; SPA route refreshs could 404.
- **Suggested action:** Add SPA fallback to index.html; handle missing extension; safe content-type default; tests.
- **Recommended owner:** Server dev.

### 21. Erroneous / Misleading Test Scripts

- File: [frontend/package.json](frontend/package.json:13,16,17,20,21)
- Snippet:
```json
"format:tauri": "cd src-tauri && cargo fmt"
"lint:tauri": "cd src-tauri && cargo clippy -- -D warnings"
"check:tauri": "cd src-tauri && cargo check"
```
- **Category:** Erroneous
- **Rationale:** There is no src-tauri directory in this repo; actual tauri app is under crates/tauri-app. Scripts are stale/misreferenced.
- **Potential impact or risk:** Developer confusion; CI failures; missed linting on actual code.
- **Suggested action:** Update scripts to point to crates/tauri-app; ensure consistent dev ergonomics.
- **Recommended owner:** Build tooling maintainer.

### 22. Placeholder / Doc Warning of "hack"

- File: [README.md](README.md:5-7,17-23)
- Snippet:
```md
[!WARNING] ... automatic saving ... ultimately a hack ... would be more robust to have automatic recording incorporated into the Gemini CLI itself ... see PRs...
Planned: Automatic chat history saving ... MCP server management ... Token/cost information ...
```
- **Category:** Placeholder
- **Rationale:** Acknowledges current approach is a stopgap; planned features not implemented.
- **Potential impact or risk:** Expectations management with users; architectural debt.
- **Suggested action:** Keep documentation up-to-date; track PR dependencies; design for graceful degradation.
- **Recommended owner:** Docs and product owner.

### 23. Placeholder / Hardcoded Window Size

- File: [crates/tauri-app/tauri.conf.json](crates/tauri-app/tauri.conf.json:13-18)
- Snippet:
```json
"windows": [{ "title": "Gemini Desktop", "width": 800, "height": 600 }]
```
- **Category:** Placeholder
- **Rationale:** Default size; ok for dev; consider persistence or responsive sizing.
- **Potential impact or risk:** UX minor.
- **Suggested action:** Optional: persist window size, multi-window?
- **Recommended owner:** Desktop app owner.

### 24. Guess / Portability of PATH Debug

- File: [crates/tauri-app/src/lib.rs](crates/tauri-app/src/lib.rs:271-286)
- Snippet: Windows-only system PATH retrieval via cmd echo; not used elsewhere.
- **Category:** Placeholder/Guess
- **Rationale:** Debug command for environment; might be leftover.
- **Potential impact or risk:** None at runtime; dead command surface.
- **Suggested action:** Hide behind debug feature flag or remove from release.
- **Recommended owner:** Desktop app owner.

### 25. Placeholder / Incomplete WebSocket reconnection policy

- File: [frontend/src/lib/webApi.ts](frontend/src/lib/webApi.ts:267-354)
- Snippet: WebSocketManager with exponential backoff up to 5 attempts, no jitter, no user notification.
- **Category:** Estimate
- **Rationale:** Heuristic limits; no surfacing to user; no re-subscription strategy described beyond local storage.
- **Potential impact or risk:** Silent failure; missed events.
- **Suggested action:** Add UI status; jitter; infinite but throttled reconnection; server pings; tests.
- **Recommended owner:** Frontend real-time owner.

## Prioritized High-Risk Items
1. Server unwrap panic in list_directory route: [crates/server/src/main.rs](crates/server/src/main.rs:471-482)
2. Command safety heuristic correctness: [crates/backend/src/lib.rs](crates/backend/src/lib.rs:415-537)
3. Protocol version hardcoding and icon-to-tool guess mapping: [crates/backend/src/lib.rs](crates/backend/src/lib.rs:835-843, 1206-1215)
4. Package scripts referencing non-existent src-tauri: [frontend/package.json](frontend/package.json:13,16,17,20,21)
5. Heuristic project discovery/parsing without schema/versioning: [crates/backend/src/lib.rs](crates/backend/src/lib.rs:1616-1674)
6. Stubbed discussions API powering a UI page: [frontend/src/lib/webApi.ts](frontend/src/lib/webApi.ts:229-258), [frontend/src/pages/ProjectDetail.tsx](frontend/src/pages/ProjectDetail.tsx:18-22)

## Cross-Cutting Themes
- Heuristic choices need central configuration and documentation (log retention, context window size, model availability, protocol version).
- Error handling should avoid unwraps in server paths; prefer typed error propagation and HTTP mapping.
- Contract drift risk between UI and backend (tool call names/icons, title generation, discussion API).
- Dev tooling inconsistencies (scripts paths) reduce reliability of CI and local workflows.
- Placeholders and stubs are clearly marked but should be tracked with issues and owners to prevent bitrot.

## Remediation Checklist with Effort Estimates and Dependencies
- [ ] Replace unwrap in list_directory route with proper error handling and Status mapping; add tests (0.5 day, backend; no deps)
- [ ] Introduce configuration for log retention period; default 30 days documented; unit test (0.5 day, backend)
- [ ] Centralize protocol version; add negotiation or CLI query; tests (1–2 days, backend; dependent on CLI capabilities)
- [ ] Remove icon-to-tool guess mapping; require explicit tool identifier from CLI; update UI rendering accordingly (1 day, backend + frontend; depends on CLI contract)
- [ ] Update frontend package scripts to target crates/tauri-app; validate lint/format/check (0.25 day, tooling)
- [ ] Replace conversation context heuristic with token-based windowing per model; add tests (1–2 days, frontend)
- [ ] Implement real project discussions endpoint in server; wire webApi.get_project_discussions to REST; update ProjectDetailPage (2–3 days, backend + frontend)
- [ ] Improve command safety policy: structured parsing, OS-aware allowlist, argument validation, comprehensive tests (2–4 days, backend/security)
- [ ] WebSocket reconnection improvements with user feedback and jitter; add tests (1 day, frontend)
- [ ] Make ports configurable via env; propagate to Vite proxy and Rocket config; document (0.5 day, backend + frontend config)
- [ ] NoOpRpcLogger: surface warning to UI and logs; optional retry; tests (0.5 day, backend + frontend)
- [ ] SPA server: add content-type fallback, index.html fallback for 404 routes; tests (0.5–1 day, server)
- [ ] is_home_directory normalization improvements and cross-platform tests (0.5 day, backend)
- [ ] Clean up commented scaffolding or implement planned UI in ToolCallDisplay; track with issue (0.5 day, frontend)
- [ ] Update tauri Cargo metadata (authors) (0.1 day, maintainers)
- [ ] Documentation adjustments (Projects copy precision, README roadmap) (0.25 day, docs)

### Dependencies

- CLI protocol/feature support impacts: protocol version negotiation and explicit tool identifiers.
- Coordinated changes across backend and frontend for model availability and discussions API.

---

*This report is ready for review. Approve to proceed to implementation planning and mode switch.*