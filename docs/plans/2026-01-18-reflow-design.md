# Reflow Design

## Scope
- Chrome MV3 extension named Reflow.
- Targets Pinterest domains only (broad TLD coverage).
- Removes promoted/ads cards and lets layout reflow naturally.
- Avoids language-dependent text; uses structural DOM attributes.

## Architecture
- Content script handles DOM scanning and removal, plus MutationObserver for dynamic loads.
- Service worker manages settings (enabled + whitelist) and broadcasts changes.
- Popup UI provides toggle and whitelist control.
- Storage uses chrome.storage.sync by default.

## Components
- `manifest.json`: MV3 config, permissions (storage + Pinterest host permissions).
- `content.js`: ad detection + removal + observer.
- `background.js`: settings read/write, runtime messaging.
- `popup.html`/`popup.js`/`popup.css`: UI and settings updates.

## Data Flow
- Content script reads settings; if disabled or whitelisted, it exits.
- On page changes, observer triggers incremental scanning.
- Popup writes to storage; background notifies tabs to refresh behavior.

## Error Handling
- Conservative removal: only remove nodes that match multiple structural heuristics.
- Try/catch around DOM operations; use debug logs only.
- Observer throttling to avoid high-frequency loops.
- On storage or messaging failure, fall back to cached defaults.

## Testing
- Manual verification on home, search, and detail pages.
- Toggle/whitelist behavior smoke tests.
- Validate across multiple locales to ensure language-agnostic detection.