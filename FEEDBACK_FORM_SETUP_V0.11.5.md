# LogTogether v0.11.5 — optional feedback form setup

v0.11.5 deliberately uses an external Google Form instead of adding a Firebase bug-report backend.

Recommended Google Form settings:

- Do not require sign-in unless your testers already expect that.
- Do not automatically collect email addresses.
- Suggested fields: `Bug / idea / confusion`, `What happened?`, `What did you expect?`, `Steps to reproduce`, `Device/browser`, and optional comments/contact.
- Tell testers not to paste account IDs, GPS routes, private workout details, medical information, or other sensitive data.

After creating the form, copy its public `https://forms.gle/...` link (or a `https://docs.google.com/forms/...` link).

For the packaged deploy script, save it once with:

```bash
mkdir -p ~/.config/logtogether
printf '%s\n' 'https://forms.gle/YOUR_FORM_ID' > ~/.config/logtogether/feedback-form-url.txt
```

Then rerun `./deploy.sh`. The script injects that public link into Hosting only. It does not create or use additional Firebase resources.

You may alternatively run:

```bash
LOGTOGETHER_FEEDBACK_FORM_URL='https://forms.gle/YOUR_FORM_ID' ./deploy.sh
```

If no form URL is configured, the Settings and Quick Guide feedback sections remain visible but the submission button is disabled; anonymous app-info copying still works.
