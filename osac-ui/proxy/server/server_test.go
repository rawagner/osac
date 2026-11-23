package server

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestSpaHandlerAppliesCSPToHTMLResponsesOnly(t *testing.T) {
	root := t.TempDir()
	for path, content := range map[string]string{
		"index.html": "<html><body>OSAC</body></html>",
		"help.html":  "<html><body>Help</body></html>",
		"app.js":     "console.log('OSAC')",
	} {
		if err := os.WriteFile(filepath.Join(root, path), []byte(content), 0o600); err != nil {
			t.Fatalf("write %s: %v", path, err)
		}
	}

	policy := "default-src 'self'; script-src 'self' https://plugins.example.com; connect-src 'self' https://plugins.example.com"
	handler := SpaHandler{Dir: root, ContentSecurityPolicy: policy}
	for _, test := range []struct {
		path     string
		wantCSP  string
		wantCode int
	}{
		{path: "/", wantCSP: policy, wantCode: http.StatusOK},
		{path: "/plugin-route", wantCSP: policy, wantCode: http.StatusOK},
		{path: "/index.html", wantCSP: policy, wantCode: http.StatusMovedPermanently},
		{path: "/help.html", wantCSP: policy, wantCode: http.StatusOK},
		{path: "/app.js", wantCode: http.StatusOK},
	} {
		t.Run(test.path, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodGet, test.path, nil)
			handler.ServeHTTP(recorder, request)

			if recorder.Code != test.wantCode {
				t.Fatalf("status = %d, want %d", recorder.Code, test.wantCode)
			}
			if got := recorder.Header().Get("Content-Security-Policy"); got != test.wantCSP {
				t.Fatalf("Content-Security-Policy = %q, want %q", got, test.wantCSP)
			}
		})
	}
}
