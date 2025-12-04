const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Octokit } = require('@octokit/rest');

// Récupère la version depuis package.json
const packageJson = require('../package.json');
const version = packageJson.version;
const tag = `v${version}`;

// Initialise Octokit avec ton token GitHub
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN // Utilise le token depuis les secrets GitHub
});

// Fonction pour calculer le SHA256 d'un fichier
function calculateSha256(filePath) {
  if (!fs.existsSync(filePath)) return '';
  const hash = execSync(`sha256sum ${filePath}`).toString().split(' ')[0];
  return hash.trim();
}

// Fonction pour obtenir la taille d'un fichier
function getFileSize(filePath) {
  if (!fs.existsSync(filePath)) return 0;
  const stats = fs.statSync(filePath);
  return stats.size;
}

// Génère le contenu du fichier latest.yml
function generateLatestYaml(files) {
  let yamlContent = `version: ${tag}\nfiles:\n`;

  files.forEach(file => {
    if (fs.existsSync(file.path)) {
      const sha256 = calculateSha256(file.path);
      const size = getFileSize(file.path);
      yamlContent += `  - url: https://github.com/alphaleadership/skid-inc/releases/download/${tag}/${path.basename(file.path)}\n`;
      yamlContent += `    sha256: ${sha256}\n`;
      yamlContent += `    size: ${size}\n`;
    }
  });

  yamlContent += `path: Skid-Inc-Setup-${version}.exe\n`;
  yamlContent += `sha256: ${calculateSha256('./dist/win-unpacked/Skid-Inc-Setup-${version}.exe')}\n`;
  yamlContent += `releaseName: Skid-Inc ${tag}\n`;
  yamlContent += `releaseNotes: "Automatically generated release for version ${version}"\n`;
  yamlContent += `releaseDate: ${new Date().toISOString()}\n`;

  return yamlContent;
}

// Fonction principale
async function main() {
  try {
    // Liste des fichiers à inclure dans latest.yml
    const files = [
      { name: 'Windows Installer', path: './dist/win-unpacked/Skid-Inc-Setup-${version}.exe' },
      { name: 'Windows Portable', path: './dist/win-unpacked/Skid-Inc-${version}-win.exe' },
  
      { name: 'Linux AppImage', path: './dist/linux-unpacked/Skid-Inc-${version}.AppImage' },
      { name: 'Linux DEB', path: './dist/skid-inc_${version}_amd64.deb' },
      { name: 'Linux RPM', path: './dist/skid-inc-${version}.x86_64.rpm' },
    ];

    // Génère le contenu du fichier latest.yml
    const latestYamlContent = generateLatestYaml(files);

    // Écrit le fichier latest.yml
    fs.writeFileSync('./latest.yml', latestYamlContent);
    console.log('Fichier latest.yml généré avec succès !');

    // Récupère l'ID de la release
    const release = await octokit.rest.repos.getReleaseByTag({
      owner: 'alphaleadership',
      repo: 'skid-inc',
      tag: tag,
    });

    // Upload le fichier latest.yml à la release
    await octokit.rest.repos.uploadReleaseAsset({
      owner: 'alphaleadership',
      repo: 'skid-inc',
      release_id: release.data.id,
      name: 'latest.yml',
      data: fs.readFileSync('./latest.yml'),
    });

    console.log('Fichier latest.yml ajouté à la release avec succès !');
  } catch (error) {
    console.error('Erreur :', error);
    process.exit(1);
  }
}

// Exécute la fonction principale
main();
