# 🎥 Stream Catcher for FDM (Firefox Add-on)

Bienvenue dans le dépôt de **Stream Catcher for FDM**, l'extension "ultime" conçue pour pallier les faiblesses de l'extension officielle de Free Download Manager (FDM) sur Firefox.

Créée sur mesure, cette extension agit comme un "renifleur" (sniffer) de flux vidéos ultra-puissant capable de déjouer les protections modernes (HLS, DASH, lecteurs iframe cachés, Voe, Uqload, YouTube) et de relier ces téléchargements directement au logiciel bureau FDM.

---

## ✨ Fonctionnalités Principales Développées

Cette extension n'est pas qu'un simple bouton de téléchargement, c'est un véritable intercepteur de réseau (Network Interceptor) :

### 1. 🕵️‍♂️ Détection de Flux Avancée (M3U8, MP4, DASH)
*   Écoute silencieuse du trafic réseau (`webRequest.onResponseStarted`).
*   Analyse combinée des **Extensions d'URL** (`.m3u8`, `.ts`, `.mp4`) et des **Content-Types** HTTP (`application/x-mpegurl`, `video/mp2t`) pour détecter à tous les coups les vidéos cachées.
*   Extraction et présentation propre du nom du fichier en se basant sur le Titre de l'onglet (`document.title`) plutôt que sur le nom de fichier technique serveur incompréhensible (`master.m3u8`).

### 2. 📺 Support Optimisé pour YouTube
*   Contournement du fameux **Bug 413 (Payload Too Large)** de FDM en supprimant intentionnellement l'envoi des énormes cookies YouTube.
*   Nettoyage drastique de l'URL YouTube envoyée à FDM pour s'assurer que seuls les bons paramètres (`?v=XXXXXX`) soient traités par le moteur de FDM.

### 3. 🧹 Nettoyage Proactif des Iframes (Garbage Collection)
*   **Problème initial :** Les listes de flux s'accumulaient indéfiniment lorsque les sites (comme le streaming d'animes) chargeaient plusieurs lecteurs (Iframes) l'un après l'autre sur la même page.
*   **Solution :** Vérification proactive des Iframes vivants via `webNavigation.getAllFrames()`. Dès qu'un flux est détecté, l'extension supprime de sa mémoire tous les flux appartenant à des lecteurs (iframes) qui ont été détruits ou remplacés. Le compteur reste précis !

### 4. 💾 Persistance Mémoire Anti-Sommeil (Manifest V3)
*   Firefox Manifest V3 "endort" le script de fond (`background.js`) après 30 secondes d'inactivité, créant une amnésie complète des flux.
*   Implémentation d'un système robuste d'**Hydratation et Persistance** via `browser.storage.local`. La mémoire est sauvegardée à chaque action et restaurée en millisecondes au réveil du Service Worker.

### 5. 🎨 Interface Utilisateur Moderne & Minimaliste (UI)
*   **Bouton injecté (`content.js`) :** Un élégant bouton flottant n'apparaît au survol d'une vidéo **QUE SI** un flux téléchargeable est réellement détecté (fini les boutons sur de faux lecteurs pubs).
*   **Popup List (`popup.js`) :** Une interface au clic épurée, sans emojis, utilisant le style Flat Design, regroupant proprement les flux (Manifests, Vidéos, YouTube).
*   **Badges visuels :** Affichage stylisé du format détecté (ex: `MANIFESTS - M3U8`) directement dans la page.

### 6. Conformité Mozilla (AMO)
*   Ajout exhaustif des règles de protection des données (`data_collection_permissions: {"required": ["none"]}`).
*   Nettoyage des avertissements Linter liés aux injections non sécurisées (`innerHTML` remplacé par `document.createElement`).
*   Création d'un ID unique conforme : `stream_catcher_fdm@freedownloadmanager.org`.

---

## 🛠️ Installation & Liaison Automatique (Native Messaging)

Pour que Firefox puisse communiquer avec **Free Download Manager**, une liaison sécurisée doit être établie sur votre ordinateur. Puisque les extensions WebExtensions ne peuvent pas modifier les fichiers système directement, vous devez lancer un petit script d'activation unique.

### 📝 Procédure d'activation :

1.  **Installez l'extension** sur votre navigateur Firefox.
2.  **Téléchargez ce dépôt** (ou juste le fichier `FDM_Linker.bat`).
3.  **Exécutez `FDM_Linker.bat`** en faisant un **clic droit -> Exécuter en tant qu'administrateur**.
    *   Le script va automatiquement détecter votre installation de FDM (via le Registre Windows) et ajouter l'autorisation pour cette extension.
4.  **Redémarrez complètement Firefox.**

🚀 **C'est tout !** FDM autorisera désormais **Stream Catcher** à lui envoyer des interceptions M3U8, DASH et YouTube avec l'ensemble des cookies de session.

---

## 🏗️ Pour les Développeurs (Packaging)

Si vous modifiez l'extension et souhaitez la republier sur **Mozilla Add-ons (AMO)** :

1.  Assurez-vous que l'ID reste `stream_catcher_fdm@freedownloadmanager.org` dans le `manifest.json`.
2.  Compressez uniquement les fichiers sources (dossiers `_locales`, `icons` et les fichiers `.js`, `.html`, `.json`).
3.  **N'incluez pas** le fichier `.bat` dans l'archive `.zip` destinée à Mozilla (le script doit être hébergé sur GitHub ou ailleurs pour l'utilisateur final).

---
*Ce projet est une création indépendante visant à améliorer l'intégration de FDM sur les lectures de médias complexes en ligne.*
