// Shim minimal du navigateur : les tests portent sur la logique de jeu et l'i18n,
// pas sur le rendu DOM, donc un jsdom complet serait une dépendance inutile.
// `detectInitialLanguage()` a seulement besoin de localStorage et navigator.language.
const store = new Map<string, string>()

const localStorageStub: Storage = {
  get length() { return store.size },
  clear: () => store.clear(),
  getItem: (k: string) => store.get(k) ?? null,
  key: (i: number) => [...store.keys()][i] ?? null,
  removeItem: (k: string) => { store.delete(k) },
  setItem: (k: string, v: string) => { store.set(k, String(v)) },
}

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageStub,
  writable: true,
  configurable: true,
})

if (!('navigator' in globalThis)) {
  Object.defineProperty(globalThis, 'navigator', {
    value: { language: 'en-US' },
    writable: true,
    configurable: true,
  })
}
