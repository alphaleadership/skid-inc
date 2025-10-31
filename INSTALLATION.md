# Installation Guide - Skid-Inc

Ce guide vous explique comment installer et utiliser Skid-Inc sur votre système.

## Configuration Système Requise

### Windows
- **Système d'exploitation**: Windows 10 ou plus récent (64-bit)
- **Mémoire**: 4 GB RAM minimum, 8 GB recommandé
- **Espace disque**: 500 MB d'espace libre
- **Processeur**: Intel/AMD 64-bit

### macOS
- **Système d'exploitation**: macOS 10.14 (Mojave) ou plus récent
- **Mémoire**: 4 GB RAM minimum, 8 GB recommandé
- **Espace disque**: 500 MB d'espace libre
- **Processeur**: Intel x64 ou Apple Silicon (M1/M2)

### Linux
- **Distribution**: Ubuntu 18.04+, Debian 10+, CentOS 8+, Fedora 32+, ou équivalent
- **Mémoire**: 4 GB RAM minimum, 8 GB recommandé
- **Espace disque**: 500 MB d'espace libre
- **Processeur**: x86_64 (64-bit)
- **Dépendances**: GTK 3.0, libnotify, libnss3, libxss1, libxtst6, xdg-utils

## Installation

### Windows

#### Option 1: Installateur (Recommandé)
1. Téléchargez le fichier `Skid-Inc-Setup-x.x.x.exe` depuis la [page des releases](https://github.com/TotomInc/skid-inc/releases)
2. Exécutez l'installateur en tant qu'administrateur
3. Suivez les instructions à l'écran
4. L'application sera installée dans `C:\Program Files\Skid-Inc\`
5. Un raccourci sera créé sur le bureau et dans le menu Démarrer

#### Option 2: Version Portable
1. Téléchargez le fichier `Skid-Inc-x.x.x-win.exe`
2. Placez le fichier dans un dossier de votre choix
3. Exécutez directement le fichier - aucune installation requise
4. Les données de sauvegarde seront stockées dans le même dossier

#### Résolution des Problèmes Windows
- **Erreur "Windows a protégé votre PC"**: Cliquez sur "Informations complémentaires" puis "Exécuter quand même"
- **Antivirus bloque l'installation**: Ajoutez une exception pour Skid-Inc dans votre antivirus
- **Erreur de permissions**: Exécutez l'installateur en tant qu'administrateur

### macOS

#### Installation Standard
1. Téléchargez le fichier `Skid-Inc-x.x.x.dmg` depuis la [page des releases](https://github.com/TotomInc/skid-inc/releases)
2. Ouvrez le fichier DMG
3. Glissez l'icône Skid-Inc vers le dossier Applications
4. Lancez l'application depuis le Launchpad ou le dossier Applications

#### Résolution des Problèmes macOS
- **"Skid-Inc ne peut pas être ouvert car il provient d'un développeur non identifié"**:
  1. Allez dans Préférences Système > Sécurité et confidentialité
  2. Cliquez sur "Ouvrir quand même" à côté du message concernant Skid-Inc
  3. Ou utilisez la commande: `sudo xattr -rd com.apple.quarantine /Applications/Skid-Inc.app`

- **Problème de notarisation**: Téléchargez la version ZIP au lieu du DMG

### Linux

#### Ubuntu/Debian (.deb)
```bash
# Téléchargez le fichier .deb
wget https://github.com/TotomInc/skid-inc/releases/download/vx.x.x/skid-inc_x.x.x_amd64.deb

# Installez avec dpkg
sudo dpkg -i skid-inc_x.x.x_amd64.deb

# Résolvez les dépendances si nécessaire
sudo apt-get install -f
```

#### Red Hat/Fedora (.rpm)
```bash
# Téléchargez le fichier .rpm
wget https://github.com/TotomInc/skid-inc/releases/download/vx.x.x/skid-inc-x.x.x.x86_64.rpm

# Installez avec rpm
sudo rpm -i skid-inc-x.x.x.x86_64.rpm

# Ou avec dnf (Fedora)
sudo dnf install skid-inc-x.x.x.x86_64.rpm
```

#### AppImage (Universel)
```bash
# Téléchargez le fichier AppImage
wget https://github.com/TotomInc/skid-inc/releases/download/vx.x.x/Skid-Inc-x.x.x.AppImage

# Rendez-le exécutable
chmod +x Skid-Inc-x.x.x.AppImage

# Exécutez directement
./Skid-Inc-x.x.x.AppImage
```

#### Installation des Dépendances Linux
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install libgtk-3-0 libnotify4 libnss3 libxss1 libxtst6 xdg-utils libatspi2.0-0 libdrm2 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libxkbcommon0 libasound2

# CentOS/RHEL/Fedora
sudo yum install gtk3 libnotify nss libXScrnSaver libXtst xdg-utils at-spi2-atk libdrm libXcomposite libXdamage libXrandr mesa-libgbm libxkbcommon alsa-lib

# Arch Linux
sudo pacman -S gtk3 libnotify nss libxss libxtst xdg-utils at-spi2-atk libdrm libxcomposite libxdamage libxrandr mesa libxkbcommon alsa-lib
```

## Premier Lancement

### Migration des Données
Si vous avez déjà joué à Skid-Inc dans votre navigateur:

1. **Lancez l'application Electron** pour la première fois
2. **Une boîte de dialogue apparaîtra** vous proposant d'importer vos données existantes
3. **Cliquez sur "Importer"** pour transférer votre progression
4. **Vos données seront automatiquement converties** et sauvegardées localement
5. **Confirmez l'importation** une fois terminée

### Configuration Initiale
1. **Paramètres de sauvegarde**: L'application configure automatiquement la sauvegarde automatique
2. **Répertoire de sauvegarde**: Les sauvegardes sont stockées dans:
   - Windows: `%APPDATA%\Skid-Inc\saves\`
   - macOS: `~/Library/Application Support/Skid-Inc/saves/`
   - Linux: `~/.config/Skid-Inc/saves/`

## Utilisation

### Interface Principale
L'application Skid-Inc fonctionne exactement comme la version web, avec des fonctionnalités supplémentaires:

- **Sauvegarde automatique**: Votre progression est sauvegardée toutes les 30 secondes
- **Sauvegarde rapide**: Sauvegarde immédiate lors de changements importants
- **Gestion des sauvegardes**: Accès via le menu "Fichier" > "Gestion des sauvegardes"
- **Notifications**: Indicateurs discrets de l'état des sauvegardes

### Menu de l'Application

#### Fichier
- **Nouvelle partie**: Recommencer le jeu (avec confirmation)
- **Sauvegarder maintenant**: Force une sauvegarde immédiate
- **Charger sauvegarde**: Restaurer depuis une sauvegarde spécifique
- **Gestion des sauvegardes**: Interface complète de gestion
- **Exporter données**: Exporter votre progression
- **Importer données**: Importer une sauvegarde externe
- **Quitter**: Fermer l'application (sauvegarde automatique)

#### Édition
- **Copier**: Copier du texte sélectionné
- **Coller**: Coller du texte
- **Sélectionner tout**: Sélectionner tout le contenu

#### Affichage
- **Zoom avant**: Agrandir l'interface (Ctrl/Cmd + Plus)
- **Zoom arrière**: Réduire l'interface (Ctrl/Cmd + Moins)
- **Zoom normal**: Rétablir le zoom par défaut (Ctrl/Cmd + 0)
- **Plein écran**: Basculer en mode plein écran (F11)
- **Outils de développement**: Ouvrir la console (F12)

#### Aide
- **À propos**: Informations sur l'application
- **Vérifier les mises à jour**: Rechercher manuellement les mises à jour
- **Signaler un problème**: Ouvrir la page des issues GitHub
- **Guide d'utilisation**: Ouvrir cette documentation

### Raccourcis Clavier

#### Généraux
- `Ctrl/Cmd + S`: Sauvegarder maintenant
- `Ctrl/Cmd + O`: Ouvrir la gestion des sauvegardes
- `Ctrl/Cmd + N`: Nouvelle partie
- `Ctrl/Cmd + Q`: Quitter l'application
- `F11`: Plein écran
- `F12`: Outils de développement

#### Zoom
- `Ctrl/Cmd + Plus`: Zoom avant
- `Ctrl/Cmd + Moins`: Zoom arrière
- `Ctrl/Cmd + 0`: Zoom normal

#### Jeu
- `Espace`: Pause/Reprendre (si disponible)
- `Échap`: Fermer les boîtes de dialogue

## Gestion des Sauvegardes

### Sauvegarde Automatique
- **Fréquence**: Toutes les 30 secondes pendant le jeu actif
- **Sauvegarde rapide**: 5 secondes après un changement important
- **Sauvegardes de backup**: Créées automatiquement avec horodatage
- **Nettoyage automatique**: Suppression des sauvegardes de plus de 30 jours

### Sauvegarde Manuelle
1. **Menu Fichier** > **Sauvegarder maintenant**
2. **Raccourci**: `Ctrl/Cmd + S`
3. **Confirmation**: Notification de succès ou d'erreur

### Restauration
1. **Menu Fichier** > **Gestion des sauvegardes**
2. **Sélectionnez** la sauvegarde désirée dans la liste
3. **Cliquez** sur "Restaurer"
4. **Confirmez** l'action (votre progression actuelle sera remplacée)

### Exportation/Importation
- **Exporter**: Crée un fichier `.json` avec vos données
- **Importer**: Charge des données depuis un fichier `.json`
- **Format**: Compatible avec la version web de Skid-Inc

## Mises à Jour

### Mises à Jour Automatiques
- **Vérification**: Automatique au démarrage et toutes les 4 heures
- **Notification**: Boîte de dialogue lors de la disponibilité d'une mise à jour
- **Téléchargement**: Optionnel, sur demande de l'utilisateur
- **Installation**: Redémarrage requis pour appliquer

### Mises à Jour Manuelles
1. **Menu Aide** > **Vérifier les mises à jour**
2. **Téléchargement manuel**: Depuis la [page des releases](https://github.com/TotomInc/skid-inc/releases)
3. **Installation**: Suivre les instructions d'installation standard

## Résolution des Problèmes

### Problèmes de Sauvegarde
- **Erreur de permissions**: Vérifiez les droits d'écriture dans le répertoire utilisateur
- **Espace disque insuffisant**: Libérez de l'espace (minimum 100 MB recommandé)
- **Corruption de données**: L'application tentera une récupération automatique

### Problèmes de Performance
- **Utilisation mémoire élevée**: Redémarrez l'application périodiquement
- **Lenteur**: Fermez les autres applications gourmandes en ressources
- **Plantages**: Vérifiez les logs dans le répertoire de l'application

### Problèmes de Compatibilité
- **Écran haute résolution**: Ajustez le zoom dans le menu Affichage
- **Problèmes graphiques**: Mettez à jour vos pilotes graphiques
- **Audio**: Vérifiez les paramètres audio du système

### Récupération de Données
Si vos sauvegardes sont corrompues:

1. **Sauvegardes automatiques**: Vérifiez le dossier `backups/` dans le répertoire de sauvegarde
2. **Fichiers de récupération**: Recherchez les fichiers `.recovery` 
3. **Importation manuelle**: Utilisez une sauvegarde exportée précédemment
4. **Support**: Contactez le support avec les fichiers de log

## Désinstallation

### Windows
1. **Panneau de configuration** > **Programmes et fonctionnalités**
2. **Sélectionnez** "Skid-Inc" et cliquez sur **Désinstaller**
3. **Ou** utilisez l'outil de désinstallation dans le menu Démarrer

### macOS
1. **Glissez** l'application depuis le dossier Applications vers la Corbeille
2. **Supprimez** les données utilisateur (optionnel):
   ```bash
   rm -rf ~/Library/Application\ Support/Skid-Inc
   rm -rf ~/Library/Preferences/com.totominc.skidinc.plist
   ```

### Linux
```bash
# Pour les packages .deb
sudo apt-get remove skid-inc

# Pour les packages .rpm
sudo rpm -e skid-inc

# Pour AppImage, supprimez simplement le fichier
rm Skid-Inc-x.x.x.AppImage

# Suppression des données utilisateur (optionnel)
rm -rf ~/.config/Skid-Inc
```

## Support et Aide

### Ressources
- **Documentation**: [GitHub Wiki](https://github.com/TotomInc/skid-inc/wiki)
- **Issues**: [GitHub Issues](https://github.com/TotomInc/skid-inc/issues)
- **Discussions**: [GitHub Discussions](https://github.com/TotomInc/skid-inc/discussions)

### Signaler un Problème
1. **Vérifiez** les issues existantes sur GitHub
2. **Collectez** les informations système:
   - Version de l'application (Menu Aide > À propos)
   - Système d'exploitation et version
   - Fichiers de log (si disponibles)
3. **Créez** une nouvelle issue avec une description détaillée

### Logs et Débogage
Les fichiers de log se trouvent dans:
- Windows: `%APPDATA%\Skid-Inc\logs\`
- macOS: `~/Library/Logs/Skid-Inc/`
- Linux: `~/.config/Skid-Inc/logs/`

---

*Cette documentation est mise à jour régulièrement. Pour la version la plus récente, consultez le [repository GitHub](https://github.com/TotomInc/skid-inc).*