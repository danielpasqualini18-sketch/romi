# Security

This app stores family records. Each installation operator controls its Cloudflare
account, D1 database, Access policy, allowed-email secret, exports and retention.
There is no central Romi account service and no maintainer access to self-hosted data.
The app has not undergone an independent security audit.

Keep the entire Worker behind Cloudflare Access, retain JWT verification in the
Worker, use an exact-email allowlist and never deploy LOCAL_DEV=true. Restrict
Cloudflare deployment tokens to necessary resources. Do not put credentials or
private config into Git history. Rotate accidentally disclosed credentials promptly;
deleting the latest file alone does not remove Git history.

For a suspected vulnerability, do not open a public issue containing exploit details
or private records. Use GitHub's private vulnerability reporting on this repository
if enabled. If it is unavailable, open a minimal issue requesting a private reporting
channel without posting the vulnerability or personal information. Do not send real
data or account credentials to maintainers.

Only the latest version is maintained. Security fixes may require updating your
self-hosted deployment; GitHub source updates do not automatically update your Worker.
