import { useSignIn, useSignUp, useSSO } from '@clerk/expo';
import { router, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Laddoo } from '@/components/Laddoo';
import { PillButton } from '@/components/PillButton';
import { Txt } from '@/components/Txt';
import { palette } from '@/theme/colors';
import { fonts } from '@/theme/type';

// One screen for signing in or signing up: Google, Apple, or a code sent to email.
// No passwords. Matches the Clerk instance config (email code + Google + Apple).

type Step = 'email' | 'code';

/** Clerk errors carry a code and a friendly long message; fall back gracefully. */
function describe(err: unknown): { code?: string; message: string } {
  const e = err as { errors?: { code?: string; longMessage?: string; message?: string }[]; code?: string; longMessage?: string; message?: string };
  const first = e?.errors?.[0];
  return { code: first?.code ?? e?.code, message: first?.longMessage ?? first?.message ?? e?.longMessage ?? e?.message ?? 'Something went wrong. Please try again.' };
}

export default function SignIn() {
  const insets = useSafeAreaInsets();
  const { signIn, errors: signInErrors, fetchStatus: signInStatus } = useSignIn();
  const { signUp, errors: signUpErrors, fetchStatus: signUpStatus } = useSignUp();
  const { startSSOFlow } = useSSO();

  const [step, setStep] = useState<Step>('email');
  const [isNew, setIsNew] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string>();
  const [ssoBusy, setSsoBusy] = useState(false);
  const busy = signInStatus === 'fetching' || signUpStatus === 'fetching' || ssoBusy;

  const fieldError = step === 'email' ? (signInErrors.fields.identifier ?? signUpErrors.fields.emailAddress)?.message : (isNew ? signUpErrors.fields.code : signInErrors.fields.code)?.message;

  const goHome = async ({ session, decorateUrl }: { session: { currentTask?: unknown } | null; decorateUrl: (url: string) => string }) => {
    if (session?.currentTask) {
      setMessage('Your account needs one more step before you can continue.');
      return;
    }
    const url = decorateUrl('/today');
    if (url.startsWith('http') && Platform.OS === 'web') window.location.href = url;
    else router.replace(url as Href);
  };

  const sendCode = async () => {
    setMessage(undefined);
    const emailAddress = email.trim();
    if (!emailAddress) return setMessage('Enter your email to get a code.');

    // Try signing in; if there's no account yet, start a sign-up with the same email.
    const { error } = await signIn.emailCode.sendCode({ emailAddress });
    if (!error) {
      setIsNew(false);
      setStep('code');
      return;
    }
    if (describe(error).code !== 'form_identifier_not_found') return setMessage(describe(error).message);

    const created = await signUp.create({ emailAddress });
    if (created.error) return setMessage(describe(created.error).message);
    const sent = await signUp.verifications.sendEmailCode();
    if (sent.error) return setMessage(describe(sent.error).message);
    setIsNew(true);
    setStep('code');
  };

  const verify = async () => {
    setMessage(undefined);
    if (!isNew) {
      const { error } = await signIn.emailCode.verifyCode({ code: code.trim() });
      if (error) return setMessage(describe(error).message);
      if (signIn.status === 'complete') await signIn.finalize({ navigate: goHome });
      else setMessage(`Almost there (${signIn.status.replace(/_/g, ' ')}).`);
      return;
    }
    const { error } = await signUp.verifications.verifyEmailCode({ code: code.trim() });
    if (error) return setMessage(describe(error).message);
    if (signUp.status === 'complete') await signUp.finalize({ navigate: goHome });
    else setMessage(`We still need: ${signUp.missingFields.join(', ') || 'one more detail'}.`);
  };

  const social = async (strategy: 'oauth_google' | 'oauth_apple') => {
    setMessage(undefined);
    setSsoBusy(true);
    // Web: redirect the whole page. Browsers block the popup because Clerk has to talk to its
    // servers before opening it, which is too long after the tap.
    if (Platform.OS === 'web') {
      const origin = window.location.origin;
      const { error } = await signIn.sso({ strategy, redirectUrl: `${origin}/today`, redirectCallbackUrl: `${origin}/sso-callback` });
      if (error) {
        setMessage(describe(error).message);
        setSsoBusy(false);
      }
      return;
    }
    try {
      const { createdSessionId, setActive, signUp: pending } = await startSSOFlow({ strategy });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.replace('/today');
      } else if (pending?.status === 'missing_requirements') {
        setMessage(`We still need: ${pending.missingFields.join(', ')}.`);
      }
      // No session and nothing missing: the traveler closed the window. Not an error.
    } catch (err) {
      setMessage(describe(err).message);
    } finally {
      setSsoBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="dark" />
      <View style={[styles.body, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.hero}>
          <Laddoo size={110} />
          <Txt size={28} weight="bold" tight style={{ marginTop: 18, textAlign: 'center', lineHeight: 32 }}>
            {step === 'email' ? 'Hello, traveler' : 'Check your email'}
          </Txt>
          <Txt size={14} color={palette.cocoa} style={{ marginTop: 8, textAlign: 'center', maxWidth: 300, lineHeight: 21 }}>
            {step === 'email'
              ? "Sign in so Laddoo can remember how you like to travel, on every trip."
              : `We sent a 6-digit code to ${email.trim()}.`}
          </Txt>
        </View>

        {step === 'email' ? (
          <View style={{ gap: 12 }}>
            <PillButton variant="ink" onPress={() => social('oauth_google')} accessibilityLabel="Continue with Google">
              <View style={styles.socialRow}>
                <GoogleMark />
                <Txt size={16} weight="semibold" color={palette.cream}>
                  Continue with Google
                </Txt>
              </View>
            </PillButton>
            <PillButton variant="cream" onPress={() => social('oauth_apple')} accessibilityLabel="Continue with Apple">
              <View style={styles.socialRow}>
                <AppleMark />
                <Txt size={16} weight="semibold">
                  Continue with Apple
                </Txt>
              </View>
            </PillButton>

            <View style={styles.or}>
              <View style={styles.rule} />
              <Txt size={12.5} color={palette.cocoa}>
                or use email
              </Txt>
              <View style={styles.rule} />
            </View>

            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={palette.dune}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="send"
              onSubmitEditing={sendCode}
              style={styles.input}
              accessibilityLabel="Email address"
            />
            <PillButton variant="chip" label="Send me a code" onPress={sendCode} />
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <TextInput
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              placeholderTextColor={palette.dune}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={6}
              onSubmitEditing={verify}
              style={[styles.input, styles.codeInput]}
              accessibilityLabel="Verification code"
            />
            <PillButton label={isNew ? 'Create my account' : 'Sign in'} onPress={verify} />
            <Pressable onPress={() => (setStep('email'), setCode(''), setMessage(undefined))} hitSlop={10} accessibilityRole="button">
              <Txt size={13.5} weight="semibold" color={palette.cocoa} style={{ textAlign: 'center', marginTop: 4 }}>
                Use a different email
              </Txt>
            </Pressable>
          </View>
        )}

        {(fieldError || message) && (
          <Txt size={13} color={palette.terracotta} style={{ textAlign: 'center', marginTop: 14 }} accessibilityLiveRegion="polite">
            {fieldError ?? message}
          </Txt>
        )}
        {busy && <ActivityIndicator color={palette.ink} style={{ marginTop: 14 }} />}

        {/* Clerk's bot protection mounts here during sign-up. */}
        <View nativeID="clerk-captcha" />
      </View>
    </KeyboardAvoidingView>
  );
}

function GoogleMark() {
  return (
    <Svg width={18} height={18} viewBox="0 0 48 48">
      <Path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <Path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <Path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <Path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </Svg>
  );
}

function AppleMark() {
  return (
    <Svg width={16} height={18} viewBox="0 0 17 20">
      <Path
        fill={palette.ink}
        d="M14.1 10.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9s-2-.9-3.4-.9C3.6 4.8 2 5.8 1.1 7.3c-1.8 3.1-.5 7.8 1.3 10.3.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8s2 .8 3.4.8c1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.7-1-2.7-4.2zM11.5 3c.7-.9 1.2-2 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4z"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.peach },
  body: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between' },
  hero: { alignItems: 'center', marginTop: 20 },
  socialRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  or: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 },
  rule: { flex: 1, height: 1.5, backgroundColor: palette.creamLine },
  input: {
    backgroundColor: palette.cream,
    borderWidth: 1.5,
    borderColor: palette.creamLine,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 15,
    fontSize: 16,
    fontFamily: fonts.medium,
    color: palette.ink,
  },
  codeInput: { textAlign: 'center', fontSize: 26, letterSpacing: 10, fontFamily: fonts.bold },
});
