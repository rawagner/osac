package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"

	"gopkg.in/yaml.v3"
)

type pluginConfig struct {
	Plugins []pluginDefinition `yaml:"plugins"`
}

type pluginDefinition struct {
	ID  string     `yaml:"id" json:"id"`
	URL string     `yaml:"url" json:"url"`
	BFF *pluginBFF `yaml:"bff,omitempty" json:"-"`
}

type pluginBFF struct {
	URL string `yaml:"url"`
}

type pluginSource struct {
	ID  string `json:"id"`
	URL string `json:"url"`
}

var pluginIDPattern = regexp.MustCompile(`^[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$`)

func pluginBFFPath(pluginID string) string {
	return "/api/plugin/" + pluginID
}

func pluginSourcesHandler(plugins []pluginDefinition) http.Handler {
	sources := make([]pluginSource, 0, len(plugins))
	for _, plugin := range plugins {
		sources = append(sources, pluginSource{ID: plugin.ID, URL: plugin.URL})
	}
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(sources); err != nil {
			return
		}
	})
}

func pluginCSP(plugins []pluginDefinition) string {
	origins := make([]string, 0, len(plugins))
	seen := make(map[string]struct{}, len(plugins))
	for _, plugin := range plugins {
		frontendURL, err := url.Parse(plugin.URL)
		if err != nil || frontendURL.Scheme == "" || frontendURL.Host == "" {
			continue
		}
		origin := frontendURL.Scheme + "://" + frontendURL.Host
		if _, exists := seen[origin]; exists {
			continue
		}
		seen[origin] = struct{}{}
		origins = append(origins, origin)
	}
	sources := append([]string{"'self'"}, origins...)
	joinedSources := strings.Join(sources, " ")
	return "default-src 'self'; script-src " + joinedSources + "; connect-src " + joinedSources
}

func loadPluginConfig(filename string) ([]pluginDefinition, error) {
	if strings.TrimSpace(filename) == "" {
		return nil, nil
	}

	data, err := os.ReadFile(filename)
	if err != nil {
		return nil, fmt.Errorf("read plugin config: %w", err)
	}
	decoder := yaml.NewDecoder(strings.NewReader(string(data)))
	decoder.KnownFields(true)
	var cfg pluginConfig
	if err := decoder.Decode(&cfg); err != nil {
		return nil, fmt.Errorf("decode plugin config: %w", err)
	}
	var extra any
	if err := decoder.Decode(&extra); !errors.Is(err, io.EOF) {
		if err == nil {
			return nil, errors.New("plugin config must contain one YAML document")
		}
		return nil, fmt.Errorf("decode plugin config: %w", err)
	}

	allowInsecurePluginHTTP := os.Getenv("PLUGINS_INSECURE") == "1"
	if err := validatePluginConfig(cfg.Plugins, allowInsecurePluginHTTP); err != nil {
		return nil, err
	}
	return cfg.Plugins, nil
}

func validatePluginConfig(plugins []pluginDefinition, allowInsecurePluginHTTP bool) error {
	ids := make(map[string]struct{}, len(plugins))
	for i, plugin := range plugins {
		if !pluginIDPattern.MatchString(plugin.ID) {
			return fmt.Errorf("plugins[%d].id must be a lowercase RFC 1035 identifier of at most 63 characters", i)
		}
		if _, exists := ids[plugin.ID]; exists {
			return fmt.Errorf("plugin id %q is configured more than once", plugin.ID)
		}
		ids[plugin.ID] = struct{}{}
		if err := validateAbsoluteHTTPURL(fmt.Sprintf("plugins[%d].url", i), plugin.URL, true, allowInsecurePluginHTTP); err != nil {
			return err
		}
		if plugin.BFF == nil {
			continue
		}
		if err := validateAbsoluteHTTPURL(fmt.Sprintf("plugins[%d].bff.url", i), plugin.BFF.URL, false, allowInsecurePluginHTTP); err != nil {
			return err
		}
	}
	return nil
}

func validateAbsoluteHTTPURL(name, raw string, allowPath, allowInsecureHTTP bool) error {
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") || u.User != nil || strings.Contains(raw, "#") {
		return fmt.Errorf("%s must be an absolute HTTP(S) URL without user info or a fragment", name)
	}
	if u.RawQuery != "" || u.ForceQuery {
		return fmt.Errorf("%s must not include a query string", name)
	}
	if u.Scheme == "http" && !allowInsecureHTTP {
		return fmt.Errorf("%s must use HTTPS", name)
	}
	if !allowPath && u.Path != "" && u.Path != "/" {
		return fmt.Errorf("%s must not include a path", name)
	}
	return nil
}
