# OpenAI Plus VXT

A browser extension built with [WXT](https://wxt.dev/) to assist with ChatGPT registration, checkout link extraction, random address profile generation, and autofilling information on OpenAI/PayPal payment pages.

Telegram group: [https://t.me/fuck_open](https://t.me/fuck_open)

## Features

- Registration helper
  - Supports single-email input.
  - Supports Outlook account lines in the `email----password----client_id----refresh_token` format.
  - On the OpenAI email verification page, you can either enter the code manually or fetch and submit it automatically through a local Outlook API.
  - Automatically fills in an English name and age on the profile page.

- Link extraction
  - Reads `https://chatgpt.com/api/auth/session` when you switch to the "Link Extractor" tab.
  - Extracts `accessToken`, `user.email`, and `account.planType` from the session.
  - Supports generating both long and short ChatGPT checkout links.
  - Checkout parameters can be adjusted and persisted inside the extension.

- Address profile
  - Supports fetching random address data from `https://www.meiguodizhi.com/`.
  - Supports a specific country, a specific city, or random country/random city.
  - Address, identity, employment, credit card, and related profile data can be viewed and copied in the extension panel.
  - The current address profile is saved locally and remains available after page refresh.

- Payment page autofill
  - `pay.openai.com/c/pay`: automatically selects PayPal, fills in name, country, address, postal code, and phone number, then checks the terms box.
  - `paypal.com/checkoutweb/signup`: automatically fills in country, email, card details, name, address, and password, and shows a reminder that the current password matches the email.
  - Autofill switches for the two pages are controlled independently in settings and are enabled by default.

- Extension panel
  - Floating panel on the right side with collapse/expand support.
  - Collapse state, current tab, input content, and settings are saved locally.
  - The settings page shows the current extension version and supports manual GitHub Release update checks.
  - The settings page also includes a Telegram group link: [https://t.me/fuck_open](https://t.me/fuck_open).

## Screenshots

### Registration Helper

![Registration Helper](image/reg.png)

### Link Extractor

![Link Extractor](image/link.png)

### Address Profile

![Address Profile](image/address.png)

### SMS Code

![SMS Code](image/sms.png)

### Settings

![Settings](image/settings.png)

## Development Environment

Install the following first:

- Node.js
- pnpm
- Chrome or Chromium

Install dependencies:

```bash
pnpm install
```

Start development mode:

```bash
pnpm dev
```

WXT will launch the browser and load the extension. You can also use manual debugging mode:

```bash
pnpm dev:manual
```

Type check:

```bash
pnpm compile
```

Build:

```bash
pnpm build
```

Package:

```bash
pnpm zip
```

Firefox:

```bash
pnpm dev:firefox
pnpm build:firefox
pnpm zip:firefox
```

## Outlook Auto-Code API

The registration module can read Outlook verification codes through a local service. Default API address:

```text
http://127.0.0.1:8787
```

Account line format:

```text
email----password----client_id----refresh_token
```

The extension calls the local Outlook mail API and waits for the verification code. If the local service is not available, you can use single-email mode and enter the code manually.

## Permissions and Matched Pages

The extension is injected into the following pages:

- `https://chatgpt.com/*`
- `https://auth.openai.com/*`
- `https://pay.openai.com/*`
- `https://www.paypal.com/*`
- `https://paypal.com/*`

The requested host permissions include:

- Local Outlook API: `127.0.0.1:8787`, `localhost:8787`
- ChatGPT / OpenAI Auth / OpenAI Pay
- PayPal
- The meiguodizhi address data site
- GitHub Releases API for version update checks

## Releasing

If you upload this project to GitHub later, it is recommended to publish releases through GitHub Releases:

1. Update the `version` field in `package.json`.
2. Run:

```bash
pnpm compile
pnpm build
pnpm zip
```

3. Create a `vX.Y.Z` release in GitHub Releases.
4. Upload the generated zip file from `.output`.
5. Write the update notes in the release notes.

The extension checks the latest stable version through the GitHub Releases API. If the latest version is newer than the current extension version, an update notice, download link, and release notes are shown at the top of the extension. The settings page also provides a "Check for updates" button to force a manual refresh of the version check.

## Project Structure

```text
entrypoints/
  background.ts          Background message handling, Outlook code fetching, checkout creation
  content.ts             Content script entry that mounts the right-side extension panel and autofill modules
src/
  app/                   Main panel framework, state, and styles
  features/
    register/            Registration helper
    link-extractor/      Checkout link extraction
    address-autofill/    Address profiles and payment-page autofill
    version-check/       GitHub Release version checks and update prompts
    sms/                 SMS link polling and verification code history
    settings/            Settings page and persisted settings
scripts/                 Local debugging scripts
wxt.config.ts            WXT and extension manifest configuration
```

## Notes

This project is intended for browser extension development and workflow assistance. Payment pages, third-party sites, and API structures may change at any time, so autofill selectors need ongoing maintenance based on the actual pages.
