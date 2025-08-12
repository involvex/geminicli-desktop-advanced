# Gemini Desktop Documentation

A powerful, modern desktop and web UI for Gemini CLI. Built with Tauri and web technologies.

## Quick Start

### Installation

Download the latest release from [GitHub Releases](https://github.com/involvex/geminicli-desktop-advanced/releases).

**Windows:**
- MSI Installer: `Gemini Desktop_0.1.0_x64_en-US.msi`
- NSIS Installer: `Gemini Desktop_0.1.0_x64-setup.exe`

### Building from Source

```bash
# Clone repository
git clone https://github.com/involvex/geminicli-desktop-advanced
cd geminicli-desktop-advanced

# Install dependencies
just deps

# Build desktop app
just build

# Build web version
just build-web
```

## Features

- ✨ Modern UI with React + TypeScript
- 🚀 Cross-platform desktop app (Tauri)
- 🌐 Standalone web server
- 🤖 Multiple Gemini models support
- 📝 Markdown rendering with syntax highlighting
- 🔧 Tool call handling
- 🎨 Theme system
- ⌨️ Global hotkeys
- 📁 File browser
- ⚙️ Settings management

## Architecture

- **Frontend**: React + TypeScript + Vite
- **Desktop**: Rust + Tauri
- **Web Server**: Rust + Rocket
- **Build System**: Just + pnpm

## Development

```bash
# Development mode
just dev          # Desktop app
just dev-web      # Web version

# Testing
just test

# Linting
just lint
```

## License

MIT License - see [LICENSE](../LICENSE) for details.