# FDM Stream Capture (Style IDM)

[![Firefox Add-on](https://img.shields.io/badge/Firefox-Add--on-orange.svg)](https://addons.mozilla.org/en-US/firefox/addon/fdm-stream-capture-idm-style/)

Bienvenue dans le dépôt de **FDM Stream Capture**, l'extension "ultime" conçue pour pallier les faiblesses de l'extension officielle de Free Download Manager (FDM) sur Firefox.

Cette extension agit comme un "renifleur" (sniffer) de flux vidéos ultra-puissant capable de déjouer les protections modernes (HLS, DASH, lecteurs iframe cachés, Voe, Uqload, YouTube) et de relier ces téléchargements directement au logiciel bureau FDM.

---

## Installation & Activation Rapide

### 1. Télécharger l'extension
Installez l'extension directement depuis le store officiel :
👉 **[Télécharger sur Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/fdm-stream-capture-idm-style/)**

### 2. Procédure de liaison (Native Messaging) :

Pour que Firefox puisse communiquer avec **Free Download Manager**, une liaison doit être établie. 

1.  **Téléchargez ce dépôt** (bouton vert "Code" -> Download ZIP) ou juste le fichier `FDM_Linker.bat`.
2.  **Exécutez `FDM_Linker.bat`** en faisant un **clic droit -> Exécuter en tant qu'administrateur**.
    *   Le script va automatiquement détecter votre installation de FDM et ajouter l'autorisation pour l'extension.
3.  **Redémarrez complètement Firefox.**

---

## Fonctionnalités Principales

### 1. Détection de Flux Avancée (M3U8, MP4, DASH)
*   Écoute silencieuse du trafic réseau (`webRequest.onResponseStarted`).
*   Analyse combinée des **Extensions d'URL** (`.m3u8`, `.ts`, `.mp4`) et des **Content-Types** HTTP.
*   Extraction propre du nom du fichier basée sur le titre de la page.

### 2. Support Optimisé pour YouTube
*   Contournement du **Bug 413 (Payload Too Large)** de FDM.
*   Nettoyage drastique de l'URL YouTube envoyée à FDM.

### 3. Nettoyage Proactif (Garbage Collection)
*   Vérification des Iframes vivants : les flux sont supprimés de la mémoire dès qu'un lecteur est fermé ou remplacé.

### 4. Persistance Mémoire (Manifest V3)
*   Système d'**Hydratation** via `browser.storage.local` pour éviter l'amnésie du Service Worker de Firefox.

---

## Pour les Développeurs (Packaging)

Si vous souhaitez modifier et republier l'extension :

1.  ID de l'extension : `stream_catcher_fdm@freedownloadmanager.org`
2.  Compressez uniquement les fichiers sources (`_locales`, `icons`, `.js`, `.html`, `.json`).
3.  **N'incluez pas** le fichier `.bat` dans l'archive envoyée à Mozilla.

---
*Ce projet est une création indépendante visant à améliorer l'intégration de FDM sur les lectures de médias complexes en ligne.*
