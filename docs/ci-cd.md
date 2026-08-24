# Pulse CI/CD

The `Pulse CI/CD` workflow in `.github/workflows/ci.yml` runs the monorepo
checks, publishes the API and web images to Docker Hub, and builds a signed
Android APK. A tag such as `v1.0.1` also creates a GitHub Release with the APK
attached. The home server is updated manually by pulling the `latest` images.

## GitHub configuration

Add these repository secrets under **Settings → Secrets and variables →
Actions**:

- `DOCKERHUB_USERNAME`: Docker Hub account that owns the `pulse-api` and
  `pulse-web` repositories.
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
`PULSE_API_IMAGE` and `PULSE_WEB_IMAGE`. Set these two values in the home
server's `.env` to the Docker Hub `latest` tags, for example:

```dotenv
PULSE_API_IMAGE=docker.io/<dockerhub-namespace>/pulse-api:latest
PULSE_WEB_IMAGE=docker.io/<dockerhub-namespace>/pulse-web:latest
```

After a successful `main` build, update the server manually:

```sh
cd /home/delishad21/services/pulse
docker compose pull api web
docker compose up -d --no-build api web
```

Only the application services are recreated; database volumes and existing
authentication settings remain untouched.

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
Enable GitHub secret scanning and push protection, and leave Dependabot enabled
for npm, Docker, and GitHub Actions updates (the repository includes
`.github/dependabot.yml`).
