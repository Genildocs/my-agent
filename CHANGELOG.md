# Changelog

Todas as mudanças notáveis deste projeto são documentadas aqui.

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

---

## [Unreleased]

### Adicionado

- **TUI: markdown renderizado** — instalada a dependência `web-tree-sitter@0.25.10`, que estava faltando e impedia o tree-sitter de funcionar silenciosamente. O `<markdown>` no `ChatScreen.tsx` agora roda com `conceal={true}`, ocultando a marcação bruta e exibindo o texto formatado.
- **TUI: estilos `markup.*` no tema** — adicionados ao `syntaxStyle()` em `tui/theme.ts` os tokens `markup.heading` (níveis 1–4), `markup.bold`, `markup.strong`, `markup.italic`, `markup.list`, `markup.quote`, `markup.link` e `markup.raw`. Sem esses tokens o OpenTUI parseava o markdown mas não aplicava ênfase — negrito e itálico saíam como texto comum.
- **TUI: syntax highlight de linguagens adicionais** — criado `tui/parsers-config.ts` com 9 linguagens extras (Python, Rust, Go, Bash/sh/shell/zsh/fish, C, C++, JSON, YAML, TOML) via parsers tree-sitter WASM e queries SCM carregados por URL (mesmo padrão do OpenCode). Integrado via `addDefaultParsers(extraParsers)` no `tui/index.tsx` antes do renderer, sob demanda pelo worker do tree-sitter. JavaScript, TypeScript e Markdown continuam usando os parsers built-in do `@opentui/core`.

---

## [0.5.0] — TUI: seletores, temas, configuração persistente e experiência completa no terminal

### Adicionado

- **TUI: configuração persistente (XDG)** — modelo, effort e tema sobrevivem a reinicializações. Salvo em `~/.config/my-agent/config.json` via `tui/config.ts`; lido na inicialização e atualizado em cada troca. Compartilha o mesmo arquivo da config web (chave da API + providers).
- **TUI: paletas de tema centralizadas** — `tui/theme.ts` define quatro temas completos (dark, light, nord, dracula) como `Palette` tipada. O store reativo `COLOR` propaga a troca ao vivo para todo o JSX sem re-render manual. O `syntaxStyle()` é reconstruído apenas quando o tema muda (lazy, com cache por nome).
- **TUI: seletor de tema com preview ao vivo** — `Ctrl+T` abre um `DialogSelect` de temas; mover o cursor no dialog já aplica o tema; cancelar reverte ao estado anterior.
- **TUI: seletores de modelo e effort** — `Ctrl+M` e `Ctrl+E` abrem dialogs fuzzy; a escolha é persistida e enviada no próximo turno.
- **TUI: aprovação de tools repaginada** — card inline com verbo de ação contextual (ex.: "Escrever arquivo", "Executar comando"), mini-diff para edições (linhas − / +), preview de conteúdo para writes. Teclas Y / N / A (sempre) com ownership de teclado: enquanto um card está visível, atalhos globais (ESC, Ctrl+M etc.) não vazam.
- **TUI: AskUserQuestion inline** — card de pergunta direto no fluxo, com suporte a opções (lista navegável ↑↓) ou input livre.
- **TUI: command palette e slash menu** — `Ctrl+P` abre o palette de comandos; digitar `/` no input abre autocomplete estilo OpenCode (encostado no input, com seleção por ↑↓ e Tab).
- **TUI: cwd dinâmico** — o TUI aceita o diretório de trabalho como argumento (`my-agent-tui /caminho`) ou captura o `$PWD` do chamador via launcher global (`bin/my-agent-tui`). O diretório aparece no header e é enviado ao backend a cada mensagem.
- **TUI: bootstrap cross-platform** — `tui/server-bootstrap.ts` sobe e encerra o servidor Express/WebSocket automaticamente; funciona em Windows (PowerShell) e Unix sem bifurcação de código.
- **TUI: footer de sessão** — barra superior com modelo · effort · status (streaming/thinking/idle) com spinner · tokens formatados (k) · custo do turno.
- **TUI: auto-start do backend** — `npm run tui` sobe o servidor se não estiver no ar e o derruba ao sair; se o web já está rodando, o TUI só conecta.

---

## [0.4.0] — Agentes: AskUserQuestion nativa e scripts de RAG

### Adicionado

- **Tool `AskUserQuestion` nativa** — implementada via `canUseTool` no servidor: quando o agente usa essa tool, o servidor roteia a pergunta ao cliente (web ou TUI) em vez de executá-la como tool comum. O cliente responde com as respostas do usuário e o fluxo continua. Suporta múltiplas perguntas e opções predefinidas.
- **Scripts de RAG** — scripts auxiliares para indexação e consulta ao guardião via linha de comando, integrando embedding Jina e vetor store Neon/pgvector.

---

## [0.3.0] — Web chat: base completa

### Adicionado

- **`my-agent-chat`** — cliente web React 18 + Vite + Tailwind sobre servidor Express + WebSocket.
- **Streaming com raciocínio visível** — extended thinking colapsável e persistido no histórico (SQLite).
- **Syntax highlight** — blocos de código com Shiki no cliente web.
- **Diff Git estruturado** — painel por arquivo com badges Adicionado/Modificado/Removido, contagem +/−, modos unificado/dividido e escopos "último turno" / "tudo".
- **Prompt enhancer com aprendizado** — reescreve rascunhos via Haiku one-shot; pares aprovados são guardados no SQLite e reinjetados como few-shot nas próximas melhorias.
- **Sub-agentes** — delegações (`Task`) e consulta ao guardião viram cards inline no fluxo.
- **Guardião ancorado nas docs** — RAG com Jina + Neon/pgvector; ancoragem garantida por código (retrieval antes do `query()`).
- **Segurança em 2 camadas** — guard hook (PreToolUse) veta operações destrutivas; `canUseTool` pede confirmação humana para write/edit/bash, com opção "✓ Sempre".
- **Slash-commands** — `/clear`, `/git`, `/tools`, `/tarefas`, `/compact`, `/guardian`.
- **Ctrl+K** — command palette com busca de arquivos e ações.
- **Sessões SQLite** — renomear/arquivar, retomar contexto, persistência de imagens e exemplos do enhancer.
- **Settings via UI** — modal para configurar `ANTHROPIC_API_KEY` e providers sem reiniciar o servidor; salvo em `~/.config/my-agent/config.json`.
- **Multimodal** — colar imagens no input (valida tipo/tamanho, persiste no SQLite).
