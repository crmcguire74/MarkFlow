# MarkFlow Editor

## Summary

MarkFlow Editor is an award-winning Markdown editor designed for speed, clarity, and reliability. Acting as a rich-text to Markdown converter with advanced real-time previews, it supports standard Markdown alongside GitHub Flavored Markdown (GFM) features. MarkFlow's interface provides a calm, focused writing workspace, empowering creators, developers, and writers alike to formulate and shape context precisely.

## Features Supported

- **Real-Time Synchronized Editing & Preview**: See the Markdown output immediately as you type, with scroll synchronization preventing you from ever losing your place.
- **Rich Text Toolbar**: Quickly insert headings, bold, italics, quotes, links, images, tables, and code blocks using standard shortcuts and visual tools.
- **Offline Mode & PWA Capable**: Keep working when the internet cuts out. MarkFlow is highly optimized as a Progressive Web Application (PWA). You can install it directly onto your device (desktop or mobile) and write fully offline.
- **Intelligent Updates**: MarkFlow checks in the background for new versions. When an update is available, a convenient "Update App" button pulses to seamlessly pull in enhancements.
- **Dark & Light Mode**: Smooth transition between light and dark themes using a beautiful custom palette.
- **Document Export & Download**: Export generated markdown straight to a `.md` footprint file with a single click.

## User Workflows

- **Writing Workflows**: Simply type in the left editor pane. Format dynamically using standard Markdown syntax, or hit the top toolbar action buttons to auto-generate markdown markers (e.g. `**text**` for bold).
- **Installing as a Standalone App (PWA)**: If MarkFlow is opened in a compatible web browser, an "Install" button resides in the toolbar navigation. Clicking it triggers the browser's PWA install prompt. Once installed properly on the system, to prevent clutter, the "Install" button is intelligently hidden from the user interface.
- **Updating the Application**: Periodic background polling queries for service worker updates. If the system goes offline, the app leans on local cache and functions uninterrupted silently. When an update becomes available on a network connection, a bright "Update App" button prompts the user to refresh their installed version.
- **Saving & Exporting**: Rather than relying strictly on heavy cloud infrastructure, MarkFlow stores your document content directly in your browser's local memory. For portability, the "Download" button safely pushes the active markdown instance to your system files.

## System Architecture

MarkFlow is built as a front-end heavy Single Page Application (SPA), completely decentralized from server processing to maximize user privacy and offline capabilities.

- **Progressive Web App (PWA)**: Implemented using Vite PWA Plugin, meaning it leverages a robust Service Worker strategy (`CacheFirst` for static assets and fonts) mapped safely with a `.webmanifest`.
- **Offline-First Delivery**: Using Google Workbox under the hood, MarkFlow pre-caches HTML, CSS, JavaScript, icons, and SVG paths.
- **React Environment**: Composed entirely of modular functional React components tied together with React Hooks. State management natively relies on `useState` and `useEffect` patterns mapped directly to `localStorage` for content persistence across sessions.

## Technical Details & Libraries Used

- **Core Framework**: React 18 / TypeScript
- **Tooling & Build**: Vite, `vite-plugin-pwa` for manifest execution and service-worker injection.
- **Markdown Parsing**: `marked` (for highly extensible lexing/parsing strings to HTML) paired with `remark-gfm` for advanced GitHub markdown specs (like tables and checklists).
- **HTML/Markdown conversions**: `turndown` for seamless bidirectional conversions allowing rich context to map to markdown footprints.
- **Styling**: Tailwind CSS configured via PostCSS and custom CSS variables mapping for elegant dynamic themes. UI icons provided universally by `lucide-react`.
- **Hosting Assumptions**: Compatible strictly behind Netlify/Vercel standard fallback rules (`/* -> /index.html`), paired alongside specific `netlify.toml` headers to strictly disable caching on the Service Worker script (`sw.js`).
