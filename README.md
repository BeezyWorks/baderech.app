# baderech.app

The home page for the Baderech apps (Mikros BaDerech, Mishnayos, Siddur One), with
a privacy policy and an about page.

Plain static files in `public/`, no build step, same approach as
[beezyworks.com](https://github.com/BeezyWorks/beezyworks.com). Deployed as a
Cloudflare Worker with static assets (`wrangler.jsonc`): build command empty,
deploy command `npx wrangler deploy`, then attach `baderech.app` as a custom domain.

| Path | What |
| --- | --- |
| `/` | The apps |
| `/about/` | About, with contact |
| `/privacy/` | Privacy policy |
| `/terms/` | Terms of service |

## Local development

```
npx wrangler dev --port 8788
```
