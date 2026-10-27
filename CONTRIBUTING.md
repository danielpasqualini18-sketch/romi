# Contributing

Romi is an early, self-hosted project. Start with a small issue or pull request.

1. Use Node.js 24+, `npm ci`, `npm run setup` and `npm run db:local`.
2. Start with `npm run dev`; create only fictional test records locally.
3. Run `npm test` and `npm run build:check` before submitting.
4. Document changed setup steps, schema migrations and data behaviour.

Do not commit personal records, exports, local databases, private Wrangler
configuration, Access identifiers, caregiver email lists or API credentials. Do not
include real baby/caregiver details in issues, screenshots or examples. Production
credentials are not needed to contribute. Keep tests independent of remote services
and avoid adding runtime dependencies without a concrete need.

Maintain the small phone-friendly interface, visible labels, shared-timer conflict
checks, fail-closed authentication and backup compatibility. Schema upgrades should
preserve existing records. Never edit an already-released migration to change an
existing deployment; add the next numbered migration instead.

Code contributions are offered under this project's MIT licence. Font assets retain
their own licences in public/fonts and THIRD_PARTY_NOTICES.md.
