package utils

import (
	"os"
	"path/filepath"
	"sort"
	"strings"
)

type ZipFile struct {
	Name     string     `json:"name"`
	IsDir    bool       `json:"isDir"`
	Path     string     `json:"path"`
	Children []*ZipFile `json:"children,omitempty"`
}

// BuildStructureFromPath builds ZipFile structure from a filesystem path
func BuildStructureFromPath(rootPath string) ([]ZipFile, error) {
	var result []ZipFile

	err := filepath.Walk(rootPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Get relative path from root directory
		relPath, err := filepath.Rel(rootPath, path)
		if err != nil {
			return err
		}

		// Normalize separators to /
		normalizedPath := filepath.ToSlash(relPath)

		// Build ZipFile entry
		zipFile := ZipFile{
			Name:     info.Name(),
			IsDir:    info.IsDir(),
			Path:     normalizedPath,
			Children: []*ZipFile{}, // Will be filled later
		}

		// If it's the root directory, skip it
		if relPath == "." {
			return nil
		}

		result = append(result, zipFile)
		return nil
	})

	if err != nil {
		return nil, err
	}

	// Build hierarchical structure
	return BuildHierarchicalStructure(result), nil
}

func BuildHierarchicalStructure(files []ZipFile) []ZipFile {
	// Create map for fast access
	fileMap := make(map[string]*ZipFile)

	// First, create all entries and save references
	for i := range files {
		fileMap[files[i].Path] = &files[i]
	}

	// Then, build hierarchy
	var root []*ZipFile // Use pointers to keep references
	for i := range files {
		file := &files[i]
		if !strings.Contains(file.Path, "/") {
			// It's a root file/directory - add map reference
			root = append(root, file)
		} else {
			// Has a parent
			parentPath := file.Path[:strings.LastIndex(file.Path, "/")]
			if parent, exists := fileMap[parentPath]; exists {
				// Add map reference instead of copy
				parent.Children = append(parent.Children, file)
			}
		}
	}

	// Convert to []ZipFile for return
	result := make([]ZipFile, len(root))
	for i, item := range root {
		result[i] = *item
	}

	// Sort
	sort.Slice(result, func(i, j int) bool {
		if result[i].IsDir != result[j].IsDir {
			return result[i].IsDir // Directories first
		}
		return result[i].Name < result[j].Name
	})

	// Sort recursively
	for i := range result {
		SortZipFileChildren(&result[i])
	}

	return result
}

// SortZipFileChildren recursively sorts children of a ZIP file
func SortZipFileChildren(file *ZipFile) {
	if len(file.Children) > 0 {
		sort.Slice(file.Children, func(i, j int) bool {
			if file.Children[i].IsDir != file.Children[j].IsDir {
				return file.Children[i].IsDir // Directories first
			}
			return file.Children[i].Name < file.Children[j].Name
		})

		// Sort recursively children of each child
		for i := range file.Children {
			SortZipFileChildren(file.Children[i])
		}
	}
}
