package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"syscall"
	"time"

	"github.com/navid-m/rush/internal/gitparser"
	"github.com/navid-m/rush/internal/server"
)

// CommitData represents commit information
type CommitData struct {
	Hash         string   `json:"hash"`
	Author       string   `json:"author"`
	Date         string   `json:"date"`
	Message      string   `json:"message"`
	FilesChanged int      `json:"filesChanged"`
	Insertions   int      `json:"insertions"`
	Deletions    int      `json:"deletions"`
	Files        []string `json:"files"`
}

// JsonData represents the structure of the output JSON
type JsonData struct {
	Commits  []CommitData `json:"commits"`
	Metadata Metadata     `json:"metadata"`
}

// Metadata contains repository statistics
type Metadata struct {
	TotalCommits    int      `json:"totalCommits"`
	Authors         []string `json:"authors"`
	FirstCommitDate string   `json:"firstCommitDate"`
	LastCommitDate  string   `json:"lastCommitDate"`
}

func main() {
	clearScreen()

	args := os.Args[1:]
	var repoPath string

	if len(args) > 0 {
		var err error
		repoPath, err = filepath.Abs(args[0])
		if err != nil {
			log.Fatalf("Error resolving path: %v", err)
		}
	} else {
		var err error
		repoPath, err = os.Getwd()
		if err != nil {
			log.Fatalf("Error getting current directory: %v", err)
		}
	}

	fmt.Printf("\033[31mRepository:\033[0m %s\n\n", repoPath)

	parser := gitparser.NewGitParser(repoPath)

	if !parser.IsValidRepo() {
		fmt.Println("\033[31mError:\033[0m Not a valid git repository")
		fmt.Println("\nUsage:")
		fmt.Println("  rush .")
		fmt.Println("  rush /path/to/repo")
		os.Exit(1)
	}

	rawCommits, err := parser.GetCommits()
	if err != nil {
		fmt.Printf("\033[31mError reading commits:\033[0m %v\n", err)
		os.Exit(1)
	}

	if len(rawCommits) == 0 {
		fmt.Println("\033[31mError:\033[0m No commits found in repository")
		os.Exit(1)
	}

	commitsWithFiles, err := parser.GetAllFilesForCommits(rawCommits)
	if err != nil {
		log.Printf("Error getting files for commits: %v", err)
		os.Exit(1)
	}

	commits := make([]CommitData, len(commitsWithFiles))
	for i, commit := range commitsWithFiles {
		commits[i] = CommitData{
			Hash:         commit.Hash,
			Author:       commit.Author,
			Date:         commit.Date.Format("2006-01-02T15:04:05Z"),
			Message:      commit.Message,
			FilesChanged: commit.FilesChanged,
			Insertions:   commit.Insertions,
			Deletions:    commit.Deletions,
			Files:        commit.Files,
		}
	}

	totalCommits := len(commits)
	authorSet := make(map[string]bool)
	for _, c := range commits {
		authorSet[c.Author] = true
	}
	authors := len(authorSet)

	var firstCommit, lastCommit time.Time
	if len(commits) > 0 {
		firstCommit, _ = time.Parse("2006-01-02T15:04:05Z", commits[0].Date)
		lastCommit, _ = time.Parse("2006-01-02T15:04:05Z", commits[len(commits)-1].Date)
	}

	duration := 0
	if !firstCommit.IsZero() && !lastCommit.IsZero() {
		duration = int(lastCommit.Sub(firstCommit).Hours() / 24)
	}

	fmt.Printf("Total Commits: %d\n", totalCommits)
	fmt.Printf("Contributors: %d\n", authors)
	if !firstCommit.IsZero() {
		fmt.Printf("First Commit: %s\n", firstCommit.Format("2006-01-02"))
	}
	if !lastCommit.IsZero() {
		fmt.Printf("Last Commit: %s\n", lastCommit.Format("2006-01-02"))
	}
	fmt.Printf("Duration: %d days\n\n", duration)

	uniqueAuthors := make([]string, 0, len(authorSet))
	for author := range authorSet {
		uniqueAuthors = append(uniqueAuthors, author)
	}

	var firstCommitDate, lastCommitDate string
	if len(commits) > 0 {
		firstCommitDate = commits[0].Date
		lastCommitDate = commits[len(commits)-1].Date
	}

	jsonData := JsonData{
		Commits: commits,
		Metadata: Metadata{
			TotalCommits:    totalCommits,
			Authors:         uniqueAuthors,
			FirstCommitDate: firstCommitDate,
			LastCommitDate:  lastCommitDate,
		},
	}

	jsonBytes, err := json.MarshalIndent(jsonData, "", "  ")
	if err != nil {
		log.Printf("Error marshaling JSON: %v", err)
		os.Exit(1)
	}

	err = os.WriteFile("./commits-data.json", jsonBytes, 0644)
	if err != nil {
		log.Printf("Error writing commits-data.json: %v", err)
		os.Exit(1)
	}

	srv := server.NewStaticFileServer(3000)
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		if err := srv.Start(); err != nil && err != http.ErrServerClosed {
			log.Printf("Server error: %v", err)
		}
	}()

	go func() {
		time.Sleep(200 * time.Millisecond)
		openBrowser("http://localhost:3000")
	}()

	<-sigChan
	fmt.Println("\nBye")

	_, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Stop(); err != nil {
		log.Printf("Server shutdown error: %v", err)
	}
}

// clearScreen clears the terminal screen
func clearScreen() {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("cmd", "/c", "cls")
	default:
		cmd = exec.Command("clear")
	}
	cmd.Stdout = os.Stdout
	cmd.Run()
}

// openBrowser opens the default browser to the given URL
func openBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("cmd", "/c", "start", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	_ = cmd.Run()
}
