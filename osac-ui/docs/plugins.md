# UI plugins

OSAC UI loads independently built frontends at runtime through Module Federation.
A plugin can contribute pages and navigation, share React context with its
pages, and optionally serve API requests through its backend-for-frontend (BFF).
A configured plugin is trusted executable code in the OSAC UI browser page.

## Configure and enable a plugin

The UI Helm chart's `plugins` list configures which remotes the proxy loads. Each
entry has a unique plugin ID, a frontend base URL, and an optional BFF URL:

```yaml
plugins:
  - id: inventory-console
    url: https://plugins.example.com/inventory/
    bff:
      url: https://inventory-bff.example.com
```

Plugin IDs must be unique lowercase RFC 1035 labels: 1–63 characters, starting
with a letter and ending with a letter or digit; letters, digits, and hyphens
are allowed. Frontend and BFF URLs must be absolute HTTP(S) URLs without user
info, query strings, or fragments. BFF URLs must not include a path other than
`/`.

Plugin frontend and BFF URLs must use HTTPS by default. The proxy accepts HTTP
for either URL only when its environment contains
`PLUGINS_INSECURE=1`; see [BFF routes](#bff-routes). Use this setting only
for local development or explicitly controlled environments.

Adding or removing an entry enables or disables the plugin after the UI proxy
rolls out. No separate approval action is required. A fresh page load reads
`GET /api/plugins`; the endpoint returns only each plugin's `id` and frontend
`url` and sends `Cache-Control: no-store`. BFF URLs stay on the server. The UI
HTML response's CSP includes the exact origins of configured frontend URLs in
`script-src` and `connect-src`, and does not add BFF origins.

## Build a remote and define its descriptor

Build a frontend as a Module Federation remote and serve these files from its
configured base URL:

- `osac-plugin.json` — the plugin descriptor
- `mf-manifest.json` — the Module Federation manifest and remote entry metadata

The Module Federation remote name, descriptor `id`, and configured plugin ID
must match. A descriptor uses `apiVersion: osac.ui.plugin.v1` and
package-qualified extension types. For example:

```json
{
  "apiVersion": "osac.ui.plugin.v1",
  "id": "inventory-console",
  "name": "Inventory Console",
  "extensions": [
    {
      "type": "osac.ui.extension.v1.Route",
      "properties": {
        "path": "/extensions/inventory",
        "component": { "$codeRef": "InventoryPage" }
      }
    },
    {
      "type": "osac.ui.extension.v1.NavigationLink",
      "properties": {
        "id": "inventory",
        "label": "Inventory",
        "path": "/extensions/inventory",
        "allowedRoles": ["admin", "tenant-admin"]
      }
    }
  ]
}
```

A `$codeRef` resolves a module exposed by the remote. A module name selects its
default export; use `ModuleName.exportName` for a named export. Host and remote
must share compatible singleton instances of React, ReactDOM, `react-router`,
and `react-router-dom` when remote components use the host's React or router
context. The host assigns each loaded extension an ID based on its plugin ID
and descriptor position: `<plugin-id>:<index>`.

The host supports these extension types:

| Type | Contribution | Properties |
|------|--------------|------------|
| `osac.ui.extension.v1.Route` | A page rendered inside the OSAC application shell | `path`, `component` code reference |
| `osac.ui.extension.v1.NavigationSection` | A section in the sidebar | `id`, `label` |
| `osac.ui.extension.v1.NavigationLink` | A sidebar link | `id`, `label`, `path`, optional `section`, optional `allowedRoles` |
| `osac.ui.extension.v1.ContextProvider` | A React provider around the authenticated UI tree | `component` code reference accepting children |

Navigation links appear in descriptor order. A link's optional `section` names
a navigation section by its `properties.id` or a matching host section. Plugin
section IDs must be unique across loaded plugins.

`allowedRoles` controls link visibility only. Supported values are `admin`,
`tenant-idp-manager`, `tenant-admin`, and `tenant-user`. If the property is
omitted, every role sees the link. An empty list or a list containing an
unknown role hides that link. Routes are not guarded by navigation roles: a
user who knows the route URL can open it directly. Plugins and their BFFs must
enforce their own data and API authorization.

The host skips extension types it does not recognize. A plugin or extension
load failure is reported with its plugin and extension identity where
available; the host shows an accessible error at the affected extension and
keeps built-in pages and working extensions available.

## Runtime updates and trust

On each application load, the browser fetches the plugin source list, descriptor,
and Module Federation manifest. The plugin source endpoint is not cached. The
remote server or CDN controls caching for its descriptor, manifest, and emitted
assets; configure those response headers to match the remote's release process.
After publishing a compatible remote release, a full page reload discovers it
without rebuilding OSAC UI. An already-open page keeps the code it loaded until
that page is reloaded. There is no host/remote API compatibility guarantee;
coordinate changes to descriptors, exposed modules, or shared dependencies.

A remote runs in the host page and can use the browser capabilities available
to OSAC UI. CSP allows the OSAC UI's own origin and configured frontend origins
as script and connection sources, but it is not a JavaScript sandbox and does
not authorize backend requests. OSAC UI does not require signed plugin
manifests or Subresource Integrity for remote assets. Configure only plugin
URLs and releases that your organization trusts, and protect their publishing
pipeline and hosting.

## BFF routes

The optional `bff.url` is the server-side upstream for the plugin's same-origin
browser route `/api/plugin/<id>`. The proxy strips that prefix, binds the route
to the configured plugin ID, and never sends the upstream URL to the browser.
It replaces browser-supplied authorization and identity headers with the
Keycloak access token from the user's OSAC session, removes the OSAC session
cookie, and forwards the token as a bearer token. The BFF must validate the
token and authorize every API operation; a navigation policy is not an API
security check.

The proxy requires HTTPS for plugin frontend and BFF URLs by default. Its BFF
client validates the server certificate and uses the proxy's
`FULFILLMENT_TLS_CA_FILE` trust bundle; for a private BFF issuer, include that
CA in the configured bundle. The development-only
`FULFILLMENT_TLS_INSECURE=1` setting also disables outbound certificate
verification; do not set it in deployments. To allow HTTP plugin frontend or
BFF URLs, set the exact environment value `PLUGINS_INSECURE=1` on the OSAC
UI proxy process. With an HTTP BFF, the user's bearer token travels over HTTP;
with an HTTP frontend, remote code and data load without TLS. Use this opt-out
only when those transports are explicitly acceptable. Values such as `true`
do not enable it.

## Run a plugin locally

Install the OSAC UI dependencies once, from `osac-ui/`:

```bash
pnpm install
```

Start the federation demo remote and the OSAC UI host in separate terminals.
The demo uses HTTP locally, so set the unified HTTP opt-in:

```bash
# From osac-ui/
PLUGINS_INSECURE=1 \
FULFILLMENT_API_URL=https://fulfillment.your-env.example.com \
  pnpm dev -- --plugins apps/federation-demo-remote/plugins.dev.yaml

# In another terminal, from osac-ui/
pnpm --filter @osac/federation-demo-remote run dev
```

The `--plugins` flag registers plugin URLs with the OSAC host; it does not start
the plugin's frontend or BFF processes. The OSAC dev proxy reads its OIDC
settings from the local environment or, when available, from the `osac-ui`
ConfigMap and `osac-ui-backend-credentials` Secret in the current OpenShift
project. For protected API reflection, log in with `oc` and make sure the
proxy can read those resources. See the [quick start](../README.md#quick-start)
for TLS and namespace overrides.

If a local plugin frontend or BFF serves HTTP, set `PLUGINS_INSECURE=1` on
the proxy process. For example:

```bash
PLUGINS_INSECURE=1 \
FULFILLMENT_API_URL=https://fulfillment.your-env.example.com \
  pnpm dev -- --plugins <plugin-config.yaml>
```

The BFF issuer must be reachable from the plugin process and match the issuer
trusted by OSAC UI. For an in-cluster BFF with a different CA, add that CA to the
proxy's configured TLS trust bundle.

### AI Grid provider console

The AI Grid development configuration uses an HTTP frontend on port 9000 and
an HTTP BFF on port 8082. From `osac-ui/`, start the host with both local HTTP
opt-ins:

```bash
PLUGINS_INSECURE=1 \
FULFILLMENT_API_URL=https://fulfillment.your-env.example.com \
  pnpm dev -- --plugins "$(realpath ../../ai-grid-provider-console/frontend/plugins.ai-grid.dev.yaml)"
```

Then, from the AI Grid provider console repository root, start its fake stack
with an issuer that signs the OSAC session token:

```bash
OIDC_ISSUER_URL=https://keycloak.your-env.example.com/realms/your-realm \
OIDC_CLIENT_ID=osac-ui BFF_PORT=8082 make dev-fake
```

For a real hub backend, use the AI Grid repository's `make dev-cluster`
workflow and its
[development setup guide](https://github.com/ai-grid-cloud/ai-grid-provider-console/blob/main/docs/dev-setup.md).
