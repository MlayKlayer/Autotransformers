# AutoTransformers

A responsive multi-page dealership website for showcasing used cars, now backed by a real server-side authentication API.

## What this project includes

- Home landing page with hero, featured inventory, trust/benefit section, and contact cards.
- Inventory page with client-side sorting (price, year, mileage).
- Individual car details pages with specs and dealer CTAs.
- Sign in / registration page with tabbed forms.
- Shared styling and JavaScript.
- Node.js backend with secure authentication.

## Answers to your questions

### 1) Is the login option legit (real working login)?

**Yes — now it is a real backend login flow.**

It now uses:
- server-side user storage in `users.json`,
- password hashing with Node's `crypto.scrypt`,
- HTTP-only signed session cookie auth,
- auth API endpoints (`/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`),
- rate limiting on auth endpoints,
- basic secure response headers.

### 2) Is the website looking like real car selling websites?

**Yes, mostly.**

It already has typical dealer-site structure and UX:
- hero + CTA,
- inventory cards,
- detail pages with specs + contact actions,
- responsive navigation and layouts.

## Tech stack

- Frontend: HTML, CSS, vanilla JavaScript
- Backend: Node.js (`http`, `fs`, `crypto`)
- Auth/session: password hashing + signed cookie sessions

## Run locally

1. Start server:

```bash
npm start
```

2. Open:

```text
http://localhost:8000
```

## Environment

Optional environment variables:

- `PORT` (default: `8000`)
- `NODE_ENV` (`production` enables `Secure` session cookie)
- `SESSION_SECRET` (recommended in production)

Example:

```bash
SESSION_SECRET="replace-with-long-random-secret" npm start
```

## Project structure

- `index.html` - home page
- `car-deals.html` - inventory page
- `car-details-1.html` / `car-details-2.html` / `car-details-3.html` - vehicle pages
- `login.html` - sign in / registration UI
- `style.css` - shared styles
- `script.js` - shared frontend behavior + API integration
- `server.js` - backend server + auth API
- `package.json` - start scripts
- `images/` - car images

## Notes

- Auth now runs on the server (not browser localStorage).
- `users.json` is created automatically after first registration.
- For production, also add CSRF protection, persistent DB, and stricter password policy/email verification.
