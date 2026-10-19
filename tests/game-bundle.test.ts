import assert from 'node:assert/strict';
import test from 'node:test';

import { GAME_HTML, GAME_SOURCE_HASH } from '../src/game-html/game-html.js';
import { sourceHash } from '../scripts/build-game.mjs';

test('the committed game bundle matches the game sources (run npm run build:game)', () => {
  assert.equal(GAME_SOURCE_HASH, sourceHash());
});

test('the game bundle is a single offline page', () => {
  assert.ok(GAME_HTML.startsWith('<!doctype html>'));
  assert.ok(!/<script[^>]+src=/i.test(GAME_HTML), 'no external scripts');
  assert.ok(!/<link[^>]+href=/i.test(GAME_HTML), 'no external stylesheets');
  assert.ok(!/https?:\/\/fonts\./.test(GAME_HTML), 'no web fonts');
  assert.ok(GAME_HTML.includes('data:font/ttf;base64,'), 'Inter is inlined');
});
