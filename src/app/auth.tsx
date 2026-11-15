import { Redirect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

// OAuth redirect target (hackerfeed://auth, <web origin>/auth). Hands the result back to the
// opener window on web, then returns to Home.
WebBrowser.maybeCompleteAuthSession();

export default function AuthRedirect() {
  return <Redirect href="/" />;
}
