# Buck Euchre AI Agent Playbook

Notes to future agents (and my future self) about this repo. Share freely with our successors.

## Environment basics
- Backend tests run inside the repo, but the app is dockerised. After rebuilding TypeScript, copy the compiled `backend/dist/backend` and `shared/dist` into the running container and restart it: `docker cp backend/dist/backend/. buckeuchre-backend:/app/dist/app`, `docker cp shared/dist/. buckeuchre-backend:/app/dist/shared`, `docker restart buckeuchre-backend`.
- Integration tests live in `backend/tests/integration/`. They expect the backend to be reachable at `http://localhost:3000` and assume deterministic behaviour when we control the shuffle/deck via the new test control endpoints.
- Use `PATH=$HOME/.nvm/versions/node/v20.19.5/bin:$PATH` when running npm commands so we are on Node 20.

## Test controls
- `/api/test/shuffle-seed` – set deterministic shuffle.
- `/api/test/deck` – provide an explicit 24-card sequence (array of card IDs in deal order).
- `/api/test/dealer` – set the initial dealer index.
- Our integration helpers now expose `setShuffleSeed`, `setCustomDeck`, `setDealerPosition`, and `resetTestControls`. Always call `resetTestControls()` in `afterEach` to avoid cross-test leakage.

## Integration helper utilities
- `bidAndDeclareTrump` drives bidding for a given winning bid and trump suit.
- `resolveFoldingPhase` moves the game through folding decisions using a map of position → bool.
- `playOutRound` automates playing a full round (bidding, trump, folding, trick play) and returns the final state plus the winning bidder position and dealer index. It is invaluable for multi-round scenarios.

## Data setup patterns
- Deterministic decks use `composeDeck` and constants like `FOLLOW_SUIT_DECK`, `DIRTY_CLUBS_DECK`, `TRICK_WINNER_DECK`. Add new deck constants as needed with the same helper so validation is consistent.
- When constructing specialised rounds, set the dealer via `setDealerPosition` before `setCustomDeck` so the right player leads.

## Common pitfalls
- Forgetting to copy built JS into the container after editing TypeScript leads to “code didn’t change” behaviour.
- Each deterministic test must restore test controls; missing `resetTestControls` will stack seeds/decks and cause flaky runs.
- Tests that expect socket errors should use `waitForSocketError(socket)` and emit the illegal action once – emitting twice before the first resolves can race.
- When waiting for sequential bids, guard for the phase changes properly (e.g., `waitForPhase` for `DECLARING_TRUMP` after the last pass).

## Future work ideas
- Add a helper to configure per-player hands instead of handcrafting full decks.
- Wrap `docker cp` + restart in a script to reduce manual steps.
- The win-condition test is still TODO; consider seeding scores via a test control endpoint or custom state injection.

Keep this doc updated so the next debug session starts faster!
