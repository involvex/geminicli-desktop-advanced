# Gemini Desktop

A powerful, modern desktop and web UI for Gemini CLI. Built with Tauri and web technologies. Cross-platform, open-source by [Involvex](https://github.com/involvex).

🌐 **[Live Demo & Documentation](https://involvex.github.io/geminicli-desktop-advanced/)**

![Screenshot of Gemini Desktop](./assets/screenshot.png)

## ✨ Features

### 🚀 Core Features
- **Multiple Models**: Gemini 2.5 Pro, Flash, and Flash-Lite support
- **Cross-Platform**: Native desktop app for Windows, macOS, and Linux
- **Web Version**: Standalone web server with Rocket backend
- **Real-time Communication**: JSON-RPC 2.0 integration with Gemini CLI
- **Modern UI**: React + TypeScript with beautiful design

### 🎨 Interface & Experience
- **Markdown Support**: Rich text rendering with syntax highlighting
- **Theme System**: Dark/light modes with customizable themes
- **System Tray**: Background operation with global hotkeys
- **File Browser**: Integrated file management and project tools
- **Persistent Chat**: Floating chat window for quick access

### 🔧 Advanced Features
- **Tool Call Support**: Advanced tool integration and handling
- **MCP Server Management**: Model Context Protocol server support
- **Settings Management**: Comprehensive configuration system
- **Screenshot Integration**: Built-in screenshot capabilities
- **Auto-save**: Automatic chat history preservation

### 📦 Distribution
- **Windows Installers**: MSI and NSIS packages
- **GitHub Actions**: Automated builds and releases
- **Documentation**: Interactive GitHub Pages site

## 🏗️ Architecture

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Desktop**: Rust + Tauri (cross-platform native)
- **Web Server**: Rust + Rocket (standalone web version)
- **Build System**: Just + pnpm (unified development experience)
- **CI/CD**: GitHub Actions (automated testing and releases)

## 🚀 Quick Start

### 📥 Download

Visit our [**Releases Page**](https://github.com/involvex/geminicli-desktop-advanced/releases) to download:

**Windows:**
- `Gemini Desktop_0.1.0_x64_en-US.msi` (MSI Installer)
- `Gemini Desktop_0.1.0_x64-setup.exe` (NSIS Installer)

**Other Platforms:**
- macOS and Linux builds available in releases

### 🛠️ Building from Source

#### Prerequisites

- [Rust](https://rust-lang.org) (latest stable)
- [Node.js](https://nodejs.org) (v18+)
- [pnpm](https://pnpm.io) (v8+)
- [just](https://just.systems) (task runner)

#### Installation

```bash
# Clone repository
git clone https://github.com/involvex/geminicli-desktop-advanced
cd geminicli-desktop-advanced

# Install dependencies
just deps

# Development
just dev          # Desktop app
just dev-web      # Web version (http://localhost:1420)

# Production builds
just build        # Desktop app
just build-web    # Web server
just build-all    # Both versions
```

#### Platform-Specific Dependencies

**Linux (Ubuntu/Debian):**
```bash
sudo apt install libgdk-pixbuf-2.0-dev libpango1.0-dev \
  libjavascriptcoregtk-4.1-dev libatk1.0-dev \
  libsoup-3.0-dev libwebkit2gtk-4.1-dev
```

**Windows:**
```powershell
# Install Just via Winget
winget install --id Casey.Just
```

**macOS:**
```bash
# Install Just via Homebrew
brew install just
```

## 🔄 How It Works

Gemini CLI functions as an ACP (Agent Communication Protocol) server, enabling real-time communication via JSON-RPC 2.0 between:

1. **Client**: Gemini Desktop (this application)
2. **Server**: Gemini CLI (Google's official CLI tool)
3. **Protocol**: JSON-RPC 2.0 over WebSocket/HTTP

This architecture provides seamless integration while maintaining the power and flexibility of the official Gemini CLI.

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork** the repository
2. **Clone** your fork: `git clone https://github.com/YOUR_USERNAME/geminicli-desktop-advanced`
3. **Create** a feature branch: `git checkout -b feature/amazing-feature`
4. **Make** your changes and add tests
5. **Test** your changes: `just test`
6. **Commit** your changes: `git commit -m "Add amazing feature"`
7. **Push** to your branch: `git push origin feature/amazing-feature`
8. **Open** a Pull Request

### Development Commands

```bash
just lint         # Run linters (Rust + TypeScript)
just test         # Run test suite
just check        # Type checking
just format       # Format code
```

## 📄 License

[MIT License](./LICENSE)

Copyright © 2025 [Involvex](https://github.com/involvex)

## 🔗 Links

- 🌐 **[Homepage & Docs](https://involvex.github.io/geminicli-desktop-advanced/)**
- 📦 **[Releases](https://github.com/involvex/geminicli-desktop-advanced/releases)**
- 🐛 **[Issues](https://github.com/involvex/geminicli-desktop-advanced/issues)**
- 💬 **[Discussions](https://github.com/involvex/geminicli-desktop-advanced/discussions)**
- 👤 **[Involvex Profile](https://github.com/involvex)**

---

⭐ **Star this repo** if you find it useful!