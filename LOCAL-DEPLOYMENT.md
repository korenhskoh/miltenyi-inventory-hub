# Running the Inventory Hub on an office desktop

This is the procedure for moving the system off the hosted service and onto a
desktop in the office, with colleagues reaching it over the office network and
over the VPN from outside.

The plan is to run both side by side for a while and cut over once the local one
has proved itself. Nothing here shuts the hosted service down; that is a separate
decision taken at the end.

Everything in `scripts/windows/` was syntax-checked against Windows PowerShell
5.1. The application side — booting in production mode against a local
PostgreSQL with no TLS, the migration, the backup and restore, and the full
order-to-arrival journey — was run end to end before this was written.

## What the desktop needs

A machine that stays powered on. It is now the server: when it sleeps, the
system is down for everybody, WhatsApp drops its session, and any scheduled
report due in that window does not go out. Turn off sleep and hibernate under
Power Options, and set it to power on again after a power cut if the BIOS
offers that.

Install, in this order, then open a **new** PowerShell window so the updated
PATH is picked up:

1. **Node.js LTS** — https://nodejs.org (the MSI; tick "Add to PATH")
2. **PostgreSQL 16 or newer** — https://www.postgresql.org/download/windows/
   Note the password you set for the `postgres` user; you need it shortly. Tick
   "Command Line Tools" so `pg_dump` and `pg_restore` are installed, and add
   PostgreSQL's `bin` folder to the system PATH.
3. **Git** — https://git-scm.com (only needed to pull updates later)

Check all three answer:

```powershell
node --version
npm --version
pg_dump --version
```

## 1. Get the code onto the desktop

```powershell
cd C:\
git clone https://github.com/korenhskoh/miltenyi-inventory-hub.git
cd miltenyi-inventory-hub
npm ci
npm run build
```

`npm run build` produces `dist\`, which is what the browser actually loads. Skip
it and every page shows "Cannot GET /".

## 2. Create the database

```powershell
createdb -U postgres miltenyi
```

Empty for now — the next step fills it from the hosted copy.

## 3. Copy the data across

Get the hosted connection string from the Railway dashboard (Postgres service →
Variables → `DATABASE_URL`). Then, in the project folder:

```powershell
$env:SOURCE_DATABASE_URL = 'postgresql://...from railway...'
$env:TARGET_DATABASE_URL = 'postgres://postgres:YOURPASSWORD@localhost:5432/miltenyi'
node scripts/migrate-to-local.mjs
```

It dumps, restores, then counts every table in both databases and prints them
side by side. It only says the copy is complete when every number matches.

If it reports tables as SHORT or MISSING, do not continue — the restore did not
finish. Run it again; if the same table is short twice, restore that table on
its own and investigate before going further.

The WhatsApp session lives in the `wa_auth` table, so it comes across with the
data. No QR scan is needed.

## 4. Configure

```powershell
copy scripts\windows\env.example scripts\windows\server.env
notepad scripts\windows\server.env
```

Fill in, at minimum:

- `DATABASE_URL` — with the real postgres password
- `JWT_SECRET` — generate one and never change it, or everyone is logged out:
  ```powershell
  -join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Max 256) })
  ```
- `ADMIN_PASSWORD` — only used if the users table is empty, which after a
  migration it is not; set it anyway
- `FRONTEND_URL` — every address the system will be reached by, comma-separated
- `BACKUP_DIR` — ideally a different physical disk from the database

`DATABASE_SSL=disable` is already set and must stay. The database is on this
machine, so there is no TLS; without this the server tries to negotiate it and
PostgreSQL answers "The server does not support SSL connections".

`TRUST_PROXY_HOPS=0` is also already set and matters more than it looks. There
is no reverse proxy here, so at the hosted value of 1 the login rate limiter
believes the `X-Forwarded-For` header — which anything on the network can set —
and an attacker sidesteps the limiter by varying it. 0 means clients are judged
by the address they actually connected from.

`server.env` holds the database password and the token secret. It is excluded
from git; keep it that way.

## 5. Give the desktop a fixed address

Before telling anyone the URL, make sure the address cannot change. Either set a
static IP on the desktop, or — better, and the thing to ask IT for — a DHCP
reservation so the router always hands it the same one. Without this the address
changes at some point and every link breaks at once.

## 6. Install the services

From an **elevated** PowerShell (right-click, Run as administrator), in the
project folder:

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
.\scripts\windows\install.ps1
```

That registers two scheduled tasks and opens the firewall port:

- **MiltenyiInventoryHub** — starts at boot, as SYSTEM, running the supervisor
  in `run-server.ps1`. The supervisor restarts the server if it ever exits, with
  a backoff so a misconfiguration cannot spin the CPU. It runs as SYSTEM so it
  survives sign-out and is unaffected by anyone's password changing.
- **MiltenyiInventoryHubBackup** — nightly at 01:30.

The firewall rule is added for the **Private** profile only. If the office
network is classified as Public on this machine, the rule will not apply —
change the network to Private in Windows network settings rather than opening
the Public profile.

Scheduled tasks rather than a Windows service because a real service needs a
third-party wrapper such as NSSM, and that is rarely welcome on a managed
corporate desktop. A task set to run whether the user is logged on or not gives
the same practical result with nothing extra installed.

Start it:

```powershell
Start-ScheduledTask -TaskName 'MiltenyiInventoryHub'
```

Then open `http://localhost:3001` on the desktop, and the computer-name URL from
another machine.

## 7. Remote access

The firewall rule covers the office network. For access from outside, in order
of preference:

1. **The company VPN.** Nothing to configure here — anyone on the VPN reaches
   the same address as if they were in the office. Add the VPN-side address to
   `FRONTEND_URL`. This is the one to ask IT for.
2. **A reverse proxy run by IT**, terminating HTTPS and forwarding to this
   machine. If you go this way, set `TRUST_PROXY_HOPS` to the number of proxies
   in front of the server, or the rate limiter sees only the proxy's address and
   counts the whole company as one client.

Do not forward a port on the office router to this machine. It would put an
internal system holding customer and pricing data directly on the public
internet, over plain HTTP, with no certificate.

## 8. Check the backups before trusting them

This is the part of leaving a managed host that is easy to skip and expensive to
skip. Run one by hand and then restore it:

```powershell
.\scripts\windows\run-backup.ps1
```

```powershell
createdb -U postgres restore_test
pg_restore --no-owner --no-privileges --dbname "postgres://postgres:YOURPASSWORD@localhost:5432/restore_test" "D:\MiltenyiBackups\miltenyi-....dump"
psql -U postgres -d restore_test -c "SELECT count(*) FROM orders;"
dropdb -U postgres restore_test
```

A backup nobody has restored is a guess. Repeat this once a quarter.

Copy the backup folder somewhere off this machine as well — a network share, or
OneDrive. A nightly backup sitting on the same disk as the database is lost with
the disk.

## 9. Run both, then cut over

While both are running, the hosted copy keeps changing. Before cutting over,
compare them:

```powershell
$env:SOURCE_DATABASE_URL = 'postgresql://...railway...'
$env:TARGET_DATABASE_URL = 'postgres://postgres:YOURPASSWORD@localhost:5432/miltenyi'
node scripts/migrate-to-local.mjs --verify
```

Tables where the local copy has *more* rows are flagged as ahead — that is work
done locally that the hosted copy does not have, and re-running a full migration
would overwrite it.

The cleanest cutover is to pick a quiet moment, tell everyone to stop using the
hosted system, re-run the full migration so the local copy is exact, verify, and
then point everyone at the new address.

Checklist before the hosted service is shut down:

- [ ] `--verify` reports every table matching
- [ ] A backup has been taken *and restored* successfully
- [ ] The backup folder is copied somewhere off this machine
- [ ] The desktop has a fixed address and does not sleep
- [ ] It comes back on its own after a reboot (test it — reboot and wait)
- [ ] Colleagues have reached it, by name and over the VPN
- [ ] WhatsApp shows connected, and a test notification arrives
- [ ] An approval email sends, or Copy for Outlook works
- [ ] Someone other than you knows how to restart it and where the backups are

Keep the hosted service running, with its data frozen, for a week or two after
cutover. It is the fallback if something surfaces late, and it costs very little
to leave alone.

## Everyday operations

```powershell
# state, start, stop
Get-ScheduledTask -TaskName 'MiltenyiInventoryHub'
Start-ScheduledTask -TaskName 'MiltenyiInventoryHub'
Stop-ScheduledTask  -TaskName 'MiltenyiInventoryHub'

# is it alive
curl http://localhost:3001/api/health
```

Logs are in `logs\` in the project folder: `supervisor.log` for starts, stops
and restarts, `server.log` and `server.error.log` for the application, and
`.prev.log` for the run before the current one — which is where the reason for a
restart will be.

To update after a change is pushed:

```powershell
Stop-ScheduledTask -TaskName 'MiltenyiInventoryHub'
git pull
npm ci
npm run build
Start-ScheduledTask -TaskName 'MiltenyiInventoryHub'
```

Take a backup first.

## If something goes wrong

**Nobody can reach it, but localhost works on the desktop.** The firewall rule,
or the network profile. Check `Get-NetFirewallRule -DisplayName '*Miltenyi*'`
and confirm the active network is Private, not Public.

**"Cannot GET /" in the browser.** `dist\` is missing. Run `npm run build`.

**The server will not start, log says the server does not support SSL
connections.** `DATABASE_SSL=disable` is missing from `server.env`.

**Everyone was logged out after a restart.** `JWT_SECRET` changed or is empty.
It must be set and must stay the same.

**The address stopped working.** DHCP gave the desktop a different IP. This is
what the fixed address in step 5 prevents.

**It did not come back after a reboot.** Check the task ran:
`Get-ScheduledTask -TaskName 'MiltenyiInventoryHub' | Get-ScheduledTaskInfo`,
and read `logs\supervisor.log`.

## Rolling back to the hosted service

While the hosted service is still running, rolling back is just telling people
to use the old address again. That is the whole reason for running both.

Once it has been shut down, roll back by restoring the most recent local backup
into a fresh hosted database and redeploying — which is why the backups, and
having actually tested a restore, matter.
