import type { Metadata } from 'next';

import { PlainPage } from '../lib/plain-page';

// selodia.app/support, added 2026-09-19.
//
// THE APP STORE REQUIRES A SUPPORT URL, and it must lead to a way to get in
// touch. Kept short on purpose: a support page that promises response times or
// features the app does not have is a review note waiting to happen.

export const metadata: Metadata = {
  title: 'Support — Selodía',
  description: 'How to get help with Selodía.',
};

export default function SupportPage() {
  return (
    <PlainPage
      title="Support"
      intro={
        <p>
          Something not working, or a question about the app? Email{' '}
          <a href="mailto:hello@selodia.app">hello@selodia.app</a>. Every message is read by a person.
        </p>
      }
      sections={[
        {
          heading: 'Help us help you',
          body: [
            [
              'What you were doing when it went wrong.',
              'Your phone, and whether it is Android or iPhone.',
              'A screenshot, if you have one.',
            ],
            'Please do not send health details by email that you would not want in an inbox. We can look at your account with your permission instead.',
          ],
        },
        {
          heading: 'Your data',
          body: [
            'Take a copy of everything, or delete your account, from Settings in the app.',
            <>
              No longer have the app? See <a href="/delete-account">how to delete your account</a> by email.
            </>,
            <>
              What we hold and why is in the <a href="/privacy">privacy policy</a>.
            </>,
          ],
        },
        {
          heading: 'Not medical advice',
          body: [
            'Selodía is not a medical service and does not replace advice from your doctor. If you are worried about your health, please speak to a GP or call NHS 111.',
          ],
        },
      ]}
    />
  );
}
