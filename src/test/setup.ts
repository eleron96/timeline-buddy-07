import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

const createMemoryStorage = () => {
  const storage = new Map<string, string>();
  return {
    getItem: (key: string) => (storage.has(key) ? storage.get(key)! : null),
    setItem: (key: string, value: string) => {
      storage.set(key, String(value));
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
    clear: () => {
      storage.clear();
    },
    key: (index: number) => Array.from(storage.keys())[index] ?? null,
    get length() {
      return storage.size;
    },
  };
};

const hasValidLocalStorage = () => {
  const storage = window.localStorage as Storage | undefined;
  return Boolean(
    storage
      && typeof storage.getItem === "function"
      && typeof storage.setItem === "function"
      && typeof storage.removeItem === "function"
      && typeof storage.clear === "function",
  );
};

if (!hasValidLocalStorage()) {
  Object.defineProperty(window, "localStorage", {
    writable: true,
    value: createMemoryStorage(),
  });
}
