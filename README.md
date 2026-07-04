# Drive PWA Starter

Base de PWA perso, installable smartphone, avec stockage Google Drive (gratuit via `appDataFolder`).

## 1) Prérequis Google Cloud

1. Créer un projet Google Cloud
2. Activer **Google Drive API**
3. Configurer l’écran de consentement OAuth
4. Créer un **OAuth Client ID (Web application)**
5. Ajouter les origines autorisées :
   - `http://localhost:5173` (dev)
   - ton domaine de prod (ex: GitHub Pages)
6. Copier le **Client ID**

## 2) Lancer en local

npm run dev

Ouvrir l’URL locale, coller le Client ID dans l’app, cliquer "Se connecter à Google".

## 3) Déploiement GitHub Pages (CI)

Le workflow ci-dessous build et publie automatiquement sur GitHub Pages.

## 4) Stockage

L’app écrit dans `daily-data.json` en `appDataFolder` :
- privé à ton application
- invisible dans “Mon Drive” standard
- quota Drive gratuit (15 Go partagé Google)

## 5) Évolutions conseillées

- chiffrement local des données avant upload
- gestion de conflits (multi-appareils)
- segmentation par fichiers (au lieu d’un JSON unique)
- ajout d’un mode offline-first plus avancé
