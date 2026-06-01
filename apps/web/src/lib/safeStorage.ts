export function safeStorageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeStorageSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* privacy mode / blocked storage */
  }
}

export function safeStorageRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* privacy mode / blocked storage */
  }
}
