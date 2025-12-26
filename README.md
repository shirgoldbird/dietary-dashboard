# Dietary Dashboard

A static site for listing dietary restrictions and allergies for the guests at your meal. Built with Astro, Preact, and Google Sheets.

## Features

- 📋 Sync dietary restrictions data from Google Sheets
- ✅ Select attendees for a meal with checkboxes
- 📝 Generate formatted summary with:
  - Attendees list
  - Airborne allergies
  - Other dietary restrictions
  - Restrictions by person
- 📋 Copy summary to clipboard
- 💾 Download as text file
- 🔗 Share via URL (with attendees encoded)
- 🌙 Dark mode support

## Project Structure

```
dietary-dashboard/
├── .github/
│   ├── scripts/
│   │   └── sync-dietary-data.js       # Google Sheets sync script
│   └── workflows/
│       ├── content-sync.yml           # Daily sync from Google Sheets
│       └── deploy.yml                 # Deploy to GitHub Pages
├── public/                            # Static assets
├── src/
│   ├── components/
│   │   ├── Header.astro
│   │   ├── Footer.astro
│   │   ├── DarkModeToggle.jsx
│   │   └── DietaryRestrictionsTool.jsx # Main interactive component
│   ├── data/
│   │   └── dietary-restrictions.json   # Generated from Google Sheets
│   ├── layouts/
│   │   └── Layout.astro
│   └── pages/
│       └── index.astro
├── .env.example                        # Environment variables template
├── astro.config.mjs                    # Astro configuration
├── tailwind.config.mjs                 # Tailwind configuration
└── package.json
```

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Google Sheets

#### Create Google Sheets Structure

Your Google Sheet should have:
- **First row**: Member names (Column A can be empty, columns B onwards are member names)
- **Subsequent rows**: Restriction name in Column A, member-specific values in other columns

Example:
```
              Abby         Baruch        Chava
Wheat/Gluten               No
Dairy         Airborne                   Small amounts
Nuts                                     No
```

#### Create Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google Sheets API
4. Create a Service Account:
   - Go to IAM & Admin → Service Accounts
   - Click "Create Service Account"
   - Give it a name and click "Create"
   - Skip the permissions step
   - Click "Done"
5. Create a key:
   - Click on the service account you just created
   - Go to "Keys" tab
   - Click "Add Key" → "Create New Key"
   - Choose JSON format
   - Download the file
6. Share your Google Sheet with the service account email (found in the JSON file as `client_email`)

#### Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` and add:
- `GOOGLE_SPREADSHEET_ID`: Get from your Sheet URL
- `GOOGLE_SHEETS_CREDENTIALS`: Paste the entire JSON from the service account key file

### 3. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:4321`

### 4. Test Google Sheets Sync

```bash
node .github/scripts/sync-dietary-data.js
```

Check that `src/data/dietary-restrictions.json` is created with your data.

## Deployment (GitHub Pages)

### 1. Configure GitHub Secrets

Go to your repository → Settings → Secrets and variables → Actions

Add two secrets:
- `GOOGLE_SPREADSHEET_ID`: Your spreadsheet ID
- `GOOGLE_SHEETS_CREDENTIALS`: Paste the entire JSON from service account

### 2. Trigger Deployment

Push to main branch or manually trigger the workflows in the Actions tab.

## Google Sheets Data Format

### Cell Value Formats

- **Empty or "No"**: No restriction
- **"Yes" or any text**: Has this restriction
- **"Airborne"**: Airborne allergy (parsed automatically)
- **"Small amounts"**: Can tolerate small amounts
- **"Airborne (notes)"**: Airborne with notes in parentheses

### Severity Detection

The sync script automatically detects:
- **airborne**: Contains "airborne" (case-insensitive)
- **small amounts**: Contains "small amount" (case-insensitive)
- **yes**: Any other non-empty value

## Development

### Available Commands

- `npm run dev` - Start dev server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `node .github/scripts/sync-dietary-data.js` - Manually sync from Google Sheets

### Customization

- Update `src/components/Header.astro` to change header
- Update `src/components/Footer.astro` to change footer
- Modify `tailwind.config.mjs` for custom colors
- Edit `.github/workflows/content-sync.yml` to change sync schedule

## License

MIT
