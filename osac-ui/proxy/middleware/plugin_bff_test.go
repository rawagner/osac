package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestPluginBFFAuth_UsesSessionTokenAndRemovesBrowserCredentials(t *testing.T) {
	t.Parallel()

	var got *http.Request
	handler := PluginBFFAuth(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		copy := r.Clone(r.Context())
		got = copy
	}))
	request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/api/plugin/inventory/items", nil)
	request.AddCookie(&http.Cookie{Name: "osac-access", Value: "session-token"})
	request.AddCookie(&http.Cookie{Name: "other-cookie", Value: "private"})
	request.Header.Set("Authorization", "Bearer browser-token")
	request.Header.Set("Proxy-Authorization", "Basic browser-credentials")
	request.Header.Set("Forwarded", "for=browser")
	request.Header.Set("X-Forwarded-For", "192.0.2.1")
	request.Header.Set("X-Auth-Request-User", "browser-user")
	request.Header.Set("X-Request-ID", "request-1")

	handler.ServeHTTP(httptest.NewRecorder(), request)

	if got == nil {
		t.Fatal("expected downstream handler to run")
	}
	if got.Header.Get("Authorization") != "Bearer session-token" {
		t.Fatalf("Authorization = %q, want session token", got.Header.Get("Authorization"))
	}
	for _, name := range []string{"Proxy-Authorization", "Cookie", "Forwarded", "X-Forwarded-For", "X-Auth-Request-User"} {
		if value := got.Header.Get(name); value != "" {
			t.Errorf("%s = %q, want empty", name, value)
		}
	}
	if got.Header.Get("X-Request-ID") != "request-1" {
		t.Fatalf("X-Request-ID = %q, want request-1", got.Header.Get("X-Request-ID"))
	}
}

func TestPluginBFFAuth_DoesNotForwardBrowserAuthorizationWithoutSessionAccessToken(t *testing.T) {
	t.Parallel()

	var gotAuthorization string
	handler := PluginBFFAuth(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		gotAuthorization = r.Header.Get("Authorization")
	}))
	request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/api/plugin/inventory/items", nil)
	request.AddCookie(&http.Cookie{Name: "osac-refresh", Value: "refresh-token"})
	request.Header.Set("Authorization", "Bearer browser-token")

	handler.ServeHTTP(httptest.NewRecorder(), request)

	if gotAuthorization != "" {
		t.Fatalf("Authorization = %q, want empty", gotAuthorization)
	}
}
