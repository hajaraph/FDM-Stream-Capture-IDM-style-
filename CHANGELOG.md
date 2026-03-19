# FDM Stream Capture — Notes de version

## Version 1.5 — 13 Mars 2026

### 🆕 Nouvelles fonctionnalités

#### 🛒 Panier de téléchargement (Catch Log)
- L'extension mémorise automatiquement les 100 derniers flux vidéo/audio détectés lors de votre navigation.
- Idéal pour les sites de streaming où chaque épisode recharge la page : les médias précédents restent accessibles dans le panier.
- Bouton **"Panier"** dans le popup pour consulter l'historique des flux captés.
- Bouton **"Vider"** pour purger le panier d'un clic.

#### 📂 Téléchargement en lot (Mass Downloader / Batch)
- Nouveau bouton **"Scanner la page"** dans le popup.
- Analyse la page active pour détecter tous les liens vers des fichiers médias (MP4, MKV, MP3, PDF, ZIP, etc.) ainsi que les balises `<video>`, `<audio>` et `<source>`.
- Interface de sélection avec cases à cocher et option "Tout cocher / décocher".
- Envoi groupé de tous les fichiers sélectionnés vers FDM en un seul clic.

#### 🎞️ Amélioration du support M3U8
- Meilleure gestion des playlists HLS (.m3u8) : l'extension transmet désormais les métadonnées nécessaires pour permettre à FDM de fusionner automatiquement les pistes audio et vidéo séparées.

### 🔧 Corrections de bugs

- **Correction innerHTML** : Remplacement de toutes les affectations `innerHTML` dynamiques par des méthodes DOM sécurisées (`createElement`, `createTextNode`) pour respecter les exigences de sécurité de Mozilla (CSP / XSS).
- **Correction du nommage batch** : Le moteur de téléchargement en lot accepte désormais correctement les noms de fichiers provenant du panier (`title`) en plus du champ `filename`.

### 🌍 Multilingue

- Ajout de 11 nouvelles clés de traduction (FR + EN) pour l'ensemble de l'interface du Panier et du Scanner de page :
  - `btnScanPage`, `strCart`, `strDlSelected`, `btnClearCart`, `cartEmptyMsg`, `cartSelectMsg`, `cartToggleAll`, `cartSentMsg`, `scanInProgress`, `scanError`

---

## Version 1.1 — 8 Mars 2026

### 🆕 Fonctionnalités initiales
- Détection automatique des flux vidéo (MP4, M3U8, DASH, WebM, MKV).
- Bouton de téléchargement flottant sur les lecteurs vidéo HTML5.
- Scan profond des flux cachés dans le code source des pages (JS Sniffer).
- Envoi direct vers FDM avec cookies, referer et nommage intelligent (style IDM).
- Support natif de YouTube (nettoyage d'URL, fusion audio/vidéo via FDM).
- Filtre anti-bruit (taille minimale configurable).
- Détection optionnelle des sous-titres (.vtt, .srt).
- Page de paramètres complète.
- Interface multilingue (FR / EN).
