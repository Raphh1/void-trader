interface ImportMetaEnv {
  /** Adresse du serveur de salons multijoueur (ex. wss://void-trader.example). */
  readonly VITE_MP_SERVER?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
