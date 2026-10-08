import type { Metadata } from 'next';

import { PlainPage } from '../lib/plain-page';
import {
  BODY_SOURCES,
  LANGUAGE_SOURCES,
  MOVEMENT_SOURCES,
  PUBLISHED_FIGURES,
  type Source,
} from '../lib/sources';

// selodia.app/sources, added 8 October 2026.
//
// WHY IT EXISTS. The sourcing was already there and had never been visible to
// anybody outside the repository: three maintained reference lists, a research
// log, and a monthly scan that re-checks the primary sources against the rules
// in the code. Ruth asked for it to be published. It is a visibility job rather
// than a research job, which is the whole reason it was a day and a half.
//
// TWO RULES SHE SET, AND THEY SHAPE THE WHOLE PAGE:
//
//   1. DO NOT NAME HER ANYWHERE ON IT. Same decision as the privacy policy and
//      the app's legal text: the company speaks, not a person. Enforced by
//      `check-sources-page.mjs`, not by remembering.
//   2. THE RED-FLAG DETECTORS ARE "approved by the founder and not clinically
//      reviewed". Her words, used verbatim, because every softer phrasing
//      makes it sound reviewed by somebody.
//
// AND THE RULE THAT MATTERS MOST: state nothing that cannot be verified from
// the code or the configuration. That is why the second half of this page
// exists at all. A sources page listing only strengths is marketing wearing a
// lab coat, and anybody who would be persuaded by this page is exactly the
// person who would notice.

export const metadata: Metadata = {
  title: 'Sources · Selodía',
  description: 'What Selodía’s guidance is built from, and what it is not.',
};

/**
 * A citation and what it actually supports. The identifier is the point: it has
 * to be something a reader can look up.
 *
 * RETURNS AN ARRAY, NOT A <ul>. `PlainPage` renders an array body block as a
 * list and anything else as a paragraph, so returning the <ul> myself put a
 * list inside a <p>. That is invalid HTML, and React rejected the page at
 * hydration rather than quietly rendering it: "Hydration failed because the
 * server rendered HTML didn't match the client." Found in the browser console,
 * which is the only place it showed up, because the page looked correct.
 */
function list(sources: Source[]) {
  return sources.map((s) => (
    <span key={s.id}>
      {s.cite} <span style={{ opacity: 0.75 }}>{s.id}</span>
      <br />
      <span style={{ opacity: 0.85 }}>{s.supports}</span>
    </span>
  ));
}

export default function SourcesPage() {
  return (
    <PlainPage
      title="Sources"
      updated="8 October 2026"
      intro={
        <>
          <p>
            Selodía gives you figures, suggestions and explanations. This page says where they come
            from, and, just as plainly, where parts of it do not come from anywhere yet.
          </p>
          <p>
            One thing to be clear about before any of it. The work below supports the <em>rules</em>{' '}
            Selodía applies. It does not mean Selodía has been trialled. No study here was done on
            this app, and nothing on this page should be read as evidence that using it produces a
            result.
          </p>
        </>
      }
      sections={[
        {
          heading: 'How the figures are produced',
          body: [
            'Your calorie and protein targets are not written by the model that talks to you. They are calculated in code, from fixed rules, using your own measurements. The same inputs always give the same numbers, and those numbers are the same whoever is asking.',
            'That matters more than it sounds. It means a target cannot drift because of how a conversation went, and it means the rules can be pointed at sources, which is what the rest of this page does.',
          ],
        },
        {
          heading: 'Calories, protein and body measurements',
          body: [
            'What the daily targets are built from.',
            list(BODY_SOURCES),
          ],
        },
        {
          heading: 'Movement',
          body: [
            'What the movement guidance draws on. One of these is a negative finding, and it is here on purpose.',
            list(MOVEMENT_SOURCES),
          ],
        },
        {
          heading: 'How it talks about changing a habit',
          body: [
            'Selodía asks rather than advises, and it does not argue anybody into anything. That is a method with a literature behind it rather than a tone of voice.',
            list(LANGUAGE_SOURCES),
          ],
        },
        {
          heading: 'Published figures quoted directly',
          body: [
            'These are the only numbers Selodía quotes from an outside body by name. They are fixed text in the code, so they are reproduced here exactly as you would see them.',
            // An array, so PlainPage makes the list. Same reason as `list()` above.
            PUBLISHED_FIGURES.map((f) => (
              <span key={f.figure}>
                {f.figure} <span style={{ opacity: 0.75 }}>({f.body})</span>
              </span>
            )),
            'Published guidance changes. If one of these is out of date, write to hello@selodia.app and it will be corrected.',
          ],
        },
        {
          heading: 'How these are kept honest',
          body: [
            'The references above are kept in the repository alongside the code they support, not in a document that can drift away from it.',
            <>
              A scheduled scan re-checks the primary sources behind the calorie and protein rules and
              proposes changes without applying them, so nothing is altered by an automated process
              on its own. It runs on the first Monday of each month. <strong>It has not run yet:</strong>{' '}
              the first one is due in November 2026, and saying so is more use to you than a claim of
              a routine that has not started.
            </>,
          ],
        },
        {
          heading: 'What is not sourced, and this is the half that matters',
          body: [
            'A page like this that lists only strengths is not worth reading. Here is the rest of it.',
            <>
              <strong>The urgent-symptom prompts are approved by the founder and not clinically
              reviewed.</strong> Selodía recognises a small number of things it will not suggest
              waiting on, such as bleeding after the menopause, a new lump, or blood where there
              should not be any. There are eleven of these. They were approved by the founder, in
              writing, and <strong>no clinician has reviewed them</strong>. That is recorded in the
              code and it is recorded here. A clinician reviews them before anybody outside the
              company uses the app.
            </>,
            'The patterns it shows you never draw a conclusion. It will tell you a thing has happened five times and on which days, and it will say plainly when there are too few days to mean anything. It will not tell you that one thing caused another, because it does not know that and neither does anybody else from a handful of entries.',
            'What it says about your own data is description, not a finding. Nothing in Selodía has been validated as a predictor of anything.',
          ],
        },
        {
          heading: 'Not a medical device',
          body: [
            'Selodía does not diagnose, and it is not a medical device or a regulated clinical tool. It does not replace a GP, a nurse, a pharmacist or any other clinician, and it is not an emergency service.',
            'If something is worrying you, speak to a GP or call NHS 111. If it is an emergency, call 999.',
          ],
        },
        {
          heading: 'Something wrong on this page?',
          body: [
            <>
              A citation that does not support what it is said to support is a real problem and worth
              hearing about. Write to <a href="mailto:hello@selodia.app">hello@selodia.app</a>.
            </>,
          ],
        },
      ]}
    />
  );
}
