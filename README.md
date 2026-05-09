# Veracode Defender

[![Deployed on Vercel](https://img.shields.io/badge/Vercel-deployed-0D1117?style=flat-square&logo=vercel&logoColor=white)](https://veracode-defender.vercel.app)
[![Brand](https://img.shields.io/badge/Veracode-2026%20Brand-0065DD?style=flat-square)](https://www.veracode.com)

A 2026 HTML5 rebuild of the 2012 Veracode Defender Flash game, retooled for the AI-coding era and aligned with current Veracode brand guidelines.

> **▶ Play it live: [veracode-defender.vercel.app](https://veracode-defender.vercel.app)**

---

## What's this?

The original Veracode Defender shipped in 2012 as a Flash `.swf` file. Flash has been dead in browsers since 2020, and SWF internals can't be edited for re-branding — so this is a complete rebuild in HTML5 Canvas + vanilla JavaScript, with no build step and no runtime dependencies beyond Google Fonts.

The gameplay is themed around real AppSec concepts so it doubles as a light marketing/community asset:

| Element       | Theme                                                                  |
| ------------- | ---------------------------------------------------------------------- |
| Player ship   | Veracode "V" mark — defending the `// PRODUCTION` zone                |
| Enemies       | SQLi, XSS, RCE, Supply Chain (splits into npm packages), AI Hallucination, Zero-Day boss |
| Power-ups     | SAST, DAST Shield, SCA Blast, Package Firewall, AI Rapid Fix, Triple Patch |
| Wave names    | Legacy Vulns → Runtime Exploits → Modern Threats → AI-Era Threats → Zero-Day Storm |

## Controls

| Key                     | Action                                  |
| ----------------------- | --------------------------------------- |
| `←` `↑` `↓` `→` / `WASD` | Move                                    |
| `Space`                 | Fire scan beam                          |
| `Shift`                 | Deploy Package Firewall (screen clear)  |
| `P` / `Esc`             | Pause                                   |

## Run it locally

No build step. Two options:

```bash
# Option 1 — npm script (uses http-server via npx)
npm run dev

# Option 2 — any static server
npx http-server . -p 4590 -o
```

Or just open `index.html` directly in a browser. (Some browsers block ES modules from `file://`; this game uses a plain script tag so it works either way.)

## Deploy

The project is wired up to Vercel. From this folder:

```bash
npm run deploy
# or: npx vercel deploy --prod
```

Production URL: <https://veracode-defender.vercel.app>

## Project structure

```
VeracodeDefender/
├── index.html              # Entry point + start/pause/game-over screens
├── css/style.css           # Brand-aligned styles (Public Sans, gradients)
├── js/game.js              # Game engine + entities + waves (single file, ~800 lines)
├── assets/logos/           # Veracode 2026 logo + V-mark (SVG + PNG)
├── package.json            # dev / deploy scripts
└── LICENSE                 # Internal-use license
```

## Brand alignment

Pulled directly from the Veracode 2026 Brand Guidelines (Feb 2026):

- **Primary palette** — Veracode Black `#0D1117`, Veracode Blue `#0065DD`, Bright Blue `#00B9FF`
- **Threat palette** — full secondary palette (Pink, Purple, Orange, Yellow, Red) used for enemy types
- **Typography** — Public Sans (400 / 600 / 700 / 900) loaded from Google Fonts
- **Logo** — Veracode "V" mark used as the player ship; full logo in the header
- **Voice** — "We secure the future," "secure from the start," AI-coding era messaging
- **Gradient discipline** — Veracode Blue used in gradients only, never as a flat flood color (per guideline)

## Credits

- Original 2012 Veracode Defender — Veracode Marketing
- 2026 rebuild — Sam Houston, with Claude

## License

See [LICENSE](LICENSE). Source code is for internal/demonstration use; the Veracode name, logo, and brand assets are trademarks of Veracode, Inc.
