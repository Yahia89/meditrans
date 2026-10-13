# Isolated Firefox regression runs

After building the production app, run:

```sh
npm run test:firefox:ui
```

This runs the existing startup, dashboard and router Firefox projects against production preview using synthetic sessions and intercepted backend requests. To select suites, use `npm run test:firefox:ui -- startup dashboard` or `npm run test:firefox:ui -- router`. No real credentials are used.

The normal `npm run test:router:ui` command retains Chromium/WebKit; use this wrapper for Firefox on affected macOS hosts.

On affected macOS 27 hosts, Playwright's Firefox can fail with `Could not find profile folder` even with a temporary `-profile`: it separately looks up the personal Firefox application-data directory. The [upstream Playwright issue](https://github.com/microsoft/playwright/issues/42768) documents a temporary `CFFIXED_USER_HOME` workaround. The wrapper supplies this variable only to its child test processes, pointing at a new session-owned directory. It leaves the actual HOME environment value, personal browser profiles, managed browser binary and macOS privacy settings unchanged. Other platforms use their normal environment.

The wrapper writes `meditrans-firefox-<suite>.log` in the system temporary directory. It then removes only its own temporary application-data tree, including the ordinary deny-delete ACLs macOS creates inside that tree. A failed suite yields a nonzero exit code after the other selected suites finish.

Validation and retained runner logs: [Firefox evidence](../../reports/startup/firefox-validation.md).
