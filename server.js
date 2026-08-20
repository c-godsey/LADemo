/**
 * Minimal example backend for the LAFCU ACH Stop Payment demo.
 *
 * What this shows: the ONE call that has to happen server-side —
 * turning "core system" data into a pre-filled DocuSign Web Form
 * instance — using the Web Forms API's Instances:createInstance
 * endpoint. The static demo (lafcu_demo_index.html) posts to
 * POST /api/start-ach-stop-payment and expects back { redirectUrl }.
 *
 * This is intentionally a skeleton, not a production integration:
 *   - Auth is stubbed out (see getAccessToken below). Swap in your
 *     real OAuth/JWT grant flow — never hand a DocuSign access token
 *     to the browser.
 *   - "Core system" lookup is mocked. Replace `lookupMemberAndTxn`
 *     with your actual account/transaction system call, and always
 *     resolve it from the authenticated session server-side (don't
 *     trust a memberId posted from the client for anything that ends
 *     up on a document).
 *
 * Run:
 *   npm install
 *   cp .env.example .env   # fill in real values
 *   node lafcu_demo_server.js
 */

const express = require("express");
const fetch = global.fetch || require("node-fetch"); // Node 18+ has fetch built in
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(express.static(__dirname)); // serves lafcu_demo_index.html

const {
  DOCUSIGN_BASE_URI = "https://na3.docusign.net", // your account's base URI, from getUserInfo
  DOCUSIGN_ACCOUNT_ID,
  DOCUSIGN_WEB_FORM_ID, // "formId" of the published web form (from the Builder / getForm)
  DOCUSIGN_ACCESS_TOKEN // short-lived token for local testing only — see note below
} = process.env;

/**
 * Swap this for your real OAuth (Authorization Code) or JWT grant.
 * For local testing you can paste a short-lived access token (from
 * the OAuth playground or your existing integration) into .env as
 * DOCUSIGN_ACCESS_TOKEN and this function will just return it.
 */
async function getAccessToken() {
  if (!DOCUSIGN_ACCESS_TOKEN) {
    throw new Error(
      "No DocuSign access token configured. Set DOCUSIGN_ACCESS_TOKEN in .env " +
      "for local testing, or replace getAccessToken() with a real JWT grant."
    );
  }
  return DOCUSIGN_ACCESS_TOKEN;
}

/**
 * Stand-in for your real "core system" call. In production, resolve
 * this from the authenticated session (req.session.memberId), not
 * from anything the client posts.
 */
function lookupMemberAndTxn() {
  return {
    memberName: "Jordan Alvarez",
    accountNumber: "****4821",
    debitorCompanyName: "Streamline Fitness LLC",
    amountOfDebit: "49.99",
    firstDateOfDisputedDebit: "2026-08-17"
  };
}

app.post("/api/start-ach-stop-payment", async (req, res) => {
  try {
    const accessToken = await getAccessToken();

    // In a real app: trust the server-side lookup, not req.body,
    // for anything sensitive. Here we merge for demo flexibility.
    const core = lookupMemberAndTxn();
    const formValues = {
      MemberName: core.memberName,
      AccountNumber: core.accountNumber,
      DebitorCompanyName: core.debitorCompanyName,
      AmountOfDebit: core.amountOfDebit,
      FirstDateOfDisputedDebit: core.firstDateOfDisputedDebit,
      typeOfStopPayment: "Unauthorized",
      ReasonNotAuthorized: true,
      ...(req.body && req.body.formValues ? req.body.formValues : {})
    };

    const url = `${DOCUSIGN_BASE_URI}/v1/accounts/${DOCUSIGN_ACCOUNT_ID}/forms/${DOCUSIGN_WEB_FORM_ID}/instances`;

    const dsResponse = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ formValues })
    });

    if (!dsResponse.ok) {
      const errText = await dsResponse.text();
      throw new Error(`DocuSign createInstance failed (${dsResponse.status}): ${errText}`);
    }

    const { formUrl, instanceToken } = await dsResponse.json();

    // Per Docusign's Web form instance URLs doc:
    // https://[formUrl]#instanceToken=[instanceToken]
    const redirectUrl = `${formUrl}#instanceToken=${instanceToken}`;

    res.json({ redirectUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`LAFCU demo backend listening on http://localhost:${PORT}`);
  console.log(`Open http://localhost:${PORT}/lafcu_demo_index.html and set CONFIG.DEMO_MODE = false in that file.`);
});
