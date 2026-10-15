# baderech.app

The home page for the Baderech apps (Mikros BaDerech, Mishnayos, Siddur One), with
web account management for the shared Baderech account, a privacy policy and an
about page.

Plain static files in `public/`, no build step, same approach as
[beezyworks.com](https://github.com/BeezyWorks/beezyworks.com). Deployed as a
Cloudflare Worker with static assets (`wrangler.jsonc`): build command empty,
deploy command `npx wrangler deploy`, then attach `baderech.app` as a custom domain.

| Path | What |
| --- | --- |
| `/` | The apps |
| `/account/` | Sign in / sign up / forgot password; when signed in: name, sign-in methods, password, sign out, delete account |
| `/about/` | About, with contact |
| `/privacy/` | Privacy policy |

## Accounts

`/account/` calls the Better Auth API at `https://auth.baderech.app`
([BeezyWorksAccounts](https://github.com/BeezyWorks/BeezyWorksAccounts)) from the
browser with `credentials: "include"`, using the shared `.baderech.app` session
cookie. For that to work the auth worker needs `https://baderech.app` in
`TRUSTED_ORIGINS` (it then sends CORS for it). Google/Apple buttons appear only when
the auth worker's `GET /providers` says they're configured.

## Local development

```
npx wrangler dev --port 8788          # this site
```

On `localhost` the account page talks to `http://localhost:8787`, so run the auth
worker there (`pnpm dev` in BeezyWorksAccounts) with `http://localhost:8788` in its
`TRUSTED_ORIGINS` and `COOKIE_DOMAIN` empty.
