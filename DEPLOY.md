# Putting the marketplace online

This guide takes you from a fresh server to a live website. A technician can do it in about an hour. Everything runs in Docker, so there is nothing to install except Docker.

## What you need

| Item | Notes |
|---|---|
| A server (VPS) | Ubuntu 22.04 or 24.04, **2 GB RAM or more**, 20 GB disk or more. Any provider works (DigitalOcean, Hetzner, AWS, a local Pakistani host). |
| A domain name | e.g. `cars.example.pk`. Point an **A record** at the server's IP address. |
| Ports 80 and 443 open | Caddy needs both to get your free HTTPS certificate. |

## 1. Install Docker (once)

```bash
curl -fsSL https://get.docker.com | sh
```

## 2. Put the project on the server

Copy the project folder to the server (for example `/srv/auto-marketplace`) with `scp`, `rsync` or `git clone`.

## 3. Fill in the settings

```bash
cd /srv/auto-marketplace
cp .env.production.example .env
nano .env
```

Set at least these three:

```
SITE_URL=https://cars.example.pk       # your real address, with https
DOMAIN=cars.example.pk                 # same name, no https
JWT_SECRET=<paste the output of:  openssl rand -hex 32 >
```

**Keep `.env` private and back it up somewhere safe.** If you lose `KYC_SECRET`/`JWT_SECRET`, stored CNIC numbers cannot be read again. Never change them after launch.

The app **refuses to start** with a missing or weak secret, so a mistake shows up immediately rather than as a hole later.

## 4. Start everything

```bash
docker compose up -d --build
```

The first start takes a few minutes. Then open `https://cars.example.pk`. Caddy gets the HTTPS certificate by itself.

Check it is healthy:

```bash
docker compose ps                     # all three should be "running" / "healthy"
curl https://cars.example.pk/api/health   # {"ok":true}
```

## 5. First-time setup in the browser

1. Open `https://cars.example.pk/setup` and create the **owner (admin) account**. This page only works once.
2. Go to **Settings** and fill in:
   - business name, phone, WhatsApp, addresses of showrooms (branches);
   - **Running costs**: today's petrol/diesel prices and token-tax amounts;
   - **Bank lease rates**: replace the sample banks with real current rates;
   - **Safe token**: your business bank/JazzCash details, if you want to offer online tokens.
3. Add staff accounts (Settings → Staff accounts). Give day-to-day staff the "staff" role, not "admin".

## 6. Backups (do not skip)

Everything customers have given you (cars, ads, identities, accounts) lives in the database and the photos folder. Back both up **every night**:

```bash
crontab -e
```

add:

```
0 3 * * *  cd /srv/auto-marketplace && ./scripts/backup.sh >> backups/backup.log 2>&1
```

This keeps 14 days in `./backups`. **That is not enough on its own**, because a backup on the same disk is lost if the disk fails. Copy `./backups` to another place every day, for example:

- another server: `rsync -a ./backups/ user@other-server:/safe/place/`
- a cloud bucket: `rclone sync ./backups remote:my-bucket/backups`

**Practise a restore once, before you need it:**

```bash
./scripts/restore.sh backups/db-20261017-030000.archive.gz --into auto_check   # safe copy to look at
./scripts/restore.sh backups/db-20261017-030000.archive.gz                      # replaces the live database (asks you to type YES)
./scripts/restore.sh backups/photos-20261017-030000.tar.gz                      # puts photos back
```

## 7. Updating the website later

```bash
cd /srv/auto-marketplace
./scripts/backup.sh                    # always back up first
# copy in the new version of the project, then:
docker compose up -d --build
```

Data lives in Docker volumes, so rebuilding never touches it.

## 8. Photos in the cloud (optional)

By default photos are stored on the server's disk (a Docker volume) and are included in the backups. Use a cloud bucket instead if you will run more than one server or your host's disk is temporary. Any S3-compatible service works (Cloudflare R2, AWS S3, DigitalOcean Spaces, Backblaze B2). In `.env`:

```
STORAGE_DRIVER=s3
S3_BUCKET=my-photos
S3_REGION=auto
S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_PUBLIC_URL=https://cdn.example.pk      # the public address the bucket is served from
```

The bucket must allow public reads of its files (buyers' browsers load the photos from it). Back the bucket up with your provider's tools; `backup.sh` then only backs up the database.

## 9. Keeping watch

- Add `https://cars.example.pk/api/health` to a free uptime monitor (UptimeRobot, Better Stack). It returns an error if the database is unreachable.
- Logs: `docker compose logs -f app`
- Disk space: `df -h` now and then; photos and backups grow.

## Security checklist

- [ ] `JWT_SECRET` is long and random, and `.env` is not shared or committed.
- [ ] Only ports 80 and 443 are open to the internet (the database has no public port by design). Use `ufw allow 80,443,22/tcp && ufw enable`.
- [ ] SSH uses keys, not passwords.
- [ ] Nightly backups run **and are copied off the server**; you have tested a restore.
- [ ] Only trusted people have the **admin** role: admins can see CNIC numbers, approve dealers, verify tokens and refund money. Every CNIC view is logged.
- [ ] Server updates are applied regularly (`apt update && apt upgrade`, then `docker compose up -d --build` for the app).

## Things to know

- **One app instance.** Rate limiting (against spam and password guessing) is kept in the app's memory, so run a single `app` container as `docker-compose.yml` does. To run several, move rate limiting to Redis first.
- **NADRA verification is built but off.** See the README ("NADRA verification") for how to switch it on once you have NADRA's agreement. Until then admins verify identities by hand.
- **Certificates need `SITE_URL`.** The QR code on every certificate points there; a wrong address means customers' scans fail.
- **Build needs internet once** (to download packages). Fonts are bundled, so the site never calls Google.
