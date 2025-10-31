# Guide de Build et Déploiement - Skid-Inc

Ce guide détaille le système complet de build automatisé et de déploiement pour l'application Skid-Inc.

## Table des Matières

1. [Vue d'ensemble](#vue-densemble)
2. [Scripts de Build](#scripts-de-build)
3. [Système de Déploiement](#système-de-déploiement)
4. [Actions GitHub](#actions-github)
5. [Mise à jour Automatique](#mise-à-jour-automatique)
6. [Configuration](#configuration)
7. [Utilisation](#utilisation)
8. [Dépannage](#dépannage)

## Vue d'ensemble

Le système de build et déploiement de Skid-Inc comprend :

- **Build automatisé** : Scripts pour compiler l'application sur toutes les plateformes
- **Déploiement multi-cible** : Support GitHub Releases et Amazon S3
- **CI/CD complet** : Actions GitHub pour l'intégration continue
- **Mise à jour automatique** : Système intégré de mise à jour dans l'application
- **Documentation complète** : Guides d'installation et d'utilisation

### Architecture

```
build/
├── automated-build.js      # Script de build automatisé principal
├── deploy.js              # Script de déploiement multi-plateforme
├── auto-updater.js        # Gestionnaire de mise à jour automatique
├── prebuild.js            # Script de pré-build et validation
├── build-config.js        # Configuration de build et métadonnées
└── README-DEPLOYMENT.md   # Ce guide

.github/workflows/
├── build-and-release.yml  # Workflow de build et release
├── ci.yml                 # Intégration continue
└── auto-release.yml       # Release automatique sur changement de version
```

## Scripts de Build

### Build Automatisé (`automated-build.js`)

Script principal qui gère l'ensemble du processus de build :

#### Fonctionnalités
- **Validation d'environnement** : Vérification des prérequis
- **Nettoyage automatique** : Suppression des builds précédents
- **Build multi-plateforme** : Support Windows, macOS, Linux
- **Gestion d'erreurs** : Retry automatique et rapports détaillés
- **Métadonnées** : Génération d'informations de build
- **Rapports** : Logs détaillés et statistiques

#### Utilisation

```bash
# Build pour la plateforme courante
npm run build:automated

# Build pour toutes les plateformes
BUILD_PLATFORMS=all npm run build:automated

# Build pour des plateformes spécifiques
BUILD_PLATFORMS=win,mac npm run build:automated

# Build en mode CI
npm run build:ci
```

#### Variables d'environnement

| Variable | Description | Valeurs |
|----------|-------------|---------|
| `BUILD_PLATFORMS` | Plateformes à builder | `current`, `win`, `mac`, `linux`, `all` |
| `SKIP_SIGNING` | Ignorer la signature de code | `true`, `false` |
| `NODE_ENV` | Mode de développement | `development`, `production` |

### Configuration de Build (`build-config.js`)

Gère la configuration et les métadonnées de build :

- **Hash Git** : Récupération du commit actuel
- **Timestamp** : Horodatage de build
- **Informations système** : Plateforme et architecture
- **Validation** : Vérification de la configuration

### Pré-build (`prebuild.js`)

Script de validation exécuté avant chaque build :

- **Validation des fichiers** : Vérification des fichiers requis
- **Nettoyage** : Suppression des builds précédents
- **Validation package.json** : Vérification de la configuration
- **Contrôle d'icônes** : Validation des ressources graphiques

## Système de Déploiement

### Script de Déploiement (`deploy.js`)

Gestionnaire de déploiement multi-cible avec support pour :

#### Cibles Supportées
- **GitHub Releases** : Publication automatique sur GitHub
- **Amazon S3** : Upload vers buckets S3
- **Extensible** : Architecture modulaire pour nouvelles cibles

#### Fonctionnalités
- **Validation d'artefacts** : Vérification des fichiers de build
- **Checksums** : Génération SHA256 pour l'intégrité
- **Notes de release** : Génération automatique depuis Git
- **Mode dry-run** : Test sans déploiement réel
- **Retry automatique** : Gestion des échecs temporaires

#### Utilisation

```bash
# Déploiement vers GitHub
npm run deploy:github

# Déploiement vers S3
npm run deploy:s3

# Déploiement vers toutes les cibles
npm run deploy:all

# Test sans déploiement
npm run deploy:dry-run

# Release complète (build + deploy)
npm run release
```

#### Variables d'environnement

| Variable | Description | Requis pour |
|----------|-------------|-------------|
| `GITHUB_TOKEN` | Token d'accès GitHub | GitHub Releases |
| `GH_TOKEN` | Alternative au GITHUB_TOKEN | GitHub Releases |
| `AWS_ACCESS_KEY_ID` | Clé d'accès AWS | Amazon S3 |
| `AWS_SECRET_ACCESS_KEY` | Clé secrète AWS | Amazon S3 |
| `S3_BUCKET_NAME` | Nom du bucket S3 | Amazon S3 |
| `S3_BUCKET_PREFIX` | Préfixe des objets S3 | Amazon S3 |
| `DEPLOY_TARGETS` | Cibles de déploiement | Toutes |
| `DRY_RUN` | Mode test | Toutes |

## Actions GitHub

### Build and Release (`build-and-release.yml`)

Workflow principal pour les releases :

#### Déclencheurs
- **Tags** : Automatique sur les tags `v*`
- **Manuel** : Via workflow_dispatch avec paramètres

#### Matrice de Build
- **Windows** : x64, NSIS + Portable
- **macOS** : Universal (Intel + Apple Silicon), DMG + ZIP
- **Linux** : x64, AppImage + DEB + RPM

#### Fonctionnalités
- **Cache intelligent** : Electron et dépendances
- **Signature de code** : Support Windows et macOS
- **Artefacts** : Upload automatique des builds
- **Release GitHub** : Création automatique avec notes
- **Checksums** : Génération et upload SHA256SUMS

#### Secrets Requis

```yaml
# Code signing Windows
WIN_CSC_LINK: # Certificat P12 (base64 ou chemin)
WIN_CSC_KEY_PASSWORD: # Mot de passe du certificat

# Code signing macOS
CSC_LINK: # Certificat Developer ID (base64)
CSC_KEY_PASSWORD: # Mot de passe du certificat
APPLE_ID: # Apple ID pour la notarisation
APPLE_ID_PASSWORD: # Mot de passe spécifique à l'app
APPLE_TEAM_ID: # ID de l'équipe Apple Developer
```

### Intégration Continue (`ci.yml`)

Workflow de validation pour les PR et commits :

#### Tests
- **Linting** : Vérification du style de code
- **Tests unitaires** : Exécution des tests
- **Build test** : Compilation sur toutes les plateformes
- **Audit sécurité** : Vérification des vulnérabilités
- **Analyse performance** : Estimation de l'usage mémoire

#### Matrice de Test
- **Ubuntu** : Tests complets + headless
- **Windows** : Build et validation
- **macOS** : Build et validation

### Release Automatique (`auto-release.yml`)

Workflow pour les releases automatiques :

#### Déclencheurs
- **Changement de version** : Détection automatique dans package.json
- **Manuel** : Bump de version avec workflow_dispatch

#### Fonctionnalités
- **Détection de version** : Comparaison avec le commit précédent
- **Création de tags** : Tags Git automatiques
- **Déclenchement** : Lancement du workflow de build

## Mise à jour Automatique

### Gestionnaire (`auto-updater.js`)

Système intégré de mise à jour automatique :

#### Fonctionnalités
- **Vérification automatique** : Au démarrage et périodiquement
- **Notifications utilisateur** : Dialogues informatifs
- **Téléchargement optionnel** : Contrôle utilisateur
- **Installation silencieuse** : Redémarrage automatique
- **Gestion d'erreurs** : Fallback vers téléchargement manuel

#### Configuration
- **Serveur** : GitHub Releases par défaut
- **Fréquence** : Vérification toutes les 4 heures
- **Canaux** : Stable et beta
- **Logs** : Journalisation détaillée

#### Intégration Application

```javascript
// Dans main.js
const AutoUpdateManager = require('../build/auto-updater');

// Initialisation
this.autoUpdateManager = new AutoUpdateManager(this.mainWindow);
this.autoUpdateManager.scheduleUpdateChecks();

// IPC handlers pour le contrôle depuis le renderer
ipcMain.handle('check-for-updates', async () => {
  return await this.autoUpdateManager.checkForUpdates(true);
});
```

## Configuration

### Package.json

Configuration electron-builder intégrée :

```json
{
  "build": {
    "appId": "com.totominc.skidinc",
    "productName": "Skid-Inc",
    "directories": {
      "output": "dist",
      "buildResources": "build"
    },
    "publish": {
      "provider": "github",
      "owner": "TotomInc",
      "repo": "skid-inc"
    }
  }
}
```

### Scripts NPM

Scripts intégrés pour toutes les opérations :

```json
{
  "scripts": {
    "build:automated": "node build/automated-build.js",
    "build:ci": "BUILD_PLATFORMS=current npm run build:automated",
    "build:release": "BUILD_PLATFORMS=all npm run build:automated",
    "deploy": "node build/deploy.js",
    "deploy:github": "DEPLOY_TARGETS=github npm run deploy",
    "deploy:all": "DEPLOY_TARGETS=github,s3 npm run deploy",
    "release": "npm run build:release && npm run deploy:github"
  }
}
```

## Utilisation

### Développement Local

```bash
# Installation des dépendances
npm install

# Build de développement
npm run build:dir

# Build complet local
npm run build:automated

# Test de déploiement
npm run deploy:dry-run
```

### Release Manuelle

```bash
# 1. Mettre à jour la version
npm version patch  # ou minor, major

# 2. Push avec tags
git push origin main --tags

# 3. Le workflow GitHub se déclenche automatiquement
```

### Release Automatique

```bash
# Via GitHub Actions (workflow_dispatch)
# 1. Aller sur GitHub Actions
# 2. Sélectionner "Auto Release"
# 3. Choisir le type de release (patch/minor/major)
# 4. Exécuter
```

### CI/CD Pipeline

1. **Commit/PR** → Déclenchement CI
2. **Tests** → Validation du code
3. **Build test** → Compilation multi-plateforme
4. **Merge** → Intégration dans main
5. **Version bump** → Mise à jour automatique ou manuelle
6. **Tag creation** → Création du tag de version
7. **Release build** → Build complet multi-plateforme
8. **Deployment** → Publication sur GitHub Releases
9. **Auto-update** → Notification aux utilisateurs

## Dépannage

### Problèmes de Build

#### Erreur de signature de code
```bash
# Vérifier les certificats
echo $WIN_CSC_LINK | base64 -d > cert.p12
openssl pkcs12 -info -in cert.p12

# Désactiver temporairement
export SKIP_SIGNING=true
npm run build:automated
```

#### Problème de dépendances natives
```bash
# Reconstruire les modules natifs
npm run postinstall
electron-builder install-app-deps

# Nettoyer le cache
rm -rf node_modules/.cache
npm run build:automated
```

#### Espace disque insuffisant
```bash
# Nettoyer les builds précédents
rm -rf dist/
rm -rf build-errors/

# Vérifier l'espace disponible
df -h
```

### Problèmes de Déploiement

#### Échec GitHub Releases
```bash
# Vérifier le token
gh auth status

# Tester manuellement
gh release create v1.0.0 --title "Test Release" --notes "Test"

# Vérifier les permissions
# Le token doit avoir les scopes: repo, write:packages
```

#### Échec S3
```bash
# Vérifier les credentials AWS
aws sts get-caller-identity

# Tester l'accès au bucket
aws s3 ls s3://your-bucket-name/

# Vérifier les permissions IAM
aws iam get-user
```

### Problèmes d'Auto-update

#### Mise à jour non détectée
```bash
# Vérifier la configuration publish dans package.json
# Vérifier que les releases GitHub sont publiques
# Vérifier les logs electron-log
```

#### Échec de téléchargement
```bash
# Vérifier la connectivité réseau
# Vérifier les permissions de fichier
# Vérifier l'espace disque disponible
```

### Logs et Débogage

#### Logs de build
```bash
# Logs détaillés
DEBUG=electron-builder npm run build:automated

# Logs de déploiement
node build/deploy.js 2>&1 | tee deploy.log
```

#### Logs d'auto-update
```bash
# Emplacement des logs
# Windows: %APPDATA%\Skid-Inc\logs\
# macOS: ~/Library/Logs/Skid-Inc/
# Linux: ~/.config/Skid-Inc/logs/
```

#### Debug GitHub Actions
```bash
# Activer les logs détaillés
# Ajouter dans le workflow :
env:
  ACTIONS_STEP_DEBUG: true
  ACTIONS_RUNNER_DEBUG: true
```

## Bonnes Pratiques

### Versioning
- Utiliser le versioning sémantique (semver)
- Tagger toutes les releases
- Maintenir un CHANGELOG.md

### Sécurité
- Stocker les secrets dans GitHub Secrets
- Utiliser des tokens avec permissions minimales
- Valider tous les inputs utilisateur

### Performance
- Utiliser les caches GitHub Actions
- Paralléliser les builds quand possible
- Optimiser la taille des artefacts

### Monitoring
- Surveiller les métriques de build
- Alertes sur les échecs de déploiement
- Suivi des téléchargements de releases

---

*Ce guide est maintenu à jour avec chaque version. Pour des questions spécifiques, consultez les [GitHub Issues](https://github.com/TotomInc/skid-inc/issues).*