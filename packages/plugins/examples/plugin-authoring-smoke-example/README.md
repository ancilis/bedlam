# Plugin Authoring Smoke Example

A Bedlam plugin

## Development

```bash
pnpm install
pnpm dev            # watch builds
pnpm dev:ui         # local dev server with hot-reload events
pnpm test
```

## Install Into Bedlam

```bash
pnpm bedlam plugin install ./
```

## Build Options

- `pnpm build` uses esbuild presets from `@bedlam/plugin-sdk/bundlers`.
- `pnpm build:rollup` uses rollup presets from the same SDK.
