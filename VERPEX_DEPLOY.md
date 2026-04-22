Verpex cPanel Node.js deployment

1. Upload this package and extract it into the Node.js app application root.
2. In cPanel Node.js App, use `server.js` as the startup file.
3. Create `.env` in the application root before installing dependencies.
4. Run `npm install` in the application root.
5. Run `npm run build` in the application root.
6. Restart the Node.js app.

Expected environment file

- `.env` is included with:
  - `DATABASE_URL="file:./prisma/dev.db"`
  - `AUTH_SECRET="..."`

Required deploy sequence

- Use Node.js 20 in cPanel.
- Run install and build from the project root, the same directory that contains `package.json`, `server.js`, `app/`, and `prisma/`.
- Do not skip lifecycle scripts during install. Prisma client generation is required both after install and during build.
- Prisma lifecycle scripts are wrapped to resolve the schema from the project root even if cPanel runs npm hooks from the wrong directory.
- Confirm that `prisma/dev.db` exists after upload and is writable by the Node.js app user.

Notes

- The SQLite database file is stored at `prisma/dev.db`.
- The build now runs `prisma generate` explicitly so Verpex/cPanel installs that skip implicit hooks still produce a usable Prisma client.
- Do not upload `.venv`, `node_modules`, `.next-dev`, or the old broken zip.
- The app is configured with Next.js base path `/sgicerp`, so the public URL must be under `/sgicerp`.