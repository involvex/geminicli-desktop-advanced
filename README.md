# Gemini Desktop

A powerful, modern desktop and web UI for Gemini CLI.  Built with Tauri and web technologies.  Cross-platform, open-source on [GitHub.](https://github.com/Piebald-AI/gemini-desktop)

> [!WARNING]
> We're working on implementing automatic saving on top of Gemini CLI, but it's ultimately a hack.  It would be more robust to have automatic recording incorporated into the Gemini CLI itself.  We've opened PR [#4401](https://github.com/google-gemini/gemini-cli/pull/4401) on the Gemini CLI repo with a complete implementation; please :+1: it to encourage it to be merged!

![Screenshot of Gemini Desktop](./assets/screenshot.png)

## Features

- Choose between models (Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.5 Flash-Lite)
- Send messages to/from Gemini and receive responses
- Handle tool call requests
- Markdown support ([#1](https://github.com/Piebald-AI/gemini-desktop/issues/1))

### Planned

- Automatic chat history saving ([#2](https://github.com/Piebald-AI/gemini-desktop/issues/2)).  Note: See related PRs [#4401](https://github.com/google-gemini/gemini-cli/pull/4401) and [#4609](https://github.com/google-gemini/gemini-cli/pull/4609) on the Gemini CLI repo.
- MCP server management
- Token/cost information
- More advanced tool call support

## How it works

Gemini CLI can function as an ACP (Agent Communication Protocol) server, which enables real-time communication via JSON-RPC 2.0 between the client, Gemini Desktop, and the server, Gemini CLI.

## Building from source

### Prerequisites

Gemini Desktop is written using Rust and Tauri for the backend and web technologies for the frontend.  When building it from source or running it in development you'll need to install the following tools:

- [Rust](https://rust-lang.org)
- [Node.js](https://nodejs.org)
- [pnpm](https://pnpm.io)
- [just](https://just.systems)

#### Installing Just

If you're on macOS/Linux and you use [asdf](https://asdf-vm.com), you can install `just` with the following commands:

```bash
asdf plugin add just
asdf install just latest
```

If you're on Windows, you can use Winget:

```powershell
winget install --id Casey.Just
```

#### Linux Dependencies

On Linux building Tauri apps requires several dependencies.  If you're using Ubuntu, you can install them all using this command:

```bash
sudo apt install libgdk-pixbuf-2.0-dev \
   libpango1.0-dev \
   libjavascriptcoregtk-4.1-dev \
   libatk1.0-dev \
   libsoup-3.0-dev \
   libwebkit2gtk-4.1-dev
```

### Build

Then clone the repository:

```bash
git clone https://github.com/Piebald-AI/gemini-desktop
cd gemini-desktop
```

You can run the app in development mode, or build it for production.  The desktop, being a Tauri app, follows the standard setup for development and production.  For the webapp, there are two servers that run in development mode: a Rust/Rocket backend API server on port 1858, and a Vite frontend webserver with hot reloading on port 1420.  In production a single executable hosts the backend API and the frontend, both on port 1858.

**Development:** Run `just deps dev` to start the desktop app in development.  Alternatively, run `just deps dev-web` to start the webapp version in development and go to http://localhost:1420 in your browser.

**Production:** Run `just deps build-all`.  Two binaries built in release mode will be produced in `target/release`: `gemini-desktop` (`gemini-desktop.exe`) for the desktop app, and `gemini-desktop-web` (`gemini-desktop-web.exe`) for the webapp version.
 
## Contributing

Contributions are welcome!
1. Fork the repo.
2. Clone it, optionally create a new branch, and then and make your changes.
3. Add tests.
4. Commit your changes and open a PR.

## License

[MIT](./LICENSE)

Copyright © 2025 [Piebald LLC.](https://piebald.ai)
