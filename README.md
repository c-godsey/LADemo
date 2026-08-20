# LAFCU ACH Stop Payment — Demo Site + Core-System Prefill

Two things in this package:

1. **`lafcu_demo_index.html`** — a fake "online banking" portal you can open right now, no setup, no server. It shows a mock account/transaction dashboard, flags one ACH debit as "Unrecognized?", and walks through what pre-fill from a core system would look like before handing off to the DocuSign web form.
2. **`lafcu_demo_server.js`** (+ `lafcu_demo_package.json`, `lafcu_demo.env.example`) — the real piece: a small backend showing exactly how the pre-fill actually has to work against DocuSign's Web Forms API.

## Just want to see the demo?

Double-click `lafcu_demo_index.html` (or open it in any browser). Click **"Dispute / Stop this debit"** on the flagged Streamline Fitness transaction. It'll show you the exact `formValues` it would send — member name, account number, debitor name, amount, and date — pulled from the fake "core system" data at the top of the `<script>` block, then simulate the handoff. No backend, no DocuSign account, no network calls. This is `DEMO_MODE`, set at the top of the file's `CONFIG` object.

## Why a backend is required for the real version

DocuSign's Web Forms API doesn't support prefilling a form via URL parameters from the browser — prefill only happens through the `Instances:createInstance` call, which needs an OAuth access token. That token can never live in front-end JavaScript, so pre-filling from your core system has to go: **browser → your backend → DocuSign API → back to browser** and this is why the demo ships with a small Express server rather than just static HTML.

## Wiring up the real integration

1. `npm install` (in this folder — installs Express + dotenv).
2. `cp lafcu_demo.env.example .env` and fill in:
   - `DOCUSIGN_ACCOUNT_ID`
   - `DOCUSIGN_WEB_FORM_ID` — the `formId` of the web form you already built from the template (find it in the Web Forms Builder, or via the API's `getForm`/`listForms`)
   - `DOCUSIGN_ACCESS_TOKEN` — for quick local testing, paste in a short-lived token. Before this goes anywhere real, replace `getAccessToken()` in `lafcu_demo_server.js` with your actual JWT or Authorization Code grant — a hardcoded token is only for kicking the tires locally.
3. `node lafcu_demo_server.js` (or `npm start`).
4. In `lafcu_demo_index.html`, set `CONFIG.DEMO_MODE = false`.
5. Open `http://localhost:3000/lafcu_demo_index.html` and click through — this time it calls your real server, which calls DocuSign, and redirects the browser to the actual pre-filled web form instance.

## Where the "core system" fits in

`lookupMemberAndTxn()` in `lafcu_demo_server.js` is the stand-in for your actual core banking / transaction platform call. Two things worth keeping when you replace it:

- Resolve the member from the **authenticated session** server-side (e.g. `req.session.memberId`), not from anything the browser posts — don't let a client request dictate whose account number ends up on a document.
- Map your core system's field names to the exact `formValues` keys Web Forms expects. Those keys should match the `tabLabel`s from the original template (`MemberName`, `AccountNumber`, `DebitorCompanyName`, `AmountOfDebit`, `FirstDateOfDisputedDebit`, `typeOfStopPayment`, etc.) — double check them against the Builder's field list, since DocuSign may normalize a label slightly differently than what was submitted at template-creation time.

## Two ways to hand the member off to the form

Both are legitimate; pick based on how much you want them to leave your site:

- **Redirect** (what this demo does): `window.location.href = formUrl + "#instanceToken=" + instanceToken`. Simple, and what's implemented here.
- **Embed in an iframe via DocuSign JS**: keeps the member on your site the whole time. DocuSign's SDK (`docusign.js`) mounts the instance into a container element on your page. Worth switching to for a real member-facing rollout — check the current method signature in DocuSign's "Render embedded web form instances" doc before wiring it in, since the exact API surface is newer and still evolving.
