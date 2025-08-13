export TAURI_APP_PATH := "../crates/tauri-app"  # Relative to `frontend`.
export TAURI_FRONTEND_PATH := "frontend"
export host := "0.0.0.0"
export TAURI_DEV_HOST := "0.0.0.0"
set windows-shell := ["powershell"]

default:
    just --list

build-all: build build-web

deps:
    cd frontend ; pnpm install
    cd crates/backend ; cargo build

### DESKTOP

[group('desktop')]
[working-directory("frontend")]
dev:
    pnpm tauri dev

[group('desktop')]
[working-directory("frontend")]
build:
    pnpm tauri build

### WEB

[group('web')]
[parallel]
dev-web: server-dev frontend-dev-web

[group('web')]
[working-directory("crates/server")]
server-dev:
    cargo run

[group('web')]
[working-directory("frontend")]
frontend-dev-web $GEMINI_DESKTOP_WEB="true":
    pnpm dev

[group('web')]
build-web $GEMINI_DESKTOP_WEB="true":
    cd frontend ; pnpm build
    cd crates/server ; cargo build --release

### RELEASE

[group('release')]
version-patch:
    node scripts/version.js patch

[group('release')]
version-minor:
    node scripts/version.js minor

[group('release')]
version-major:
    node scripts/version.js major

[group('release')]
release type="patch":
    node scripts/version.js {{type}}
    git add .
    git commit -m "🚀 Release v$(node -p "require('./frontend/package.json').version")"
    git tag -a "v$(node -p "require('./frontend/package.json').version")" -m "Release v$(node -p "require('./frontend/package.json').version")"
    git push origin main --tags

[group('release')]
docs:
    cd frontend && pnpm build
    mkdir -p docs-build
    cp -r docs/* docs-build/
    cp -r frontend/dist/* docs-build/