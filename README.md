# Artemius Radio

Independent static front end + Supabase database/auth/storage. Built with HTML, CSS and vanilla JavaScript.

## Safety / repository isolation

This implementation is placed in `radio/` on the `artemius-radio-build` branch of `Artemiusdyso/artemius`. It does not replace or edit the existing root pages. It is not live until the branch is merged and GitHub Pages is configured. To make a truly independent GitHub Pages site, create a new repository named `artemius-radio` and copy the contents of this folder to its root (the GitHub integration available here does not expose a create-repository action).

## Supabase setup

1. Create a NEW Supabase project for Artemius Radio. Do not reuse the existing Artemius shop project.
2. In SQL Editor, run `supabase/schema.sql`.
3. In Authentication, create your owner account (disable public sign-ups afterwards if available).
4. Copy the UUID for that user from Authentication > Users.
5. Run `insert into public.radio_admins (user_id) values ('YOUR_AUTH_USER_UUID');` after replacing the placeholder.
6. Get the project URL and publishable key. Put them in `config.js` as `supabaseUrl` and `supabaseAnonKey`. Only the publishable/anon key belongs in browser code; never expose a service-role or secret key.
7. Configure Supabase Auth URL allow-list for the final site URL and `admin.html`.
8. Deploy the site, then test login, upload, public playback, and deletion.

## Upload workflow

The Studio at `admin.html` accepts MP3 files up to 50 MB and optional JPG/PNG/WebP cover art up to 8 MB. Audio files are stored in Supabase Storage, not GitHub. Tracks remain private from the public listing until published; the audio bucket is public because this is a public radio, so anyone who obtains an audio URL can listen.

## Important limitations

- This is an on-demand public music library/player, not yet a 24/7 continuous radio server or live broadcasting console. AutoDJ and live radio require a compatible streaming service/encoder.
- Public MP3 streaming uses storage bandwidth. Free-tier limits apply and heavy listening may require paid bandwidth.
- This code intentionally does not include Supabase secrets.
- Before public broadcasting, confirm music, recording, sample and voice rights plus any applicable Belgian obligations.
