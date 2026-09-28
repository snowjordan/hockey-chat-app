# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Database migrations

Before deploying the editable industry field, run
`supabase/migrations/20260928000000_add_custom_industry.sql` in the Supabase SQL
editor (or apply it through your migration workflow). This adds a custom industry
to business listings and makes the preset industry optional. Existing preset
selections are preserved; listing access continues to use existing policies.

### Main and spare teams

Apply `supabase/migrations/20260928010000_player_team_settings.sql` before deploying
team settings. The app uses `profiles` for players, `team_members` for the main
team, and the existing `sub_team_preferences` for spare teams. Existing spare
preferences become visible below team rosters. `profiles.active_team_id` stores
the team whose schedule and tonight's roster the player views.

The migration adds `save_player_teams`, which validates the signed-in player or
league administrator and saves all team settings in one transaction. It preserves
an existing main membership's ID and rejects ambiguous multiple main memberships.
It depends on the existing `is_league_admin()` function. Apply both migrations
listed above when deploying these changes together.

Verification: `node --test src/utils/teamHelpers.test.mjs` and `npm run build`.
After applying the migration, check saving main/spare teams, reloading the profile,
switching the viewing team, and removing a spare team. Confirm that one player
cannot save another player's settings and that admins can edit players.

Spare-team viewing shows that team's schedule and roster; RSVP controls remain
available when viewing the player's main team. Team-specific spare call-up RSVPs
are not introduced by this migration.
