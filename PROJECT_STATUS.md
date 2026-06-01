# Lab Workspace Project Status

Last updated: 2026-06-01

## Current Root

- Active local root: `D:\CodexCodeProj\LabWorkspace`
- Repository: `https://github.com/cnupsydevp-lab/lab-workspace.git`
- Branch: `main`
- Current HEAD: `22b4b00`
- Main app: `pixellab`
- Runtime: Node.js + Express + Socket.io, Phaser client served from `pixellab/public`

This status was refreshed from the current folder after the project folder move. Current work should treat the active local root above as the project root and should not rely on earlier local paths from previous conversations.

## Current Structure

- `README.md`: setup, run, verification, Docker, feature, and GitHub collaboration notes.
- `PROJECT_STATUS.md`: canonical local progress and handoff note.
- `.gitignore`: local ignore rules for Node dependencies and local env files.
- `pixellab/package.json`: app metadata and `start`/`dev` scripts.
- `pixellab/package-lock.json`: reproducible npm dependency lockfile; needed by the Dockerfile because it uses `npm ci`.
- `pixellab/server.js`: Express + Socket.io server, in-memory session state plus lightweight profile persistence.
- `pixellab/public/index.html`: browser entry page.
- `pixellab/public/game.js`: Phaser client UI and real-time lab scene logic.
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

## Current Git State

Current local changes:

- Modified: `README.md`
- Modified: `pixellab/server.js`
- Modified: `pixellab/public/game.js`

Local untracked files expected from setup and documentation:

- `.gitignore`
- `PROJECT_STATUS.md`
- `pixellab/package-lock.json`

`pixellab/node_modules/` exists locally after dependency installation and is ignored by `.gitignore`.

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

- [ ] Run one manual visual pass in a normal desktop browser window, because the automated in-app browser screenshot/canvas-click APIs were unreliable even though DOM/state checks passed.
- [ ] Review message bubble behavior and timeout cleanup with actual `send_message` UI/trigger if that feature is exposed later.
- [x] Expand `README.md` with setup, local run, smoke test, Docker, collaboration rules, and research-lab-oriented development candidates.
- [ ] Decide whether `.gitignore`, `PROJECT_STATUS.md`, and `pixellab/package-lock.json` should be committed.
- [ ] Add a lightweight smoke-test command or script if this repo will be maintained by multiple agents/users.
- [ ] Confirm deployment target and whether Cloud Run assumptions in comments are current.

## Recommended Next Step

Prepare the GitHub collaboration flow before adding more features: create a feature branch, review the current changed files, decide whether to include `.gitignore`, `PROJECT_STATUS.md`, and `pixellab/package-lock.json`, then open a PR with the verification commands and manual visual-check note.
