# Preflight

Preflight is an email-operated pre-IPO investment broker on Solana.

Private company equity from Anthropic, SpaceX, OpenAI, and Anduril trades on Solana through PreStocks SPV tokens and Tessera loan participation tokens. Tracking listings, calculating discounts against secondary marks, and signing DEX transactions normally demands multiple analytics tools and wallet prompts. Preflight runs the broker directly from your email inbox: you read market memos, reply in plain English to lock in a quote, and confirm to settle the trade on-chain.

## How it works

1. **Market ingestion**: Preflight polls PreStocks and Tessera APIs for new primary listings and price movements over 3%.
2. **Deal memos**: When an asset moves, the agent formats a short memo with current pricing, implied valuation, NAV premium or discount, and public comparables.
3. **Structured intent parsing**: You reply in natural language (for example, `BUY $100 ANTHROPIC`, `What stocks are available to purchase?`, or `Show my portfolio`). Gemini 3.6 Flash parses your reply against a strict Zod schema.
4. **Guaranteed quote**: Buy requests generate a 15-minute locked quote that details the asset, token count, price, fee, and estimated slippage.
5. **On-chain settlement**: Replying `CONFIRM` triggers settlement on Solana Devnet, returns a Solscan explorer link, and records the position in your portfolio. Replying `PASS` voids the order.

## Supported assets

### PreStocks

PreStocks issues SPL tokens backed 1:1 by SPVs holding private shares, trading with zero transfer fees:

- Anthropic (`ANTHROPIC`)
- SpaceX (`SPACEX`)
- OpenAI (`OPENAI`)
- Anduril (`ANDURIL`)
- Kalshi (`KALSHI`)
- Figure AI (`FIGUREAI`)
- Neuralink (`NEURALINK`)
- Polymarket (`POLYMARKET`)

### Tessera

Tessera issues institutional loan participation tokens on the Token-2022 standard, featuring on-chain Chainlink Proof of Reserve (PoR) verification and a 0.20% transfer fee:

- T-OpenAI (`T-OpenAI`)
- T-Kalshi (`T-Kalshi`)
- T-SpaceX (`T-SpaceX`)

## Email commands

You can send any of the following instructions in reply to a deal alert or directly to the agent address:

| Command    | Example                                  | Result                                                          |
| ---------- | ---------------------------------------- | --------------------------------------------------------------- |
| Buy        | `BUY $100 ANTHROPIC`                     | Locks in a 15-minute execution quote                            |
| Market     | `What stocks are available to purchase?` | Returns live prices, valuations, and symbols for all assets     |
| Confirm    | `CONFIRM`                                | Settles pending quote on Solana Devnet                          |
| Pass       | `PASS`                                   | Cancels pending quote                                           |
| Portfolio  | `PORTFOLIO`                              | Returns current positions, entry cost basis, and unrealized P&L |
| Sell       | `SELL 50% ANTHROPIC`                     | Generates exit quote for held position                          |
| Redemption | `How do I redeem?`                       | Details IPO and change-of-control payout schedules              |
| Opt out    | `UNSUBSCRIBE`                            | Halts automated alerts                                          |

## Architecture

```
                    ┌─────────────────────────┐
                    │  PreStocks & Tessera    │
                    │  REST APIs & Feeds      │
                    └───────────┬─────────────┘
                                │
                                ▼
                    ┌─────────────────────────┐
                    │ Aggregator & Move Check │
                    └───────────┬─────────────┘
                                │
                                ▼
                    ┌─────────────────────────┐
                    │ Gemini 3.6 Flash        │
                    │ Schema Intent & Memos   │
                    └───────────┬─────────────┘
                                │
                                ▼
                    ┌─────────────────────────┐
                    │ AgentMail Inbound &     │
                    │ Webhook Engine          │
                    └───────────┬─────────────┘
                                │
                                ▼
                    ┌─────────────────────────┐
                    │ Solana Devnet Execution │
                    │ & Upstash Redis Store   │
                    └─────────────────────────┘
```

## Tech stack

- **Runtime**: Bun 1.2.5
- **Framework**: Next.js 16.3.5 (App Router, Turbopack)
- **Interface**: React 19.2.8, Tailwind CSS v4, Lucide Icons
- **AI & Intent Extraction**: Google Gemini 3.6 Flash via Vercel AI SDK (`ai`, `@ai-sdk/google`)
- **Email Infrastructure**: AgentMail (`agentmail` SDK) with Svix webhook verification
- **Persistence**: Upstash Redis (idempotent webhook registry, subscriber profiles, trade intents, user portfolios)
- **Blockchain**: `@solana/web3.js` for Devnet transactions and mainnet Token-2022 supply inspection

## Getting started

### 1. Install dependencies

```bash
bun install
```

### 2. Configure environment variables

Create `.env.local` with the following variables:

```bash
# Google Gemini
GEMINI_API_KEY=your_gemini_api_key

# AgentMail
AGENTMAIL_API_KEY=your_agentmail_api_key
AGENTMAIL_DOMAIN=your_domain.agentmail.to

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://your-database.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_token

# Solana RPC (defaults to public devnet if omitted)
SOLANA_RPC_URL=https://api.devnet.solana.com

# Agent Keypair (base58 private key for settlement signing)
AGENT_SOLANA_PRIVATE_KEY=your_base58_private_key
```

### 3. Start development server

```bash
bun run dev
```

The application runs at `http://localhost:3000`.

### 4. Code formatting

To run Prettier with the repository configuration:

```bash
bun run format
```

## API reference

- `GET /api/tokens`: Lists active PreStocks and Tessera tokens with prices, implied valuations, and backing sources.
- `GET /api/portfolio`: Returns holdings, cost basis, current valuations, and unrealized profit and loss.
- `POST /api/webhooks/agentmail`: Webhook endpoint processing incoming emails from AgentMail.
- `POST /api/trade`: Direct trading endpoint for quoting and execution.
- `POST /api/cron/monitor`: Triggers a market scan for listing additions and price changes over 3%.
