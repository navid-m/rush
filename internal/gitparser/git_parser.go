package gitparser

import (
	"fmt"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"
)

// Commit represents a git commit
type Commit struct {
	Hash         string
	Author       string
	Date         time.Time
	Message      string
	FilesChanged int
	Insertions   int
	Deletions    int
	Files        []string
}

// GitParser handles parsing git repositories
type GitParser struct {
	repoPath string
}

// NewGitParser creates a new GitParser instance
func NewGitParser(repoPath string) *GitParser {
	return &GitParser{
		repoPath: repoPath,
	}
}

// IsValidRepo checks if the given path is a valid git repository
func (gp *GitParser) IsValidRepo() bool {
	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = exec.Command("cmd", "/c", fmt.Sprintf(`git -C "%s" status --porcelain`, gp.repoPath))
	} else {
		cmd = exec.Command("sh", "-c", fmt.Sprintf(`git -C "%s" status --porcelain`, gp.repoPath))
	}

	output, err := cmd.CombinedOutput()
	if err != nil {
		return !strings.Contains(string(output), "fatal: not a git repository")
	}
	return true
}

// GetCommits retrieves all commits from the repository
func (gp *GitParser) GetCommits() ([]Commit, error) {
	format := "%H|%an|%at|%s"
	cmd := fmt.Sprintf(`git -C "%s" log --all --format="%s" --shortstat --reverse`, gp.repoPath, format)

	output, err := exec.Command("sh", "-c", cmd).Output()
	if err != nil {
		return nil, fmt.Errorf("failed to read git history: %v", err)
	}

	return gp.parseCommits(string(output)), nil
}

// parseCommits parses the git log output into Commit structs
func (gp *GitParser) parseCommits(output string) []Commit {
	lines := strings.Split(output, "\n")
	commits := []Commit{}
	var currentCommit *Commit

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		if strings.Contains(line, "|") {
			if currentCommit != nil {
				commits = append(commits, *currentCommit)
			}

			parts := strings.Split(line, "|")
			if len(parts) >= 4 {
				timestamp, err := strconv.ParseInt(parts[2], 10, 64)
				if err != nil {
					continue
				}

				currentCommit = &Commit{
					Hash:         parts[0],
					Author:       parts[1],
					Date:         time.Unix(timestamp, 0),
					Message:      parts[3],
					FilesChanged: 0,
					Insertions:   0,
					Deletions:    0,
					Files:        []string{},
				}
			}
		} else if currentCommit != nil && strings.Contains(line, "changed") {
			filesMatch := strings.Fields(strings.Split(line, " changed")[0])
			if len(filesMatch) > 0 {
				filesChanged, err := strconv.Atoi(filesMatch[0])
				if err == nil {
					currentCommit.FilesChanged = filesChanged
				}
			}

			insertionsMatch := strings.Split(line, " insertions")
			if len(insertionsMatch) > 0 {
				insertionParts := strings.Fields(strings.Split(insertionsMatch[0], "(")[len(strings.Split(insertionsMatch[0], "("))-1])
				if len(insertionParts) > 0 {
					insertions, err := strconv.Atoi(insertionParts[0])
					if err == nil {
						currentCommit.Insertions = insertions
					}
				}
			}

			deletionsMatch := strings.Split(line, " deletions")
			if len(deletionsMatch) > 0 {
				deletionParts := strings.Fields(strings.Split(deletionsMatch[0], "(")[len(strings.Split(deletionsMatch[0], "("))-1])
				if len(deletionParts) > 0 {
					deletions, err := strconv.Atoi(deletionParts[0])
					if err == nil {
						currentCommit.Deletions = deletions
					}
				}
			}
		}
	}

	if currentCommit != nil {
		commits = append(commits, *currentCommit)
	}

	return commits
}

// GetAllFilesForCommits gets all files associated with each commit
func (gp *GitParser) GetAllFilesForCommits(commits []Commit) ([]Commit, error) {
	batchSize := 100

	for i := 0; i < len(commits); i += batchSize {
		end := min(i+batchSize, len(commits))
		batch := commits[i:end]
		for j := range batch {
			batch[j].Files = gp.getFilesForCommit(batch[j].Hash)
		}
	}

	return commits, nil
}

// getFilesForCommit gets the files changed in a specific commit
func (gp *GitParser) getFilesForCommit(hash string) []string {
	cmd := fmt.Sprintf(`git -C "%s" diff-tree --no-commit-id --name-only -r %s`, gp.repoPath, hash)

	output, err := exec.Command("sh", "-c", cmd).Output()
	if err != nil {
		return []string{}
	}

	files := strings.Split(strings.TrimSpace(string(output)), "\n")
	result := []string{}

	for _, file := range files {
		file = strings.TrimSpace(file)
		if file != "" {
			result = append(result, file)
		}
	}

	return result
}

// GetRepoName extracts the repository name from the path
func (gp *GitParser) GetRepoName() string {
	parts := strings.Split(filepath.ToSlash(gp.repoPath), "/")
	if len(parts) > 0 {
		return parts[len(parts)-1]
	}
	return "repository"
}
