# Artemius Radio

Independent static front end + Supabase database/auth/storage. Built with HTML, CSS and vanilla JavaScript.

## Current setup

- GitHub repository: `Artemiusdyso/artemius-radio`
- Supabase project: `Artemius Radio` (`cflecltrnyqugnmsvfke`), region `eu-west-1`
- Database tables and row-level security: installed
- Storage buckets: `radio-audio` and `radio-covers`
- Browser config: connected using the public publishable key
- GitHub Pages workflow: `.github/workflows/pages.yml`

The existing `Artemius shop` Supabase project and original `artemius` website have not been changed.

## Final launch steps

1. In GitHub, open Settings > Pages for this repository and select **GitHub Actions** as the build/deployment source.
2. In Supabase Authentication > Users, create the owner account using your chosen email and a strong password. Do not share the password in chat.
3. Copy that account's UUID from Authentication > Users.
4. In Supabase SQL Editor, run the following after replacing the placeholder with that UUID:
   `insert into public.radio_admins (user_id) values ('YOUR_AUTH_USER_UUID');`
5. In Supabase Authentication > URL Configuration, set the Site URL to the final GitHub Pages URL and add that URL to Redirect URLs.
6. Open the deployed `admin.html`, sign in, and upload a test MP3.

Do not put a Supabase service-role key or secret key into GitHub. The public publishable key in `config.js` is designed for browser use; row-level security restricts changes to authorized radio admins.

## Upload workflow

The Studio at `admin.html` accepts MP3 files up to 50 MB and optional JPG/PNG/WebP cover art up to 8 MB. Audio files are stored in Supabase Storage, not GitHub. The public audio bucket allows listening by anyone who has the audio URL; publish/unpublish controls the public track listing.

## Important limitations

- This is an on-demand public music library/player, not yet a 24/7 continuous radio server or live broadcasting console. AutoDJ and live radio require a compatible streaming service/encoder.
- The project creation quote was $0/month. Supabase free-tier quotas still apply, and heavy storage/bandwidth use may require a paid plan. No paid add-ons were selected.
- Before public broadcasting, confirm music, recording, sample and voice rights plus any applicable Belgian obligations.
