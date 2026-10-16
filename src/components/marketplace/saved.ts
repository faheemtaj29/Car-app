"use client";

/** Saved (♥) and compare lists live in the browser: no account needed. */
export type SavedRef = { id: string; type: "car" | "bike" };
const SAVED = "am_saved_v1";
const COMPARE = "am_compare_v1";
export const SAVED_EVENT = "am-saved-changed";
export const MAX_COMPARE = 3;

function read(key: string): SavedRef[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(raw) ? raw.filter((r) => typeof r?.id === "string" && /^[a-f0-9]{24}$/i.test(r.id)) : [];
  } catch {
    return [];
  }
}

function write(key: string, list: SavedRef[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* storage blocked: lists live for this page only */
  }
  window.dispatchEvent(new Event(SAVED_EVENT));
}

export const savedList = () => read(SAVED);
export const compareList = () => read(COMPARE);

export function toggleSaved(ref: SavedRef) {
  const list = read(SAVED);
  const next = list.some((r) => r.id === ref.id) ? list.filter((r) => r.id !== ref.id) : [ref, ...list].slice(0, 30);
  write(SAVED, next);
}

/** Returns false when the compare list is already full. */
export function toggleCompare(ref: SavedRef) {
  const list = read(COMPARE);
  if (list.some((r) => r.id === ref.id)) {
    write(COMPARE, list.filter((r) => r.id !== ref.id));
    return true;
  }
  if (list.length >= MAX_COMPARE) return false;
  write(COMPARE, [...list, ref]);
  return true;
}

export const clearCompare = () => write(COMPARE, []);
