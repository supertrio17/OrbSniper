# OrbSniper — Vencord Quest Monitor

OrbSniper now includes a custom Vencord userplugin. It adds a read-only Quest dashboard inside Vencord settings.

## Features

- Live overview of available, in-progress, ready-to-claim, claimed and expired Quests
- Quest progress read from Discord's already-loaded Quest store
- Reward summaries, including configured base Orb rewards
- Current Orb balance when Discord has already hydrated its local balance store
- Search and status filters
- New-Quest and ready-to-claim notifications
- Account-aware notification state (the in-memory snapshot resets when the Discord account changes)
- Refresh and open Discord's official Quest Home

## Safety and scope

This plugin is intentionally read-only. It does not enroll in Quests, submit progress, simulate gameplay, forge video/activity/stream heartbeats, change Discord's running-game state, claim rewards, access your token, or make Quest API requests.

Complete the advertised activity and claim rewards through Discord's normal interface. Discord's internal Quest stores are private implementation details and may change; when that happens, the dashboard can temporarily show no Quest data until updated.

This is a third-party Vencord userplugin, not an official Vencord plugin. Vencord's official plugin rules do not accept selfbots or API-spam automation.

## Install into a Vencord source checkout

Custom plugins require building Vencord from source.

1. Install Vencord from source using the official guide at https://docs.vencord.dev/installing/.
2. Open the Vencord checkout and navigate to src/userplugins.
3. Clone this repository as the plugin folder using: git clone --branch feature/vencord-quest-dashboard --single-branch https://github.com/supertrio17/OrbSniper.git orbSniper
4. From the Vencord repository root, run: pnpm build
5. Inject/reinstall that build if your Vencord setup requires it, then restart Discord.
6. Open Settings → Vencord → Plugins, enable OrbSniper, and open the plugin's settings page for the dashboard.

The Vencord build discovers the root index.tsx; the existing Electron application files in this repository are not loaded by the plugin.

## Settings

- Notify about new quests — notify once when a newly discovered available Quest appears after the first successful scan.
- Notify when a quest is ready to claim — notify when a Quest changes from in progress to completed.

Notifications are local to the running client. The status snapshot is kept in memory and is cleared when the plugin stops or the account changes.

## Troubleshooting

- No quests detected: open Discord's Quest Home, wait for its list to load, then press Refresh in the dashboard.
- Old or missing progress: use Refresh; Discord controls when its local Quest store updates.
- No Orb balance: the plugin only displays an already-loaded local balance. It deliberately does not request one.
- Plugin does not appear: check that the cloned folder is directly under src/userplugins/orbSniper and contains index.tsx at its root.

## Credits

The original OrbSniper desktop application remains in this repository. The Vencord dashboard is a separate, read-only implementation. The repository retains the original MIT license and upstream copyright notice.
