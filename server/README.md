# Serveur multijoueur de Void Trader

Relais WebSocket pour les salons entre amis. Il ne fait tourner aucune logique de jeu : chaque joueur garde sa partie dans son navigateur, le serveur partage seulement qui est où, à quel jour, avec quelle fortune, et relaie les échanges (prix, dons, morts, victoires). Tout vit en mémoire : un redémarrage efface les salons.

## Lancer

```sh
npm --prefix server install     # une seule fois
npm run server                  # port 8787
```

Entre amis sur le même réseau : lance aussi le jeu avec `npx vite --host`. Les autres ouvrent `http://<ton-ip>:5173`, et le jeu trouve tout seul le serveur sur `ws://<ton-ip>:8787`.

## Mettre en ligne

Il faut un hébergeur Node qui fournit le HTTPS (Render, Fly.io, Railway…), avec le dossier `server/` et la commande `node index.mjs`.

| Variable | Rôle |
|---|---|
| `PORT` | Port d'écoute (fourni par l'hébergeur en général) |
| `ALLOWED_ORIGINS` | Adresse(s) exacte(s) du jeu, séparées par des virgules, ex. `https://mon-jeu.example`. Sans elle, seules les pages en local ou sur le réseau de la maison sont acceptées. |

Côté jeu, construis avec `VITE_MP_SERVER=wss://ton-serveur.example npm run build`. On peut aussi saisir l'adresse dans le menu multijoueur (« Serveur »).

## Note de sécurité

- **Rôle** : relais de salons multijoueur, sans compte ni base de données.
- **Installation** : dossier `server/` du dépôt ou hébergeur Node. Rien ne s'installe sur les postes des joueurs.
- **Démarrage** : rien ne se lance au démarrage de la machine. Le serveur tourne seulement quand on le lance (ou sur l'hébergeur).
- **Réseau** : un port TCP entrant (HTTP + WebSocket, 8787 par défaut), et `GET /health` pour la supervision. Aucune connexion sortante. En ligne, uniquement derrière du HTTPS (`wss://`).
- **Privilèges** : aucun, il tourne en simple utilisateur.
- **Données** : un pseudo choisi par le joueur, en mémoire seulement, jamais écrit dans les journaux (qui ne contiennent que des compteurs). Les jetons de reconnexion ne sont pas journalisés non plus.
- **Protections** : origines filtrées, messages limités à 2 Ko et validés (type, format, longueur), 80 messages par 10 s et par connexion, 6 joueurs par salon, 200 salons maximum, salons vides supprimés au bout de 2 h. Les effets de prix sont fixés par le serveur, et un don ne passe qu'entre joueurs à quai dans la même station.
- **Limite connue** : chaque joueur calcule sa partie chez lui, le serveur lui fait confiance (crédits, jour). C'est fait pour jouer entre amis, pas pour un classement public.

À faire relire par l'équipe sécurité avant une mise en ligne publique.
