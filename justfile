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

# Check prose with the prose-lint commit pinned in .github/workflows/prose.yml.
prose:
	uvx --from git+https://github.com/zane-lang/prose-lint@107c5f768ea3ce4936d6fdff1b0f30fac9237615 prose-lint .
