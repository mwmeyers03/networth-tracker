export type EditPath = readonly (string | number)[];

function container(value: unknown): Record<string | number, unknown> {
  if (value === null || typeof value !== 'object') throw new Error('Invalid editable path.');
  return value as Record<string | number, unknown>;
}

export function readPath(root: unknown, path: EditPath): unknown {
  let value = root;
  for (const key of path) {
    if (value === null || typeof value !== 'object') return undefined;
    value = container(value)[key];
  }
  return value;
}

export function writePath(root: unknown, path: EditPath, value: unknown): void {
  if (!path.length || path.some(key => ['__proto__', 'constructor', 'prototype'].includes(String(key)))) {
    throw new Error('Invalid editable path.');
  }
  let cursor = root;
  for (const key of path.slice(0, -1)) cursor = container(cursor)[key];
  container(cursor)[path[path.length - 1]] = value;
}
