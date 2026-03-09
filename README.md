<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/f12c97d9-73f9-44cb-87e5-a225d83b7912

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set your Gemini key in `.env`:
   `VITE_GEMINI_API_KEY=your_key_here`
   (fallback supported: `GEMINI_API_KEY`)
3. Run the app:
   `npm run dev`

## Operations Docs

- Admin validation matrix: `docs/admin-test-matrix.md`
- Deploy and rollback runbook: `docs/deploy-runbook.md`
