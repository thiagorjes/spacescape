# Copilot Instructions for Space Scape

## Project Overview
- **Space Scape** is a static web game/app with all logic in the root directory. Main files: `index.html`, `script.js`, `style.css`, `space_scape_fases.html`, `touch-connect.js`.
- No build system or package manager; all code is vanilla JS/HTML/CSS.
- Deployment is automated via GitHub Actions (`.github/workflows/static.yml`) to GitHub Pages on every push to `main`.

## Key Files & Structure
- `index.html`: Main entry point. Loads scripts and styles.
- `script.js`: Core game logic and UI interactions.
- `touch-connect.js`: Handles touch input and device connection logic.
- `space_scape_fases.html`: Likely contains level/fase data or alternate UI.
- `style.css`: All styling; no CSS frameworks detected.
- No external dependencies or modules.

## Developer Workflows
- **Edit and test locally:** Open `index.html` in browser. No local server required.
- **Deploy:** Push to `main` branch. GitHub Actions will deploy to Pages automatically.
- **Add new files:** Place in root directory. Update `index.html` to reference them if needed.
- **Touch input:** For touch region logic, see `touch-connect.js` and `script.js`.

## Patterns & Conventions
- All scripts/styles are loaded directly in HTML; no dynamic imports.
- Game logic and UI are tightly coupled in JS files.
- Touch regions are calculated from the center of the screen. Use angle math (atan2) for dividing into 4 regions (see below).
- No test framework or linting; manual testing only.

## Example: Dividing Touch Area into 4 Regions
To split the screen into 4 regions from the center using angles:
```js
const centerX = window.innerWidth / 2;
const centerY = window.innerHeight / 2;
document.addEventListener('touchstart', function(e) {
  const touch = e.touches[0];
  const dx = touch.clientX - centerX;
  const dy = centerY - touch.clientY;
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  let region;
  if (angle >= 45 && angle < 135) region = 'top';
  else if (angle >= -45 && angle < 45) region = 'right';
  else if (angle >= -135 && angle < -45) region = 'bottom';
  else region = 'left';
  // ... handle region
});
```

## Integration Points
- No backend or API calls; all logic is client-side.
- For new features, follow the pattern of direct JS/HTML/CSS edits.

---
**Update this file if you add new workflows, dependencies, or major architectural changes.**
