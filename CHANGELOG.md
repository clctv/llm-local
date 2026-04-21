# Changelog

# [0.3.0](https://github.com/clctv/llm-local/compare/0.2.0...0.3.0) (2026-04-21)

### Bug Fixes

- **core:** remove maxTokens field from request types and providers ([ca48a2f](https://github.com/clctv/llm-local/commit/ca48a2f3daea9b68a4522cb75d64f03afa7a170a))
- **ollama:** remove OLLAMA_HOST env var dependency ([94fe79f](https://github.com/clctv/llm-local/commit/94fe79fd37cc54d2e86b3689dcf7454ef174bd6a))

### Features

- **core:** add provider control via createLLM options ([f1e8a1b](https://github.com/clctv/llm-local/commit/f1e8a1b932900706a25e6ab0c4e5b89ecb2d583b))
- **core:** unify generate API to support both streaming and non-streaming modes ([a5fb374](https://github.com/clctv/llm-local/commit/a5fb374eab283a29d2e2e8a27263ffefa5ebc355))

# [0.2.0](https://github.com/clctv/llm-local/compare/0.1.3...0.2.0) (2026-04-20)

### Bug Fixes

- **ollama:** simplify model extraction logic ([f8ffa0e](https://github.com/clctv/llm-local/commit/f8ffa0ef7050440e4c0777e691619e5aedea8b54))

### Features

- **ollama:** add support for mapping top-level request extras ([c62af4e](https://github.com/clctv/llm-local/commit/c62af4ec7b3b016865ba88eab1266fa6571c090d))

## [0.1.3](https://github.com/clctv/llm-local/compare/0.1.2...0.1.3) (2026-04-16)

### Bug Fixes

- **cli:** simplify think command logic and remove unused toggle option ([01ea2e7](https://github.com/clctv/llm-local/commit/01ea2e7e8a09d2ba2c72fec2e83ec968f1dc3104))

## [0.1.2](https://github.com/clctv/llm-local/compare/0.1.1...0.1.2) (2026-04-15)

### Features

- **lmstudio:** add model initialization and filtering ([d16aab0](https://github.com/clctv/llm-local/commit/d16aab0509021d5cea8f03d7f1638bee7d040caa))

## [0.1.1](https://github.com/clctv/llm-local/compare/0.1.0...0.1.1) (2026-04-14)

### Features

- **cli:** improve selector prompt message ([63882cc](https://github.com/clctv/llm-local/commit/63882ccf14d1b64568a2eec2c8475aea50718035))

# [0.1.0](https://github.com/clctv/llm-local/compare/0.0.4...0.1.0) (2026-04-13)

### Bug Fixes

- **providers:** adjust LLMProvider return structure, remove name field ([b6ed896](https://github.com/clctv/llm-local/commit/b6ed8968e63f873871a0fd449a86528ceae877ac))

### Features

- **core:** unify llm response content field to content ([4856462](https://github.com/clctv/llm-local/commit/48564627276fdc330024b41588cebf853e9a7cc8))

## [0.0.4](https://github.com/clctv/llm-local/compare/0.0.3...0.0.4) (2026-04-10)

## [0.0.3](https://github.com/clctv/llm-local/compare/0.0.2...0.0.3) (2026-04-10)

## [0.0.2](https://github.com/clctv/llm-local/compare/0.0.1...0.0.2) (2026-04-10)

### Features

- **providers:** add format support for structured output requests ([d64627d](https://github.com/clctv/llm-local/commit/d64627d3c80fe7dd396cae595efdf2f9cea51eb9))

## 0.0.1 (2026-04-10)

### Features

- init ([1cee317](https://github.com/clctv/llm-local/commit/1cee317617036c9a0756161fea089d1bbe65f71f))
