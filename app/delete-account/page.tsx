import type { Metadata } from 'next';

import { PlainPage } from '../lib/plain-page';

// selodia.app/delete-account, added 2026-09-19.
//
// GOOGLE PLAY REQUIRES THIS PAGE. An app that lets people create an account
// must give a web link where they can ask for the account and its data to be
// deleted WITHOUT reinstalling the app - somebody who has already uninstalled
// it cannot reach Settings. The link goes in the Data Safety form.
//
// The email route is handled by hand: the request must come from the address
// on the account, and deleting that user in Supabase Auth cascades every table
// (the same end state as the in-app button). The steps are in
// mobile/SELODIA_STORE_SUBMISSION.md.

export const metadata: Metadata = {
  title: 'Delete your account — Selodía',
  description: 'How to delete your Selodía account and all of its data.',
};

export default function DeleteAccountPage() {
  return (
    <PlainPage
      title="Delete your account"
      intro={<p>You can delete your Selodía account and everything in it at any time. There are two ways.</p>}
      sections={[
        {
          heading: 'In the app',
          body: [
            'Open Settings and choose Delete my account. It happens straight away.',
            'If you would like a copy first, use Prepare my data under Your data in Settings before you delete.',
          ],
        },
        {
          heading: 'Without the app',
          body: [
            <>
              Email <a href="mailto:hello@selodia.app?subject=Delete%20my%20account">hello@selodia.app</a> with
              the subject “Delete my account”. Send it from the email address you signed up with, so we know
              the request is yours.
            </>,
            'We will reply to confirm, and delete the account within 30 days. It is usually much sooner.',
          ],
        },
        {
          heading: 'What is deleted',
          body: [
            'Everything. Your account and sign-in, your profile, and every log, measurement, conversation, plan, note and photo. Nothing is kept.',
            'Encrypted backups held by our providers roll off on their own schedule, within 30 days.',
            'Once it is done it cannot be undone, and none of it can be recovered.',
          ],
        },
        {
          heading: 'Deleting only some of it',
          body: [
            'You do not have to delete your account to remove something. Any single entry can be deleted from its own row in the app.',
          ],
        },
      ]}
    />
  );
}
