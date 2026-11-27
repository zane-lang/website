# Download the newest documentation folders of every source repository.
fetch:
	npm run fetch

# Serve the site locally, reloading on changes.
dev:
	npm run dev

# Build the site into dist/, index it for search and check its links.
build:
	npm run build

# Check the links of the last build again.
check-links:
	npm run check-links

# Run the unit tests of the build scripts.
test:
	npm test

ship:
	#!/usr/bin/env bash
	read -p "Are you sure you want to deploy to production? [y/N] " confirm
	if [[ "$confirm" =~ ^[Yy]$ ]]; then
		vercel --prod
	else
		echo "Deployment cancelled."
	fi

# Check prose with the prose-lint commit and lockfile that CI pins in prose.yml.
prose:
	#!/usr/bin/env bash
	set -euo pipefail
	dir="${XDG_CACHE_HOME:-$HOME/.cache}/prose-lint/107c5f768ea3ce4936d6fdff1b0f30fac9237615"
	if [ ! -d "$dir" ]; then
		rm -rf "$dir.tmp"
		git clone -q https://github.com/zane-lang/prose-lint "$dir.tmp"
		git -C "$dir.tmp" checkout -q 107c5f768ea3ce4936d6fdff1b0f30fac9237615
		mv "$dir.tmp" "$dir"
	fi
	uv run --frozen --project "$dir" prose-lint .
