# AI Intelligence Workflow

The AI Intelligence workflow is the persistent operations layer between the Decision Engine and any public or internal action.

## Flow

1. **AI Scan** creates an `AiIntelligence` record from normalized fixture and decision-engine output.
2. **Operations Review** records a reviewer decision in `AiIntelligenceReview` and advances status.
3. **Subscriber Publishing Queue** creates `SubscriberPublication` drafts only after subscriber approval.
4. **Company Bets Queue** creates `CompanyBet` records only after company execution approval.
5. **Betting Ledger** records placed company bets in integer cents and settles outcomes audibly.
6. **Audit Logs** are written for every sensitive action.
7. **Executive Reporting** summarizes queue, publication, exposure, and ledger status.

## Statuses

AI intelligence status:

- `SCANNED`
- `QUALIFIED`
- `REQUIRES_REVIEW`
- `APPROVED_SUBSCRIBER`
- `APPROVED_COMPANY`
- `APPROVED_BOTH`
- `REJECTED`
- `PUBLISHED`
- `WITHDRAWN`
- `EXPIRED`

Subscriber publication status:

- `DRAFT`
- `SCHEDULED`
- `PUBLISHED`
- `WITHDRAWN`
- `EXPIRED`

Company bet status:

- `PENDING_APPROVAL`
- `APPROVED`
- `READY_TO_PLACE`
- `PLACED`
- `CANCELLED`
- `EXPIRED`
- `SETTLED`

Betting ledger result:

- `PENDING`
- `WON`
- `LOST`
- `VOID`
- `PARTIAL_WIN`
- `PARTIAL_LOSS`
- `CANCELLED`

## Endpoints

Admin and operations:

- `GET /api/admin/intelligence`
- `GET /api/admin/intelligence/:id`
- `GET /api/admin/intelligence/review-queue`
- `POST /api/admin/intelligence/:id/review`
- `GET /api/admin/intelligence/:id/history`
- `GET /api/admin/intelligence/executive-summary`

Subscriber publishing:

- `GET /api/admin/subscriber-publications`
- `POST /api/admin/intelligence/:id/subscriber-publication`
- `PATCH /api/admin/subscriber-publications/:id`
- `POST /api/admin/subscriber-publications/:id/publish`
- `POST /api/admin/subscriber-publications/:id/withdraw`
- `GET /api/subscriber/intelligence`
- `GET /api/subscriber/intelligence/:id`

Company bets:

- `GET /api/admin/company-bets`
- `GET /api/admin/company-bets/:id`
- `POST /api/admin/intelligence/:id/company-bet`
- `PATCH /api/admin/company-bets/:id`
- `POST /api/admin/company-bets/:id/approve`
- `POST /api/admin/company-bets/:id/mark-placed`
- `POST /api/admin/company-bets/:id/cancel`

Betting ledger:

- `GET /api/admin/betting-ledger`
- `GET /api/admin/betting-ledger/:id`
- `POST /api/admin/company-bets/:id/ledger`
- `POST /api/admin/betting-ledger/:id/settle`

## Security

- Admin and analyst roles may inspect the operations review queue.
- Only admin may publish subscriber intelligence, manage company bets, and settle ledger entries.
- Subscriber endpoints return only subscriber-safe publication fields.
- Investors and unauthenticated users are denied access to internal workflow endpoints.

## MCP Compatibility

Existing read tools such as `list_verified_selections`, `get_verified_selection`, `list_daily_ai_scan`, and internal read services should treat `AiIntelligence` plus `SubscriberPublication` as the future source of truth. Write tools should remain unavailable until explicit approval workflows are formalized for MCP callers.

## Notes

The workflow stores stake, exposure, returns, and profit/loss in integer cents. There is no direct balance editing in this workflow; settlement is recorded through immutable ledger entries and audited actions.
