# App opportunity: a paid successor to Maestral

Researched 2026-10-17.

## Recommendation

Build a native, lightweight Dropbox client for macOS, using the retired open-source
Maestral project as the reference design, and sell it as a one-time purchase.

## Why this one

- **Real, recent gap.** Maestral, a popular lightweight Dropbox client for Mac, was archived
  by its developer at the end of June 2026. It keeps working only until its certificates
  expire. MacRumors, Daring Fireball, MacSparky and Michael Tsai all covered the retirement.
- **Nobody has picked it up.** None of Maestral's GitHub forks with recent activity has more
  than 2 stars. Coverage names only the official Dropbox client and iCloud Drive as
  alternatives, and users who chose Maestral did so because they find the official client bloated.
- **We are allowed to build on it.** Both the sync engine and the macOS app are MIT licensed.
  MIT permits commercial use and closed-source derivatives, provided the copyright notice ships
  with the product.
- **Clear room to improve.** The top open requests are files-on-demand ("Smart Sync"),
  crash fixes, sync progress in the menu bar, last-sync time, and confirmation before large
  deletions. Several popular closed issues were crashes in the Python app.

| Fact | Value |
| --- | --- |
| Maestral GitHub stars | 3,324 |
| Sync engine size | ~17,000 lines of Python |
| macOS app size | ~5,700 lines of Python |
| Open issues | 137 |
| Last release | v1.9.5, 2025-10-04 |

## Product plan

1. **Rewrite natively, don't repackage.** Maestral is Python and runs unsandboxed, which rules
   out the Mac App Store. A Swift app built on Apple's File Provider framework can be sandboxed
   and gets files-on-demand from the system for free.
2. **Port the hard-won logic, not the code style.** The valuable part is `sync.py`: conflict
   handling, content hashing, revision tracking and error recovery. Use it as the specification
   for the Swift engine and port its test cases.
3. **Ship the top requests in v1.** Files-on-demand, sync progress, last-sync time, and a
   confirmation step before mass deletions.
4. **Price.** One-time purchase. Sell on the Mac App Store and directly through Paddle or
   Lemon Squeezy for users who avoid the store.
5. **Later.** Google Drive and other providers were requested, and the same File Provider
   architecture could support them.

## Rules we must follow

- **Name and icon.** Dropbox's branding guide forbids "Dropbox" in the app name, names starting
  with "drop", and anything resembling the Dropbox logo. "for Dropbox" is only allowed to
  distinguish it from our other apps.
- **Production approval.** Dropbox reviews an app once it links 50 users, and can refuse at its
  sole discretion. After 50 users we have two weeks to get approval before new sign-ups freeze.
  Apply early.
- **MIT notice.** Include Maestral's copyright and license text in the app's acknowledgements.
- **Where reverse engineering fits.** Study Maestral from its source, which we have legally.
  Do not decompile the official Dropbox client or any other closed app to copy it. Use REA on
  our own builds, for example to compare releases or audit what we ship.

## Risks

- **Willingness to pay is unproven.** Maestral was free. Validate with a landing page and
  waitlist, posted where Maestral users gather, before building the full engine.
- **Platform risk.** Dropbox controls API access and could change terms or rate limits.
- **Free competitors.** The official Dropbox client and iCloud Drive cost nothing extra.
- **Sync engines are hard.** Data-loss bugs destroy trust. Budget heavily for testing.

## Other leads considered

- **MacUpdater replacement.** MacUpdater shut down on 2026-01-01 and its maker invited offers to
  license or buy the code. Its database server runs until 2026-12-31. The open-source competitor
  Latest is active and GPL licensed, and users say it covers fewer apps. Viable only by
  licensing CoreCode's code or building from scratch.
- **Sequel Pro replacement.** Rejected. Sequel Ace already fills that gap and is actively maintained.

## Sources

- [Daring Fireball: Maestral retired](https://daringfireball.net/linked/2026/07/06/maestral-retired)
- [MacRumors: Maestral will eventually stop working](https://www.macrumors.com/2026/07/07/free-dropbox-client-maestral-retired/)
- [Michael Tsai: Sunsetting Maestral](https://mjtsai.com/blog/2026/07/07/sunsetting-maestral/)
- [Maestral on GitHub](https://github.com/samschott/maestral)
- [Dropbox Developer Terms](https://www.dropbox.com/developers/reference/tos)
- [Dropbox Branding Guide](https://docs.dropboxapi.com/dropbox-api/docs/developer-resources/branding-guide)
- [n8n docs on Dropbox production approval](https://docs.n8n.io/integrations/builtin/credentials/dropbox.md)
- [AlternativeTo: MacUpdater discontinued and up for sale](https://alternativeto.net/news/2025/5/macupdater-to-be-discontinued-in-january-2026-code-and-technology-up-for-sale)
- [TidBITS on MacUpdater's end](https://tidbits.com/?p=72881)
