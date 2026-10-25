# 11 · OTP / verification code input

**Difficulty:** Medium–Hard · **Time:** 40 min · **Similar to:** GreatFrontEnd *Auth Code Input*, the 2FA screens of Stripe, Google and banking apps

## Why companies ask this

Every login and payment flow has one, and most of them are annoying: paste doesn't work, Backspace gets stuck, SMS autofill fills only the first box, and screen readers announce "edit text, edit text, edit text". Interviewers use it to test **focus management, keyboard handling, paste, mobile autofill and accessibility**, all in a small component.

## Task

Build `<OtpInput />` in `index.tsx`.

```tsx
<OtpInput length={6} onComplete={(code) => verify(code)} />
```

## Requirements

**Markup**
1. One `<input>` per digit, inside an element with `role="group"` and `aria-label` = `label` (default `"Verification code"`).
2. Each input has `aria-label="Digit N of LENGTH"` (e.g. `Digit 1 of 6`) and `inputMode="numeric"`.
3. **Only the first** input has `autoComplete="one-time-code"`. This makes iOS/Android offer the code from the SMS.

**Typing**
4. Typing a digit fills the box and moves focus to the next box.
5. Non-digits are ignored.
6. Typing into a filled box **replaces** its digit. The change event may contain `"15"` (old digit + new) or `"7"` (the whole content was selected and replaced). Either way the box ends up with the new digit.
7. Several digits arriving in one change event (SMS autofill puts the whole code into the first box) fill from that box onward.

**Keyboard**
8. `Backspace` on a filled box clears it, and focus stays.
9. `Backspace` on an empty box clears the **previous** box and moves focus there.
10. `ArrowLeft` / `ArrowRight` move focus.

**Paste**
11. Pasting into **any** box takes the digits from the clipboard text (`"12 34-56"` → `123456`) and fills from that box onward. Extra digits are dropped. Focus moves to the box after the last filled one (or the last box).

**Completion**
12. Call `onComplete(code)` when all boxes become filled, and again when the complete code **changes** (a digit is replaced, or the code is completed again after an edit). Don't call it if nothing changed.

## Edge cases interviewers probe

- Why not `maxLength={1}`? (It would block SMS autofill, which delivers the whole code into the first box.)
- Why `inputMode="numeric"` and not `type="number"`? (`type="number"` allows `e`, `+`, `-`, shows spinners, and drops leading zeros.)
- How does a screen reader user know where they are? (`Digit 3 of 6` labels plus a group label.) Would one input with CSS letter-spacing be more accessible?
- Calling `onComplete` from a `useEffect` vs from the event handler: what goes wrong with StrictMode or with re-renders?

## Follow-ups

- Auto-submit: what if the parent shows an error and wants to clear the boxes? Controlled (`value`/`onChange`) vs uncontrolled API design.
- WebOTP API (`navigator.credentials.get({ otp: { transport: ['sms'] } })`) on Android Chrome.
- RTL languages (Persian/Arabic): should the digit order flip? (No. Digits are left-to-right even in RTL, so set `dir="ltr"` on the group.) And what about Persian digits `۱۲۳` typed on a Persian keyboard? Normalize them to `123`.
- Rate limiting and "resend code" timers.

## Run

```bash
npm test react/11-otp-input
npm run test:solution react/11-otp-input
npm run dev   # then open "react / 11-otp-input"
```
