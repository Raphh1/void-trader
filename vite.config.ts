import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Le chunk principal (~578 Ko brut / ~134 Ko gzip) contient le moteur de jeu
    // et les écrans de la boucle principale, volontairement gardés ensemble pour
    // éviter un flash de chargement entre hub / marché / combat. Le seuil est
    // relevé juste au-dessus pour qu'une vraie régression de taille alerte quand même.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // React/i18next/zustand changent bien moins souvent que le jeu :
        // les isoler permet au navigateur de garder ce chunk en cache entre
        // deux déploiements au lieu de tout retélécharger.
        manualChunks(id) {
          if (id.includes('node_modules')) return 'vendor'
        },
      },
    },
  },
})
