import { Stack } from 'expo-router';

// Settings is one route to the app's root stack - pushed over the tabs as a
// modal, as it always was - and a stack of its own inside, so each page can
// open and go back without touching the root navigator. This is what Ruth's IA
// brief asks for structurally: "Settings should simply become the hub ... Each
// opens its own page."
export default function SettingsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
