# Requirements Document

## Introduction

Transformation de l'application web SkidInc (jeu idle avec thème hacking) en application Electron native avec système de sauvegarde automatique. L'objectif est de permettre aux utilisateurs d'avoir une expérience desktop native tout en conservant toutes les fonctionnalités existantes du jeu, avec l'ajout d'un système de sauvegarde automatique robuste.

## Glossary

- **Electron_App**: L'application Electron qui encapsule le jeu SkidInc
- **Auto_Save_System**: Le système de sauvegarde automatique qui persiste l'état du jeu
- **Game_State**: L'état complet du jeu incluant le niveau, l'expérience, l'argent, les serveurs, etc.
- **Local_Storage**: Le stockage local du navigateur utilisé actuellement par le jeu
- **File_System**: Le système de fichiers local de l'ordinateur de l'utilisateur
- **Main_Process**: Le processus principal d'Electron qui gère l'application
- **Renderer_Process**: Le processus de rendu d'Electron qui affiche l'interface utilisateur

## Requirements

### Requirement 1

**User Story:** En tant qu'utilisateur, je veux lancer SkidInc comme une application desktop native, afin de pouvoir jouer sans ouvrir un navigateur web.

#### Acceptance Criteria

1. WHEN l'utilisateur lance l'application, THE Electron_App SHALL afficher l'interface complète du jeu SkidInc
2. THE Electron_App SHALL charger tous les assets (CSS, JS, images) depuis les fichiers locaux
3. THE Electron_App SHALL maintenir toutes les fonctionnalités existantes du jeu
4. THE Electron_App SHALL s'ouvrir dans une fenêtre redimensionnable avec une taille minimale de 1024x768 pixels
5. WHEN l'utilisateur ferme la fenêtre, THE Electron_App SHALL se fermer complètement

### Requirement 2

**User Story:** En tant qu'utilisateur, je veux que mon progrès soit sauvegardé automatiquement, afin de ne jamais perdre mes données de jeu.

#### Acceptance Criteria

1. THE Auto_Save_System SHALL sauvegarder le Game_State toutes les 30 secondes
2. WHEN le Game_State change, THE Auto_Save_System SHALL déclencher une sauvegarde dans les 5 secondes
3. THE Auto_Save_System SHALL stocker les données dans le File_System de l'utilisateur
4. THE Auto_Save_System SHALL créer des sauvegardes de backup avec horodatage
5. IF une sauvegarde échoue, THEN THE Auto_Save_System SHALL réessayer jusqu'à 3 fois

### Requirement 3

**User Story:** En tant qu'utilisateur, je veux que mes données soient migrées depuis le navigateur, afin de continuer ma progression existante.

#### Acceptance Criteria

1. WHEN l'application démarre pour la première fois, THE Electron_App SHALL détecter les données existantes dans Local_Storage
2. IF des données Local_Storage existent, THEN THE Electron_App SHALL proposer de les importer
3. THE Electron_App SHALL convertir les données Local_Storage vers le format File_System
4. THE Electron_App SHALL valider l'intégrité des données importées
5. WHEN l'importation est terminée, THE Electron_App SHALL confirmer le succès à l'utilisateur

### Requirement 4

**User Story:** En tant qu'utilisateur, je veux pouvoir gérer mes sauvegardes, afin de contrôler mes données de jeu.

#### Acceptance Criteria

1. THE Electron_App SHALL fournir un menu pour accéder aux options de sauvegarde
2. THE Electron_App SHALL permettre de créer une sauvegarde manuelle à tout moment
3. THE Electron_App SHALL permettre de restaurer depuis une sauvegarde spécifique
4. THE Electron_App SHALL afficher la liste des sauvegardes disponibles avec leurs dates
5. THE Electron_App SHALL permettre de supprimer les anciennes sauvegardes

### Requirement 5

**User Story:** En tant qu'utilisateur, je veux que l'application soit performante et stable, afin d'avoir une expérience de jeu fluide.

#### Acceptance Criteria

1. THE Electron_App SHALL démarrer en moins de 3 secondes
2. THE Auto_Save_System SHALL utiliser moins de 100MB d'espace disque pour les sauvegardes
3. THE Electron_App SHALL maintenir un usage mémoire inférieur à 200MB
4. THE Electron_App SHALL gérer gracieusement les erreurs de sauvegarde sans crasher
5. THE Electron_App SHALL nettoyer automatiquement les sauvegardes de plus de 30 jours

### Requirement 6

**User Story:** En tant qu'utilisateur, je veux des notifications sur l'état des sauvegardes, afin d'être informé du bon fonctionnement du système.

#### Acceptance Criteria

1. WHEN une sauvegarde automatique réussit, THE Electron_App SHALL afficher un indicateur discret
2. IF une sauvegarde échoue, THEN THE Electron_App SHALL afficher une notification d'erreur
3. THE Electron_App SHALL afficher l'heure de la dernière sauvegarde dans l'interface
4. THE Electron_App SHALL permettre de désactiver les notifications de sauvegarde
5. WHEN l'espace disque est insuffisant, THE Electron_App SHALL alerter l'utilisateur