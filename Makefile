# Makefile para Tsunagu Mod Manager
# Automatiza el build de Wails y copia archivos necesarios

.PHONY: build build-windows build-linux build-darwin clean dev install

# Variables
APP_NAME := Tsunagu
BUILD_DIR := build/bin
WINDOWS_OUTPUT := $(BUILD_DIR)/$(APP_NAME).exe
LINUX_OUTPUT := $(BUILD_DIR)/$(APP_NAME)

# Build para Windows (AMD64)
build-windows:
	@echo "Building $(APP_NAME) for Windows..."
	wails build -platform windows/amd64 -o $(APP_NAME).exe
	@echo "Copying characters.json to build directory..."
	cp characters.json $(BUILD_DIR)/
	@echo "Build complete! Output: $(WINDOWS_OUTPUT)"
	@echo "characters.json copied to $(BUILD_DIR)/"

# Build para Windows con NSIS installer
build-windows-nsis:
	@echo "Building $(APP_NAME) for Windows with NSIS installer..."
	wails build -platform windows/amd64 -nsis -o $(APP_NAME).exe
	@echo "Copying characters.json to build directory..."
	cp characters.json $(BUILD_DIR)/
	@echo "Build complete with installer!"

# Build para Linux
build-linux:
	@echo "Building $(APP_NAME) for Linux..."
	wails build -platform linux/amd64 -o $(APP_NAME)
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
	@echo "  make clean              - Clean build files"
	@echo "  make package-windows    - Build and package for Windows"
	@echo "  make help               - Show this help message"
