// Specs declare state via their nearest blueprint.json (defineWpConfigConsts +
// setSiteOptions + updateUserMeta steps). Keep this file as a thin re-export so
// spec imports stay stable as helpers come and go.
//
// API mocking convention: per-spec `page.route()` inside the spec's own
// `beforeEach` (or per-test, where one branch needs a different stub). No
// shared mock fixture, no cassette layer — most ported specs assert on UI
// shape, not response data, so they hit real APIs by design and match the
// Cypress posture for the same scope. The only spec that depends on a stubbed
// response today is `Draft/completions/completions.spec.ts`; copy that shape
// when a new spec needs to assert against a specific payload.
export { expect, test } from '@wordpress/e2e-test-utils-playwright';
