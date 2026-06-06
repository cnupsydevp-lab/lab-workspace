# Lab Workspace Project Status

Last updated: 2026-06-06

## Current Root

- Active local root: `D:\CodexCodeProj\LabWorkspace`
- Repository: `https://github.com/cnupsydevp-lab/lab-workspace.git`
- Branch: `main`
- Latest app/deploy config checkpoint: `12ce7c3 ci: use cloud logging for cloud build`
- Automatic deployment success recorded in docs after user-confirmed Cloud Build trigger run.
- Main app: `pixellab`
- Runtime: Node.js + Express + Socket.io, Phaser client served from `pixellab/public`
- Cloud Run URL: `https://pixellab-922543866704.asia-northeast3.run.app`

This status was refreshed from the current folder after the project folder move. Current work should treat the active local root above as the project root and should not rely on earlier local paths from previous conversations.

## Current Structure

- `README.md`: setup, run, verification, Docker, feature, and GitHub collaboration notes.
- `PROJECT_STATUS.md`: canonical local progress and handoff note.
- `.gitignore`: local ignore rules for Node dependencies and local env files.
- `pixellab/package.json`: app metadata and `start`/`dev` scripts.
- `pixellab/package-lock.json`: reproducible npm dependency lockfile; needed by the Dockerfile because it uses `npm ci`.
- `pixellab/scripts/smoke.js`: lightweight Socket.io smoke test for presence, bubble, direct-message, todo, and notice events.
- `pixellab/server.js`: Express + Socket.io server, in-memory session state plus lightweight profile and todo persistence.
- `pixellab/public/index.html`: browser entry page, responsive app shell, and real-time workspace panel.
- `pixellab/public/game.js`: Phaser client UI, real-time lab scene logic, and panel state event bridge.
- `pixellab/Dockerfile`: Node 20 Alpine container build.
- `pixellab/.dockerignore`: Docker build exclusions.
- `cloudbuild.yaml`: Cloud Build validation, image build/push, and Cloud Run deploy pipeline for `main` push automation.

No `AGENTS.md`, `AI_HANDOFF.md`, or `WORKING_SUMMARY.md` file currently exists in this repository root.

## Completed Checks

- [x] Located the active project at `D:\CodexCodeProj\LabWorkspace`.
- [x] Confirmed Git top-level path matches the active project root.
- [x] Checked Git status: branch `main`, tracking `origin/main`, with local untracked setup/status files.
- [x] Reviewed current status documents and confirmed `PROJECT_STATUS.md` is the only detailed handoff/status file.
- [x] Searched code, config, and documents for stale local absolute paths.
- [x] Confirmed the only absolute path references found by search are the current active root references in this status document.
- [x] Checked environment/config files: `package.json`, `package-lock.json`, `Dockerfile`, `.dockerignore`, `.gitignore`.
- [x] Confirmed no `.env` or `.env.*` files are present.
- [x] Confirmed runtime tools: Node `v24.13.0`, npm `11.6.2`.
- [x] Re-ran server smoke test from the active root on `PORT=18080`: `http://127.0.0.1:18080` returned HTTP 200.
- [x] Re-checked browser loading from the active root: title `PPAI Lab Pixel`, one Phaser canvas rendered at internal size `960x640`, desktop viewport displayed the canvas, and browser console errors/warnings were empty.
- [x] Verified browser interaction on a narrow mobile-sized viewport: check-in modal opens, Korean placeholder text renders, keyboard submission works, and checkout returns server state to empty.
- [x] Verified Socket.io state transitions: check-in, away, back, checkout, six occupied desks, seventh-user full-desk error, and disconnect cleanup.
- [x] Found and fixed duplicate-name handling: the server now rejects blank and duplicate nicknames, trims names to 8 characters, emits `check_in_ok` only to the accepted socket, and the client now switches to worker mode only after that acknowledgement.
- [x] Added lightweight persistent user profiles in `pixellab/data/profiles.json`: nickname, color, preferred desk, last status, and last seen timestamp.
- [x] Extended presence states from working/away to `working`, `away`, `meeting`, and `experiment`; checkout records `done`, and disconnect records `disconnected` in the profile.
- [x] Updated the client status control to cycle through working, away, meeting, and experiment.
- [x] Added `pixellab/data/` to `.gitignore` so runtime profile data is not committed.
- [x] Updated `README.md` with current features, local run commands, verification commands, Docker notes, and GitHub collaboration guidance.
- [x] Re-ran syntax checks: `node --check server.js` and `node --check public/game.js`.
- [x] Re-ran Socket.io verification for profile persistence, color reuse, preferred-desk fallback, status transitions, checkout/disconnect cleanup, and profile-file writes.
- [x] Added responsive workspace layout shell: desktop keeps a fixed right panel, tablet/mobile moves the panel below the lab canvas, and tabs switch between overview, todo, timer, and schedule placeholders.
- [x] Verified responsive layout through browser DOM measurements at `1366x768`, `390x844`, and the in-app browser's narrow default viewport; Phaser canvas remained present and panel tabs switched correctly.
- [x] Re-ran syntax/static checks after the layout change: `node --check server.js`, `node --check public/game.js`, and `git diff --check`.
- [x] Fixed the overview panel's stale status values by forwarding Phaser `state_sync` updates to the HTML panel through a `lab:state` browser event.
- [x] Added live overview values for checked-in count, working count, away count, meeting/experiment count, and the current member list.
- [x] Tightened canvas/container sizing so the Phaser canvas and responsive shell share the same measured box on desktop and mobile.
- [x] Verified panel updates through real Socket.io server events: check-in changed the panel to `1명`/`작업중 1명`, status change moved the count to `자리비움 1명`, and checkout returned all counts to `0명`.
- [x] Re-checked mobile layout at `390x844`: canvas and game container matched at `370x247`, panel moved below the stage, and tab widths remained even.
- [x] Fixed lower UI button border leakage by keeping button backgrounds, labels, and border graphics in the same visibility groups.
- [x] Replaced the Phaser-scaled nickname DOM input with a stable HTML check-in modal overlay, so the input box no longer drifts outside the modal at responsive sizes.
- [x] Verified the revised check-in modal through the in-app browser: canvas check-in button opened the HTML modal, the input focused correctly, submit updated the panel to `1명`/`작업중 1명`, checkout returned the panel to empty, and console errors/warnings were empty.
- [x] Replaced the bottom status-cycle button with explicit status buttons for `작업`, `비움`, `회의`, and `실험`.
- [x] Increased lower-bar button and count text sizes and switched Korean control text from the pixel font to a system UI font for readability.
- [x] Split overview counts for `회의중` and `실험중` instead of combining them under one `회의/실험` bucket.
- [x] Added consistent status color rules across the lower bar and the overview/member panel.
- [x] Verified split status counts through real Socket.io server events: `meeting` updated only `회의중`, `experiment` moved the count to `실험중`, and member badges used the matching status classes.
- [x] Fixed a regression where hidden Phaser status buttons could still intercept the observer check-in button by disabling interactivity when control groups are hidden.
- [x] Added an HTML lower action overlay for check-in, explicit status selection, and checkout, so primary controls no longer depend on Phaser canvas hit testing.
- [x] Verified the HTML controls in the in-app browser: check-in opened the modal, submit switched to worker controls, meeting/experiment buttons updated the split counts, checkout returned to observer controls, and console errors/warnings were empty.
- [x] Removed the remaining ambiguity between Phaser canvas controls and HTML controls by hiding and disabling the canvas lower-bar buttons whenever the HTML action overlay is available.
- [x] Re-verified the check-in click target: the action button center resolved to `#action-checkin`, clicking it opened the modal, focused `#checkin-name`, and produced no console errors/warnings.
- [x] Cleaned up the canvas lower bar so primary actions live in the HTML overlay instead of duplicated Phaser hit areas.
- [x] Split notices into a separate panel tab, leaving messages and todos as independent workflows.
- [x] Added personal direct-message plumbing through Socket.io with `send_direct_message` and `direct_message` events.
- [x] Added persistent self bubble messages through `set_bubble`/`clear_bubble`; bubbles are rendered through the existing character speech bubble path.
- [x] Added shared todo support with seeded sample todos, add/toggle/delete events, and runtime persistence under `pixellab/data/todos.json`.
- [x] Verified the workspace panel loaded the new tabs, the HTML check-in target remained stable, bubble submission cleared the input, and todo add/sync rendered through the panel without console errors/warnings.
- [x] Added `pixellab/scripts/smoke.js`; it starts an isolated server on port `18081` and verifies HTTP loading, presence, status, bubble, direct-message, todo, and notice Socket.io events without changing the committed main `package.json` environment scripts.
- [x] Implemented editable/file-backed notices with default seeded notices, `notices_sync`, `notice_add`, and `notice_delete`.
- [x] Refined todo UX with optional owner and due-date fields, plus rendering of ownership/deadline metadata.
- [x] Refined message UX by excluding the current user from the direct-message target list and keeping sent/received message logs visually separated.
- [x] Re-ran validation after notice/todo/message updates: `node --check server.js`, `node --check public/game.js`, `node --check scripts/smoke.js`, `git diff --check`, and `node scripts/smoke.js`.
- [x] Pulled latest `origin/main` to `aceadde`, including the new real-time character movement, desk collision handling, corrected walk animation rows, raised UI/modal depth, and Eunbin character assets.
- [x] Re-applied local workspace panel work after the pull and resolved conflicts in `pixellab/public/game.js` and `pixellab/server.js`.
- [x] Preserved upstream movement/collision/player asset behavior while keeping local HTML controls, notices, direct messages, bubbles, todos, and panel event bridges.
- [x] Removed the local idle-floating character tween from the merged client path so it does not fight the new keyboard movement/`player_move` updates.
- [x] Re-ran merge validation: `node --check pixellab/server.js`, `node --check pixellab/public/game.js`, `node --check pixellab/scripts/smoke.js`, `git diff --check`, and `node pixellab/scripts/smoke.js`.
- [x] Committed and pushed the collaborative workspace panel work to `origin/main` as `e09af8b feat: add collaborative workspace panel`.
- [x] Re-checked GitHub sync on 2026-06-06: local `main` and `origin/main` are aligned with no ahead/behind commits.
- [x] Refreshed this status document on 2026-06-06 to match the committed/pushed state.
- [x] Ran local browser QA on `http://127.0.0.1:8080/` in a desktop-sized viewport: initial load rendered one Phaser canvas, check-in modal focused the nickname input, check-in switched to worker controls, and console errors/warnings were empty.
- [x] Verified status transitions through the browser panel: `working -> meeting -> experiment -> working` updated the split overview counts and member badge text correctly.
- [x] Verified panel workflows through the browser: notice add/delete, bubble set/clear, todo add/toggle/delete, and direct-message send/receive with a second Socket.io client.
- [x] Verified keyboard movement integration through the browser: arrow-key input on the canvas emitted `player_move` updates to the second Socket.io client with increasing character x coordinates.
- [x] Ran mobile viewport QA at `390x844`: canvas and game container matched at `370x247`, the panel moved below the stage, tabs stayed evenly sized, and the check-in modal/input stayed inside the viewport with no console errors/warnings.
- [x] Added todo editing UX: each todo row now supports inline editing for task text, owner, and due date through a new `todo_update` Socket.io event.
- [x] Changed todo due-date inputs from strict date fields to short text fields so lab shorthand such as `오늘` and `내일 오전` can be saved.
- [x] Improved canvas speech bubble readability with a larger system UI font, wider rounded bubble background, stronger border, and word wrapping.
- [x] Increased canvas name-tag readability with a larger system UI font, taller name-tag background, and larger timer text.
- [x] Fixed speech bubble vertical alignment so the message text is centered inside the enlarged bubble instead of sitting near the bottom edge.
- [x] Extended `pixellab/scripts/smoke.js` to verify `todo_update` with edited text, owner, and shorthand due date.
- [x] Re-ran validation for the todo/bubble update: `node --check pixellab/server.js`, `node --check pixellab/public/game.js`, `node --check pixellab/scripts/smoke.js`, `git diff --check`, and `node pixellab/scripts/smoke.js`.
- [x] Browser-checked todo editing on `http://127.0.0.1:8080/`: add with `오늘`, open inline edit form, update text/owner/due to `내일 오전`, save, and delete the QA item.
- [x] Reworked the timer tab from a placeholder focus timer into an automatic attendance-time panel.
- [x] Added `arrivedAt` to server presence snapshots so the panel can show the actual check-in time separately from the active working-segment timer.
- [x] Browser-checked the attendance timer: before check-in it shows a waiting state, after check-in it auto-increments, and switching to meeting preserves the accumulated working time.
- [x] Committed and pushed the todo/attendance UX refinement to `origin/main` as `39a41f2 feat: refine todo and attendance UX`.
- [x] Created Artifact Registry repository `pixellab` in GCP project `lab-workspace-498607`, region `asia-northeast3`.
- [x] Built and pushed the Cloud Run image through Cloud Build: build ID `56182734-ad89-404a-b66d-dd7ced283379`, status `SUCCESS`.
- [x] Deployed Cloud Run service `pixellab` revision `pixellab-00001-84p` in `asia-northeast3`.
- [x] Confirmed deployed service URL: `https://pixellab-922543866704.asia-northeast3.run.app`.
- [x] User manually checked the deployed service's planned 1-8 validation items and confirmed they worked.
- [x] Added root `cloudbuild.yaml` for automatic deployment: `npm ci`, syntax checks, smoke test, Docker image build/push, and Cloud Run deploy.
- [x] Kept Cloud Run deploy configuration at `--max-instances=1` while the app still has file/in-memory runtime state.
- [x] Committed and pushed the automatic deployment config to `origin/main` as `3497e73 ci: add cloud run auto deploy config`.
- [x] Fixed Cloud Build service-account logging requirements by adding `options.logging: CLOUD_LOGGING_ONLY`, committed and pushed as `12ce7c3 ci: use cloud logging for cloud build`.
- [x] Created and ran the Cloud Build GitHub trigger for `main` push using `cloudbuild.yaml`; user confirmed the automatic build/deploy succeeded.
- [x] Verified the Cloud Build service account has sufficient permissions for the configured pipeline through a successful trigger run.

## Current Git State

Before this automatic-deployment success note, local `main` was aligned with `origin/main` at `12ce7c3`.

Current documentation update scope:

- Modified: `PROJECT_STATUS.md`

`pixellab/node_modules/` exists locally after dependency installation and is ignored by `.gitignore`.

The pre-pull safety stash is still retained as `stash@{0}` with message `codex-local-work-before-pull-20260602` until the merged working tree is manually reviewed.

Collaboration rule: do not automatically commit or push changes in this project. Because this repository is shared with other collaborators, inspect and report Git state first, and only commit or push after the user explicitly approves that specific action and scope.

## Environment Notes

- In PowerShell on this machine, use `npm.cmd` instead of `npm` because `npm.ps1` can be blocked by execution policy.
- Run local install from `pixellab` with `npm.cmd install`.
- Run the app from `pixellab` with `npm.cmd start` or `node server.js`.
- The app listens on `PORT` when set, otherwise defaults to `8080`.
- There is no test script and no build script in `package.json`.
- The Dockerfile uses `npm ci --omit=dev`, so `pixellab/package-lock.json` should be kept if Docker deployment is expected.
- `Start-Process -Environment` is not available in the observed PowerShell version; set `$env:PORT` before `Start-Process` when launching an alternate local port.
- Runtime profile data is stored under `pixellab/data/`, which is intentionally ignored by Git.
- First manual Cloud Run deployment is live at `https://pixellab-922543866704.asia-northeast3.run.app`.
- Cloud Run local filesystem is ephemeral. Current file-backed JSON data under `pixellab/data/` is acceptable for MVP testing, but not for durable research-lab operation.

## Remaining Work

- [x] Run one manual visual pass in a browser, including desktop and mobile-sized viewport checks.
- [x] Replace the current status-cycle button with explicit status controls if users keep missing which status will be selected next.
- [x] Continue UI polish on the Phaser canvas itself: bottom bar spacing and clearer status affordances.
- [x] After desktop UI polish settles, add mobile-specific HTML controls for check-in, status selection, and checkout.
- [x] Review message bubble behavior and timeout cleanup with actual `send_message` UI/trigger if that feature is exposed later.
- [x] Add editing/assignment metadata for todos if the lab needs real task ownership beyond simple add/complete/delete.
- [x] Improve todo due-date UX: the current field is a date input and rejects free text such as `오늘`; decide whether to keep strict dates or support natural lab shorthand.
- [x] Replace the placeholder focus timer with an automatic attendance-time calculator.
- [x] Replace placeholder notice content with an editable or file-backed notice source.
- [ ] Decide whether direct messages should remain session-only or move directly to durable storage.
- [x] Expand `README.md` with setup, local run, smoke test, Docker, collaboration rules, and research-lab-oriented development candidates.
- [ ] After manual browser review, decide whether to drop the retained safety stash.
- [x] Decide whether the current local changes should be committed as one collaboration-ready checkpoint or split into UI, server events, and docs/test commits.
- [x] Add a lightweight smoke-test command or script if this repo will be maintained by multiple agents/users.
- [ ] User-facing visual pass for the enlarged name tag and speech bubble after the latest alignment adjustment.
- [ ] Optional external-browser visual pass for exact desk collision edge cases near table boundaries.
- [x] Confirm deployment target and whether Cloud Run assumptions in comments are current.
- [ ] Restore or redesign todo due-date input as a calendar/date-picker UX; the current shorthand text field is useful but lost the previous calendar affordance.
- [x] Add Cloud Build automatic deployment config from `main` push after smoke checks are part of the build.
- [x] Create and verify the Cloud Build GitHub trigger in GCP Console for `main` push using `cloudbuild.yaml`.
- [x] Grant/confirm Cloud Build service account permissions: Cloud Run Admin, Artifact Registry Writer, and Service Account User.
- [ ] Move operational data for notices, todos, profiles, and future messages to durable storage before real lab use.

## Recommended Next Step

Next, plan durable storage for notices, todos, profiles, and messages; otherwise Cloud Run redeploys or instance restarts can lose file-backed runtime data. The other practical UI follow-up is restoring a calendar/date-picker affordance for todo due dates while keeping shorthand text input available if the lab wants both.
