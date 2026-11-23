import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { openAndLogin } from '../../../../libs/test-utils/src/general/open_and_login';

const pluginPath = '/extensions/federation-demo';
const releaseOne = 'osac-fr4-release-one';
const releaseTwo = 'osac-fr4-release-two';
const osacUiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../');
const federationDemoRemoteDir = join(osacUiRoot, 'apps/federation-demo-remote');

const buildRemoteRelease = (outputDir: string, release: string) => {
  execFileSync('pnpm', ['exec', 'vite', 'build', '--outDir', outputDir], {
    cwd: federationDemoRemoteDir,
    env: { ...process.env, VITE_FEDERATION_DEMO_RELEASE: release },
    stdio: 'inherit',
  });
};

const roleUsers = [
  {
    role: 'admin',
    username: process.env.OSAC_ADMIN_USERNAME,
    password: process.env.OSAC_ADMIN_PASSWORD,
    loginType: 'admin',
    navigationVisible: true,
  },
  {
    role: 'tenant-idp-manager',
    username: process.env.OSAC_PLUGIN_TENANT_IDP_MANAGER_USERNAME,
    password: process.env.OSAC_PLUGIN_TENANT_IDP_MANAGER_PASSWORD,
    loginType: 'tenant_type',
    navigationVisible: false,
  },
  {
    role: 'tenant-admin',
    username: process.env.OSAC_PLUGIN_TENANT_ADMIN_USERNAME,
    password: process.env.OSAC_PLUGIN_TENANT_ADMIN_PASSWORD,
    loginType: 'tenant_admin',
    navigationVisible: true,
  },
  {
    role: 'tenant-user',
    username: process.env.OSAC_PLUGIN_TENANT_USER_USERNAME,
    password: process.env.OSAC_PLUGIN_TENANT_USER_PASSWORD,
    loginType: 'tenant_user',
    navigationVisible: false,
  },
] as const;

const loginAsAdmin = async (page: Parameters<typeof openAndLogin>[0]) => {
  test.skip(
    !process.env.OSAC_ADMIN_USERNAME || !process.env.OSAC_ADMIN_PASSWORD,
    'Set OSAC_ADMIN_USERNAME and OSAC_ADMIN_PASSWORD for the dedicated plugin test deployment.',
  );

  await openAndLogin(
    page,
    '/',
    process.env.OSAC_ADMIN_USERNAME ?? '',
    process.env.OSAC_ADMIN_PASSWORD ?? '',
    'admin',
  );
};

test.describe('OSAC UI Module Federation plugin', () => {
  for (const user of roleUsers) {
    test(`${user.role} can open the demo route directly`, async ({ page }) => {
      test.skip(
        !user.username || !user.password,
        `Set the dedicated ${user.role} plugin test credentials to run this case.`,
      );

      await openAndLogin(page, '/', user.username ?? '', user.password ?? '', user.loginType);
      await page.goto(pluginPath);

      const navigationLink = page.getByRole('link', { name: 'Federation demo', exact: true });
      if (user.navigationVisible) {
        await expect(navigationLink).toBeVisible();
      } else {
        await expect(navigationLink).toHaveCount(0);
      }

      await expect(
        page.getByRole('heading', { name: 'Vite native federation demo' }),
      ).toBeVisible();
      await expect(
        page.getByText(`Current host path: ${pluginPath}`, { exact: true }),
      ).toBeVisible();
    });
  }

  test('serves enabled plugin sources with no-store and the matching CSP after a fresh page load', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    const response = await page.goto(pluginPath);
    const csp = response?.headers()['content-security-policy'];
    expect(csp).toBeTruthy();

    const sourceResult = await page.evaluate(async () => {
      const response = await fetch('/api/plugins');
      const isRecord = (value: unknown): value is Record<string, unknown> =>
        typeof value === 'object' && value !== null && !Array.isArray(value);
      const sources: unknown = JSON.parse(await response.text()) as unknown;
      const plugin = (Array.isArray(sources) ? (sources as unknown[]) : []).find(
        (source) => isRecord(source) && source.id === 'federation-demo',
      );
      const pluginInfo = isRecord(plugin)
        ? {
            id: plugin.id,
            url: plugin.url,
            keys: Object.keys(plugin).sort(),
          }
        : undefined;

      return {
        status: response.status,
        cacheControl: response.headers.get('cache-control'),
        plugin: pluginInfo,
      };
    });

    expect(sourceResult.status).toBe(200);
    expect(sourceResult.cacheControl?.toLowerCase()).toContain('no-store');
    expect(sourceResult.plugin).toBeDefined();
    expect(sourceResult.plugin?.id).toBe('federation-demo');
    expect(sourceResult.plugin?.keys).toEqual(['id', 'url']);

    const frontendUrl = sourceResult.plugin?.url;
    if (typeof frontendUrl !== 'string') {
      throw new Error('The configured demo plugin source did not include a URL.');
    }
    const frontendOrigin = new URL(frontendUrl).origin;
    const directives = Object.fromEntries(
      (csp ?? '').split(';').map((directive) => {
        const [name, ...values] = directive.trim().split(/\s+/);
        return [name, values.join(' ')];
      }),
    );
    expect(directives['script-src']).toContain(frontendOrigin);
    expect(directives['connect-src']).toContain(frontendOrigin);
    expect(csp).not.toMatch(/https?:\/\/\*/);

    const registryReload = page.waitForResponse(
      (reloadResponse) => new URL(reloadResponse.url()).pathname === '/api/plugins',
    );
    await page.reload();
    expect((await registryReload).status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Vite native federation demo' })).toBeVisible();
  });

  test('keeps built-in pages usable after a remote route error', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${pluginPath}?osac-plugin-test-failure=true`);

    const alert = page.getByRole('alert');
    await expect(alert).toContainText('Plugin extension unavailable');
    await expect(alert).toContainText('federation-demo');
    await expect(alert).not.toContainText('intentional demo plugin failure');

    await page.goto('/catalog');
    await expect(page.getByRole('heading', { name: 'Catalog' })).toBeVisible();

    await page.goto(pluginPath);
    await expect(page.getByRole('heading', { name: 'Vite native federation demo' })).toBeVisible();
  });

  test('omits a disabled plugin from discovery, CSP, and BFF routing', async ({ page }) => {
    const disabledPluginId = process.env.OSAC_PLUGIN_DISABLED_ID;
    const disabledPluginUrl = process.env.OSAC_PLUGIN_DISABLED_FRONTEND_URL;
    test.skip(
      !disabledPluginId || !disabledPluginUrl,
      'Set OSAC_PLUGIN_DISABLED_ID and OSAC_PLUGIN_DISABLED_FRONTEND_URL for the disabled-plugin fixture.',
    );
    await loginAsAdmin(page);

    const disabledPlugin = await page.evaluate(
      async ({ pluginId, frontendOrigin }) => {
        const isRecord = (value: unknown): value is Record<string, unknown> =>
          typeof value === 'object' && value !== null && !Array.isArray(value);
        const [pluginsResponse, htmlResponse, bffResponse] = await Promise.all([
          fetch('/api/plugins'),
          fetch('/'),
          fetch(`/api/plugin/${encodeURIComponent(pluginId)}/health`),
        ]);
        const plugins: unknown = JSON.parse(await pluginsResponse.text()) as unknown;
        const configuredIds = (Array.isArray(plugins) ? (plugins as unknown[]) : []).flatMap(
          (plugin: unknown) =>
            isRecord(plugin) && typeof plugin.id === 'string' ? [plugin.id] : [],
        );

        return {
          configuredIds,
          csp: htmlResponse.headers.get('content-security-policy'),
          bffContentType: bffResponse.headers.get('content-type'),
          frontendOrigin,
        };
      },
      {
        pluginId: disabledPluginId ?? '',
        frontendOrigin: new URL(disabledPluginUrl ?? 'https://invalid.example').origin,
      },
    );

    expect(disabledPlugin.configuredIds).not.toContain(disabledPluginId);
    expect(disabledPlugin.csp).not.toContain(disabledPlugin.frontendOrigin);
    expect(disabledPlugin.bffContentType).toContain('text/html');
  });

  test('loads a compatible remote release after reload without rebuilding the host UI', async ({
    page,
  }) => {
    test.skip(
      !process.env.OSAC_ADMIN_USERNAME || !process.env.OSAC_ADMIN_PASSWORD,
      'Set OSAC_ADMIN_USERNAME and OSAC_ADMIN_PASSWORD for the dedicated plugin test deployment.',
    );

    const fixtureRoot = mkdtempSync(join(tmpdir(), 'osac-plugin-release-fixtures-'));
    const releaseOneDir = join(fixtureRoot, 'release-one');
    const releaseTwoDir = join(fixtureRoot, 'release-two');
    let activeReleaseDir = releaseOneDir;

    try {
      buildRemoteRelease(releaseOneDir, releaseOne);
      buildRemoteRelease(releaseTwoDir, releaseTwo);

      const releaseOneManifest = readFileSync(join(releaseOneDir, 'mf-manifest.json'), 'utf8');
      const releaseTwoManifest = readFileSync(join(releaseTwoDir, 'mf-manifest.json'), 'utf8');
      expect(releaseOneManifest).not.toBe(releaseTwoManifest);
      const releaseOneManifestData = JSON.parse(releaseOneManifest) as {
        metaData?: { publicPath?: string };
      };
      const remoteAssetPath = releaseOneManifestData.metaData?.publicPath;
      if (!remoteAssetPath) {
        throw new Error('The release fixture manifest did not include a public path.');
      }

      const uiOrigin = new URL(process.env.OSAC_UI_BASE_URL ?? '').origin;
      let remoteBaseUrl: URL | undefined;
      let manifestRequests = 0;
      let fixtureRequests = 0;
      const pluginListSnapshots: Array<Array<{ id: string; url: string }>> = [];

      await page.route('**/*', async (route) => {
        const requestUrl = new URL(route.request().url());
        if (requestUrl.origin === uiOrigin && requestUrl.pathname === '/api/plugins') {
          const response = await route.fetch();
          const payload: unknown = await response.json();
          if (!Array.isArray(payload)) {
            throw new Error('GET /api/plugins did not return an array.');
          }

          const sources = payload.map((source: unknown) => {
            if (
              typeof source !== 'object' ||
              source === null ||
              !('id' in source) ||
              typeof source.id !== 'string' ||
              !('url' in source) ||
              typeof source.url !== 'string'
            ) {
              throw new Error('GET /api/plugins returned an invalid plugin source.');
            }
            return { id: source.id, url: source.url };
          });

          const federationDemo = sources.find((source) => source.id === 'federation-demo');
          if (!federationDemo) {
            throw new Error('The test deployment does not configure the federation-demo plugin.');
          }
          remoteBaseUrl = new URL(
            federationDemo.url.endsWith('/') ? federationDemo.url : `${federationDemo.url}/`,
          );
          pluginListSnapshots.push(sources);

          await route.fulfill({
            status: response.status(),
            headers: {
              'cache-control': response.headers()['cache-control'] ?? 'no-store',
              'content-type': response.headers()['content-type'] ?? 'application/json',
            },
            body: JSON.stringify(payload),
          });
          return;
        }

        const remoteBase = remoteBaseUrl;
        if (!remoteBase || requestUrl.origin !== remoteBase.origin) {
          await route.continue();
          return;
        }

        const basePath = remoteBase.pathname.endsWith('/')
          ? remoteBase.pathname
          : `${remoteBase.pathname}/`;
        if (!requestUrl.pathname.startsWith(basePath)) {
          await route.continue();
          return;
        }

        const relativePaths = new Set<string>();
        if (requestUrl.pathname.startsWith(basePath)) {
          relativePaths.add(decodeURIComponent(requestUrl.pathname.slice(basePath.length)));
        }
        if (requestUrl.pathname.startsWith(remoteAssetPath)) {
          relativePaths.add(decodeURIComponent(requestUrl.pathname.slice(remoteAssetPath.length)));
        }

        const fixturePath = [...relativePaths]
          .map((relativePath) => resolve(activeReleaseDir, relativePath))
          .find((candidatePath) => {
            const fixtureRelativePath = relative(activeReleaseDir, candidatePath);
            return (
              !fixtureRelativePath.startsWith('..') &&
              !isAbsolute(fixtureRelativePath) &&
              existsSync(candidatePath) &&
              statSync(candidatePath).isFile()
            );
          });
        if (!fixturePath) {
          await route.continue();
          return;
        }

        if (requestUrl.pathname.endsWith('/mf-manifest.json')) {
          manifestRequests += 1;
        }
        fixtureRequests += 1;
        await route.fulfill({
          path: fixturePath,
          headers: {
            'access-control-allow-origin': '*',
            'cache-control': 'no-cache',
          },
        });
      });

      await loginAsAdmin(page);
      await page.goto(pluginPath);
      await expect(page.getByText(`Remote release: ${releaseOne}`, { exact: true })).toBeVisible();
      expect(fixtureRequests).toBeGreaterThan(0);
      expect(manifestRequests).toBeGreaterThan(0);

      const originalPluginList = pluginListSnapshots.at(-1);
      const originalManifestRequests = manifestRequests;
      expect(originalPluginList).toBeDefined();

      activeReleaseDir = releaseTwoDir;
      await expect(page.getByText(`Remote release: ${releaseOne}`, { exact: true })).toBeVisible();

      await page.reload();
      await expect(page.getByText(`Remote release: ${releaseTwo}`, { exact: true })).toBeVisible();
      expect(manifestRequests).toBeGreaterThan(originalManifestRequests);
      expect(pluginListSnapshots.at(-1)).toEqual(originalPluginList);
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });
});
