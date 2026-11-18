docs:
	npm run sync:docs

dev:
	npm run dev

ship:
	#!/usr/bin/env bash
	read -p "Are you sure you want to deploy to production? [y/N] " confirm
	if [[ "$confirm" =~ ^[Yy]$ ]]; then
		vercel --prod
	else
		echo "Deployment cancelled."
	fi
