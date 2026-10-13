<p align="center"><img src="icon.png" width="120" alt="Ícone do PdfCraft Bridge"></p>

<h1 align="center">PdfCraft MCP Server</h1>

<p align="center">
  <a href="README.md">English</a> · <a href="README.es.md">Español</a> · <b>Português</b> · <a href="README.fr.md">Français</a> · <a href="README.de.md">Deutsch</a> · <a href="README.ru.md">Русский</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  Deixe o Claude trabalhar com PDFs usando o <b>PdfCraft</b> instalado no seu computador — <b>Windows, macOS e Linux</b>:<br>
  ler, dividir, juntar, organizar, marcar, proteger, ocultar, preencher, assinar, converter, comprimir e fazer OCR.
</p>

---

## Por quê

O [PdfCraft](https://github.com/storytold/pdfcraft) é um editor de PDF de código aberto, no nível do Acrobat, escrito em Rust, com uma CLI sem interface (`pdfcraft-cli`) e 131 ferramentas de automação. Este servidor [Model Context Protocol](https://modelcontextprotocol.io) transforma esse motor em **ferramentas de arquivo para arquivo** para o Claude, para pedir coisas como:

> *"Divida cada PDF de `D:\digitalizados` a cada 10 páginas, uma pasta por arquivo."*
> *"Adicione a marca d'água 'CONFIDENCIAL' e o rodapé 'Página 1 de n' em `~/contratos/nda.pdf`."*
> *"Oculte todos os e-mails e telefones deste relatório."*
> *"Preencha este formulário com estes dados e achate-o; depois converta o original para Word."*

Irmão do [filmcraft-mcp-server](https://github.com/jhonsu01/filmcraft-mcp-server) e do [audacity-mcp-server](https://github.com/jhonsu01/audacity-mcp-server).

## Plataformas

| Sistema | Pacote do PdfCraft a instalar | Onde o servidor o encontra (sem configurar) | Status |
| --- | --- | --- | --- |
| **Windows** 10/11 (x64, x86, arm64) | MSI ou zip portátil | `C:\Program Files\PdfCraft`, `%LOCALAPPDATA%\Programs\PdfCraft`, `PATH` | ✅ Verificado (Windows 11) |
| **Linux** (x86_64, aarch64, glibc ≥ 2.35) | `.deb`, `.rpm` ou `.tar.gz` | `/usr/bin`, `/usr/local/bin`, `/opt/pdfcraft/bin`, `~/.local/bin`, `PATH` | ✅ Verificado (Debian 12, sem interface) |
| **macOS** 11+ (Apple silicon e Intel) | `.dmg` (o app) **mais** `pdfcraft-cli-<versão>-macos-universal.zip` | `/Applications/PdfCraft.app`, `/usr/local/bin`, `/opt/homebrew/bin`, `~/.local/bin`, `~/bin`, `PATH` | 🟡 Suportado, ainda não testado em um Mac |

Downloads: [versões do PdfCraft](https://github.com/storytold/pdfcraft/releases) (há também um tar.gz para FreeBSD; aponte `PDFCRAFT_DIR` para ele). Em qualquer outro local: defina `PDFCRAFT_DIR` (pasta, raiz do `.tar.gz` ou `PdfCraft.app`) ou `PDFCRAFT_CLI`.

- **macOS:** o DMG contém apenas o app. Descompacte o zip separado do `pdfcraft-cli` e mova `pdfcraft-cli` para `/usr/local/bin` (ou aponte `PDFCRAFT_CLI` para ele). Se o macOS bloquear a primeira execução, permita em *Ajustes do Sistema → Privacidade e Segurança*.
- **Linux:** o AppImage e o Flatpak contêm apenas o app, sem `pdfcraft-cli`; use o deb, o rpm ou o tar.gz. Se o app for um AppImage, defina `PDFCRAFT_APP` para que `open_in_pdfcraft` consiga iniciá-lo. Em um servidor sem GPU, a configuração verificada usou `libxkbcommon0 libvulkan1 libegl1 mesa-vulkan-drivers libasound2`.
- **OCR** precisa dos modelos de reconhecimento de texto do PdfCraft (`get_pdfcraft_status` informa se estão instalados); todas as outras ferramentas funcionam sem eles.

## Como funciona

| Parte | O que é |
| --- | --- |
| **Motor do PdfCraft** (`pdfcraft-cli mcp`) | O próprio motor sem interface do PdfCraft: leitura, renderização, edição, formulários, ocultação, criptografia, assinaturas, exportadores. Iniciado do zero para cada tarefa em uma pasta temporária privada. |
| **Servidor MCP** (Node.js) | 21 ferramentas de alto nível. Abre os documentos no motor, executa as ferramentas uma por vez, valida caminhos e nunca sobrescreve. |

## Ferramentas

| Ferramenta | O que faz |
| --- | --- |
| `get_pdf_info` | Páginas e tamanhos, metadados, versão, segurança, campos, marcadores, comentários, links, anexos, fontes, assinaturas |
| `extract_text` | Texto por página em ordem de leitura, opcionalmente salvo como `.txt` |
| `render_pages` | Páginas como PNG / JPEG / TIFF (`<nome>_page_001.png`…), com uma prévia que o Claude pode ver |
| `split_pdf` | A cada N páginas, antes de certas páginas, por marcadores ou por tamanho; uma pasta por arquivo |
| `merge_pdfs` | Junta PDFs com intervalos de páginas (`"1-3, 6"`) |
| `extract_pages` | Páginas escolhidas em um PDF novo, ou um arquivo por página |
| `edit_pages` | Inserir arquivos ou páginas em branco, duplicar, girar, mover, excluir, recortar, rótulos de página, metadados |
| `create_pdf` | PDF novo a partir de imagens, texto ou páginas em branco |
| `add_content` | Marcas d'água de texto ou imagem, cabeçalhos e rodapés (números de página, datas, Bates), fundos, caixas de texto, imagens, links |
| `protect_pdf` | Senhas de abertura / permissões (AES-256), restrições de impressão / cópia / alterações, ou desbloquear |
| `redact_pdf` | Ocultação real de palavras, padrões (e-mail, telefone, SSN, cartão, data), áreas ou páginas, mais limpeza de informações ocultas |
| `fill_form` | Listar, detectar, preencher e achatar campos de formulário |
| `sign_pdf` | Assinatura digital com um ID .p12/.pfx (ou cria um autoassinado) |
| `convert_pdf` | Word, HTML, RTF, texto, PNG / JPEG / TIFF, PDF/A-2b / 3b |
| `optimize_pdf` | Reduz o tamanho, opcionalmente remove informações ocultas |
| `ocr_pdf` | Torna PDFs digitalizados pesquisáveis |
| `compare_pdfs` | Diferenças entre duas versões, relatório em PDF, cópia marcada |
| `list_pdf_tools` | As 131 ferramentas do motor, com esquemas |
| `run_pdf_tools` | Qualquer ferramenta do motor em uma sessão (referências `$docs[0]`, `$steps[N].caminho`) |
| `open_in_pdfcraft` | Abre PDFs no app PdfCraft |
| `get_pdfcraft_status` | Plataforma, instalação, versão, ferramentas do motor, OCR |

Posições e tamanhos são em **pontos** (1/72 de polegada) a partir do **canto superior esquerdo** da página; `get_pdf_info` informa o tamanho de cada página.

## Exemplo

```json
{
  "input_path": "/home/eu/contratos/nda.pdf",
  "watermark": { "text": "CONFIDENCIAL", "opacity": 0.25 },
  "header_footer": { "footer_center": "<<Page 1 of n>>", "header_right": "<<yyyy-mm-dd>>" },
  "texts": [ { "page": 1, "text": "Aprovado", "at": [400, 60], "size": 20, "color": "#008800", "bold": true } ],
  "links_from_urls": true
}
```

## Requisitos

- **PdfCraft** com `pdfcraft-cli` (testado com **0.4.0**); veja [Plataformas](#plataformas)
- Node.js ≥ 20 (incluído no Claude Desktop para instalações `.mcpb`)

## Instalação

### Claude Desktop (recomendado, todas as plataformas)

1. Baixe `pdfcraft-mcp-server.mcpb` da [versão mais recente](https://github.com/jhonsu01/pdfcraft-mcp-server/releases/latest).
2. Clique duas vezes (ou arraste para o Claude Desktop → *Configurações → Extensões*) e clique em **Instalar**.
3. Opcional: se o PdfCraft não estiver em um local padrão, informe a pasta ou o caminho do `pdfcraft-cli` nas configurações da extensão. Também é possível limitá-lo a uma única pasta.

### Codex (OpenAI)

**Recomendado — o marketplace (recebe atualizações):** *Plugins → Adicionar → Adicionar marketplace*, origem `jhonsu01/craft-marketplace`, referência `main`, e instale o **PdfCraft Bridge** em **Craft Bridges** ([craft-marketplace](https://github.com/jhonsu01/craft-marketplace)). As novas versões chegam ao atualizar o marketplace. Ou envie o zip (o Codex o guarda na sua conta e recusa um zip mais novo com o mesmo nome):

1. Baixe `pdfcraft-mcp-server-<versão>-codex.zip` da [versão mais recente](https://github.com/jhonsu01/pdfcraft-mcp-server/releases/latest).
2. No Codex: *Plugins → Adicionar → Novo plugin*, escolha o zip e clique em **Adicionar plugin**.
3. O Codex inicia o servidor com `node`, então o Node.js ≥ 20 precisa estar no `PATH`. Se o PdfCraft não estiver em um local padrão, defina `PDFCRAFT_DIR` ou `PDFCRAFT_CLI` como variáveis de ambiente do sistema (o Codex não tem formulário de configuração para plugins locais).

### DeepSeek Harness

1. *Plugins → Add plugin*, digite `github:jhonsu01/craft-marketplace#path:/plugins/pdfcraft-mcp-server` e clique em **Install** e depois em **Enable now**.
2. O Harness inicia o servidor com seu próprio cliente MCP e `node` (Node.js ≥ 20 no `PATH`); as ferramentas aparecem como `mcp__pdfcraft__<ferramenta>` e os arquivos de saída como cartões que abrem no Harness.
3. O Harness ainda não atualiza plugins sozinho: para atualizar, desinstale o plugin e instale-o de novo com o mesmo endereço.

### Claude Code / outros clientes MCP

```bash
git clone https://github.com/jhonsu01/pdfcraft-mcp-server.git
cd pdfcraft-mcp-server
npm install
npm run build
```

Windows:

```bash
claude mcp add pdfcraft -- node "%CD%\dist\bundle.cjs"
```

macOS / Linux:

```bash
claude mcp add pdfcraft -- node "$PWD/dist/bundle.cjs"
```

## Configuração

| Variável | Significado |
| --- | --- |
| `PDFCRAFT_DIR` | Pasta do PdfCraft, um de seus executáveis, a raiz de um `.tar.gz` (com `bin/`) ou `PdfCraft.app`. Padrão: detecção automática |
| `PDFCRAFT_CLI` | Caminho do `pdfcraft-cli` / `pdfcraft-cli.exe` (tem prioridade sobre `PDFCRAFT_DIR`) |
| `PDFCRAFT_APP` | Caminho do app de desktop quando está em outro lugar (ex.: um AppImage no Linux) |
| `PDFCRAFT_ROOT` | Só permite arquivos dentro desta pasta (`pdfcraft-cli mcp --root`) |
| `PDFCRAFT_MCP_TIMEOUT` | Máximo de segundos por chamada ao motor (padrão 3600) |

## Segurança

- Os arquivos **nunca são sobrescritos**, exceto com `overwrite: true`; as entradas nunca são modificadas.
- Todos os caminhos devem ser absolutos. As senhas nunca aparecem nos resultados.
- Tudo roda localmente, sem acesso à rede. Cada tarefa usa um motor privado em uma pasta temporária que é apagada ao final.

## Desenvolvimento

```bash
npm run build       # TypeScript + bundle de arquivo único (dist/bundle.cjs)
npm test            # testes unitários (lógica de caminhos de Windows, macOS e Linux)
npm run test:e2e    # 29 testes de ponta a ponta via MCP stdio real (PDFs sintéticos)
npm run pack:mcpb   # pdfcraft-mcp-server.mcpb
npm run pack:codex  # zip de plugin para o Codex
```

Teste de Linux no Docker (descompacte antes `pdfcraft-<versão>-linux-x86_64.tar.gz`):

```bash
docker run --rm -v "$PWD:/work:ro" -v "/caminho/para/pdfcraft-0.4.0-linux-x86_64:/opt/pdfcraft:ro" -w /work node:22-bookworm bash -c "apt-get update && apt-get install -y libxkbcommon0 libvulkan1 libegl1 mesa-vulkan-drivers libasound2 && node scripts/e2e.mjs"
```

## Licença

Apache-2.0. O PdfCraft é © de seus autores (Storytold), Apache-2.0.
Este projeto não é afiliado nem endossado pelo PdfCraft ou pela Storytold. Adobe Acrobat é marca da Adobe.
