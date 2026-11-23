package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestValidatePluginConfig_RFC1035IDs(t *testing.T) {
	valid := []string{"a", "a1", "a-b", "a" + strings.Repeat("b", 61) + "1"}
	for _, id := range valid {
		t.Run(id, func(t *testing.T) {
			if err := validatePluginConfig([]pluginDefinition{{ID: id, URL: "https://frontend.example.com"}}, false); err != nil {
				t.Fatalf("validatePluginConfig(%q): %v", id, err)
			}
		})
	}

	invalid := []string{"", "1abc", "-abc", "abc-", "UPPER", "has.dot", "under_score", strings.Repeat("a", 64)}
	for _, id := range invalid {
		t.Run("reject_"+id, func(t *testing.T) {
			if err := validatePluginConfig([]pluginDefinition{{ID: id, URL: "https://frontend.example.com"}}, false); err == nil {
				t.Fatalf("validatePluginConfig(%q) succeeded, want error", id)
			}
		})
	}
}

func TestValidatePluginConfig_RequiresUniqueIDsAndValidURLs(t *testing.T) {
	valid := []pluginDefinition{
		{ID: "inventory", URL: "https://frontend.example.com/plugins/inventory"},
		{ID: "orders", URL: "https://frontend.example.com", BFF: &pluginBFF{URL: "https://orders-bff.example.com/"}},
	}
	if err := validatePluginConfig(valid, false); err != nil {
		t.Fatalf("validatePluginConfig(valid): %v", err)
	}

	tests := []struct {
		name    string
		plugins []pluginDefinition
	}{
		{
			name: "duplicate_id",
			plugins: []pluginDefinition{
				{ID: "inventory", URL: "https://one.example.com"},
				{ID: "inventory", URL: "https://two.example.com"},
			},
		},
		{name: "relative_frontend_url", plugins: []pluginDefinition{{ID: "inventory", URL: "/plugin.js"}}},
		{name: "unsupported_frontend_scheme", plugins: []pluginDefinition{{ID: "inventory", URL: "ftp://frontend.example.com"}}},
		{name: "frontend_user_info", plugins: []pluginDefinition{{ID: "inventory", URL: "https://user:password@frontend.example.com"}}},
		{name: "frontend_query", plugins: []pluginDefinition{{ID: "inventory", URL: "https://frontend.example.com?token=value"}}},
		{name: "frontend_fragment", plugins: []pluginDefinition{{ID: "inventory", URL: "https://frontend.example.com#section"}}},
		{name: "frontend_empty_query", plugins: []pluginDefinition{{ID: "inventory", URL: "https://frontend.example.com?"}}},
		{name: "frontend_empty_fragment", plugins: []pluginDefinition{{ID: "inventory", URL: "https://frontend.example.com#"}}},
		{name: "bff_path", plugins: []pluginDefinition{{ID: "inventory", URL: "https://frontend.example.com", BFF: &pluginBFF{URL: "https://bff.example.com/api"}}}},
		{name: "bff_query", plugins: []pluginDefinition{{ID: "inventory", URL: "https://frontend.example.com", BFF: &pluginBFF{URL: "https://bff.example.com?token=value"}}}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if err := validatePluginConfig(test.plugins, false); err == nil {
				t.Fatal("validatePluginConfig() succeeded, want validation error")
			}
		})
	}
}

func TestValidatePluginConfig_RequiresHTTPSByDefaultWithUnifiedOptIn(t *testing.T) {
	tests := []struct {
		name              string
		plugin            pluginDefinition
		allowInsecureHTTP bool
		wantErr           bool
	}{
		{
			name:   "https_frontend_and_bff",
			plugin: pluginDefinition{ID: "inventory", URL: "https://frontend.example.com", BFF: &pluginBFF{URL: "https://bff.example.com"}},
		},
		{
			name:    "reject_http_frontend_by_default",
			plugin:  pluginDefinition{ID: "inventory", URL: "http://frontend.example.com"},
			wantErr: true,
		},
		{
			name:              "allow_http_frontend_with_unified_opt_in",
			plugin:            pluginDefinition{ID: "inventory", URL: "http://frontend.example.com"},
			allowInsecureHTTP: true,
		},
		{
			name:    "reject_http_bff_by_default",
			plugin:  pluginDefinition{ID: "inventory", URL: "https://frontend.example.com", BFF: &pluginBFF{URL: "http://bff.example.com"}},
			wantErr: true,
		},
		{
			name:              "allow_http_bff_with_unified_opt_in",
			plugin:            pluginDefinition{ID: "inventory", URL: "https://frontend.example.com", BFF: &pluginBFF{URL: "http://bff.example.com"}},
			allowInsecureHTTP: true,
		},
		{
			name:              "allow_http_frontend_and_bff_with_one_opt_in",
			plugin:            pluginDefinition{ID: "inventory", URL: "http://frontend.example.com", BFF: &pluginBFF{URL: "http://bff.example.com"}},
			allowInsecureHTTP: true,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := validatePluginConfig([]pluginDefinition{test.plugin}, test.allowInsecureHTTP)
			if (err != nil) != test.wantErr {
				t.Fatalf("validatePluginConfig() error = %v, wantErr %t", err, test.wantErr)
			}
		})
	}
}

func TestLoadPluginConfig_InsecureEnvironmentOptInAppliesToFrontendAndBFF(t *testing.T) {
	configPath := filepath.Join(t.TempDir(), "plugins.yaml")
	if err := os.WriteFile(configPath, []byte("plugins:\n  - id: inventory\n    url: http://frontend.example.com\n    bff:\n      url: http://bff.example.com\n"), 0o600); err != nil {
		t.Fatalf("write plugin config: %v", err)
	}

	t.Setenv("PLUGINS_INSECURE", "")
	if _, err := loadPluginConfig(configPath); err == nil {
		t.Fatal("loadPluginConfig() succeeded without PLUGINS_INSECURE, want HTTPS validation error")
	}

	t.Setenv("PLUGINS_INSECURE", "1")
	plugins, err := loadPluginConfig(configPath)
	if err != nil {
		t.Fatalf("loadPluginConfig() with PLUGINS_INSECURE=1: %v", err)
	}
	if len(plugins) != 1 || plugins[0].URL != "http://frontend.example.com" || plugins[0].BFF == nil || plugins[0].BFF.URL != "http://bff.example.com" {
		t.Fatalf("loadPluginConfig() = %#v, want configured HTTP plugin frontend and BFF", plugins)
	}

	t.Setenv("PLUGINS_INSECURE", "true")
	if _, err := loadPluginConfig(configPath); err == nil {
		t.Fatal("loadPluginConfig() accepted PLUGINS_INSECURE=true, want exact value 1")
	}
}

func TestPluginSourcesHandler_ReturnsOnlyPublicSourcesWithoutCaching(t *testing.T) {
	handler := pluginSourcesHandler([]pluginDefinition{
		{ID: "inventory", URL: "https://inventory.example.com", BFF: &pluginBFF{URL: "https://inventory-bff.example.com"}},
	})
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/plugins", nil)
	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}
	if got := recorder.Header().Get("Cache-Control"); got != "no-store" {
		t.Fatalf("Cache-Control = %q, want no-store", got)
	}
	if got := recorder.Header().Get("Content-Type"); got != "application/json" {
		t.Fatalf("Content-Type = %q, want application/json", got)
	}
	var sources []map[string]json.RawMessage
	if err := json.Unmarshal(recorder.Body.Bytes(), &sources); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(sources) != 1 {
		t.Fatalf("got %d sources, want 1", len(sources))
	}
	if len(sources[0]) != 2 || sources[0]["id"] == nil || sources[0]["url"] == nil {
		t.Fatalf("source fields = %v, want only id and url", sources[0])
	}
	if _, ok := sources[0]["bff"]; ok {
		t.Fatalf("response leaked BFF configuration: %v", sources[0])
	}
}

func TestPluginCSP_ContainsUniqueExactFrontendOriginsOnly(t *testing.T) {
	plugins := []pluginDefinition{
		{ID: "inventory", URL: "https://plugins.example.com/inventory/remoteEntry.js", BFF: &pluginBFF{URL: "https://inventory-bff.example.com"}},
		{ID: "orders", URL: "https://plugins.example.com/orders/remoteEntry.js"},
		{ID: "reports", URL: "https://reports.example.com/plugins/remoteEntry.js"},
	}
	want := "default-src 'self'; script-src 'self' https://plugins.example.com https://reports.example.com; connect-src 'self' https://plugins.example.com https://reports.example.com"
	if got := pluginCSP(plugins); got != want {
		t.Fatalf("pluginCSP() = %q, want %q", got, want)
	}
}

func TestPluginCSP_WithoutPluginsAllowsOnlySelf(t *testing.T) {
	want := "default-src 'self'; script-src 'self'; connect-src 'self'"
	if got := pluginCSP(nil); got != want {
		t.Fatalf("pluginCSP(nil) = %q, want %q", got, want)
	}
}
