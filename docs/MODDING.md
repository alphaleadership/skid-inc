# Modding Guide

Ce document explique comment créer et intégrer des mods dans la version desktop de Skid-Inc.

## 1) Structure d'un dossier de mod

Les mods sont chargés depuis le dossier utilisateur `mods` de l'application (créé automatiquement au premier lancement).

Structure minimale attendue :

```text
<mods>/
  hello-mod/
    mod.json
    index.js
```

Contraintes importantes :

- Le dossier du mod contient **obligatoirement** un fichier `mod.json`.
- `entry` (défini dans `mod.json`) doit pointer vers un fichier `.js` **relatif** au dossier du mod.
- L'entrée ne peut pas sortir du dossier du mod (protection contre les chemins `../...`).

## 2) Format `mod.json`

Le manifeste est validé strictement. Les champs autorisés sont uniquement :

- `id`
- `name`
- `version`
- `entry`
- `apiVersion`
- `gameVersionRange`
- `permissions`

Exemple complet :

```json
{
  "id": "hello-mod",
  "name": "Hello Mod",
  "version": "1.0.0",
  "entry": "index.js",
  "apiVersion": ">=1.0.0 <=1.0.0",
  "gameVersionRange": ">=0.0.0",
  "permissions": ["logger", "hooks:register", "hooks:emit"]
}
```

Règles de validation :

- `id` : chaîne `^[a-z0-9._-]{3,64}$`.
- `name` : chaîne non vide (min 2 caractères).
- `version` : format numérique (`1`, `1.2`, `1.2.3`).
- `entry` : chemin relatif vers un `.js`.
- `apiVersion` : plage de versions simple (ex. `>=1.0.0 <=1.0.0`).
- `gameVersionRange` : plage de versions du jeu (ex. `>=0.0.0`).
- `permissions` : tableau non vide avec permissions reconnues :
  - `hooks:register`
  - `hooks:emit`
  - `logger`

## 3) Hooks disponibles

Le système expose un registre de hooks dynamique.

### Enregistrement

Si le mod possède la permission `hooks:register`, il reçoit :

- `context.hooks.on(hookName, handler)`

Le handler peut être synchrone ou asynchrone.

### Émission

Si le mod possède la permission `hooks:emit`, il reçoit :

- `context.hooks.emit(hookName, payload)`

Retour : tableau de résultats `{ modId, ok, value | error }` pour chaque listener.

### Hooks prédéfinis

À ce stade, il n'existe pas de catalogue fixe de hooks métiers côté jeu. Le système permet d'ajouter et d'émettre des hooks nommés librement entre mods.

## 4) API renderer/main exposée

### API d'un mod (côté process principal)

Chaque phase de cycle de vie reçoit un `context` :

- `manifest` : contenu du manifeste du mod.
- `permissions` : permissions accordées.
- `app.version` : version de l'application desktop.
- `app.modApiVersion` : version de l'API de mod.
- `game.version` : version du jeu détectée.
- `hooks` : présent uniquement selon permissions (`hooks:register`, `hooks:emit`).
- `logger` : présent uniquement avec permission `logger`.

### Cycles de vie supportés

Le module exporté peut définir les fonctions suivantes :

- `onLoad(context)`
- `onEnable(context)`
- `onDisable(context)`
- `onUnload(context)`

### API renderer exposée via `window.electronAPI` (gestion des mods)

Dans le renderer, les méthodes suivantes existent :

- `getModsList()`
- `enableMod(modId)`
- `disableMod(modId)`
- `reloadMods()`
- `getModErrors()`
- `openModsDirectory()`

Ces méthodes reposent sur des handlers IPC côté main (`mods-list`, `mods-enable`, `mods-disable`, `mods-reload`, `mods-get-errors`, `mods-open-directory`).

## 5) Bonnes pratiques performance & sécurité

### Performance

- Garder `onLoad` et `onEnable` très rapides (pas de traitement bloquant lourd).
- Utiliser des hooks ciblés plutôt que des traitements globaux fréquents.
- Éviter les logs excessifs en production.
- Nettoyer correctement les hooks enregistrés lors de `onDisable` / `onUnload`.

### Sécurité

- Demander le **minimum** de permissions nécessaire.
- Ne pas tenter de contourner le sandbox VM : pas de dépendance à des APIs Node non exposées.
- Valider les payloads de hooks avant traitement.
- Gérer les erreurs dans les handlers pour éviter les états dégradés.
- Conserver un `id` unique et stable pour éviter les collisions entre mods.

## 6) Exemple minimal

Un exemple prêt à copier est disponible ici :

- `docs/examples/mods/hello-mod/mod.json`
- `docs/examples/mods/hello-mod/index.js`

Ce mod enregistre un hook `hello:ping` et écrit un log au chargement.
