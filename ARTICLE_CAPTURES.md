# Selodía Article Captures

Running log of build moments worth writing about later. Updated as moments surface and at closing ceremony each session.

---

## 18 September 2026 — A rule you ask a model to follow is not a guard

The voice path kept writing the same dinner five times. The instinct was to tell the model more firmly not to, and that is what had already been tried. The fix was to move the check to the moment the row is created, where it cannot be talked out of. It became a standing principle: a guard belongs at the write, not in the prompt.

---

## 18 September 2026 — Item 12 was never the tab strip's fault

A bug had been logged against the tab strip and reasoned about on that basis for days. It turned out the tab strip was innocent and the real cause was somewhere else entirely. Worth writing about because the cost was not the fix, it was every hour spent thinking about the wrong thing.

---

## 18 September 2026 — The wasted room was between things, not around them

A screen felt cramped, and the obvious move was to shave the outer margins. That made it worse. The space being wasted was the gaps between elements, not the frame around them, and once that flipped the whole layout relaxed without losing a single pixel of the border.

---

## 19 September 2026 — Two sentences that now appear in every prompt that talks about a person

Observe first, and prefer curiosity to certainty. Both were written as principles and then pushed into every prompt in the app that speaks to or about a user. It is the closest the build has come to writing down what the product actually believes, and it happened as a code change rather than a manifesto.

---

## 19 September 2026 — Asked about iron, the app offers to watch it rather than closing the door

The safe answer to a question about a nutrient is a disclaimer. The better answer turned out to be an offer: it cannot diagnose, but it can start paying attention to that thing from now on. That reframing is the difference between an app that refuses and an app that is useful, and it came out of one bug report about a flat response.

---

## 20 September 2026 — Principle 16: no photography of bodies, ever

Written down as a hard rule, not a preference, for an app built for women over forty learning to read their own bodies. Almost every competitor in the category does the opposite. This is the kind of decision that is easy to make on day one and very hard to hold when someone later asks for a "before and after" feature.

---

## 20 September 2026 — The report failed on her own Almanac

The report builder worked on every test and then fell over on Ruth's real data, because her Almanac entries are not plain text. A whole feature had been built and verified against data that was tidier than the real thing. The lesson stuck: test on the actual account, not a clean one.

---

## 20 September 2026 — Measured first, then fixed

Rather than guessing at why the app felt slow, the work started by measuring. The answer was that the app kept asking who the user was, over and over. Measuring first felt slower for about twenty minutes and then saved the whole afternoon. It became a habit and paid off again three days later.

---

## 21 September 2026 — No gesture in this app has ever fired

A missing provider at the very top of the tree meant that every swipe, drag and long-press in the entire app had silently never worked. Not broken, never wired. Nobody had noticed because nobody had tried, and the app looked completely normal. A whole category of interaction can be absent without leaving a mark.

---

## 21 September 2026 — "Been shattered ever since" means every day, including that one

Ruth read an example back and corrected it: if someone says they have been shattered ever since their period started, they mean all of those days, the first one included. The code had been treating it as the days after. One sentence from the person who actually speaks this way reshaped how the whole feature reads dates.

---

## 21 September 2026 — Two facts, on two days

Ruth asked the question that stopped a bad design: how will it tell the difference between feeling tired today and logging that a period started last Tuesday? The honest answer was that it would not have. A period and a feeling became two separate facts with their own dates, which is obvious in hindsight and was not obvious the day before.

---

## 21 September 2026 — A drink with calories in it is food

Bug 17 turned out to be a definitional problem rather than a coding one. A coffee is hydration. A coffee with milk in it is hydration and food. A glass of wine is food and not hydration at all. Getting the categories right took longer than writing the code, and the code was trivial once the categories were right.

---

## 22 September 2026 — Opening the app is not a mount

The chat scrolled violently through its whole history every time the app opened. It was fixed three times and reported broken three times, because all three fixes ran when the screen was created and the chat screen is the first tab and never gets created twice. The fourth attempt worked. The expensive part was not the bug, it was the wrong mental model surviving three rounds of confident fixing.

---

## 22 September 2026 — "Surely we need to know this first"

Dropbox was full and a plan was being designed around an assumption about whether a shared folder could be read without taking up quota. Ruth stopped it: find out first. The experiment took ten minutes, the answer changed the entire approach, and a day of designing around an unknown was avoided.

---

## 22 September 2026 — The library was being stored twice

Surveying rather than guessing turned up the real problem: 265.8 GB, because the exercise library was sitting there twice over. Moving it to Backblaze took the storage bill from £14.40 a month to about 66p. The saving came from looking properly, not from any clever engineering.

---

## 22 September 2026 — A key restricted to one bucket cannot list buckets

Advice was given to restrict an access key to a single bucket, for safety. That advice then broke the very setup tool that had given it, which asked the service to list buckets and was told there were none. Ruth's report was perfect: "your form says there's no bucket but there is: selodia-library."

---

## 22 September 2026 — "It was just a scope growing to the size I wanted but didn't dare build at first"

The build was described back to her as having suffered feature creep. She rejected the framing completely, and she was right: nothing new had been added, the scope had simply grown into the size she had always wanted and had not felt allowed to aim for at the start. That is a different thing entirely, and probably the most honest sentence anyone has said about this project.

---

## 22 September 2026 — Rest is something the body does, not something that happens when you stop

The Health Flower had a Recovery petal that only filled if a workout was logged, which meant that genuinely resting registered as doing nothing. Reframing rest as an active thing the body does, fed by sleep and by real rest days, fixed the maths and the message at the same time.

---

## 22 September 2026 — "Otherwise why is it in the log list"

Hydration sat in the list of things you can log, with no way to log it in one tap. Ruth's argument for fixing it was six words long and unanswerable. Also, it was still called Water, and hydration is the better word, so it got both in the same change.

---

## 23 September 2026 — The D-U-N-S number had been sitting in Promotions since the 10th

The one thing blocking the Android application had arrived by email thirteen days earlier and been filed by Gmail into the Promotions tab. Ruth's reaction was "feel so dumb", and then the more accurate follow-up: she had been checking regularly, it was just hidden. The blocker was not bureaucracy, it was an inbox filter.

---

## 23 September 2026 — The branch holding four days of work does not exist

A branch with four days of store-submission work on it could not be found, which is a genuinely sickening ten minutes. It turned out the work had been merged days earlier and was already live. Worth writing about for the feeling, and for how quickly a missing branch reads as lost work.

---

## 23 September 2026 — Every row was asking who you are

Database performance advisors had never been run, only the security ones. Running them found forty-one security rules that re-checked the user's identity separately for every single row they touched. The fix is a pair of brackets, repeated forty-one times. Nothing was visibly wrong beforehand.

---

## 23 September 2026 — A fix that had never worked, and nobody could have known

The headphone routing fix built on 18 September had never once worked on Android 12 or newer, because a permission it needed was never requested. Proving it meant downloading the audio library's compiled package and reading its manifest. Some bugs cannot be found by testing, only by reading what the dependency actually declares.

---

## 23 September 2026 — Two of the five tabs did not exist, and screenshots found it

The job was to photograph every screen for a flow map. Ten of the Log screenshots came back showing the Chat screen instead, because the web build's tab bar was still the starter template with three tabs in it. The phone was never affected. A documentation task found a bug that no amount of using the app would have surfaced.

---

## 23 September 2026 — Seventeen icon fonts nobody uses

Two files imported an icon library by its index rather than the specific icon set they needed, which quietly bundled every icon family in the package. The app uses two. Twenty were being downloaded and loaded at startup, one of them from the very first screen. Three megabytes for a one-line mistake in two places.

---

## 23 September 2026 — The demo account was the wrong thing to photograph

Screenshotting every screen meant looking at the demo account properly for the first time, and the chat thread was a frank conversation about not eating and not having been to the loo in five days. Exactly what the app is for, and exactly wrong as the first image in a store listing. The uncomfortable question underneath: the honest screenshots are the ones you cannot use to sell it.

---

## 23 September 2026 — The flat white that went nowhere

A clean demo message was sent through the real app: chicken salad with avocado and a flat white. The reply said the flat white was added. It was not. It reached neither the itemised list nor the hydration log, despite the drinks rule already knowing what a flat white is. Two days of fixes in this exact area, and the bug was found by trying to take a nice photograph.

---

## 23 September 2026 — Backslashes, six times in one week

Six separate times in a week, a regular expression written through a shell command arrived in the file with its backslashes eaten or turned into invisible control characters. Each time it looked like a logic bug. Each time it was a typing bug that happened between the keyboard and the disk. The fix is a rule now: never write a regex through a shell.

---
