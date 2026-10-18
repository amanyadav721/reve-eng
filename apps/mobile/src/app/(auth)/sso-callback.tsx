import { useClerk, useSignIn, useSignUp } from '@clerk/expo';
import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Laddoo } from '@/components/Laddoo';
import { Txt } from '@/components/Txt';
import { palette } from '@/theme/colors';

// Web only: Google and Apple sign-in redirect the whole page (browsers block the popup) and land
// here. We finish the sign-in or sign-up, then go to the traveler's day. On phones, useSSO()
// handles the return trip itself and this screen isn't used.
//
// This mirrors Clerk's <HandleSSOCallback>, written with @clerk/expo's hooks: importing that
// component from @clerk/react loads a second copy of Clerk that can't see our ClerkProvider.

type Navigate = (params: { session: { currentTask?: unknown } | null; decorateUrl: (url: string) => string }) => void;

const toApp: Navigate = ({ session, decorateUrl }) => {
  if (session?.currentTask) return router.replace('/sign-in');
  const url = decorateUrl('/today');
  if (url.startsWith('http')) window.location.href = url;
  else router.replace(url as Href);
};
const toSignIn = () => router.replace('/sign-in');

export default function SSOCallback() {
  const clerk = useClerk();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const ran = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!clerk.loaded || ran.current) return;
    ran.current = true;
    (async () => {
      const done = async (r: typeof signIn | typeof signUp) => {
        await r.finalize({ navigate: async (p) => toApp(p) });
      };

      if (signIn.status === 'complete') return done(signIn);
      // The Google/Apple account already has a Tagalong account: finish as a sign-in.
      if (signUp.isTransferable) {
        await signIn.create({ transfer: true });
        // The status changes after create(); read it fresh.
        return (signIn.status as string) === 'complete' ? done(signIn) : toSignIn();
      }
      // A new Google/Apple user: finish as a sign-up.
      if (signIn.isTransferable) {
        await signUp.create({ transfer: true });
        return (signUp.status as string) === 'complete' ? done(signUp) : toSignIn();
      }
      if (signUp.status === 'complete') return done(signUp);
      const existing = signIn.existingSession?.sessionId ?? signUp.existingSession?.sessionId;
      if (existing) return clerk.setActive({ session: existing, navigate: async (p) => toApp(p) });
      // Needs another step (second factor, new password…) or the provider was cancelled.
      setFailed(true);
      setTimeout(toSignIn, 1500);
    })().catch(() => {
      setFailed(true);
      setTimeout(toSignIn, 1500);
    });
  }, [clerk, clerk.loaded, signIn, signUp]);

  return (
    <View style={styles.root}>
      <Laddoo size={96} />
      <Txt size={16} weight="semibold" style={{ marginTop: 16 }}>
        {failed ? "That didn't finish. Taking you back…" : 'Signing you in…'}
      </Txt>
      {/* Clerk's bot protection may need this during sign-up. */}
      <View nativeID="clerk-captcha" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.peach },
});
