# Makefile para Tsunagu Mod Manager
# Automatiza el build de Wails y copia archivos necesarios

.PHONY: build build-windows build-linux build-darwin clean dev install sync-version

# Variables
APP_NAME := Tsunagu
BUILD_DIR := build/bin
WINDOWS_OUTPUT := $(BUILD_DIR)/$(APP_NAME).exe
LINUX_OUTPUT := $(BUILD_DIR)/$(APP_NAME)

# Version embedded into the binary so the app can self-update. It is read
# from the VERSION file; the release workflow also keeps wails.json in sync.
VERSION ?= $(shell cat VERSION 2>/dev/null | tr -d '[:space:]')
ifeq ($(VERSION),)
VERSION := dev
endif
BUILD_TIME ?= $(shell date -u +%Y-%m-%dT%H:%M:%SZ)
# Release tag of this build (set by the release workflow). It lets the app
# know that the newest published release is the one it already runs.
BUILD_TAG ?= dev
LDFLAGS := -X tsunagu/pkg/updater.Version=$(VERSION) -X tsunagu/pkg/updater.BuildTag=$(BUILD_TAG) -X tsunagu/pkg/updater.BuildTime=$(BUILD_TIME)
# Newer distros ship webkit2gtk-4.1 only; Wails needs the matching build tag.
WAILS_TAGS ?= $(shell pkg-config --exists webkit2gtk-4.1 2>/dev/null && echo webkit2_41)
WAILS_TAGS_FLAG := $(if $(WAILS_TAGS),-tags "$(WAILS_TAGS)")

# Build para Windows (AMD64)
build-windows:
	@echo "Building $(APP_NAME) for Windows ($(VERSION))..."
	wails build -platform windows/amd64 -o $(APP_NAME).exe -ldflags "$(LDFLAGS)"
	@echo "Copying characters.json to build directory..."
	cp characters.json $(BUILD_DIR)/
	@echo "Build complete! Output: $(WINDOWS_OUTPUT)"
	@echo "characters.json copied to $(BUILD_DIR)/"

# Build para Windows con NSIS installer
build-windows-nsis:
	@echo "Building $(APP_NAME) for Windows with NSIS installer ($(VERSION))..."
	wails build -platform windows/amd64 -nsis -o $(APP_NAME).exe -ldflags "$(LDFLAGS)"
	@echo "Copying characters.json to build directory..."
	cp characters.json $(BUILD_DIR)/
	@echo "Build complete with installer!"

# Build para Linux
build-linux:
	@echo "Building $(APP_NAME) for Linux ($(VERSION))..."
	wails build -platform linux/amd64 -o $(APP_NAME) $(WAILS_TAGS_FLAG) -ldflags "$(LDFLAGS)"
	@echo "Copying characters.json to build directory..."
	cp characters.json $(BUILD_DIR)/
	@echo "Build complete! Output: $(LINUX_OUTPUT)"


# Build para todas las plataformas
build-all: build-windows build-linux
	@echo "All builds completed!"

# Build por defecto (Windows)
build: build-windows

# Modo desarrollo
dev:
	wails dev

# Instalar dependencias del frontend
install:
	cd frontend && bun install

# Reflejar VERSION en wails.json (metadata del .exe / instalador)
sync-version:
	@if command -v jq >/dev/null 2>&1; then \
		tmp=$$(mktemp); \
		jq --arg v "$(VERSION)" '.info.productVersion = $$v' wails.json > $$tmp && mv $$tmp wails.json; \
		echo "wails.json productVersion -> $(VERSION)"; \
	else \
		echo "jq no está instalado; wails.json queda sin cambios"; \
	fi

# Limpiar archivos de build
clean:
	@echo "Cleaning build files..."
	rm -rf $(BUILD_DIR)
	@echo "Clean complete!"

# Compilar frontend solamente
build-frontend:
	cd frontend && bun run build

# Ejecutar tests (si existen)
test:
	go test ./...

# Empaquetar para distribución (Windows)
package-windows: build-windows
	@echo "Creating distribution package..."
	mkdir -p dist
	cd $(BUILD_DIR) && zip -r ../../dist/$(APP_NAME)-windows-amd64.zip $(APP_NAME).exe characters.json
	@echo "Package created: dist/$(APP_NAME)-windows-amd64.zip"

# Mostrar ayuda
help:
	@echo "Tsunagu Mod Manager - Makefile"
	@echo ""
	@echo "Available targets:"
	@echo "  make build              - Build for Windows (default)"
	@echo "  make build-windows      - Build for Windows AMD64"
	@echo "  make build-windows-nsis - Build for Windows with installer"
	@echo "  make build-linux        - Build for Linux AMD64"
	@echo "  make build-all          - Build for all platforms"
	@echo "  make dev                - Run in development mode"
	@echo "  make install            - Install frontend dependencies"
	@echo "  make sync-version       - Copy VERSION into wails.json"
	@echo "  make clean              - Clean build files"
	@echo "  make package-windows    - Build and package for Windows"
	@echo "  make help               - Show this help message"
