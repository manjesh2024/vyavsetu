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
4. Top bar se **Theme** and **Device** choose karo. Heading ke just neeche **Quick open** buttons se POS, Customer App, Driver App, Kitchen aur Super Admin ko seedha access karo. Sidebar mein baaki modules hain, Developer Access mein brand, colours, device rules aur workflow diagrams hain.

## Publish through GitHub Pages
The deployment workflow is already committed at `.github/workflows/pages.yml`, but GitHub Pages must first be enabled in repository settings:

1. Open [Vyavsetu Pages settings](https://github.com/manjesh2024/vyavsetu/settings/pages).
2. Under **Build and deployment → Source**, select **GitHub Actions** and save.
3. Open [Actions](https://github.com/manjesh2024/vyavsetu/actions) and rerun the latest failed deployment workflow.
4. Share the live URL only after the deployment job shows **success**. Current demo URL: https://manjesh2024.github.io/vyavsetu/

## Checkout test
- POS: add a product, adjust quantity, select Take payment, then choose Cash/Dummy UPI/Dummy Card.
- Customer App: choose a shop, add products, enter name/phone/address, and checkout. A driver job and (for restaurant shops) KDS ticket are created.
- Driver App: accept the job, confirm pickup, start route, then complete delivery with the demo OTP shown in the form.
- Products/Purchases/Inventory: add a product, create a PO, mark ordered and receive goods to confirm the stock count changes.
- Orders & Receipts: inspect receipts and export orders/CSV reports.

## Important
This is a clickable product/demo prototype with sample data, not a production billing/payment system. Real auth, backend, tenant isolation, statutory invoices/tax, payment integration, printer hardware and offline sync need separate implementation.
