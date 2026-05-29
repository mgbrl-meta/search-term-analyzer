# Google Shopping Search Term Analyzer

A full-stack web application for analyzing Google Ads Search Term reports. Upload your export file and instantly get:

- 📊 Campaign, ad group, and search term dashboards
- 🏷️ Automatic keyword categorization (Irrelevant, Competitor, Brand, DIY, Informational, High-Intent, etc.)
- 🔤 N-gram analysis (1-gram, 2-gram, 3-gram) with poor performer detection
- 💸 Wasted spend identification
- 🚫 Negative keyword recommendations with broad/phrase/exact match formats
- 📅 Daily operator report with export

---

## Architecture

```
Frontend (Next.js)  →  Vercel
       ↓ HTTP
Backend (Flask/Python)  →  Railway or Render
```

- **Frontend:** Next.js 14 + TypeScript + Tailwind CSS deployed on Vercel
- **Backend:** Flask + pandas Python API deployed on Railway (free tier)
- **Analysis:** Runs entirely on the Python backend — no data sent to third parties

---

## File Structure

```
search-term-analyzer/
├── backend/
│   ├── app.py                      # Flask API (main entry point)
│   ├── requirements.txt
│   ├── Procfile                    # For Railway/Render deployment
│   ├── sample_data.csv             # Test data
│   └── analysis/
│       ├── __init__.py
│       ├── parser.py               # File reading + column normalization
│       ├── cleaner.py              # Data cleaning pipeline
│       ├── metrics.py              # KPI calculation
│       ├── categories.py           # Rule-based categorization
│       ├── ngrams.py               # N-gram analysis engine
│       ├── recommendations.py      # Negative keyword recommendation engine
│       └── exports.py              # CSV export generators
│
└── frontend/
    ├── app/
    │   ├── layout.tsx
    │   ├── globals.css
    │   ├── page.tsx                # Upload page
    │   └── dashboard/
    │       └── page.tsx            # Dashboard
    ├── components/
    │   ├── SummaryCards.tsx
    │   ├── FilterBar.tsx
    │   ├── SpendCharts.tsx
    │   ├── CampaignTable.tsx
    │   ├── SearchTermTable.tsx
    │   ├── CategoryDashboard.tsx
    │   ├── NgramDashboard.tsx
    │   ├── NegativeKeywordTable.tsx
    │   └── DailyReport.tsx
    ├── lib/
    │   └── api.ts                  # API client + CSV export utilities
    ├── types/
    │   └── analysis.ts             # TypeScript interfaces
    ├── package.json
    ├── next.config.js
    ├── tailwind.config.js
    └── tsconfig.json
```

---

## Local Development

### 1. Clone the project

```bash
git clone <your-repo>
cd search-term-analyzer
```

### 2. Set up Python backend

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
cp .env.example .env
# Edit .env — set FRONTEND_URL=http://localhost:3000

# Run the Flask server
python app.py
# Server starts at http://localhost:5000
```

### 3. Test the backend with sample data

```bash
# Quick test
python3 -c "
from analysis.parser import validate_and_parse
from analysis.cleaner import clean
with open('sample_data.csv', 'rb') as f:
    data = f.read()
df, w = validate_and_parse(data, 'sample_data.csv')
df, w = clean(df)
print('OK:', len(df), 'rows')
"
```

Or test via curl:
```bash
curl -X POST http://localhost:5000/api/analyze \
  -F "file=@sample_data.csv" \
  -F "spend_threshold=1000" \
  -F "clicks_threshold=20" \
  -F "target_roas=2.0" \
  | python3 -m json.tool | head -50
```

### 4. Set up Next.js frontend

```bash
cd ../frontend

# Install dependencies
npm install

# Set environment variables
cp .env.local.example .env.local
# Edit .env.local — NEXT_PUBLIC_API_URL=http://localhost:5000

# Run development server
npm run dev
# Opens at http://localhost:3000
```

---

## Deployment

### Deploy Backend to Railway (recommended, free tier)

1. Create account at https://railway.app
2. Create a new project → Deploy from GitHub repo
3. Point it to your `backend/` folder (or set `Root Directory` to `backend`)
4. Railway auto-detects the Procfile and installs requirements.txt
5. In Railway Variables, set:
   ```
   FRONTEND_URL=https://your-vercel-app.vercel.app
   FLASK_ENV=production
   ```
6. Copy your Railway deployment URL (e.g. `https://your-app.railway.app`)

### Deploy Frontend to Vercel

1. Push code to GitHub
2. Import project at https://vercel.com/new
3. Set **Framework Preset:** Next.js
4. Set **Root Directory:** `frontend`
5. In Environment Variables, add:
   ```
   NEXT_PUBLIC_API_URL=https://your-app.railway.app
   ```
6. Deploy

### Alternative backends: Render, Fly.io

The backend works on any Python host that supports Flask + gunicorn.
For Render: same as Railway, use `web: gunicorn app:app` as start command.

---

## How to Export from Google Ads

1. In Google Ads → Reports → Search terms
2. Select your date range
3. Click the download icon → CSV or Excel
4. Upload that file to this tool

### Supported column names

The tool handles all common Google Ads export column variations:

| Google Ads Column | Internal Name |
|---|---|
| Search term, Search terms, Keyword | search_term |
| Campaign, Campaign name | campaign |
| Ad group, Ad group name | ad_group |
| Match type | match_type |
| Impressions, Impr. | impressions |
| Clicks | clicks |
| Cost, Spend | cost |
| Conversions, Conv., All conv. | conversions |
| Purchases, Transactions | purchases |
| Conversion value, Conv. value, Revenue | conversion_value |
| Day, Date | date |
| CTR | ctr |
| Avg. CPC, Average CPC | avg_cpc |

---

## Configuration

### Thresholds (editable in the upload page)

| Threshold | Default | Meaning |
|---|---|---|
| High spend | 1000 | Flag search terms with cost ≥ this and 0 purchases |
| High clicks | 20 | Flag search terms with clicks ≥ this and 0 purchases |
| Target ROAS | 2.0 | Flag search terms with ROAS below this |
| N-gram spend | 1000 | Flag n-grams with cost ≥ this and 0 purchases |
| N-gram clicks | 20 | Flag n-grams with clicks ≥ this and 0 purchases |

### Keyword Categories (editable in `backend/analysis/categories.py`)

Categories are defined in `CATEGORY_RULES` — a dict of category name → trigger keywords.

To add your brand terms:
```python
CATEGORY_RULES["brand"] = [
    "your brand name", "yourbrand", "your product name"
]
```

To add product-specific terms:
```python
CATEGORY_RULES["product_specific"] = [
    "model xyz", "pro version", "special edition"
]
```

Category priority (first match wins):
1. Irrelevant
2. Competitor
3. Brand
4. DIY
5. Informational
6. Price-Sensitive
7. High-Intent
8. Problem/Solution
9. Lifestyle
10. Product-Specific
11. Low-Intent
12. Generic
13. Other

---

## Exports Available

| Export | Description |
|---|---|
| Full Analysis CSV | All search terms with every calculated metric |
| All Negatives (full) | Every recommendation with all fields |
| Broad Match Negatives | One keyword per line, no formatting |
| Phrase Match Negatives | Keywords wrapped in "quotes" |
| Exact Match Negatives | Keywords wrapped in [brackets] |
| N-gram Report | Full n-gram analysis table |
| Daily Operator Report | Summary + flagged terms + recommendations |

---

## Sample Test CSV

A realistic 52-row test file is included at `backend/sample_data.csv`.
Upload this to test the tool locally before using real data.

---

## Adding Features

### Add a new category
Edit `CATEGORY_RULES` in `backend/analysis/categories.py`:
```python
"luxury_brands": ["rolex", "gucci", "louis vuitton", "hermes"],
```
Then add it to `CATEGORY_PRIORITY` at the appropriate position.

### Change recommendation logic
Edit `generate_search_term_recommendations()` in `backend/analysis/recommendations.py`.

### Add a new chart
Add to `frontend/components/SpendCharts.tsx` using the Recharts library.

### Add a new export type
1. Add a function in `backend/analysis/exports.py`
2. Add a route case in `backend/app.py`
3. Add a button in `frontend/app/dashboard/page.tsx`
