// NOTE: markdown, javascript e typescript usam os parsers built-in do @opentui/core.
// Padrão: WASM e queries via URL (mesma abordagem do OpenCode).
// Carregados sob demanda pelo tree-sitter worker quando o filetype aparece num code block.
export const extraParsers = [
  {
    filetype: "python",
    aliases: ["py"],
    wasm: "https://github.com/tree-sitter/tree-sitter-python/releases/download/v0.23.6/tree-sitter-python.wasm",
    queries: {
      highlights: ["https://github.com/tree-sitter/tree-sitter-python/raw/refs/heads/master/queries/highlights.scm"],
      locals: ["https://raw.githubusercontent.com/nvim-treesitter/nvim-treesitter/refs/heads/master/queries/python/locals.scm"],
    },
  },
  {
    filetype: "rust",
    aliases: ["rs"],
    wasm: "https://github.com/tree-sitter/tree-sitter-rust/releases/download/v0.24.0/tree-sitter-rust.wasm",
    queries: {
      highlights: ["https://raw.githubusercontent.com/nvim-treesitter/nvim-treesitter/refs/heads/master/queries/rust/highlights.scm"],
      locals: ["https://raw.githubusercontent.com/nvim-treesitter/nvim-treesitter/refs/heads/master/queries/rust/locals.scm"],
    },
  },
  {
    filetype: "go",
    wasm: "https://github.com/tree-sitter/tree-sitter-go/releases/download/v0.25.0/tree-sitter-go.wasm",
    queries: {
      highlights: ["https://raw.githubusercontent.com/nvim-treesitter/nvim-treesitter/refs/heads/master/queries/go/highlights.scm"],
      locals: ["https://raw.githubusercontent.com/nvim-treesitter/nvim-treesitter/refs/heads/master/queries/go/locals.scm"],
    },
  },
  {
    filetype: "bash",
    aliases: ["sh", "shell", "zsh", "fish"],
    wasm: "https://github.com/tree-sitter/tree-sitter-bash/releases/download/v0.25.0/tree-sitter-bash.wasm",
    queries: {
      highlights: ["https://raw.githubusercontent.com/nvim-treesitter/nvim-treesitter/refs/heads/master/queries/bash/highlights.scm"],
    },
  },
  {
    filetype: "c",
    wasm: "https://github.com/tree-sitter/tree-sitter-c/releases/download/v0.24.1/tree-sitter-c.wasm",
    queries: {
      highlights: ["https://raw.githubusercontent.com/nvim-treesitter/nvim-treesitter/refs/heads/master/queries/c/highlights.scm"],
      locals: ["https://raw.githubusercontent.com/nvim-treesitter/nvim-treesitter/refs/heads/master/queries/c/locals.scm"],
    },
  },
  {
    filetype: "cpp",
    aliases: ["c++", "cxx"],
    wasm: "https://github.com/tree-sitter/tree-sitter-cpp/releases/download/v0.23.4/tree-sitter-cpp.wasm",
    queries: {
      highlights: ["https://raw.githubusercontent.com/nvim-treesitter/nvim-treesitter/refs/heads/master/queries/cpp/highlights.scm"],
      locals: ["https://raw.githubusercontent.com/nvim-treesitter/nvim-treesitter/refs/heads/master/queries/cpp/locals.scm"],
    },
  },
  {
    filetype: "json",
    wasm: "https://github.com/tree-sitter/tree-sitter-json/releases/download/v0.24.8/tree-sitter-json.wasm",
    queries: {
      highlights: ["https://raw.githubusercontent.com/nvim-treesitter/nvim-treesitter/refs/heads/master/queries/json/highlights.scm"],
    },
  },
  {
    filetype: "yaml",
    aliases: ["yml"],
    wasm: "https://github.com/tree-sitter-grammars/tree-sitter-yaml/releases/download/v0.7.2/tree-sitter-yaml.wasm",
    queries: {
      highlights: ["https://raw.githubusercontent.com/nvim-treesitter/nvim-treesitter/refs/heads/master/queries/yaml/highlights.scm"],
    },
  },
  {
    filetype: "toml",
    wasm: "https://github.com/tree-sitter-grammars/tree-sitter-toml/releases/download/v0.7.0/tree-sitter-toml.wasm",
    queries: {
      highlights: ["https://raw.githubusercontent.com/nvim-treesitter/nvim-treesitter/refs/heads/master/queries/toml/highlights.scm"],
    },
  },
]
