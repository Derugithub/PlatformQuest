# PlatformQuest

PlatformQuest is a 2D side-scrolling platformer for Android phones, played in landscape. This first version ships Zone 1, "Berry Hill": four platforming levels and a boss fight. It is built with Expo and React Native; the gameplay runs in Phaser 3 inside a fully offline WebView.

"PlatformQuest" is a placeholder name. All art, sounds, characters and level names are original.

## Overview

- The React Native shell (expo-router) owns the menus, world map, HUD, popups, saved progress and ads.
- The level itself is a Phaser 3 Arcade Physics game, bundled with the Inter font into one HTML page that is shipped inside the app as a string module (`src/game-html/game-html.js`). Nothing is fetched at runtime.
- The two sides talk through a small, validated `postMessage` protocol (`src/core/protocol.ts`).
- Levels are plain data (`src/core/levels/zone-1.ts`): rows of characters described by `LEGEND` in `src/core/level-format.ts`. A validator simulates the real jump physics and checks that the goal and every checkpoint can be reached.

## Features

- Touch controls: D-pad (left, right, up for vines, down to duck), Jump, Spin ("Eddy jump"), hold-to-Run, Shoot (Tool Box form only) and a contextual Grab / Kick button for shells.
- Movement with momentum, variable jump height, stomps, wall cling / slide / jump (not in the Tool Box suit), tire bounces, vines and moving platforms.
- Hearts: 2 at the start of a level, up to 5. Golden extra-life hearts hidden in blocks are banked for "Another chance".
- Forms: small, Tool Box (white overalls, throws arcing wrenches, breaks bricks) and an 8-second Invincible Star.
- Enemies: slime, turtle with a kickable shell, poison mushroom, spine turtle, flying turtle, banana monkey, and the boss Cinderhorn in 1-5 (10 hits from wrenches or kicked shells).
- Level pieces: item blocks, breakable bricks, hidden blocks, pits, tires, vines, moving platforms, a blue ! switch with dotted blocks, red checkpoint flags and a goal house.
- Countdown timer (300 s, 180 s for the boss). Under 100 s it flashes red and the music speeds up. At 0 the hero freezes in shock, drops off-screen, "Time's up!" shows, then "Mission Failed".
- Zero hearts or a pit opens "Another chance?": "No, thanks" (goes to Mission Failed), "Use" (spends a banked heart, greyed out without one) and a green "+1 heart" rewarded ad (granted only when the reward is earned). A continue respawns at the last checkpoint with 1 heart.
- Mission Failed: Replay (restart from the start), Map, Home.
- Mission Completed: coins, time and 3 stars (finish, defeat all monsters, beat the target time), Replay and Next Level.
- Tutorial tips in 1-1 and 1-2, shown once and skippable.
- Pause menu with Music and Sound toggles, Resume, Restart, Main Menu. Synthesised WebAudio sound effects and music.
- Ads (Google test units only in this version): a banner on the main menu and world map, an interstitial after a completed level at most once every 3 minutes and never after the first two levels of the first session, and the rewarded "+1 heart". Consent is gathered with Google UMP before the SDK starts. Android only.

## Requirements

- Node.js 20 or newer and npm.
- An Android device or emulator with a development build of this app installed (the app uses native modules such as `react-native-google-mobile-ads` and `react-native-webview`, so Expo Go is not enough).
- An Expo account with access to the `@deredo/platformquest` project, for EAS builds.

## Installation

```bash
git clone https://github.com/Derugithub/PlatformQuest.git
cd PlatformQuest
npm install
```

## Configuration

- `app.json`: name, package `com.deredo.platformquest`, landscape orientation, plugins, and the EAS project ID.
- `app.config.ts`: resolves the AdMob Android app ID and `ADS_MODE` per build profile. This version uses Google's sample app ID `ca-app-pub-3940256099942544~3347511713` everywhere.
- `src/lib/ads/production-unit-ids.js`: real ad unit IDs are commented out (`const PRODUCTION_UNIT_IDS = null;`), so every build, production included, uses Google test units. The file explains how to switch to real units.
- `eas.json`: `development` (dev client), `preview` (internal APK) and `production` (auto-incremented) profiles.
- GitHub Actions: `.github/workflows/build.yml` and `local-build.yml` run only when started by hand (`workflow_dispatch`). They need an `EXPO_TOKEN` repository secret.
- Saved data lives in SQLite key-value storage under `platformquest.progress.v1`, `platformquest.settings.v1` and `platformquest.ads.v1`.

## Usage

Start the dev server and open the app in an installed development build:

```bash
npx expo start --dev-client
```

Build an installable APK on EAS:

```bash
npx eas-cli build --platform android --profile preview
```

To try a level in a desktop browser, build the game bundle, save `GAME_HTML` from `src/game-html/game-html.js` to a file and open it with a level hash, for example `game.html#level=1-1` (arrow keys, Z jump, X spin, Shift run, C shoot, V grab).

## Project structure

```text
game/                 Phaser game: scene, procedural art, audio synth, touch controls, bridge
scripts/build-game.mjs  Bundles game/ into src/game-html/game-html.js
src/app/              Screens: main menu, world map, play, settings
src/components/       HUD, popups, buttons, banner, game WebView
src/core/             Pure logic shared by app and game: physics, levels, validator, hearts,
                      timer, scoring, run flow, progress, protocol
src/lib/              Storage, game data provider, ads (consent, policy, units, provider)
tests/                Unit tests (node:test via tsx)
```

## Development

```bash
npm run build:game     # rebuild the game bundle after editing game/ or src/core/
npm test               # unit tests, including a check that the bundle is up to date
npm run typecheck      # tsc --noEmit
npm run lint           # expo lint
npx expo-doctor
npx expo export --platform android
```

Edit levels in `src/core/levels/zone-1.ts`; the level tests fail if a goal or checkpoint becomes unreachable.

## Contributing

Open a pull request against `main`. Keep TypeScript strict (no `any`), run the commands in Development before pushing, and rebuild the game bundle whenever `game/` or `src/core/` changes.

## License

MIT. See [`LICENSE`](LICENSE).
