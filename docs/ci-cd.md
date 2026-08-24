# Pulse CI/CD

The `Pulse CI/CD` workflow in `.github/workflows/ci.yml` runs the monorepo
checks, publishes the API and web images to Docker Hub, builds a signed Android
APK, and deploys the immutable image tags to the home server on pushes to
`main`. A tag such as `v1.0.1` also creates a GitHub Release with the APK
attached.

## GitHub configuration

Add these repository secrets under **Settings → Secrets and variables →
Actions**:

- `DOCKERHUB_USERNAME`: Docker Hub account that owns the `pulse-api` and
  `pulse-web` repositories.
- `DOCKERHUB_TOKEN`: a Docker Hub access token with permission to push those
  repositories.
- `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
  and `ANDROID_KEY_PASSWORD`: the signing key used for every downloadable APK.
- `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PATH`, `DEPLOY_SSH_KEY`, and
  `DEPLOY_KNOWN_HOSTS`: the SSH connection to the home server. `DEPLOY_PATH`
  should be the directory containing the production `.env` and compose file,
  for example `/home/delishad21/services/pulse`.

The optional repository variable `DOCKERHUB_NAMESPACE` can be set when the
Docker Hub namespace differs from the login username. The optional
`PULSE_PRODUCTION_API_URL` variable defaults to `https://pulse.delishad.com`.
The API URL is embedded in the mobile bundle and is not a credential; all
credentials remain GitHub secrets or server-side environment variables.

For a new Android signing key, generate it locally and never commit it:

```sh
keytool -genkeypair -v -storetype PKCS12 \
  -keystore pulse-release.keystore \
  -alias pulse \
  -keyalg RSA -keysize 2048 -validity 10000
base64 -i pulse-release.keystore | pbcopy
```

Paste the copied value into `ANDROID_KEYSTORE_BASE64`, then add the three
password/alias values as separate secrets. Keep the keystore outside the
repository. Android only accepts an update when it is signed by the same key;
the first CI-signed APK therefore replaces any earlier locally debug-signed
APK (uninstall the debug build once if Android refuses the update).

## Home-server deployment

The production `compose.yaml` accepts complete image references through
`PULSE_API_IMAGE` and `PULSE_WEB_IMAGE`. The deploy job updates only those two
keys in the server `.env`, copies the compose file atomically, pulls the
immutable commit-tagged images, and recreates only `api` and `web`. Database
volumes and the existing authentication settings are left untouched.

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
