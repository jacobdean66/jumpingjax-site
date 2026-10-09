// Adapted from coding-by-feng/ai-agent-session-center, commit 0943ff5cdddd1862e67738d379953b4fcc14a1b4.
// Copyright (c) 2026 Kason Zhan. MIT license: public/licenses/ai-agent-session-center.txt.
/**
 * Shared rounded geometry for the diorama scene style.
 *
 * The cyberdrome style is built from sharp `BoxGeometry`. The diorama wants the same shapes with
 * softly rounded edges — a toy-like look that also catches light along the edges. A rounded box has
 * far more vertices than a plain one, so these are built ONCE per size and shared by every mesh that
 * uses them: a geometry per robot (or per desk chair) would be GPU churn with fifty sessions.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/** A side thinner than this stays a plain box — rounding a 5 mm screen would only fold it over itself. */
const MIN_ROUNDABLE = 0.02;
/** Radius as a share of the smallest side: under half, so opposite corner arcs can never meet. */
const ROUND_FRACTION = 0.45;
/** …and never rounder than this, so a big slab keeps a crisp silhouette. */
const MAX_RADIUS = 0.06;

const roundedByKey = new Map<string, THREE.BufferGeometry>();

/**
 * A rounded box of the given size, shared across callers. `segments` is how finely each corner is
 * rounded: 2 for the robots (seen up close), 1 for scenery drawn hundreds of times.
 */
export function roundedBox(
  width: number,
  height: number,
  depth: number,
  segments = 2,
): THREE.BufferGeometry {
  const key = `${width}|${height}|${depth}|${segments}`;
  const known = roundedByKey.get(key);
  if (known) return known;

  const smallest = Math.min(width, height, depth);
  const geometry =
    smallest < MIN_ROUNDABLE
      ? new THREE.BoxGeometry(width, height, depth)
      : new RoundedBoxGeometry(width, height, depth, segments, Math.min(MAX_RADIUS, smallest * ROUND_FRACTION));
  roundedByKey.set(key, geometry);
  return geometry;
}
