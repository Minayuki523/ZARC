# ZARC

[简体中文](README.md) · English

A Rust-based Zstd compression and extraction tool. It uses Zstandard to compress files and directories, with support for password encryption, split archives, self-extracting executables, and compression-level benchmarks.

![ZARC compression interface](assets/screenshots/main.png)

## Features

- **File and directory compression** — compress individual files or directories into `.zst` archives, with compression levels from 1 to 22.
- **Password encryption** — derive keys with Argon2id and encrypt archive contents with XChaCha20-Poly1305.
- **Split and self-extracting archives** — split standard archives into volumes of a specified size, or generate a Windows EXE that opens an extraction interface when launched.
- **Archive preview** — browse directory structures, search filenames, and view file counts, sizes, and BLAKE3 digests.
- **Compression-level benchmarks** — compare compressed sizes and processing times across levels, then apply the recommended level to the compression page.
- **Tasks and appearance** — view progress, speed, and remaining time, and stop tasks. Supports Chinese and English, light and dark themes, and 256 colors.

## Quick start

1. Save `ZARC.exe` locally and double-click it to launch.
2. Add files or directories on the compression page, or drag in multiple items at once. Add, remove, or clear items in the file list.
3. Enter an archive name, choose an output directory and output type, adjust the compression level, encryption, or volume size as needed, then start compression.

Multiple items are combined into one archive or self-extracting executable. Items with the same name from different directories are numbered automatically, preserving all contents.

To extract an archive, drag it into the window or select it on the extraction page, then start extraction. When the output directory is left blank, files are extracted into the directory containing the archive. Self-extracting executables follow the same rule.

## Archive formats

| Purpose | File format |
| --- | --- |
| Single file | `filename.zst` |
| Directory | `directory.tar.zst` |
| Encrypted archive | `filename.zst.enc` or `directory.tar.zst.enc` |
| Split archive | Archive name followed by `.001`, `.002`, and so on |
| Windows self-extracting archive | `name.sfx.exe`; large archives include a `name.sfx.exe.payload` data file |

Keep all volumes in the same directory and select any volume to extract the archive. Set the volume size in MiB under advanced options.

For large self-extracting archives, keep the generated EXE and its accompanying payload file in the same directory. Double-click the EXE, enter the password if required, then start extraction. Self-extracting archives support encryption; volume splitting is available for standard archives.

## Requirements

- Windows 10/11 x64.
- [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/).
- Enough disk space for the compressed or extracted files. High compression levels and long-distance matching for large files increase memory usage.

## Build from source

Install **Node.js 24 LTS**, **Rust stable with the MSVC toolchain**, and Visual Studio Build Tools with Desktop development with C++ and the Windows SDK. Follow the [Tauri Windows prerequisites](https://v2.tauri.app/start/prerequisites/#windows).

From the project directory in Windows PowerShell, run:

```powershell
cd zarc-desktop
npm ci
npm run tauri:build:win
```

The executable is generated at `zarc-desktop/src-tauri/target/release/ZARC.exe`, with frontend resources bundled into the EXE.

For development:

```powershell
npm run tauri dev
```

To check the frontend and Rust core:

```powershell
npm run build
cargo test --manifest-path src-tauri/Cargo.toml --lib --locked
```

When building from WSL, copy the source to a separate directory on a Windows drive, then run the commands above in that directory using the Windows versions of Node.js and Rust.

## About

Author: [Minayuki](https://github.com/Minayuki523) · [GitHub repository](https://github.com/Minayuki523/ZARC)

The desktop interface uses Tauri 2, Svelte 5, and TypeScript. The compression core uses Rust, Zstandard, and tar. The project uses the MIT license; dependencies retain their respective licenses.
