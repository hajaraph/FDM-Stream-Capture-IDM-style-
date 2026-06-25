# FDM Stream Capture — Notes de version

## Version 2.0.0 — 24 Juin 2026

### UI/UX
- **Thème unifié dark/light** : `theme.css` centralise tous les tokens CSS (couleurs, ombres, rayons, easings). Popup et sidebar partagent le même design language. Dark-mode natif via `prefers-color-scheme` — le popup n'en avait aucun.
- **Glassmorphism** : `backdrop-filter: blur + saturate` sur header, footer et cartes. Suppression totale des gradients (aplats propres).
- **Icônes** : nouvelles `icon48.png` / `icon128.png` — fond bleu nuit `#0f1726`, flèche de téléchargement `#4f86f7`, cohérentes avec le thème.
- **Cartes de flux** : animation `slideIn`, hover `translateY(-1px)`, badges de type portés par les tokens `--type-*`.

### Fonctionnalités
- **Pills d'état temps réel** : badge `En attente / Envoyé à FDM / Navigateur / Terminé / Échec` par carte, branché sur `downloadHistory` via `storage.onChanged`. État optimiste au clic, mise à jour live.
- **Panier fonctionnel** : compteur affiche le nombre de flux détectés. Mode sélection via checkboxes. Boutons "Télécharger (N)" et "Vider" contextuels. Envoi batch via `SEND_BATCH_TO_FDM`.
- **Taille fichier** : `Content-Length` lu depuis les headers HTTP à la détection, stocké dans l'entrée de flux, affiché en badge KB/MB/GB sur chaque carte.
- **Parser HLS / choix de qualité** : pour les flux `.m3u8`, analyse du manifest à la demande. Sélecteur de qualité inline sur la carte (résolution ou Mbps), trié du meilleur au moins bon. Envoi de la variante choisie à FDM.
- **Nettoyage URLs tracking** : `cleanStreamUrl()` supprime les paramètres `utm_*`, `fbclid`, `gclid`, etc. à la détection. URLs HLS/DASH/segments exemptées (tokens d'auth préservés).
- **Anti-doublon session** : `sentUrls` Set en mémoire — un flux déjà envoyé à FDM dans la session ne peut pas être renvoyé. Appliqué au mode unitaire et au batch.

### Background / Détection
- **Handler `SEND_BATCH_TO_FDM`** : ajouté — `sendBatchToFDM()` existait mais n'était jamais appelé depuis les messages.
- **Handler `PARSE_HLS_MANIFEST`** : fetch + parsing du manifest M3U8 côté background, retourne les variantes triées au popup.
- **`parseM3U8()`** : parser léger inline, extrait `EXT-X-STREAM-INF` (BANDWIDTH, RESOLUTION, URL), résout les URLs relatives.
- **`size` dans streamEntry** : `Content-Length` ajouté à chaque flux détecté.

### Build
- **XPI automatique** : `build.bat` génère `dist/fdm-stream-capture-vX.X.X.xpi`, version lue depuis `manifest.json`, chemins forward-slash dans l'archive (fix erreur Firefox "Invalid file name in archive").
- **Fichiers ajoutés au build** : `theme.css`, `sidebar.html`, `sidebar.js`, `content-loader.js`, `onboarding.html`, `onboarding.js`.
- **Chrome supprimé** : `manifest-chrome.json` et cible Chrome retirés — Firefox uniquement.

### Manifest & Conformité AMO
- **Version** : `1.9.0` → `2.0.0`.
- **`strict_min_version`** : `115.0` → `140.0` desktop / `gecko_android: 142.0` (requis pour `data_collection_permissions`).
- **`data_collection_permissions`** : `required: ["websiteActivity"]` — déclaration conforme AMO.
- **Permission `sidebars` supprimée** : inexistante dans l'API Firefox MV3 (sidebar déclarée via `sidebar_action`).
- **`content-loader.js`** : `import()` dynamique remplacé par injection `<script type="module">` via DOM (fix warning AMO sécurité).

---

## Version 1.7 — 19 Mars 2026

### 🚀 Améliorations majeures

#### 🏷️ Moteur de Nommage Intelligent (Style IDM)
- Nouvel algorithme de nettoyage automatique des noms de fichiers.
- Supprime les noms de sites à la fin (ex: "| YouTube", "- Streaming").
- Nettoie les balises SEO (ex: "Watch Online", "Full HD").
- Supprime les tags entre crochets et parenthèses (ex: "[1080p]").
- Nouvelle option activable dans les Paramètres Profil.

#### 🎨 Nouvelle Interface "Card-Based Minimalist"
- Refonte complète du Popup avec un design plus léger et contemporain.
- Utilisation de cartes avec ombres douces et coins arrondis.
- Typographie Sans Serif moderne et aérée (Inter-style).
- Intégration de badges visuels de couleur pour identifier les types de flux (YouTube, HLS, MP4).

#### 🖱️ Bouton Flottant "Pixel Perfect"
- Design aminci et minimaliste du bouton au survol des lecteurs vidéo.
- Suppression des effets de flou (blur) pour une netteté maximale.
- Micro-animations de survol plus fluides sans distorsion.

#### 🧹 Nettoyage Glyphique
- Retrait de tous les emojis et symboles spéciaux de l'interface pour une expérience plus sobre et professionnelle.

### 🔧 Corrections de bugs
- **Correction Panier** : Résolution du bug où le compteur de téléchargement en lot ne se remettait pas à zéro après avoir vidé le panier.
- **Synchronisation Settings** : Amélioration de la réactivité du chargement des paramètres au démarrage de l'extension.

---


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
