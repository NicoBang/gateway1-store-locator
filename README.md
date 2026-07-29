# Gateway1 Store Locator

Simpel store locator der henter data fra Google Sheets og gør det tilgængeligt via CDN.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Test connection
npm test

# Update store data
npm run update

# Deploy til GitHub
npm run deploy
```

## 📦 CDN URL

Efter data er pushed til GitHub, er det tilgængeligt på:

```
https://cdn.jsdelivr.net/gh/NicoBang/gateway1-store-locator@main/stores.min.json
```

## 📊 Data Source

- **Google Sheet:** [View/Edit](https://docs.google.com/spreadsheets/d/1sk8nwc5WBhD8dMjnelbT3rRAepVoxe3f9bkbAbxoNos)
- **Sheet Name:** Data

## 🔄 Automatisk Opdatering

Data opdateres automatisk hver dag kl. 07:00 CET via GitHub Actions.

### Manuel opdatering

1. Rediger data i Google Sheet
2. Kør: `npm run update`
3. Push til GitHub: `git push`

## 📁 Output Filer

- `stores.json` - Formateret JSON (læsbar)
- `stores.min.json` - Minified JSON (til produktion)
- `stores.csv` - CSV format

## 📝 Google Sheet Kolonner

Påkrævede kolonner:
- Company
- Address
- Postal Code
- City
- Country
- Phone
- Website

Valgfrie kolonner:
- Email
- Physical (marker med "X")
- Online (marker med "X")
- Enhver anden kolonne du ønsker

## 🔒 Sikkerhed

- API keys gemmes i `.env` (committes aldrig)
- GitHub Secrets bruges til automation
- Google Sheet skal være delt som "Alle med link kan se"

## 🛠️ Shopify Integration

I din Shopify butik kan du bruge data sådan:

```javascript
fetch('https://cdn.jsdelivr.net/gh/NicoBang/gateway1-store-locator@main/stores.min.json')
  .then(response => response.json())
  .then(stores => {
    // Brug stores data til at vise butikker
    console.log(stores);
  });
```

---
Generated: 2026-07-29T10:16:49.130Z
