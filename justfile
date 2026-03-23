submodules:
	git submodule update --remote --recursive --force

dev:
	npm run dev

ship:
	#!/usr/bin/env bash
	read -p "Are you sure you want to deploy to production? [y/N] " confirm
	if [[ "$confirm" =~ ^[Yy]$ ]]; then
		just submodules && vercel --prod
	else
		echo "Deployment cancelled."
	fi
