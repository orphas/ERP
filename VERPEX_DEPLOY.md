Verpex cPanel Node.js deployment

Target domain: `https://sgicerp.sgicr.com`

## One-command deploy (run this every time you push code)

SSH into Verpex and run:

```bash
cd /home/aofksaco/repositories/sgicerp && git pull && unset npm_config_prefix NPM_CONFIG_PREFIX && npm config delete prefix && rm -rf node_modules package-lock.json && npm install --include=dev --prefix /home/aofksaco/repositories/sgicerp && node /home/aofksaco/repositories/sgicerp/scripts/prisma-generate.cjs && /home/aofksaco/repositories/sgicerp/node_modules/.bin/next build --experimental-build-mode compile && /home/aofksaco/repositories/sgicerp/node_modules/.bin/next build --experimental-build-mode generate-env && cloudlinux-selector restart --json --interpreter nodejs --user aofksaco --app-root repositories/sgicerp
```

## First-time setup only

1. In cPanel Node.js App: set startup file to `server.js`, Node version 24.
2. Create `.env` in `/home/aofksaco/repositories/sgicerp/`:
   ```
   DATABASE_URL="file:./prisma/dev.db"
   AUTH_SECRET="your-secret-here"
   NODE_ENV="production"
   APP_BASE_PATH=""
   ```
3. Ensure `prisma/dev.db` exists and is writable.
4. Run the one-command deploy above.

## After first deploy — bootstrap the database

```bash
cd /home/aofksaco/repositories/sgicerp && node /home/aofksaco/repositories/sgicerp/scripts/prisma-db-push.cjs
```

Then log in at `https://sgicerp.sgicr.com/login` with `admin / admin123` and go to Settings → User Access to create real users.

## Why this works

- `git pull` gets latest code (no merge conflicts — never edit files directly on server)
- `rm -rf node_modules package-lock.json` + `npm install --prefix ...` forces install from project root, avoiding cPanel's nodeenv cwd bug
- `node /absolute/path/scripts/prisma-generate.cjs` uses `__dirname` so Prisma CLI is found correctly regardless of working directory
- `next build --experimental-build-mode compile` then `generate-env` is required on shared hosting (single-CPU constraint)
- `touch tmp/restart.txt` signals cPanel to restart the Node.js process

## Notes

- Never edit files directly on the server — always push via git and redeploy
- SQLite DB is at `prisma/dev.db` — do not delete it
- For the subdomain deployment, keep `APP_BASE_PATH=""` and use `https://sgicerp.sgicr.com`
- If you later deploy under a URL path (example `/sgicerp`), set `APP_BASE_PATH="/sgicerp"`
- Do not upload `.venv`, `node_modules`, `.next-dev`