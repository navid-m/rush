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
	var output []byte
	var err error

	if runtime.GOOS == "windows" {
		cmd := exec.Command("git", "-C", gp.repoPath, "log", "--all", "--format=%H|%an|%at|%s", "--shortstat", "--reverse", "--numstat")
		output, err = cmd.Output()
	} else {
		cmd := exec.Command("git", "-C", gp.repoPath, "log", "--all", "--format=%H|%an|%at|%s", "--shortstat", "--reverse", "--numstat")
		output, err = cmd.Output()
	}

	if err != nil {
		return nil, fmt.Errorf("failed to read git history: %v", err)
	}

	return gp.parseCommitsWithNumStat(string(output)), nil
}

// parseCommitsWithNumStat parses the git log output with numstat into Commit structs
func (gp *GitParser) parseCommitsWithNumStat(output string) []Commit {
	lines := strings.Split(output, "\n")
	commits := []Commit{}
	var currentCommit *Commit

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		if strings.Contains(line, "|") && !strings.Contains(line, "\t") {
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
		} else if currentCommit != nil {
			if strings.Contains(line, "\t") {
				fields := strings.Split(line, "\t")
				if len(fields) >= 2 {
					insertions, err1 := strconv.Atoi(strings.TrimSpace(fields[0]))
					deletions, err2 := strconv.Atoi(strings.TrimSpace(fields[1]))

					if err1 == nil && err2 == nil {
						currentCommit.Insertions += insertions
						currentCommit.Deletions += deletions
						currentCommit.FilesChanged++
						filename := strings.TrimSpace(fields[2])
						if filename != "" {
							currentCommit.Files = append(currentCommit.Files, filename)
						}
					}
				}
			} else if strings.Contains(line, "changed") {
				filesMatch := strings.Fields(strings.Split(line, " changed")[0])
				if len(filesMatch) > 0 {
					filesChanged, err := strconv.Atoi(filesMatch[0])
					if err == nil {
						if currentCommit.FilesChanged == 0 {
							currentCommit.FilesChanged = filesChanged
						}
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

// This method is kept for backward compatibility but is now redundant
// since GetCommits already populates the Files field
func (gp *GitParser) GetAllFilesForCommits(commits []Commit) ([]Commit, error) {
	return commits, nil
}

// GetRepoName extracts the repository name from the path
func (gp *GitParser) GetRepoName() string {
	parts := strings.Split(filepath.ToSlash(gp.repoPath), "/")
	if len(parts) > 0 {
		return parts[len(parts)-1]
	}
	return "repository"
}
