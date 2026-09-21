const { withMainActivity } = require('@expo/config-plugins');

// WHERE THE HEALTH CONNECT PRIVACY LINK ACTUALLY LANDS (21 September 2026).
//
// react-native-health-connect already puts the two required filters in the
// manifest: the rationale action on MainActivity for Android 13, and a
// VIEW_PERMISSION_USAGE activity-alias for Android 14. So when somebody taps
// the privacy link in the Health Connect permission dialog, Selodía opens.
//
// AND OPENS ON CHAT, which is the whole problem. The intent carries an ACTION
// and no data, and nothing in JavaScript can read an intent's action - React
// Native's Linking gives you a URL or nothing. So the app started, showed the
// conversation, and the person who had just asked "what will you do with my
// health data" got a chat screen. Google rejects that at review, and rightly:
// the link led nowhere useful.
//
// THE FIX IS FOUR LINES OF KOTLIN AND NO MORE. The intent is rewritten, before
// React ever sees it, into the ordinary deep link `selodia://health-data`.
// After that expo-router does what it already does with any deep link and lands
// on app/health-data.tsx. Nothing else in the app needs to know this happened.
//
// IT THROWS RATHER THAN SILENTLY DOING NOTHING. A config plugin that fails to
// find its anchor and shrugs produces a build that looks fine and fails review
// weeks later, which is the worst possible outcome for a Play Store blocker.

const RATIONALE = 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE';
const USAGE = 'android.intent.action.VIEW_PERMISSION_USAGE';
const MARKER = 'routeHealthRationale';

const HELPER = `
  /**
   * Health Connect opens this app with a bare action and no data when somebody
   * taps the privacy link in its permission dialog. Turning that into the
   * app's own deep link is what lets the router land on the explanation
   * screen instead of the conversation. Added by plugins/with-health-rationale.js.
   */
  private fun ${MARKER}(candidate: android.content.Intent?) {
    val action = candidate?.action ?: return
    if (action == "${RATIONALE}" || action == "${USAGE}") {
      candidate.action = android.content.Intent.ACTION_VIEW
      candidate.data = android.net.Uri.parse("selodia://health-data")
    }
  }

  override fun onNewIntent(newIntent: android.content.Intent) {
    ${MARKER}(newIntent)
    super.onNewIntent(newIntent)
  }
`;

const withHealthRationale = (config) =>
  withMainActivity(config, (cfg) => {
    const { language, contents } = cfg.modResults;

    if (language !== 'kt') {
      throw new Error(
        `with-health-rationale: MainActivity is ${language}, and this plugin only writes Kotlin. ` +
          'The Health Connect privacy link will open the app on Chat until this is updated.'
      );
    }

    // Already applied - prebuild runs more than once.
    if (contents.includes(MARKER)) return cfg;

    const onCreate = contents.match(/override fun onCreate\(([^)]*)\)\s*\{/);
    if (!onCreate) {
      throw new Error(
        'with-health-rationale: could not find onCreate in MainActivity, so the Health Connect ' +
          'privacy link would silently open the app on Chat and fail Play review. ' +
          'Check the Expo template and update plugins/with-health-rationale.js.'
      );
    }

    const at = onCreate.index + onCreate[0].length;
    const call = `\n    ${MARKER}(intent)\n`;

    cfg.modResults.contents =
      contents.slice(0, at) + call + contents.slice(at).replace(/\n\}\s*$/, `\n${HELPER}\n}\n`);

    if (!cfg.modResults.contents.includes(MARKER + '(intent)')) {
      throw new Error('with-health-rationale: the rewrite did not apply cleanly.');
    }

    return cfg;
  });

module.exports = withHealthRationale;
