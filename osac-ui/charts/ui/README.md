# Service Helm Chart

This Helm chart deploys the OSAC UI.

## Prerequisites

- **fulfillment-service** deployed and reachable from the cluster.
- **Keycloak** deployed with an OIDC realm and the `osac-ui` client registered.

Platform integration (Keycloak `KC_HOSTNAME`, OIDC client, fulfillment trusted issuer, TLS troubleshooting) is documented in [`../../docs/deployment-openshift-guide.md`](../../docs/deployment-openshift-guide.md).

## Installation

`helm install` deploys only the UI; complete Keycloak and fulfillment integration per the [OpenShift deployment guide](../../docs/deployment-openshift-guide.md) before expecting a working login flow.

To install the chart with the release name `osac-ui`:

```bash
$ helm install osac-ui ./deploy/chart -n osac --create-namespace
```

## Configuration

The following table lists the configurable parameters of the chart and their default values:

To configure runtime-loaded plugins, set their IDs and base URLs in `plugins`.
OSAC loads `osac-plugin.json` and `mf-manifest.json` from each base URL. A plugin
can also configure a BFF upstream URL. The OSAC UI serves that BFF at
`/api/plugin/<id>`, where `<id>` is the unique plugin ID, and the upstream URL
can point to an in-cluster Service. Use HTTPS for both URLs in deployed
environments:

```yaml
plugins:
  - id: ai-grid-provider-console
    url: https://plugins.example.com/
    bff:
      url: https://ai-grid-provider-console.ai-grid.svc:8443
```

The example BFF uses port 8443 for its TLS listener; use the actual TLS port
for your Service. The BFF Service must present a certificate valid for its
service name. The proxy uses `FULFILLMENT_TLS_CA_FILE` for BFF connections; add
a private BFF CA to the trust bundle configured by
`api.fulfillment.certs.caBundle.configMap`.
Plugin frontend and BFF URLs must use HTTPS by default. For an environment that
intentionally accepts HTTP for either, set `PLUGINS_INSECURE=1` in the
`osac-ui` proxy container environment using the deployment's environment
customization. HTTP frontend URLs load remote code and data without TLS; HTTP
BFF URLs send the user's bearer token without TLS. The chart does not enable
this override by default.

The `plugins` setting defaults to an empty list. Adding or removing an entry
updates the plugin ConfigMap and rolls out the proxy; that deployment change is
the enablement control and does not require a separate approval action. The
browser receives only plugin IDs and frontend URLs from `GET /api/plugins`.

| Parameter                                 | Description                                                                                                                                      | Default                        | Required |
|-------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------|----------|
| `externalHostname`                        | External hostname for the OpenShift Route. When not set, the hostname is automatically assigned by OpenShift.                                    | `""`                           | No       |
| `route.enabled`                           | Create the OpenShift Route. Disable when exposing the Service through another ingress, such as a Gateway API HTTPRoute.                         | `true`                          | No       |
| `api.fulfillment.url`                     | URL of the Fulfillment API backend.                                                                                                              | `https://fulfillment-api:8000` | Yes      |
| `api.fulfillment.certs.caBundle.configMap`| Name of a ConfigMap in the release namespace that contains trusted CA certificates in PEM format for the Fulfillment API TLS connection.         | `""`                           | Yes      |
| `auth.oidcClientId`                       | OIDC client ID registered in Keycloak (or another OIDC provider) for the UI.                                                                    | `osac-ui`                      | Yes      |
| `auth.certs.caBundle.configMap`           | Name of a ConfigMap in the release namespace that contains trusted CA certificates in PEM format for the OIDC/Auth TLS connection.               | `""`                           | Yes      |
| `plugins`                                 | Runtime plugin source entries and optional BFF upstreams. Frontend and BFF URLs require HTTPS by default.                                       | `[]`                            | No       |
| `log.level`                               | Log level for all components. Valid values: `debug`, `info`, `warn`, `error`. Setting `debug` increases log volume and may impact performance.   | `info`                         | No       |
| `images.ui`                               | Container image for the UI.                                                                                                                      | `ghcr.io/osac-project/osac-ui:main`    | No       |
| `images.pullPolicy`                       | Kubernetes image pull policy, or `auto` to leave it to Kubernetes' tag-based default.                                                            | `auto`                           | No       |
