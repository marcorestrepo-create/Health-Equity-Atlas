# U.S. Health Equity Atlas

An interactive county-by-county dashboard covering 3,144 U.S. counties. Layers insurance rates, maternal mortality, chronic disease burden, provider shortages, hospital closures, transportation barriers, broadband access, and environmental exposure data.

Built for National Minority Health Month 2026.

## Features

- **12 switchable data layers** with color-coded bubble map
- **6 evidence-based intervention rankings** per county (OB access, mobile clinics, language access, blood pressure programs, telehealth, community health workers)
- **Downloadable PDF briefings** for policymakers, health systems, and nonprofits
- **State rankings and filterable tables**

## Deploy to Render

Click the button below to deploy:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

## Run Locally

```bash
npm install
npm run dev
```

## Tech Stack

- Node.js + Express
- React + TypeScript
- SQLite + Drizzle ORM
- D3.js for data visualization
- jsPDF for PDF generation
