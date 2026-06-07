package main

import (
	"fmt"
	"os"
	"path/filepath"
	"gopkg.in/yaml.v3"
)

func main() {
	files, _ := filepath.Glob(".forgejo/workflows/*.yaml")
	for _, f := range files {
		b, _ := os.ReadFile(f)
		var m map[string]interface{}
		err := yaml.Unmarshal(b, &m)
		if err != nil {
			fmt.Printf("Error in %s: %v\n", f, err)
		}
	}
}
