# Migration Guide: sqlite3 to better-sqlite3

## Why

The `sqlite3` npm package pulls in a large native build toolchain (`node-gyp`, `tar`, `glob`, `minimatch`, etc.) that introduces **15 HIGH severity vulnerabilities** in Docker images. `better-sqlite3` uses prebuilt native binaries, eliminating this entire dependency tree.

## What Changed

### Dependencies
- Removed: `sqlite3` (callback-based, requires python3/make/g++ to build)
- Added: `better-sqlite3` (synchronous API, prebuilt binaries)

### API Differences

| Operation | sqlite3 (old) | better-sqlite3 (new) |
|-----------|---------------|----------------------|
| Open DB | `new sqlite3.Database(path, callback)` | `new Database(path)` |
| Query rows | `db.all(sql, params, callback)` | `db.prepare(sql).all(...params)` |
| Single row | `db.get(sql, params, callback)` | `db.prepare(sql).get(...params)` |
| Write | `db.run(sql, params, callback)` | `db.prepare(sql).run(...params)` |
| Execute DDL | `db.exec(sql, callback)` | `db.exec(sql)` |
| Close | `db.close(callback)` | `db.close()` |
| Pragma | `db.exec('PRAGMA foreign_keys = ON')` | `db.pragma('foreign_keys = ON')` |
| Backup | `sourceDb.backup(targetDb, callback)` | `db.backup(destPath)` (returns Promise) |

Key difference: `better-sqlite3` is **synchronous** — no callbacks or promises needed for queries. The adapter layer wraps these in async functions for compatibility with the rest of the app.

### Files Modified

- `src/backend/database/adapter.js` — SQLite init, query, exec, close methods
- `src/backend/database/db.js` — Legacy connection and interface methods
- `src/backend/services/backupService.js` — Backup, restore, verify operations
- `Dockerfile` — Removed python3/make/g++ build deps, pinned to node:22.22-alpine
- `package.json` — Replaced sqlite3 with better-sqlite3

### Docker Image Changes

The production Docker image no longer needs build tools:
- Removed: `apk add python3 make g++` and `.build-deps` cleanup
- Added: `apk upgrade --no-cache` for base image security patches
- Pinned: `node:22.22-alpine` for reproducible builds
- Result: Smaller image, faster builds, 15 fewer HIGH CVEs

## Upgrade Steps

1. `npm uninstall sqlite3 && npm install better-sqlite3`
2. Replace the three modified source files (adapter.js, db.js, backupService.js)
3. Update Dockerfile (remove build deps)
4. Test: `npm run build && npm run dev`
5. Verify existing database opens correctly (no schema changes needed)

## Compatibility

- Existing `.db` files are fully compatible (same SQLite format)
- No database migration needed
- PostgreSQL code paths are unaffected
- All API endpoints work identically
- `RETURNING *` clause works with better-sqlite3
