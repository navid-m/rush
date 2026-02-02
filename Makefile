.PHONY: all build-go build-ts clean

all: build-ts build-go

build-go:
	@echo "Building application..."
	go build .

build-ts:
	@echo "Building frontend..."
	cd internal/server/public/rush && bun run make

build: build-go build-ts

clean:
	@echo "Cleaning build artifacts..."
	rm -f bin/rush
	rm -f internal/server/public/rush/dist/index.min.js

all-v: build-go-v build-ts-v

build-go-v:
	@echo "Building application..."
	go build -v -o bin/rush .

build-ts-v:
	@echo "Building frontend..."
	cd internal/server/public/rush && bun run make