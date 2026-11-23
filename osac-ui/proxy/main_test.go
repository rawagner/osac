package main

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
)

func TestPluginSourceRoutesServeOnlyCurrentPath(t *testing.T) {
	router := chi.NewRouter()
	registerPluginSourceRoutes(router, []pluginDefinition{{ID: "inventory", URL: "https://inventory.example.com"}})

	for _, path := range []string{"/api/plugins", "/api/get-plugins"} {
		t.Run(path, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodGet, path, nil)
			router.ServeHTTP(recorder, request)

			if path == "/api/get-plugins" {
				if recorder.Code != http.StatusNotFound {
					t.Fatalf("legacy path status = %d, want %d", recorder.Code, http.StatusNotFound)
				}
				return
			}
			if recorder.Code != http.StatusOK {
				t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
			}
			if got := recorder.Header().Get("Cache-Control"); got != "no-store" {
				t.Fatalf("Cache-Control = %q, want no-store", got)
			}
			if !strings.Contains(recorder.Body.String(), `"id":"inventory"`) || !strings.Contains(recorder.Body.String(), `"url":"https://inventory.example.com"`) {
				t.Fatalf("body = %q, want configured plugin source", recorder.Body.String())
			}
		})
	}
}

func TestPluginBFFHandler_ProxiesSanitizedRequestsAndHidesCookies(t *testing.T) {
	var gotPath string
	var gotAuthorization string
	var gotCookie string
	var gotForwarded string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotAuthorization = r.Header.Get("Authorization")
		gotCookie = r.Header.Get("Cookie")
		gotForwarded = r.Header.Get("Forwarded")
		w.Header().Add("Set-Cookie", "upstream=secret; Path=/")
		w.WriteHeader(http.StatusCreated)
		_, _ = io.WriteString(w, "created")
	}))
	defer upstream.Close()

	plugin := pluginDefinition{ID: "inventory", URL: "https://frontend.example.com", BFF: &pluginBFF{URL: upstream.URL}}
	handler := pluginBFFHandler(plugin, nil, func(_ *http.Request, err error) {
		t.Errorf("proxy error: %v", err)
	})
	request := httptest.NewRequest(http.MethodPost, "/api/plugin/inventory/items", strings.NewReader("body"))
	request.AddCookie(&http.Cookie{Name: "osac-access", Value: "session-token"})
	request.Header.Set("Authorization", "Bearer attacker-token")
	request.Header.Set("Proxy-Authorization", "Basic attacker")
	request.Header.Set("Forwarded", "for=attacker")
	request.Header.Set("X-Forwarded-For", "attacker")
	request.Header.Set("X-Auth-Request-User", "attacker")
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusCreated || recorder.Body.String() != "created" {
		t.Fatalf("response = %d %q, want 201 created", recorder.Code, recorder.Body.String())
	}
	if gotPath != "/items" {
		t.Fatalf("upstream path = %q, want /items", gotPath)
	}
	if gotAuthorization != "Bearer session-token" {
		t.Fatalf("upstream Authorization = %q, want session token", gotAuthorization)
	}
	if gotCookie != "" || gotForwarded != "" {
		t.Fatalf("upstream received browser headers: Cookie=%q Forwarded=%q", gotCookie, gotForwarded)
	}
	if got := recorder.Result().Header.Get("Set-Cookie"); got != "" {
		t.Fatalf("response Set-Cookie = %q, want empty", got)
	}
}

func TestPluginBFFHandler_ForwardsWithoutAuthorizationWhenSessionHasNoAccessToken(t *testing.T) {
	var gotAuthorization string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuthorization = r.Header.Get("Authorization")
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer upstream.Close()

	plugin := pluginDefinition{ID: "inventory", URL: "https://frontend.example.com", BFF: &pluginBFF{URL: upstream.URL}}
	handler := pluginBFFHandler(plugin, nil, func(_ *http.Request, err error) {
		t.Errorf("proxy error: %v", err)
	})
	request := httptest.NewRequest(http.MethodGet, "/api/plugin/inventory/items", nil)
	request.AddCookie(&http.Cookie{Name: "osac-refresh", Value: "refresh-token"})
	request.Header.Set("Authorization", "Bearer attacker-token")
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)

	if gotAuthorization != "" {
		t.Fatalf("upstream Authorization = %q, want empty", gotAuthorization)
	}
	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusUnauthorized)
	}
}
