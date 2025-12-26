#!/usr/bin/env node

import { google } from 'googleapis';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const CREDENTIALS_FILE = process.env.GOOGLE_CREDENTIALS_FILE || 'google_credentials.json';
const OUTPUT_FILE = path.join(__dirname, '../../src/data/dietary-restrictions.json');

// Support for environment variable credentials
const GOOGLE_SHEETS_CREDENTIALS = process.env.GOOGLE_SHEETS_CREDENTIALS;

// Google Sheets API setup
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

class ContentSyncError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR') {
    super(message);
    this.name = 'ContentSyncError';
    this.code = code;
  }
}

async function loadCredentials() {
  try {
    let credentials;

    // Try environment variables first, then fall back to files
    if (GOOGLE_SHEETS_CREDENTIALS) {
      credentials = JSON.parse(GOOGLE_SHEETS_CREDENTIALS);
    } else {
      credentials = JSON.parse(await fs.readFile(CREDENTIALS_FILE, 'utf8'));
    }

    // Check if this is a service account (recommended for automation)
    if (credentials.type === 'service_account') {
      console.log('🔐 Using service account authentication');
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: SCOPES
      });
      return auth.getClient();
    }

    // Handle OAuth2 credentials (for development/testing)
    if (credentials.installed || credentials.web) {
      console.log('🔐 Using OAuth2 authentication');

      // For OAuth2, we'll use application default credentials
      // This works with gcloud auth application-default login
      const auth = new google.auth.GoogleAuth({
        scopes: SCOPES
      });

      return auth.getClient();
    }

    throw new ContentSyncError(
      'Invalid credentials format. Expected service account or OAuth2 credentials.',
      'INVALID_CREDENTIALS'
    );

  } catch (error) {
    throw new ContentSyncError(
      `Failed to load credentials: ${error.message}`,
      'CREDENTIALS_ERROR'
    );
  }
}

async function fetchSheetData(auth, range = 'Sheet1') {
  try {
    const sheets = google.sheets({ version: 'v4', auth });

    // Fetch data from the specified range, including calculated values
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
      valueRenderOption: 'FORMATTED_VALUE', // Include calculated/formula values
    });

    if (!response.data.values || response.data.values.length === 0) {
      throw new ContentSyncError('No data found in spreadsheet', 'NO_DATA');
    }

    return response.data.values;
  } catch (error) {
    if (error.code === 429) {
      throw new ContentSyncError('API rate limit exceeded', 'RATE_LIMIT');
    }
    throw new ContentSyncError(
      `Failed to fetch sheet data: ${error.message}`,
      'API_ERROR'
    );
  }
}

function parseRestrictionCell(item, cellValue) {
  const lowerValue = cellValue.toLowerCase();
  let severity = "yes";
  let notes = cellValue;

  if (lowerValue.includes("airborne")) {
    severity = "airborne";
    // Extract notes from parentheses
    const notesMatch = cellValue.match(/\((.*?)\)/);
    notes = notesMatch ? notesMatch[1] : "";
  } else if (lowerValue.includes("small amount")) {
    severity = "small amounts";
  }

  return { item, severity, notes };
}

function parseSheetData(rows) {
  if (rows.length < 2) {
    throw new ContentSyncError('Insufficient data in spreadsheet', 'INSUFFICIENT_DATA');
  }

  // Row 1: Member names (skip column 0 which is restriction labels)
  const headers = rows[0].slice(1);  // ["Nechoma", "Rocheli", ...]

  console.log('📋 Found member columns:', headers);

  const members = headers.map(name => ({
    name: name.trim(),
    restrictions: []
  }));

  const restrictionsList = [];

  // Process each row (restriction)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const restrictionName = row[0]?.trim();

    if (!restrictionName) continue; // Skip empty rows

    if (!restrictionsList.includes(restrictionName)) {
      restrictionsList.push(restrictionName);
    }

    // Process each member's column
    for (let j = 1; j < row.length && j <= headers.length; j++) {
      const cellValue = row[j]?.toString().trim() || "";

      if (cellValue && cellValue.toLowerCase() !== 'no') {
        const restriction = parseRestrictionCell(restrictionName, cellValue);
        members[j - 1].restrictions.push(restriction);
      }
    }
  }

  console.log(`✅ Processed ${members.length} members with ${restrictionsList.length} total restrictions`);

  return { members, restrictionsList };
}

async function saveDietaryData(data) {
  try {
    const outputDir = path.dirname(OUTPUT_FILE);
    await fs.mkdir(outputDir, { recursive: true });

    const jsonContent = JSON.stringify(data, null, 2);
    await fs.writeFile(OUTPUT_FILE, jsonContent, 'utf8');

    console.log(`✅ Successfully saved dietary restrictions data to ${OUTPUT_FILE}`);
  } catch (error) {
    throw new ContentSyncError(
      `Failed to save dietary data: ${error.message}`,
      'SAVE_ERROR'
    );
  }
}

async function main(testMode = false) {
  try {
    if (testMode) {
      console.log('🧪 Testing dietary data sync with Google Sheets...');
      console.log('');
    } else {
      console.log('🚀 Starting dietary data sync from Google Sheets...');
    }

    // Validate environment
    if (!SPREADSHEET_ID) {
      throw new ContentSyncError('GOOGLE_SPREADSHEET_ID environment variable is required', 'MISSING_CONFIG');
    }

    if (testMode) {
      console.log(`📊 Using spreadsheet ID: ${SPREADSHEET_ID}`);
      console.log('');
    }

    // Load credentials
    console.log('🔐 Loading Google Sheets credentials...');
    const auth = await loadCredentials();
    console.log('✅ Google authentication successful');

    if (testMode) {
      console.log('');
    }

    // Fetch data
    if (testMode) {
      console.log('📥 Testing data fetching...');
    } else {
      console.log('📥 Fetching data from Google Sheets...');
    }
    const rows = await fetchSheetData(auth);
    console.log(`📊 ${testMode ? 'Successfully fetched' : 'Fetched'} ${rows.length} rows from spreadsheet`);

    if (testMode) {
      console.log('');
    }

    // Parse and validate data
    if (testMode) {
      console.log('🔍 Testing data parsing...');
    } else {
      console.log('🔍 Parsing and validating data...');
    }
    const dietaryData = parseSheetData(rows);

    if (testMode) {
      console.log('');

      // Display sample results for test mode
      if (dietaryData.members.length > 0) {
        console.log('📝 Sample parsed members:');
        dietaryData.members.slice(0, 3).forEach((member, index) => {
          console.log(`\n--- Member ${index + 1} ---`);
          console.log(`Name: ${member.name}`);
          console.log(`Restrictions: ${member.restrictions.length}`);
          if (member.restrictions.length > 0) {
            member.restrictions.slice(0, 3).forEach(r => {
              console.log(`  • ${r.item} (${r.severity})${r.notes ? ` - ${r.notes}` : ''}`);
            });
          }
        });
      }

      console.log('\n🎉 All tests passed! The sync system is working correctly.');
      return;
    }

    // Save to file (production mode only)
    console.log('💾 Saving dietary restrictions data to JSON file...');
    await saveDietaryData(dietaryData);

    console.log('🎉 Dietary data sync completed successfully!');

  } catch (error) {
    console.error(`❌ ${testMode ? 'Test' : 'Dietary data sync'} failed: ${error.message}`);
    if (error.code) {
      console.error(`Error code: ${error.code}`);
    }
    process.exit(1);
  }
}

// Export functions for testing
export {
  parseSheetData,
  parseRestrictionCell,
  fetchSheetData,
  loadCredentials
};

// Only run the script if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const testMode = process.argv.includes('--test');
  main(testMode);
}
