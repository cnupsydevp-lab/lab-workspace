# Lab Workspace Project Status

Last updated: 2026-06-02

## Current Root

- Active local root: `D:\CodexCodeProj\LabWorkspace`
- Repository: `https://github.com/cnupsydevp-lab/lab-workspace.git`
- Branch: `main`
- Current HEAD: `aceadde`
- Main app: `pixellab`
- Runtime: Node.js + Express + Socket.io, Phaser client served from `pixellab/public`

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

## Current Git State

Current local changes:

- Modified: `README.md`
- Modified: `PROJECT_STATUS.md`
- Modified: `pixellab/public/game.js`
- Modified: `pixellab/public/index.html`
- Modified: `pixellab/server.js`
- Untracked: `pixellab/scripts/smoke.js`

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

## Remaining Work

- [ ] Run one manual visual pass in a normal desktop browser window, because the automated in-app browser screenshot API still timed out even though DOM/layout checks passed.
- [x] Replace the current status-cycle button with explicit status controls if users keep missing which status will be selected next.
- [x] Continue UI polish on the Phaser canvas itself: bottom bar spacing and clearer status affordances.
- [x] After desktop UI polish settles, add mobile-specific HTML controls for check-in, status selection, and checkout.
- [x] Review message bubble behavior and timeout cleanup with actual `send_message` UI/trigger if that feature is exposed later.
- [ ] Add editing/assignment metadata for todos if the lab needs real task ownership beyond simple add/complete/delete.
- [x] Replace placeholder notice content with an editable or file-backed notice source.
- [ ] Decide whether direct messages should remain session-only or be persisted under `pixellab/data/`.
- [x] Expand `README.md` with setup, local run, smoke test, Docker, collaboration rules, and research-lab-oriented development candidates.
- [ ] After manual browser review, decide whether to drop the retained safety stash.
- [ ] Decide whether the current local changes should be committed as one collaboration-ready checkpoint or split into UI, server events, and docs/test commits.
- [x] Add a lightweight smoke-test command or script if this repo will be maintained by multiple agents/users.
- [ ] Confirm deployment target and whether Cloud Run assumptions in comments are current.

## Recommended Next Step

Run a manual desktop/mobile browser pass on the merged app, focusing on keyboard character movement, desk collision, HTML check-in controls, notices, direct messages, bubble messages, and todo add/toggle/delete. If that pass looks good, prepare a collaboration-friendly commit split rather than committing everything as one large mixed change.
