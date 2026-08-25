# Pulse CI/CD

The `Pulse CI/CD` workflow in `.github/workflows/ci.yml` runs the monorepo
checks, publishes the API, web, MCP, and reminder-worker images to Docker Hub, and builds a signed
Android APK. A tag such as `v1.0.1` also creates a GitHub Release with the APK
attached. The home server is updated manually by pulling the `latest` images.

## GitHub configuration

Add these repository secrets under **Settings → Secrets and variables →
Actions**:

- `DOCKERHUB_USERNAME`: Docker Hub account that owns the `pulse-api`,
  `pulse-web`, `pulse-mcp`, and `pulse-reminder-worker` repositories.
- `DOCKERHUB_TOKEN`: a Docker Hub access token with permission to push those
  repositories.
- `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
  and `ANDROID_KEY_PASSWORD`: the signing key used for every downloadable APK.

The optional repository variable `DOCKERHUB_NAMESPACE` can be set when the
Docker Hub namespace differs from the login username. The optional
mobile development variable `EXPO_PUBLIC_PULSE_API_URL` can prefill the server
selector while running locally. Production APKs intentionally do not embed a
server URL: on first launch, the user chooses a Pulse instance and can change
or disconnect it from the login screen. All credentials remain GitHub secrets
or server-side environment variables.

For a new Android signing key, generate it locally and never commit it:

```sh
keytool -genkeypair -v -storetype PKCS12 \
  -keystore pulse-release.keystore \
  -alias pulse \
  -keyalg RSA -keysize 2048 -validity 10000
# macOS (copies one continuous line to the clipboard)
base64 -i pulse-release.keystore | tr -d '\n' | pbcopy
# Linux (writes one continuous line to a file you can copy)
base64 -w 0 pulse-release.keystore > pulse-release.keystore.b64
```

Paste only the Base64 text into `ANDROID_KEYSTORE_BASE64` (no quotes or code
fences), then add the three password/alias values as separate secrets. Wrapped
lines are accepted by CI, but a value containing other characters will fail
validation. Keep the keystore outside the repository. Android only accepts an update when it is signed by the same key;
the first CI-signed APK therefore replaces any earlier locally debug-signed
APK (uninstall the debug build once if Android refuses the update).

## Home-server updates

The production `compose.yaml` accepts complete image references through
`PULSE_API_IMAGE`, `PULSE_WEB_IMAGE`, `PULSE_MCP_IMAGE`, and
`PULSE_REMINDER_WORKER_IMAGE`. In Portainer, set
these values in the stack environment to the Docker Hub `latest` tags, for
example:

```dotenv
PULSE_API_IMAGE=docker.io/<dockerhub-namespace>/pulse-api:latest
PULSE_WEB_IMAGE=docker.io/<dockerhub-namespace>/pulse-web:latest
PULSE_MCP_IMAGE=docker.io/<dockerhub-namespace>/pulse-mcp:latest
PULSE_REMINDER_WORKER_IMAGE=docker.io/<dockerhub-namespace>/pulse-reminder-worker:latest
PULSE_MCP_HOST_PORT=6061
```

After a successful `main` build, use Portainer's **Re-pull image and redeploy**
action for the `pulse` stack. The MCP service is no longer profile-gated and
will run continuously alongside the API and web services.

Reminder delivery additionally uses `HERMES_REMINDER_WEBHOOK_URL`,
`HERMES_REMINDER_WEBHOOK_SECRET`, `TELEGRAM_FALLBACK_BOT_TOKEN`,
`TELEGRAM_REMINDER_CHAT_ID`, and `TELEGRAM_REMINDER_THREAD_ID`. Keep these in
the Portainer stack environment. The fallback token may remain empty until the
separate bot has been created; Hermes delivery remains available without it.
Optional email delivery uses `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`,
`SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`. Phone notifications use Expo
Push; set `EXPO_ACCESS_TOKEN` only when push security is enabled for the Expo
project, and configure the mobile app's Expo project and FCM/APNs credentials.

The database volume and existing authentication settings remain untouched.

## Hermes account binding

After deployment, sign in to Pulse and create a named API key under **Settings
→ API keys**. Add the one-time value to the home server's `.env`:

```dotenv
PULSE_MCP_API_KEY=pulse_replace-with-the-generated-key
```

The persistent `pulse-mcp` container serves `http://127.0.0.1:6061/mcp` and
requires the same key as its Hermes bearer token. The API resolves the key to
its owner; `PULSE_DEFAULT_USERNAME` is no longer used for MCP requests once
this key is configured. Revoke or rotate the key from Settings if the
integration host is lost or compromised.

The Docker Hub repositories may be public, in which case the server needs no
additional setup. For private repositories, log in on the server once with a
read-only Docker Hub token (`docker login`) and keep that credential on the
server; it is deliberately not transported through GitHub Actions.

To publish a release and make an APK available for phone updates:

```sh
git tag v1.0.1
git push origin v1.0.1
```

The APK is also uploaded as a 30-day Actions artifact for every `main` build.

## Recommended repository settings

Protect `main` and require the `Typecheck, lint, and test` check before merge.
Enable GitHub secret scanning and push protection. Dependabot version updates
are disabled for this repository.
