// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GRID_STEP_X,
  GRID_STEP_Y,
  rectsOverlap,
  rectInBounds,
  rectFits,
  clampRectToBounds,
  snapMoveRect,
  snapDimension,
  findFreeSpot,
  resizeRect
} from '../extension/js/features/home-editor.js';
import { GRID_CELL_WIDTH, GRID_CELL_HEIGHT } from '../extension/js/features/widget-drag.js';

const bounds = { left: 12, top: 12, right: 1012, bottom: 788 };

test('Home editor: rectsOverlap ignores touching edges and tiny overlaps', () => {
  const a = { left: 0, top: 0, width: 100, height: 100 };
  assert.equal(rectsOverlap(a, { left: 100, top: 0, width: 50, height: 50 }), false, 'touching edges');
  assert.equal(rectsOverlap(a, { left: 99, top: 0, width: 50, height: 50 }), false, 'overlap below tolerance');
  assert.equal(rectsOverlap(a, { left: 50, top: 50, width: 100, height: 100 }), true, 'real overlap');
});

test('Home editor: clampRectToBounds keeps a rect on screen without resizing it', () => {
  const r = clampRectToBounds({ left: -50, top: 900, width: 200, height: 100 }, bounds);
  assert.deepEqual(r, { left: 12, top: 688, width: 200, height: 100 });
  assert.equal(rectInBounds(r, bounds), true);
});

test('Home editor: snapMoveRect snaps to the half-cell grid and to the center guide', () => {
  const panel = { width: 1000, height: 800 };
  const snapped = snapMoveRect({ left: 133, top: 97, width: 200, height: 80 }, panel);
  assert.equal(snapped.left % GRID_STEP_X, 0);
  assert.equal(snapped.top % GRID_STEP_Y, 0);

  const centered = snapMoveRect({ left: 395, top: 100, width: 200, height: 80 }, panel);
  assert.equal(centered.left, 400, 'center of a 200px widget lands on x=500');

  const free = snapMoveRect({ left: 133, top: 97, width: 200, height: 80 }, panel, true);
  assert.deepEqual(free, { left: 133, top: 97, width: 200, height: 80 });
});

test('Home editor: snapDimension snaps to whole cells inside min/max', () => {
  assert.equal(snapDimension(250, GRID_CELL_WIDTH, 240, 960), 240);
  assert.equal(snapDimension(100, GRID_CELL_WIDTH, 240, 960), 240);
  assert.equal(snapDimension(5000, GRID_CELL_WIDTH, 240, 960), 960);
  assert.equal(snapDimension(333, GRID_CELL_WIDTH, 240, 960, true), 333);
});

test('Home editor: findFreeSpot returns the same slot when free and the nearest slot when occupied', () => {
  const target = { left: 300, top: 300, width: 200, height: 100 };
  assert.deepEqual(findFreeSpot(target, [], bounds), target);

  const blocker = { left: 300, top: 300, width: 200, height: 100 };
  const spot = findFreeSpot(target, [blocker], bounds);
  assert.ok(spot, 'a free spot exists');
  assert.equal(rectFits(spot, [blocker], bounds), true);
  const moved = Math.hypot(spot.left - target.left, spot.top - target.top);
  assert.ok(moved <= Math.max(blocker.width, blocker.height) + GRID_STEP_X, 'spot is adjacent, not far away');
});

test('Home editor: findFreeSpot returns null when the screen has no room', () => {
  const tiny = { left: 0, top: 0, right: 300, bottom: 200 };
  const full = [{ left: 0, top: 0, width: 300, height: 200 }];
  assert.equal(findFreeSpot({ left: 0, top: 0, width: 100, height: 100 }, full, tiny), null);
});

test('Home editor: resizeRect keeps the opposite edge fixed and snaps to cells', () => {
  const spec = { minW: 240, maxW: 960, minH: 80, maxH: 600, resizeMode: 'both' };
  const start = { left: 300, top: 200, width: 360, height: 160 };

  const right = resizeRect(start, 'right', 62, 0, spec);
  assert.equal(right.left, 300);
  assert.equal(right.width % GRID_CELL_WIDTH, 0);

  const left = resizeRect(start, 'left', -120, 0, spec);
  assert.equal(left.left + left.width, 660, 'right edge stays put');
  assert.equal(left.width, 480);

  const corner = resizeRect(start, 'corner', 60, 40, spec);
  assert.equal(corner.width, 420);
  assert.equal(corner.height % GRID_CELL_HEIGHT, 0);

  const top = resizeRect(start, 'top', 0, -80, spec);
  assert.equal(top.top + top.height, 360, 'bottom edge stays put');
});

test('Home editor: horizontal-only widgets (search) never change height', () => {
  const spec = { minW: 240, maxW: 960, minH: 44, maxH: 80, resizeMode: 'horizontal' };
  const start = { left: 100, top: 100, width: 420, height: 48 };
  const next = resizeRect(start, 'corner', 120, 200, spec);
  assert.equal(next.height, 48);
  assert.equal(next.width, 540);
});
