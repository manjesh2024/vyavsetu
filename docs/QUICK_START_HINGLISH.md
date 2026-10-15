# Quick Start (Hinglish)

## Run the demo locally
1. Open the repository's **Code** tab and confirm `index.html` and `app.html` are present.
2. Clone the repository:
   ```bash
   git clone https://github.com/manjesh2024/vyavsetu.git
   cd vyavsetu
   python3 -m http.server 8000
   ```
3. Visit `http://localhost:8000`.
4. Top bar se **Theme** choose karo and **Device** viewport (desktop/laptop/POS/tablet/iPad/Android/iPhone) switch karo. Inside application navigation se Developer Access open karke logo, colours, device rules and workflow diagrams dekho.

## Publish through GitHub Pages
The deployment workflow is already committed at `.github/workflows/pages.yml`, but GitHub Pages must first be enabled in repository settings:

1. Open [Vyavsetu Pages settings](https://github.com/manjesh2024/vyavsetu/settings/pages).
2. Under **Build and deployment → Source**, select **GitHub Actions** and save.
3. Open [Actions](https://github.com/manjesh2024/vyavsetu/actions) and rerun the latest failed deployment workflow.
4. Share the live URL only after the deployment job shows **success**.

## Important
This is a clickable product/demo prototype with sample data, not a production billing/payment system. Real auth, backend, tenant isolation, statutory invoices/tax, payment integration, printer hardware and offline sync need separate implementation.
