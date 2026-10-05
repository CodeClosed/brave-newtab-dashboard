// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveRotatedWallpaperId } from '../extension/js/features/wallpaper.js';

test('5.5 Rotation: "off" mode keeps current activeId', () => {
  const bgConfig = {
    rotation: 'off',
    activeId: 'wp_1',
    wallpapers: [
      { id: 'wp_1', name: 'one.jpg' },
      { id: 'wp_2', name: 'two.jpg' }
    ]
  };

  const chosen = resolveRotatedWallpaperId(bgConfig, 'wp_1', Date.now());
  assert.equal(chosen, 'wp_1');
});

test('5.5 Rotation: "tab" mode picks next wallpaper in sequence avoiding immediate repeat', () => {
  const bgConfig = {
    rotation: 'tab',
    activeId: 'wp_1',
    wallpapers: [
      { id: 'wp_1', name: 'one.jpg' },
      { id: 'wp_2', name: 'two.jpg' },
      { id: 'wp_3', name: 'three.jpg' }
    ]
  };

  const nextFrom1 = resolveRotatedWallpaperId(bgConfig, 'wp_1');
  assert.equal(nextFrom1, 'wp_2');

  const nextFrom2 = resolveRotatedWallpaperId(bgConfig, 'wp_2');
  assert.equal(nextFrom2, 'wp_3');

  const nextFrom3 = resolveRotatedWallpaperId(bgConfig, 'wp_3');
  assert.equal(nextFrom3, 'wp_1');
});

test('5.5 Rotation: "hourly" mode deterministically picks wallpaper by hour bucket', () => {
  const bgConfig = {
    rotation: 'hourly',
    wallpapers: [
      { id: 'wp_0', name: 'zero.jpg' },
      { id: 'wp_1', name: 'one.jpg' },
      { id: 'wp_2', name: 'two.jpg' }
    ]
  };

  const hour0 = 0; // 0th hour -> index 0
  const hour1 = 3600 * 1000; // 1st hour -> index 1
  const hour2 = 3600 * 1000 * 2; // 2nd hour -> index 2
  const hour3 = 3600 * 1000 * 3; // 3rd hour -> index 0

  assert.equal(resolveRotatedWallpaperId(bgConfig, null, hour0), 'wp_0');
  assert.equal(resolveRotatedWallpaperId(bgConfig, null, hour1), 'wp_1');
  assert.equal(resolveRotatedWallpaperId(bgConfig, null, hour2), 'wp_2');
  assert.equal(resolveRotatedWallpaperId(bgConfig, null, hour3), 'wp_0');
});

test('5.5 Rotation: "daily" mode deterministically picks wallpaper by day bucket', () => {
  const bgConfig = {
    rotation: 'daily',
    wallpapers: [
      { id: 'wp_0', name: 'day0.jpg' },
      { id: 'wp_1', name: 'day1.jpg' }
    ]
  };

  const day0 = 0;
  const day1 = 86400 * 1000;
  const day2 = 86400 * 1000 * 2;

  assert.equal(resolveRotatedWallpaperId(bgConfig, null, day0), 'wp_0');
  assert.equal(resolveRotatedWallpaperId(bgConfig, null, day1), 'wp_1');
  assert.equal(resolveRotatedWallpaperId(bgConfig, null, day2), 'wp_0');
});
