# Guide d'Utilisation - Skid-Inc Desktop

Ce guide détaille l'utilisation de l'application desktop Skid-Inc et ses fonctionnalités spécifiques.

## Table des Matières

1. [Démarrage Rapide](#démarrage-rapide)
2. [Interface Utilisateur](#interface-utilisateur)
3. [Système de Sauvegarde](#système-de-sauvegarde)
4. [Gestion des Données](#gestion-des-données)
5. [Paramètres et Configuration](#paramètres-et-configuration)
6. [Mises à Jour](#mises-à-jour)
7. [Conseils et Astuces](#conseils-et-astuces)
8. [FAQ](#faq)
9. [Modding](#modding)

## Démarrage Rapide

### Premier Lancement
1. **Lancez l'application** depuis votre bureau ou menu d'applications
2. **Migration automatique**: Si vous avez des données de la version web, l'application vous proposera de les importer
3. **Configuration initiale**: L'application configure automatiquement la sauvegarde
4. **Commencez à jouer**: Votre progression sera automatiquement sauvegardée

### Navigation de Base
- **Interface identique**: L'application fonctionne exactement comme la version web
- **Menus supplémentaires**: Accès aux fonctionnalités desktop via la barre de menu
- **Raccourcis clavier**: Utilisez les raccourcis pour un accès rapide aux fonctions

## Interface Utilisateur

### Barre de Menu

#### Menu Fichier
- **Nouvelle Partie** (`Ctrl+N`): Recommencer le jeu avec confirmation
- **Sauvegarder Maintenant** (`Ctrl+S`): Force une sauvegarde immédiate
- **Charger Sauvegarde** (`Ctrl+O`): Ouvre la gestion des sauvegardes
- **Exporter Données**: Crée un fichier de sauvegarde externe
- **Importer Données**: Charge des données depuis un fichier
- **Quitter** (`Ctrl+Q`): Ferme l'application avec sauvegarde automatique

#### Menu Édition
- **Annuler** (`Ctrl+Z`): Annule la dernière action (si applicable)
- **Rétablir** (`Ctrl+Y`): Rétablit une action annulée
- **Copier** (`Ctrl+C`): Copie le texte sélectionné
- **Coller** (`Ctrl+V`): Colle le contenu du presse-papiers
- **Sélectionner Tout** (`Ctrl+A`): Sélectionne tout le contenu

#### Menu Affichage
- **Zoom Avant** (`Ctrl++`): Agrandit l'interface
- **Zoom Arrière** (`Ctrl+-`): Réduit l'interface
- **Zoom Normal** (`Ctrl+0`): Rétablit le zoom par défaut
- **Plein Écran** (`F11`): Bascule en mode plein écran
- **Actualiser** (`F5`): Actualise l'interface
- **Outils de Développement** (`F12`): Ouvre la console de débogage

#### Menu Aide
- **Guide d'Utilisation**: Ouvre ce guide
- **Vérifier les Mises à Jour**: Recherche manuellement les mises à jour
- **Signaler un Problème**: Ouvre la page GitHub pour signaler des bugs
- **À Propos**: Informations sur l'application et la version

### Indicateurs d'État

#### Indicateur de Sauvegarde
- **Vert**: Dernière sauvegarde réussie
- **Orange**: Sauvegarde en cours
- **Rouge**: Erreur de sauvegarde
- **Gris**: Sauvegarde désactivée

#### Notifications
- **Coin supérieur droit**: Notifications temporaires
- **Sauvegarde réussie**: Confirmation discrète
- **Erreurs**: Alertes avec options de résolution
- **Mises à jour**: Notifications de nouvelles versions

## Système de Sauvegarde

### Sauvegarde Automatique

#### Fonctionnement
- **Intervalle régulier**: Sauvegarde toutes les 30 secondes
- **Sauvegarde intelligente**: Déclenchée par les changements importants (5 secondes)
- **Détection d'activité**: Pause automatique quand le jeu est inactif
- **Retry automatique**: 3 tentatives en cas d'échec avec délai croissant

#### Types de Sauvegardes
1. **Sauvegarde principale**: `game-state.json` - État actuel du jeu
2. **Sauvegardes horodatées**: `backup-YYYY-MM-DD-HH-MM-SS.json` - Historique
3. **Sauvegarde de récupération**: `recovery.json` - Sauvegarde d'urgence

#### Gestion Automatique
- **Rotation des backups**: Conservation des 50 dernières sauvegardes
- **Nettoyage automatique**: Suppression des sauvegardes de plus de 30 jours
- **Limite d'espace**: Maximum 100 MB pour toutes les sauvegardes
- **Compression**: Compression automatique des anciennes sauvegardes

### Sauvegarde Manuelle

#### Création d'une Sauvegarde
1. **Menu Fichier** > **Sauvegarder Maintenant**
2. **Raccourci**: `Ctrl+S`
3. **Confirmation**: Notification de succès avec horodatage
4. **Nom automatique**: Format `manual-YYYY-MM-DD-HH-MM-SS.json`

#### Avantages
- **Contrôle total**: Sauvegarde à des moments spécifiques
- **Points de contrôle**: Avant des actions risquées
- **Archivage**: Conservation de versions importantes
- **Partage**: Possibilité d'exporter et partager

### Gestion des Sauvegardes

#### Interface de Gestion
Accès via **Menu Fichier** > **Charger Sauvegarde** ou `Ctrl+O`

#### Fonctionnalités
- **Liste chronologique**: Toutes les sauvegardes avec dates et tailles
- **Aperçu**: Informations sur le contenu de chaque sauvegarde
- **Restauration**: Chargement d'une sauvegarde spécifique
- **Suppression**: Nettoyage manuel des sauvegardes
- **Exportation**: Création de fichiers de sauvegarde portables

#### Informations Affichées
- **Date et heure**: Moment de création de la sauvegarde
- **Type**: Automatique, manuelle, ou backup
- **Taille**: Espace occupé par la sauvegarde
- **Niveau**: Niveau du joueur au moment de la sauvegarde
- **Argent**: Montant d'argent dans la sauvegarde
- **Intégrité**: État de validation de la sauvegarde

## Gestion des Données

### Migration depuis la Version Web

#### Processus Automatique
1. **Détection**: L'application détecte automatiquement les données localStorage
2. **Proposition**: Boîte de dialogue de migration au premier lancement
3. **Conversion**: Transformation automatique du format web vers desktop
4. **Validation**: Vérification de l'intégrité des données migrées
5. **Confirmation**: Notification de succès avec résumé

#### Données Migrées
- **Progression du joueur**: Niveau, expérience, argent
- **Serveurs possédés**: Liste complète des serveurs
- **Scripts**: Scripts débloqués et complétés
- **Achievements**: Succès obtenus
- **Paramètres**: Préférences de jeu
- **Statistiques**: Données de progression

#### Résolution de Problèmes
- **Données corrompues**: Tentative de réparation automatique
- **Format incompatible**: Conversion avec valeurs par défaut
- **Échec de migration**: Possibilité de migration manuelle

### Exportation et Importation

#### Exportation de Données
1. **Menu Fichier** > **Exporter Données**
2. **Choisir l'emplacement**: Sélection du dossier de destination
3. **Format JSON**: Fichier `.json` lisible et portable
4. **Métadonnées incluses**: Version, date, checksum

#### Importation de Données
1. **Menu Fichier** > **Importer Données**
2. **Sélection du fichier**: Fichier `.json` compatible
3. **Validation**: Vérification de l'intégrité et compatibilité
4. **Confirmation**: Aperçu des données avant importation
5. **Remplacement**: Option de fusion ou remplacement complet

#### Formats Supportés
- **Skid-Inc Desktop**: Format natif de l'application
- **Skid-Inc Web**: Format localStorage de la version web
- **Sauvegardes externes**: Fichiers créés par d'autres utilisateurs

### Synchronisation et Backup

#### Backup Cloud (Manuel)
- **Services supportés**: Google Drive, Dropbox, OneDrive
- **Processus**: Exportation manuelle vers le service cloud
- **Restauration**: Importation depuis le service cloud
- **Fréquence recommandée**: Hebdomadaire ou avant mises à jour importantes

#### Backup Local
- **Emplacement**: Dossier `backups/` dans le répertoire de sauvegarde
- **Fréquence**: Automatique avec chaque sauvegarde importante
- **Rétention**: 30 jours ou 50 fichiers maximum
- **Compression**: Compression automatique après 7 jours

## Paramètres et Configuration

### Paramètres de Sauvegarde

#### Configuration Automatique
- **Intervalle de sauvegarde**: 15-300 secondes (défaut: 30)
- **Sauvegarde rapide**: 1-30 secondes (défaut: 5)
- **Nombre de backups**: 10-100 (défaut: 50)
- **Durée de rétention**: 7-90 jours (défaut: 30)

#### Options Avancées
- **Compression**: Activation/désactivation de la compression
- **Validation**: Niveau de vérification d'intégrité
- **Notifications**: Personnalisation des alertes
- **Emplacement**: Changement du dossier de sauvegarde

### Paramètres d'Interface

#### Affichage
- **Zoom par défaut**: 50%-200% (défaut: 100%)
- **Mode plein écran**: Activation au démarrage
- **Thème**: Clair, sombre, ou automatique
- **Animations**: Activation/désactivation des effets

#### Notifications
- **Sauvegarde réussie**: Affichage des confirmations
- **Erreurs**: Niveau de détail des messages d'erreur
- **Mises à jour**: Fréquence de vérification
- **Position**: Emplacement des notifications à l'écran

### Paramètres de Performance

#### Optimisation
- **Limite mémoire**: 100-500 MB (défaut: 200)
- **Fréquence de nettoyage**: Garbage collection automatique
- **Cache**: Taille du cache des assets
- **Threads**: Utilisation des processus en arrière-plan

#### Débogage
- **Logs détaillés**: Activation du logging avancé
- **Métriques**: Affichage des statistiques de performance
- **Profiling**: Outils de profilage pour le développement

## Mises à Jour

### Système de Mise à Jour Automatique

#### Vérification Automatique
- **Fréquence**: Au démarrage et toutes les 4 heures
- **Serveur**: GitHub Releases par défaut
- **Discrétion**: Vérification en arrière-plan sans interruption
- **Notification**: Alerte uniquement si mise à jour disponible

#### Processus de Mise à Jour
1. **Notification**: Boîte de dialogue avec détails de la version
2. **Notes de version**: Affichage des nouveautés et corrections
3. **Téléchargement**: Optionnel, sur demande de l'utilisateur
4. **Installation**: Redémarrage automatique pour appliquer
5. **Vérification**: Confirmation de la mise à jour réussie

#### Options Utilisateur
- **Télécharger maintenant**: Installation immédiate
- **Plus tard**: Report de la mise à jour
- **Ignorer cette version**: Masquer une version spécifique
- **Désactiver les mises à jour**: Arrêt complet du système

### Mise à Jour Manuelle

#### Vérification Manuelle
- **Menu Aide** > **Vérifier les Mises à Jour**
- **Vérification immédiate**: Bypass du délai automatique
- **Résultat**: Notification même si aucune mise à jour

#### Installation Manuelle
1. **Téléchargement**: Depuis la page GitHub Releases
2. **Sauvegarde**: Exportation recommandée avant mise à jour
3. **Installation**: Suivre les instructions d'installation standard
4. **Migration**: Importation automatique des données existantes

### Gestion des Versions

#### Versions Stables
- **Canal principal**: Versions testées et validées
- **Fréquence**: Mensuelle ou selon les corrections importantes
- **Compatibilité**: Garantie de compatibilité des sauvegardes

#### Versions Beta
- **Canal de développement**: Nouvelles fonctionnalités en test
- **Activation**: Option dans les paramètres avancés
- **Risques**: Possibles bugs ou instabilités
- **Feedback**: Encouragement à signaler les problèmes

## Conseils et Astuces

### Optimisation des Performances

#### Gestion Mémoire
- **Redémarrage périodique**: Une fois par semaine pour nettoyer la mémoire
- **Fermeture d'autres applications**: Libérer la RAM pour Skid-Inc
- **Surveillance**: Utiliser le gestionnaire de tâches pour surveiller l'usage

#### Sauvegarde Efficace
- **Moments stratégiques**: Sauvegarde manuelle avant actions importantes
- **Nettoyage régulier**: Suppression des anciennes sauvegardes inutiles
- **Backup externe**: Exportation hebdomadaire vers un service cloud

### Utilisation Avancée

#### Raccourcis Productifs
- `Ctrl+S` puis `Ctrl+O`: Sauvegarde rapide et vérification
- `F11`: Mode plein écran pour une immersion totale
- `Ctrl+Shift+I`: Outils de développement pour le débogage

#### Personnalisation
- **Zoom adaptatif**: Ajustement selon la résolution d'écran
- **Notifications discrètes**: Réduction des interruptions
- **Thème sombre**: Réduction de la fatigue oculaire

### Résolution de Problèmes

#### Problèmes Courants
1. **Lenteur**: Redémarrage de l'application
2. **Sauvegarde échouée**: Vérification de l'espace disque
3. **Interface figée**: Actualisation avec F5
4. **Données perdues**: Restauration depuis backup automatique

#### Diagnostic
- **Logs d'erreur**: Consultation des fichiers de log
- **Mode sans échec**: Démarrage avec paramètres par défaut
- **Réinitialisation**: Suppression du cache et des préférences

## FAQ

### Questions Générales

**Q: Puis-je jouer hors ligne?**
R: Oui, l'application fonctionne entièrement hors ligne une fois installée.

**Q: Mes sauvegardes sont-elles compatibles avec la version web?**
R: Oui, vous pouvez exporter/importer entre les versions desktop et web.

**Q: L'application collecte-t-elle des données?**
R: Non, aucune donnée n'est collectée ou transmise. Tout reste local.

**Q: Puis-je modifier l'emplacement des sauvegardes?**
R: Oui, dans les paramètres avancés de l'application.

### Questions Techniques

**Q: Quelle est la taille maximale des sauvegardes?**
R: 100 MB au total pour toutes les sauvegardes, avec compression automatique.

**Q: Combien de sauvegardes sont conservées?**
R: 50 sauvegardes maximum, avec nettoyage automatique après 30 jours.

**Q: L'application fonctionne-t-elle sur ARM (Apple M1/M2)?**
R: Oui, des versions natives sont disponibles pour Apple Silicon.

**Q: Puis-je désactiver les mises à jour automatiques?**
R: Oui, dans les paramètres de l'application.

### Dépannage

**Q: L'application ne démarre pas**
R: Vérifiez les prérequis système et réinstallez si nécessaire.

**Q: Mes sauvegardes ont disparu**
R: Vérifiez le dossier de backup automatique dans le répertoire de sauvegarde.

**Q: L'importation échoue**
R: Vérifiez le format du fichier et sa compatibilité avec la version actuelle.

**Q: Performance dégradée**
R: Redémarrez l'application et vérifiez l'usage mémoire des autres programmes.

---

*Ce guide est mis à jour avec chaque nouvelle version. Pour obtenir de l'aide supplémentaire, consultez la [documentation GitHub](https://github.com/TotomInc/skid-inc) ou signalez un problème.*

## Modding

- Consultez le guide dédié : [`docs/MODDING.md`](./docs/MODDING.md).
- Exemple prêt à l'emploi : [`docs/examples/mods/hello-mod/`](./docs/examples/mods/hello-mod/).
