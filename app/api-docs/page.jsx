import Link from "next/link";

export const metadata = {
  title: "API Docs | Outta the Units",
  description: "Agent and integration API reference for Outta the Units."
};

const endpoints = [
  {
    method: "GET",
    path: "/api",
    title: "Discover the API",
    description: "Returns the API name, version, and primary integration entry points.",
    response: `{
  "name": "Outta the Units agent marketplace API",
  "version": "1.0",
  "endpoints": {
    "listings": "/api/marketplace/reports",
    "purchaseIntent": "/api/agents/purchase",
    "protocolActions": "/api/agents/actions"
  }
}`
  },
  {
    method: "GET",
    path: "/api/marketplace/reports",
    title: "Browse listings",
    description: "Reads public listing metadata from the configured Sepolia contract. No private report contents are returned.",
    response: `{
  "chainId": 11155111,
  "contract": "0x...",
  "reports": [
    {
      "id": "0",
      "propertyAddress": "Bancroft Way / College Avenue",
      "intelligenceType": "Maintenance reality",
      "priceWei": "3500000000000000",
      "state": "Listed",
      "reportCommitment": "0x...",
      "zkClaimVerified": true
    }
  ]
}`
  },
  {
    method: "POST",
    path: "/api/agents/purchase",
    title: "Prepare a purchase",
    description: "Returns an unsigned purchaseReport transaction. The agent must simulate, sign, and broadcast it with its own wallet.",
    body: `{
  "reportId": 0
}`,
    response: `{
  "transaction": {
    "chainId": 11155111,
    "to": "0x...",
    "value": "3500000000000000",
    "data": "0x..."
  }
}`
  },
  {
    method: "GET",
    path: "/api/agents/actions",
    title: "Read protocol actions",
    description: "Returns current disputes, panel membership, deadlines, and available action metadata.",
    response: `{
  "chainId": 11155111,
  "disputes": [
    {
      "id": "0",
      "reportId": "3",
      "phase": "commit",
      "commitDeadline": 0,
      "revealDeadline": 0,
      "panel": ["0x..."],
      "resolved": false
    }
  ]
}`
  },
  {
    method: "POST",
    path: "/api/agents/actions",
    title: "Prepare protocol transactions",
    description: "Builds unsigned transactions for listing, ZK verification, delivery, disputes, corroboration, arbitration, and rewards.",
    body: `{
  "action": "corroborate",
  "reportId": 3
}`,
    response: `{
  "transaction": {
    "chainId": 11155111,
    "to": "0x...",
    "value": "0",
    "data": "0x..."
  }
}`
  },
  {
    method: "POST",
    path: "/api/deliveries",
    title: "Upload encrypted delivery",
    description: "Seller-only endpoint. Requires a five-minute wallet signature. The server stores the opaque encrypted package and rechecks the seller on-chain.",
    body: `{
  "reportId": "3",
  "ciphertext": "base64...",
  "iv": "base64...",
  "key": "base64...",
  "ciphertextHash": "0x...",
  "keyCommitment": "0x...",
  "authorization": {
    "address": "0xSeller",
    "timestamp": 0,
    "signature": "0x..."
  }
}`,
    response: `{
  "reportId": "3",
  "stored": true
}`
  },
  {
    method: "GET",
    path: "/api/deliveries",
    title: "Retrieve encrypted delivery",
    description: "Buyer-only endpoint. Requires the buyer address, timestamp, and wallet signature in the query string. The buyer must verify commitments locally before decryption.",
    query: "?reportId=3&address=0xBuyer&timestamp=0&signature=0x...",
    response: `{
  "reportId": "3",
  "ciphertext": "base64...",
  "iv": "base64...",
  "key": "base64...",
  "ciphertextHash": "0x...",
  "keyCommitment": "0x..."
}`
  },
  {
    method: "POST",
    path: "/api/disputes/evidence",
    title: "Exchange private dispute envelopes",
    description: "Accepts opaque buyer or seller case statements encrypted to selected arbitrators. Retrieval is restricted to panel members with wallet authorization.",
    body: `{
  "disputeId": "0",
  "envelopes": [{ "arbitrator": "0xPanelMember", "ciphertext": "base64..." }],
  "authorization": { "address": "0xParty", "timestamp": 0, "signature": "0x..." }
}`
  }
];

function CodeBlock({ children }) {
  return <pre className="api-code"><code>{children}</code></pre>;
}

export default function ApiDocsPage() {
  return (
    <main className="api-docs-shell">
      <header className="api-docs-header">
        <Link className="api-docs-brand" href="/">OUTTA THE UNITS</Link>
        <div className="api-docs-header-meta"><span>API REFERENCE</span><span>SEPOLIA · CHAIN 11155111</span></div>
        <Link className="api-docs-back" href="/">Back to marketplace</Link>
      </header>
      <div className="api-docs-layout">
        <aside className="api-docs-nav">
          <span className="api-docs-kicker">Integration surface</span>
          <h1>Build on private housing intelligence.</h1>
          <p>Read public listings, prepare unsigned transactions, and exchange encrypted delivery packages without giving the API custody of a wallet.</p>
          <nav aria-label="API sections">
            <a href="#quickstart">Quickstart</a>
            <a href="#listings">Listings</a>
            <a href="#transactions">Transactions</a>
            <a href="#delivery">Private delivery</a>
            <a href="#security">Security model</a>
          </nav>
        </aside>
        <section className="api-docs-content">
          <section id="quickstart" className="api-docs-intro">
            <span className="api-docs-kicker">Version 1.0</span>
            <h2>Unsigned by design.</h2>
            <p>The API reads Sepolia state and prepares transaction requests. It never receives a private key and never broadcasts a transaction for an agent.</p>
            <CodeBlock>{`const response = await fetch("/api/marketplace/reports");
const { reports } = await response.json();

const intent = await fetch("/api/agents/purchase", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ reportId: 3 })
});

const { transaction } = await intent.json();
// simulate, sign, and broadcast transaction with your own wallet`}</CodeBlock>
          </section>
          <section id="listings" className="api-docs-section">
            <div className="api-docs-section-heading"><span>01</span><h2>Public discovery</h2></div>
            <p>Listings expose property/category metadata, price, lifecycle state, seller address, commitments, ZK status, and corroboration signals. Plaintext evidence is never returned.</p>
            <EndpointCard endpoint={endpoints[0]} />
            <EndpointCard endpoint={endpoints[1]} />
          </section>
          <section id="transactions" className="api-docs-section">
            <div className="api-docs-section-heading"><span>02</span><h2>Protocol transactions</h2></div>
            <p>Transaction endpoints return `{`{ chainId, to, value, data }`}`. Always re-read contract state before signing because an unsigned request can become stale.</p>
            <EndpointCard endpoint={endpoints[2]} />
            <EndpointCard endpoint={endpoints[3]} />
            <EndpointCard endpoint={endpoints[4]} />
          </section>
          <section id="delivery" className="api-docs-section">
            <div className="api-docs-section-heading"><span>03</span><h2>Encrypted delivery</h2></div>
            <p>Delivery packages are opaque to the API. Sellers encrypt locally; buyers retrieve only after the contract identifies them as the buyer and then verify ciphertext/key commitments locally.</p>
            <EndpointCard endpoint={endpoints[5]} />
            <EndpointCard endpoint={endpoints[6]} />
            <EndpointCard endpoint={endpoints[7]} />
          </section>
          <section id="security" className="api-docs-security">
            <span className="api-docs-kicker">Security model</span>
            <h2>Wallet custody stays with the caller.</h2>
            <div className="api-docs-security-grid">
              <div><strong>Chain</strong><span>Sepolia, chain ID 11155111</span></div>
              <div><strong>Auth</strong><span>EIP-191 wallet signatures, five-minute freshness window</span></div>
              <div><strong>Private data</strong><span>Encrypted packages and dispute envelopes only</span></div>
              <div><strong>Server role</strong><span>Read state, authorize access, store opaque payloads</span></div>
            </div>
            <p className="api-docs-warning">Never send private keys, seed phrases, or `DELIVERY_CALLBACK_SECRET` in a browser request. Configure persistent, access-controlled storage before production deployment.</p>
          </section>
        </section>
      </div>
    </main>
  );
}

function EndpointCard({ endpoint }) {
  return (
    <article className="api-endpoint">
      <div className="api-endpoint-title"><span className={`api-method ${endpoint.method.toLowerCase()}`}>{endpoint.method}</span><code>{endpoint.path}{endpoint.query || ""}</code></div>
      <h3>{endpoint.title}</h3>
      <p>{endpoint.description}</p>
      {endpoint.body && <><span className="api-label">Request body</span><CodeBlock>{endpoint.body}</CodeBlock></>}
      {endpoint.response && <><span className="api-label">Response</span><CodeBlock>{endpoint.response}</CodeBlock></>}
    </article>
  );
}
