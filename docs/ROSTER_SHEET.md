# League roster from Google Sheets

Team rosters are loaded from a Google Sheet so you can manage drafts in a shared sheet and have the app show each member’s roster on their team page.

## Setup

1. **Create a sheet** with one row per wrestler assignment:
   - A column that identifies the **team/member** (e.g. "Team", "Member", "Owner") — values should match league member names: Christopher Cramer, Caleb Warren, Josh Dill, Kenny Walker, Kyle Morrow, Trevor Jones.
   - A column for the **wrestler** (e.g. "Wrestler", "Pick", "Name").
   - Optional: a **contract** column (e.g. "Contract", "Years") to show contract length on the team page.

2. **Publish the sheet as CSV**
   - In Google Sheets: **File → Share → Publish to web**.
   - Choose the correct sheet tab and **Comma-separated values (.csv)**.
   - Click **Publish** and copy the link.

   Or use the export URL directly (sheet must be viewable by “Anyone with the link”):
   ```
   https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/export?format=csv&gid={SHEET_GID}
   ```
   You can find `SPREADSHEET_ID` and `gid` from the sheet’s URL.

3. **Add the URL to `.env`**
   ```
   GOOGLE_SHEET_CSV_URL=https://docs.google.com/...your-published-csv-link...
   ```

4. Restart the dev server. Each league member’s team page will show their roster from the sheet (refreshed about every 60 seconds).

## Example sheet layout

| Member           | Wrestler    | Contract |
|------------------|-------------|----------|
| Christopher Cramer | Cody Rhodes | 3 yr     |
| Christopher Cramer | Rhea Ripley | 2 yr     |
| Caleb Warren     | Jacob Fatu   | 3 yr     |
| Josh Dill        | ...          | ...      |

Column headers are detected by name (case-insensitive):

- **Member/team**: `Team`, `Member`, `Owner`, or `Manager` → matched to league member names.
- **Wrestler**: `Wrestler`, `Pick`, or `Name` → wrestler name shown on the roster.
- **Contract** (optional): `Contract`, `Years`, or `Year` → shown next to each wrestler.

Member names in the sheet are matched to the league list (Christopher Cramer, Caleb Warren, etc.). Slight variations (e.g. “Chris Cramer”) may not match; use the full names from the app or add aliases in `lib/league.ts` if needed.
