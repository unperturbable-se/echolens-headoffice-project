# Head Office Project

A maritime-themed logistics management platform (ShipLens) with a static frontend, a FastAPI backend, and a Supabase database.

## Project structure

Code for the frontend, backend, and database lives in separate folders for modularity.

| Folder | Contents | Hosting |
|--------|----------|---------|
| `Frontend` | Static site | GitHub Pages |
| `Backend` | FastAPI service, run as a Docker container | Render |
| `Database` | SQL files (schema, seed, API functions) | Supabase |

## Tech stack

- **Frontend:** vanilla JS, HTML5, and CSS, chosen to reduce security vulnerabilities from third-party dependencies.
- **Backend:** FastAPI, running as a Docker container.
- **Database:** PostgreSQL on Supabase.
- **Caching:** Redis may be added later.

## Documentation

See [documentation.md](documentation.md) for the API reference, database layer, frontend notes, and CI checks.

## AI usage

See [AI_USAGE.md](AI_USAGE.md).