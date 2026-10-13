<p align="center"><img src="icon.png" width="120" alt="Icône de PdfCraft Bridge"></p>

<h1 align="center">PdfCraft MCP Server</h1>

<p align="center">
  <a href="README.md">English</a> · <a href="README.es.md">Español</a> · <a href="README.pt-BR.md">Português</a> · <b>Français</b> · <a href="README.de.md">Deutsch</a> · <a href="README.ru.md">Русский</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  Laissez Claude travailler sur vos PDF avec le <b>PdfCraft</b> installé sur votre ordinateur — <b>Windows, macOS et Linux</b> :<br>
  lire, découper, fusionner, organiser, marquer, protéger, caviarder, remplir, signer, convertir, compresser et faire de l'OCR.
</p>

---

## Pourquoi

[PdfCraft](https://github.com/storytold/pdfcraft) est un éditeur PDF open source, du niveau d'Acrobat, écrit en Rust, avec une CLI sans interface (`pdfcraft-cli`) et 131 outils d'automatisation. Ce serveur [Model Context Protocol](https://modelcontextprotocol.io) transforme ce moteur en **outils fichier vers fichier** pour Claude, afin de demander par exemple :

> *« Découpe chaque PDF de `D:\scans` toutes les 10 pages, un dossier par fichier. »*
> *« Ajoute le filigrane « CONFIDENTIEL » et le pied de page « Page 1 sur n » à `~/contrats/nda.pdf`. »*
> *« Caviarde toutes les adresses e-mail et tous les numéros de téléphone de ce rapport. »*
> *« Remplis ce formulaire avec ces valeurs et aplatis-le, puis convertis l'original en Word. »*

Projet frère de [filmcraft-mcp-server](https://github.com/jhonsu01/filmcraft-mcp-server) et [audacity-mcp-server](https://github.com/jhonsu01/audacity-mcp-server).

## Plateformes

| Système | Paquet PdfCraft à installer | Où le serveur le trouve (sans réglage) | État |
| --- | --- | --- | --- |
| **Windows** 10/11 (x64, x86, arm64) | MSI ou zip portable | `C:\Program Files\PdfCraft`, `%LOCALAPPDATA%\Programs\PdfCraft`, `PATH` | ✅ Vérifié (Windows 11) |
| **Linux** (x86_64, aarch64, glibc ≥ 2.35) | `.deb`, `.rpm` ou `.tar.gz` | `/usr/bin`, `/usr/local/bin`, `/opt/pdfcraft/bin`, `~/.local/bin`, `PATH` | ✅ Vérifié (Debian 12, sans interface) |
| **macOS** 11+ (Apple silicon et Intel) | `.dmg` (l'app) **et** `pdfcraft-cli-<version>-macos-universal.zip` | `/Applications/PdfCraft.app`, `/usr/local/bin`, `/opt/homebrew/bin`, `~/.local/bin`, `~/bin`, `PATH` | 🟡 Pris en charge, pas encore testé sur Mac |

Téléchargements : [versions de PdfCraft](https://github.com/storytold/pdfcraft/releases) (il existe aussi un tar.gz pour FreeBSD ; faites pointer `PDFCRAFT_DIR` dessus). Ailleurs : définissez `PDFCRAFT_DIR` (dossier, racine du `.tar.gz` ou `PdfCraft.app`) ou `PDFCRAFT_CLI`.

- **macOS :** le DMG ne contient que l'app. Décompressez le zip séparé de `pdfcraft-cli` et déplacez `pdfcraft-cli` vers `/usr/local/bin` (ou faites pointer `PDFCRAFT_CLI` dessus). Si macOS bloque son premier lancement, autorisez-le dans *Réglages Système → Confidentialité et sécurité*.
- **Linux :** l'AppImage et le Flatpak ne contiennent que l'app, sans `pdfcraft-cli` ; utilisez le deb, le rpm ou le tar.gz. Si l'app est une AppImage, définissez `PDFCRAFT_APP` pour que `open_in_pdfcraft` puisse la lancer. Sur un serveur sans GPU, la configuration vérifiée utilisait `libxkbcommon0 libvulkan1 libegl1 mesa-vulkan-drivers libasound2`.
- **L'OCR** nécessite les modèles de reconnaissance de texte de PdfCraft (`get_pdfcraft_status` indique s'ils sont installés) ; tous les autres outils fonctionnent sans eux.

## Fonctionnement

| Partie | Description |
| --- | --- |
| **Moteur PdfCraft** (`pdfcraft-cli mcp`) | Le moteur sans interface de PdfCraft : lecture, rendu, édition, formulaires, caviardage, chiffrement, signatures, exportateurs. Démarré à neuf pour chaque tâche dans un dossier temporaire privé. |
| **Serveur MCP** (Node.js) | 21 outils de haut niveau. Ouvre les documents dans le moteur, exécute les outils un par un, valide les chemins et n'écrase jamais rien. |

## Outils

| Outil | Rôle |
| --- | --- |
| `get_pdf_info` | Pages et tailles, métadonnées, version, sécurité, champs, signets, commentaires, liens, pièces jointes, polices, signatures |
| `extract_text` | Texte par page dans l'ordre de lecture, éventuellement enregistré en `.txt` |
| `render_pages` | Pages en PNG / JPEG / TIFF (`<nom>_page_001.png`…), avec un aperçu que Claude peut voir |
| `split_pdf` | Toutes les N pages, avant certaines pages, par signets ou par taille ; un dossier par fichier |
| `merge_pdfs` | Fusionne des PDF avec des plages de pages (`"1-3, 6"`) |
| `extract_pages` | Pages choisies dans un nouveau PDF, ou un fichier par page |
| `edit_pages` | Insérer des fichiers ou des pages blanches, dupliquer, faire pivoter, déplacer, supprimer, recadrer, libellés de page, métadonnées |
| `create_pdf` | Nouveau PDF à partir d'images, de texte ou de pages blanches |
| `add_content` | Filigranes texte ou image, en-têtes et pieds de page (numéros, dates, Bates), arrière-plans, zones de texte, images, liens |
| `protect_pdf` | Mots de passe d'ouverture / d'autorisations (AES-256), restrictions d'impression / copie / modification, ou déverrouillage |
| `redact_pdf` | Vrai caviardage de mots, motifs (e-mail, téléphone, SSN, carte, date), zones ou pages, plus nettoyage des informations masquées |
| `fill_form` | Lister, détecter, remplir et aplatir les champs de formulaire |
| `sign_pdf` | Signature numérique avec un ID .p12/.pfx (ou en crée un auto-signé) |
| `convert_pdf` | Word, HTML, RTF, texte, PNG / JPEG / TIFF, PDF/A-2b / 3b |
| `optimize_pdf` | Réduit la taille, supprime éventuellement les informations masquées |
| `ocr_pdf` | Rend les PDF numérisés consultables |
| `compare_pdfs` | Différences entre deux versions, rapport PDF, copie annotée |
| `list_pdf_tools` | Les 131 outils du moteur, avec schémas |
| `run_pdf_tools` | N'importe quels outils du moteur dans une session (références `$docs[0]`, `$steps[N].chemin`) |
| `open_in_pdfcraft` | Ouvre des PDF dans l'app PdfCraft |
| `get_pdfcraft_status` | Plateforme, installation, version, outils du moteur, OCR |

Positions et tailles en **points** (1/72 de pouce) depuis le **coin supérieur gauche** de la page ; `get_pdf_info` donne la taille de chaque page.

## Exemple

```json
{
  "input_path": "/home/moi/contrats/nda.pdf",
  "watermark": { "text": "CONFIDENTIEL", "opacity": 0.25 },
  "header_footer": { "footer_center": "<<Page 1 of n>>", "header_right": "<<yyyy-mm-dd>>" },
  "texts": [ { "page": 1, "text": "Approuvé", "at": [400, 60], "size": 20, "color": "#008800", "bold": true } ],
  "links_from_urls": true
}
```

## Prérequis

- **PdfCraft** avec `pdfcraft-cli` (testé avec **0.4.0**) ; voir [Plateformes](#plateformes)
- Node.js ≥ 20 (fourni avec Claude Desktop pour les installations `.mcpb`)

## Installation

### Claude Desktop (recommandé, toutes plateformes)

1. Téléchargez `pdfcraft-mcp-server.mcpb` depuis la [dernière version](https://github.com/jhonsu01/pdfcraft-mcp-server/releases/latest).
2. Double-cliquez dessus (ou glissez-le dans Claude Desktop → *Paramètres → Extensions*) puis cliquez sur **Installer**.
3. Optionnel : si PdfCraft n'est pas à un emplacement standard, indiquez son dossier ou le chemin de `pdfcraft-cli` dans les réglages de l'extension. Vous pouvez aussi le limiter à un seul dossier.

### Codex (OpenAI)

**Recommandé — le marketplace (reçoit les mises à jour) :** *Plugins → Ajouter → Ajouter un marketplace*, source `jhonsu01/craft-marketplace`, référence `main`, puis installez **PdfCraft Bridge** depuis **Craft Bridges** ([craft-marketplace](https://github.com/jhonsu01/craft-marketplace)). Les nouvelles versions arrivent en actualisant le marketplace. Ou envoyez le zip (Codex le garde dans votre compte et refuse un zip plus récent portant le même nom) :

1. Téléchargez `pdfcraft-mcp-server-<version>-codex.zip` depuis la [dernière version](https://github.com/jhonsu01/pdfcraft-mcp-server/releases/latest).
2. Dans Codex : *Plugins → Ajouter → Nouveau plugin*, choisissez le zip et cliquez sur **Ajouter le plugin**.
3. Codex lance le serveur avec `node` : Node.js ≥ 20 doit donc être dans le `PATH`. Si PdfCraft n'est pas à un emplacement standard, définissez `PDFCRAFT_DIR` ou `PDFCRAFT_CLI` comme variables d'environnement système (Codex n'a pas de formulaire de paramètres pour les plugins locaux).

### DeepSeek Harness

1. *Plugins → Add plugin*, saisissez `github:jhonsu01/craft-marketplace#path:/plugins/pdfcraft-mcp-server` puis cliquez sur **Install**, puis sur **Enable now**.
2. Harness lance le serveur avec son propre client MCP et `node` (Node.js ≥ 20 dans le `PATH`) ; les outils apparaissent sous la forme `mcp__pdfcraft__<outil>` et les fichiers produits comme des cartes qui s'ouvrent dans Harness.
3. Harness ne met pas encore les plugins à jour tout seul : pour mettre à jour, désinstallez le plugin puis réinstallez-le avec la même adresse.

### Claude Code / autres clients MCP

```bash
git clone https://github.com/jhonsu01/pdfcraft-mcp-server.git
cd pdfcraft-mcp-server
npm install
npm run build
```

Windows :

```bash
claude mcp add pdfcraft -- node "%CD%\dist\bundle.cjs"
```

macOS / Linux :

```bash
claude mcp add pdfcraft -- node "$PWD/dist/bundle.cjs"
```

## Configuration

| Variable | Signification |
| --- | --- |
| `PDFCRAFT_DIR` | Dossier de PdfCraft, l'un de ses exécutables, la racine d'un `.tar.gz` (avec `bin/`) ou `PdfCraft.app`. Par défaut : détection automatique |
| `PDFCRAFT_CLI` | Chemin de `pdfcraft-cli` / `pdfcraft-cli.exe` (prioritaire sur `PDFCRAFT_DIR`) |
| `PDFCRAFT_APP` | Chemin de l'app de bureau si elle est ailleurs (par ex. une AppImage Linux) |
| `PDFCRAFT_ROOT` | N'autorise que les fichiers de ce dossier (`pdfcraft-cli mcp --root`) |
| `PDFCRAFT_MCP_TIMEOUT` | Durée maximale en secondes par appel au moteur (3600 par défaut) |

## Sécurité

- Les fichiers ne sont **jamais écrasés** sans `overwrite: true` ; les entrées ne sont jamais modifiées.
- Tous les chemins doivent être absolus. Les mots de passe n'apparaissent jamais dans les résultats.
- Tout s'exécute en local, sans accès réseau. Chaque tâche utilise un moteur privé dans un dossier temporaire supprimé ensuite.

## Développement

```bash
npm run build       # TypeScript + bundle en un seul fichier (dist/bundle.cjs)
npm test            # tests unitaires (logique de chemins Windows, macOS et Linux)
npm run test:e2e    # 29 tests de bout en bout via MCP stdio réel (PDF synthétiques)
npm run pack:mcpb   # pdfcraft-mcp-server.mcpb
npm run pack:codex  # zip de plugin pour Codex
```

Test Linux dans Docker (décompressez d'abord `pdfcraft-<version>-linux-x86_64.tar.gz`) :

```bash
docker run --rm -v "$PWD:/work:ro" -v "/chemin/vers/pdfcraft-0.4.0-linux-x86_64:/opt/pdfcraft:ro" -w /work node:22-bookworm bash -c "apt-get update && apt-get install -y libxkbcommon0 libvulkan1 libegl1 mesa-vulkan-drivers libasound2 && node scripts/e2e.mjs"
```

## Licence

Apache-2.0. PdfCraft est © ses auteurs (Storytold), Apache-2.0.
Ce projet n'est ni affilié à PdfCraft ou Storytold, ni approuvé par eux. Adobe Acrobat est une marque d'Adobe.
