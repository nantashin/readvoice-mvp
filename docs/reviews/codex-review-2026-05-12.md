# Codex Review - 2026-05-12

Review target: current `git diff` plus commit `66b79c5` (`feat: voice file selection with folder auto-open`)

Scope:
- `/api/open-folder` 500 error cause
- Security risks in voice file selection
- Accessibility omissions
- TypeScript `any` usage

## Findings

### 1. `/api/open-folder` 500 is most likely caused by server-side `explorer` execution, not Python exec permission

- Severity: High
- Files:
  - `app/api/open-folder/route.ts:1`
  - `app/api/open-folder/route.ts:12`
  - `.claude/settings.local.json:29`
  - `.claude/settings.local.json:56`

`/api/open-folder` imports Node `child_process.exec` and runs:

```ts
await execAsync(`explorer "${folderPath}"`)
```

This route runs inside the Next.js server process. The `.claude/settings.local.json` Python/PowerShell allowlist affects Claude command execution, not the runtime permissions of the Next.js API route. So the 500 is unlikely to be a "Python exec 권한" issue.

Likely causes:

- The server process cannot launch an interactive Windows Explorer window from its execution context.
- `explorer` is unavailable or blocked in the environment where `next dev`/server is running.
- `UPLOAD_FOLDER_PATH` contains characters that break the shell command string.
- The folder does not exist yet when `/api/open-folder` runs. Unlike `/api/watch-folder`, this route does not create it before calling Explorer.

Security side note: because this uses `exec` with a string, `UPLOAD_FOLDER_PATH` can become command injection input if it is ever user-controlled or deployment-controlled incorrectly. Prefer `execFile`/`spawn` with arguments, and ensure the folder exists before launching Explorer.

### 2. Voice file selection exposes and reads too broad a local file surface

- Severity: Critical
- Files:
  - `app/api/watch-folder/route.ts:14`
  - `app/api/watch-folder/route.ts:22`
  - `app/api/watch-folder/route.ts:29`
  - `app/api/read-file/route.ts:16`
  - `app/api/read-file/route.ts:20`
  - `app/api/read-file/route.ts:29`
  - `app/api/read-file/route.ts:54`
  - `app/page.tsx:593`
  - `app/page.tsx:598`
  - `app/page.tsx:634`

Commit `66b79c5` removed the extension filter from `/api/watch-folder`; it now returns every non-hidden file in the upload folder. `/api/read-file` also supports many document/data extensions and falls back to `application/octet-stream`, then returns the entire file as base64.

Risks:

- `/api/watch-folder` returns absolute local paths via `path: path.join(UPLOAD_FOLDER, f)`. This leaks filesystem layout to any caller that can reach the dev/server origin.
- `/api/read-file` has no extension allowlist and no size limit. Any file under the upload folder can be read into memory and returned to the browser.
- The path containment check uses `filePath.startsWith(uploadFolderResolved)`. This is not a safe directory boundary check. A sibling path with the same prefix can pass in some path layouts; symlinks/reparse points can also make `fs.statSync(...).isFile()` and `fs.readFileSync(...)` reach outside the intended folder.
- The voice flow can auto-read the most recent file after a 3 second recommendation timeout (`app/page.tsx:634`, mirrored for documents at `app/page.tsx:700`) without explicit file confirmation. That is risky when the folder contains private or unrelated files.
- `/api/open-folder` is triggerable by POST from the app (`app/page.tsx:593`, `app/page.tsx:659`). If the route remains unauthenticated, any page able to make a request to the local server can cause local UI side effects.

Recommended direction:

- Restore a strict allowlist of supported file extensions and MIME types.
- Do not return absolute paths to the client.
- Add file size limits before reading into memory.
- Use a safer containment check based on `path.relative(...)`, and reject symlink/reparse escapes if this folder is treated as a trust boundary.
- Require explicit confirmation before auto-reading a recommended file.

### 3. Accessibility state is still mostly speech-only and not fully exposed to screen readers

- Severity: Medium
- Files:
  - `app/page.tsx:953`
  - `app/page.tsx:969`
  - `app/page.tsx:1026`
  - `app/page.tsx:1057`
  - `app/components/FileUpload.tsx:564`
  - `app/components/FileUpload.tsx:630`
  - `app/components/FileUpload.tsx:642`

The main mic status label has `aria-live="polite"` at `app/page.tsx:973`, which is good. However, several important states are still not announced or are represented only visually/TTS:

- The large mic state icon at `app/page.tsx:953-970` is a visual status indicator made from emoji. It has no `aria-hidden`, `role="img"`, or accessible label. Screen readers may announce raw emoji while the adjacent live label announces the actual state.
- The recognized transcript block at `app/page.tsx:1026-1045` is not an `aria-live` region, so updated recognition text may not be announced.
- `stt.error` at `app/page.tsx:1057-1067` is visible text only; it should be exposed as an alert/status for assistive tech.
- The voice file list is read through TTS, but there is no rendered accessible list for screen reader or keyboard users to review and select from.
- `FileUpload` has a static `aria-label` on the upload drop area (`app/components/FileUpload.tsx:564`). When loading or after file selection, the visible text changes at `app/components/FileUpload.tsx:630-635`, but the accessible name does not include the selected file or loading state.

Recommended direction:

- Mark decorative emoji as `aria-hidden` or give status icons meaningful labels.
- Add live regions for transcript, errors, selected file, loading, and file-list state.
- Render the available voice-selected files as an accessible list or set of buttons, not only as spoken TTS.
- Keep the upload area's accessible name/state synchronized with the visible selected-file/loading text.

### 4. Explicit and weak `any` usage remains in TypeScript code

- Severity: Low
- Files:
  - `app/components/FileUpload.tsx:108`
  - `app/components/FileUpload.tsx:124`
  - `app/page.tsx:284`
  - `lib/audio/mic-sound.ts:8`
  - `lib/audio/mic-sound.ts:35`
  - `tsconfig.json:7`

`tsconfig.json` has `strict: true`, but the code still uses explicit or weakly typed `any` patterns:

- `app/components/FileUpload.tsx:108`: `data.models?.map((m: any) => m.name)`
- `app/components/FileUpload.tsx:124`: `CustomEvent` is untyped, so `event.detail` is unchecked.
- `app/page.tsx:284`: `CustomEvent` is untyped for YouTube event handling.
- `lib/audio/mic-sound.ts:8` and `lib/audio/mic-sound.ts:35`: `(window as any).webkitAudioContext`

Recommended direction:

- Define response types for Ollama tags, e.g. `{ models?: { name: string }[] }`.
- Type custom events as `CustomEvent<{ file: File; model: string }>` or similar.
- Replace `window as any` with an interface extension for `webkitAudioContext`.

## Current Working Tree Note

The current uncommitted `git diff` only touches version metadata:

- `docs/versions/VERSION_HISTORY.md`
- `docs/versions/v2.8.3/version-meta.json`

Those changes do not materially affect the four reviewed areas above.
