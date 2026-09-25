# Preflight

Preflight is an email-operated broker for PreStocks pre-IPO equity on Solana.

Private company shares in Anthropic, SpaceX, OpenAI, Anduril, and others trade on Solana through PreStocks Special Purpose Vehicle (SPV) tokens. Tracking liquidity, calculating discounts against secondary marks, and signing DEX transactions on mobile wallets creates friction for non-crypto investors. Preflight moves the broker into your inbox: you read market memos, reply in plain English to lock in an execution quote, and confirm to settle the trade on-chain.

## How it works

1. **Market ingestion**: Preflight polls the PreStocks API (`https://prestocks.com/api/prestocks`) for primary listings and price movements over 3%.
2. **Deal memos**: When an asset moves, the broker emails a valuation memo with the token price, secondary mark, NAV discount or premium, and implied valuation.
3. **Structured intent parsing**: You reply in plain English (`BUY $100 ANTHROPIC`, `What stocks are available to purchase?`, or `Show my portfolio`). Google Gemini 3.6 Flash extracts intent, symbol, and dollar size against a strict Zod schema.
4. **Locked quote via durable workflow**: Buy requests trigger `orderQuoteWorkflow` using Workflow SDK (`workflow-sdk.dev`). The workflow calculates price per token, estimated gas, and slippage, delivers a locked quote, and runs a durable `sleep('15m')` timer that expires unconfirmed quotes without holding server memory.
5. **On-chain settlement**: Replying `CONFIRM` runs `executeTradeWorkflow` on Solana Devnet, returns an explorer link, and records the position in your portfolio. Replying `PASS` voids the order.

## Supported assets

PreStocks issues SPL tokens backed 1:1 by SPVs holding private shares, trading with zero transfer fees:

- Anduril (`ANDURIL`)
- Anthropic (`ANTHROPIC`)
- Figure AI (`FIGUREAI`)
- Kalshi (`KALSHI`)
- Neuralink (`NEURALINK`)
- OpenAI (`OPENAI`)
- Polymarket (`POLYMARKET`)
- SpaceX (`SPACEX`)

## Email commands

Send any of the following instructions in reply to a deal alert or directly to the broker address:

| Command   | Example                                  | Result                                                          |
| --------- | ---------------------------------------- | --------------------------------------------------------------- |
| Buy       | `BUY $100 ANTHROPIC`                     | Locks in a 15-minute execution quote                            |
| Market    | `What stocks are available to purchase?` | Returns live prices, valuations, and symbols for all PreStocks  |
| Confirm   | `CONFIRM`                                | Settles pending quote on Solana Devnet                          |
| Pass      | `PASS`                                   | Cancels pending quote                                           |
| Portfolio | `PORTFOLIO`                              | Returns current positions, entry cost basis, and unrealized P&L |
| Sell      | `SELL 50% ANTHROPIC`                     | Generates exit quote for held position                          |
| Opt out   | `UNSUBSCRIBE`                            | Halts automated alerts                                          |

## Architecture

```
                    ┌─────────────────────────┐
                    │  PreStocks REST API     │
                    │  (prestocks.com/api)    │
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
                    │ Workflow SDK Engine     │
                    │ (workflow-sdk.dev)      │
                    │ 15m Sleep & Auto-Expiry │
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
- **Durable Workflows**: Workflow SDK (`workflow@4.8.9`, `workflow-sdk.dev`) for step-based orchestration, 15-minute quote timers (`sleep('15m')`), and automatic quote expiration
- **Email Infrastructure**: AgentMail (`agentmail` SDK) with webhook processing
- **Persistence**: Upstash Redis (idempotent webhook registry, subscriber profiles, trade intents, user portfolios)
- **Blockchain**: `@solana/web3.js` for Devnet transactions and wallet management

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

- `GET /api/tokens`: Lists active PreStocks tokens with prices, implied valuations, and contracts.
- `GET /api/portfolio`: Returns holdings, cost basis, current valuations, and unrealized profit and loss.
- `POST /api/webhooks/agentmail`: Webhook endpoint processing incoming emails from AgentMail.
- `POST /api/trade`: Direct trading endpoint for quoting and execution.
- `POST /api/cron/monitor`: Scans PreStocks for listing additions and price changes over 3%.
