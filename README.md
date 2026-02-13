# TanStack Start + shadcn/ui + better-auth + Convex

This is a template for a new TanStack Start project with React, TypeScript, and shadcn/ui.

### Vercel deployment

You can use Convex directly in Vercel. Just create a new project with a forked github repo of this.
Use Framework Preset `TanStack Start` and replace the Build Command with `npx convex deploy --cmd 'npm run build'`.

### Set environment variables for convex
1. Generate a secret for encryption and generating hashes. Use the command below if you have openssl installed, or use the button to generate a random value instead. Or generate your own however you like.

`npx convex env set BETTER_AUTH_SECRET=$(openssl rand -base64 32)`

2. Add your site URL to your Convex deployment.

`npx convex env set SITE_URL http://localhost:3000`

3. Add environment variables to the `.env.local` file created by running `npx convex dev`. It will be picked up by your framework dev server. (Use cloud deployment)

```
.env.local
# Deployment used by \`npx convex dev\`
CONVEX_DEPLOYMENT=dev:adjective-animal-123 # team: team-name, project: project-name
VITE_CONVEX_URL=https://adjective-animal-123.convex.cloud
# Same as VITE_CONVEX_URL but ends in .site
VITE_CONVEX_SITE_URL=https://adjective-animal-123.convex.site
# Your local site URL
VITE_SITE_URL=http://localhost:3000
```