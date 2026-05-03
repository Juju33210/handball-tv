# HandTV — Programme Handball 🤾

Webapp de programme TV handball : tous les matchs diffusés en un coup d'œil.
Scrape automatiquement **lnh.fr** pour récupérer chaînes TV, scores et horaires.

## Fonctionnalités

- 📺 Chaîne TV de diffusion par match (beIN Sports, Handball TV, etc.)
- 🔴 Matchs en direct mis en avant
- 🔔 Notifications configurables (15 min avant coup d'envoi)
- 🔄 Actualisation automatique toutes les 3 minutes
- 📱 PWA installable sur mobile

## Compétitions couvertes

- Liqui Moly Starligue
- ProLigue
- Ligue des Champions EHF
- EHF European League
- Coupe de France

---

## Déploiement sur Netlify

### Prérequis
- Compte Netlify (gratuit)
- Node.js 18+
- Git

### 1. Installer les dépendances
```bash
npm install
```

### 2. Tester en local
```bash
npx netlify dev
```
→ Ouvre http://localhost:8888

### 3. Déployer sur Netlify

**Option A — Via GitHub (recommandé)**
1. Push ce projet sur un repo GitHub
2. Sur netlify.com → "Add new site" → "Import from Git"
3. Sélectionne ton repo
4. Build command : laisser vide
5. Publish directory : `public`
6. Deploy !

**Option B — Via CLI**
```bash
npx netlify login
npx netlify init
npx netlify deploy --prod
```

---

## Architecture

```
handball-tv/
├── public/
│   └── index.html          # Frontend complet (HTML + CSS + JS)
│   └── manifest.json       # PWA manifest
├── netlify/
│   └── functions/
│       ├── matches.mjs     # API /api/matches (scrape lnh.fr)
│       └── scrape-matches.mjs  # Scheduled function (cron 5 min)
├── netlify.toml            # Config Netlify
└── package.json
```

## Comment ça marche

1. Le frontend appelle `/api/matches`
2. La Netlify Function scrape `lnh.fr` en temps réel
3. Les données (matchs, scores, chaînes TV) sont parsées et renvoyées en JSON
4. Le frontend affiche les matchs triés : direct → à venir → terminés

## Personnalisation

Pour ajouter des chaînes TV, modifier le mapping dans `netlify/functions/matches.mjs` :
```js
const TV_CHANNELS = {
  "ma-chaine": { name: "Ma Chaîne", short: "MCH", color: "#...", accent: "#..." },
  // ...
}
```

---

Made with 🤾 and ☕
