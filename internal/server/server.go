package server

import (
	"embed"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
)

//go:embed public/index.html
var publicFiles embed.FS

//go:embed public/rush/dist/index.min.js
var script embed.FS

// StaticFileServer handles serving static files and API endpoints
type StaticFileServer struct {
	server    *http.Server
	port      int
	dataReady bool
}

// NewStaticFileServer creates a new StaticFileServer instance
func NewStaticFileServer(port int) *StaticFileServer {
	return &StaticFileServer{
		port:      port,
		dataReady: false,
	}
}

// Start starts the HTTP server
func (sfs *StaticFileServer) Start() error {
	mux := http.NewServeMux()

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" || r.URL.Path == "/index.html" {
			content, err := publicFiles.ReadFile("public/index.html")
			if err != nil {
				http.Error(w, "rush: Internal server error", http.StatusInternalServerError)
				return
			}
			scriptContent, err := script.ReadFile("public/rush/dist/index.min.js")
			content = ([]byte)(strings.ReplaceAll(string(content), "{ { rush_script } }", string(scriptContent)))
			w.Header().Set("Content-Type", "text/html")
			w.Write(content)
			return
		}

		if r.URL.Path == "/commits-data.json" {

			file, err := os.Open("./commits-data.json")
			if err != nil {
				http.Error(w, "Commit data not found", http.StatusNotFound)
				return
			}
			defer file.Close()

			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Cache-Control", "no-cache")

			_, err = io.Copy(w, file)
			if err != nil {
				http.Error(w, "Internal server error", http.StatusInternalServerError)
				return
			}
			return
		}

		if strings.HasPrefix(r.URL.Path, "/assets/") ||
			strings.HasSuffix(r.URL.Path, ".css") ||
			strings.HasSuffix(r.URL.Path, ".js") ||
			strings.HasSuffix(r.URL.Path, ".png") ||
			strings.HasSuffix(r.URL.Path, ".jpg") ||
			strings.HasSuffix(r.URL.Path, ".jpeg") ||
			strings.HasSuffix(r.URL.Path, ".gif") ||
			strings.HasSuffix(r.URL.Path, ".svg") ||
			strings.HasSuffix(r.URL.Path, ".ico") {

			relativePath := "." + r.URL.Path

			if _, err := os.Stat(relativePath); os.IsNotExist(err) {
				http.Error(w, "Asset not found", http.StatusNotFound)
				return
			}

			http.ServeFile(w, r, relativePath)
			return
		}

		http.Error(w, "Not found", http.StatusNotFound)
	})

	sfs.server = &http.Server{
		Addr:    fmt.Sprintf(":%d", sfs.port),
		Handler: mux,
	}

	log.Printf("Server running at http://localhost:%d\n", sfs.port)
	return sfs.server.ListenAndServe()
}

// Stop stops the HTTP server
func (sfs *StaticFileServer) Stop() error {
	if sfs.server != nil {
		return sfs.server.Close()
	}
	return nil
}

// SetDataReady marks the data as ready
func (sfs *StaticFileServer) SetDataReady() {
	sfs.dataReady = true
}
