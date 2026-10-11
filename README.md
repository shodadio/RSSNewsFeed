# RSSNewsFeed

RSSNewsFeed is a personal RSS reader and feed aggregation app built with React, TypeScript, Express, and Vite. It lets you subscribe to RSS/Atom feeds, browse articles, organize feeds into folders, and use AI-assisted discovery and summarization features.

## Features

- Add and manage RSS/Atom feeds
- Auto-discover feeds from a website URL
- Support for popular tech blogs and curated feed search
- Read article snippets and full article content via built-in scraper
- AI-powered feed recommendations and article summaries using Gemini
- Folder-based organization and OPML import/export
- Read, archive, star, and delete article actions
- Secure URL validation to protect against SSRF attempts
- Local persistent store for feed data and user state

## Tech Stack

- Frontend: React + TypeScript + Vite
- Styling: Tailwind CSS
- Backend: Express + TypeScript
- Feed parsing: rss-parser
- AI: Google GenAI SDK
- Persistence: local JSON storage in `data/store.json`

## Project Structure

- `server.ts` — Express API and RSS processing logic
- `src/` — frontend React application and UI logic
- `public/` — static assets
- `data/` — local store directory for persisted feed state
- `index.html` — app entry point
- `vite.config.ts` — Vite configuration
- `.env.example` — example environment config

## Getting Started

### 1. Install dependencies

```bash
npm install
```

Or with Bun:

```bash
bun install
```

### 2. Configure environment variables

Copy the example environment file and fill in the required values:

```bash
cp .env.example .env
```

Then set:

- `GEMINI_API_KEY` — your Google Gemini API key for AI features
- `APP_URL` — the app URL used by the deployment environment

### 3. Run the app in development mode

```bash
npm run dev
```

The app runs with the Express server and Vite dev middleware enabled.

## Production Build

```bash
npm run build
npm run start
```

This will build the frontend and start the production server.

## API Highlights

The backend exposes endpoints for:

- Feed discovery and parsing
- AI feed recommendations
- AI article summarization
- Article extraction and scraping
- OPML import/export
- Auth and app storage management

## Security Notes

This project includes SSRF protection and URL validation for external feed and article requests. Only public, safe HTTP/HTTPS targets are accepted.

## Notes

This repository appears to be a personal RSS reading and feed-curation app based on the NetNewsWire model, with AI-assisted discovery and summarization layers layered on top of a lightweight custom backend.

## License

This project does not currently declare a repository license in the visible files. If you plan to publish or redistribute it, add an appropriate open-source license before doing so.
