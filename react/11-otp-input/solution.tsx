import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';

export type OtpInputProps = {
  length?: number;
  onComplete: (code: string) => void;
  /** Accessible name of the whole group. */
  label?: string;
};

export function OtpInput({ length = 6, onComplete, label = 'Verification code' }: OtpInputProps) {
  const [digits, setDigits] = useState<string[]>(() => Array(length).fill(''));
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const focus = (i: number) => {
    const el = inputs.current[Math.max(0, Math.min(length - 1, i))];
    el?.focus();
    el?.select();
  };

  /** Single place where digits change, so onComplete logic lives in one spot (no effect needed). */
  function commit(next: string[]) {
    const wasComplete = digits.every(Boolean);
    const isComplete = next.every(Boolean);
    setDigits(next);
    if (isComplete && (!wasComplete || next.join('') !== digits.join(''))) onComplete(next.join(''));
  }

  /** Writes `chars` starting at box `from`. Returns the index after the last written box. */
  function fillFrom(from: number, chars: string) {
    const next = [...digits];
    let i = from;
    for (const ch of chars) {
      if (i >= length) break;
      next[i++] = ch;
    }
    commit(next);
    return i;
  }

  function handleChange(i: number, value: string) {
    const typed = value.replace(/\D/g, '');
    if (typed === '') {
      if (value === '') commit(digits.map((d, j) => (j === i ? '' : d))); // user deleted the digit
      return; // a non-digit: ignore
    }
    if (typed.length > 2 || (typed.length === 2 && !digits[i])) {
      // Several digits at once: SMS autofill (iOS puts the whole code in the first box).
      focus(fillFrom(i, typed));
      return;
    }
    // Typing into a filled box: the browser gives "old+new" (or "new+old"). Keep the new digit.
    const digit = typed.length === 2 ? typed.replace(digits[i], '').slice(-1) || typed[1] : typed;
    fillFrom(i, digit);
    if (i < length - 1) focus(i + 1);
  }

  function handleKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case 'Backspace':
        e.preventDefault();
        if (digits[i]) {
          commit(digits.map((d, j) => (j === i ? '' : d)));
        } else if (i > 0) {
          commit(digits.map((d, j) => (j === i - 1 ? '' : d)));
          focus(i - 1);
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        focus(i - 1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        focus(i + 1);
        break;
    }
  }

  function handlePaste(i: number, e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '');
    if (!pasted) return;
    const after = fillFrom(i, pasted);
    focus(after >= length ? length - 1 : after);
  }

  return (
    <div role="group" aria-label={label} style={{ display: 'flex', gap: 8 }}>
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el: HTMLInputElement | null) => {
            inputs.current[i] = el;
          }}
          aria-label={`Digit ${i + 1} of ${length}`}
          value={digit}
          inputMode="numeric"
          pattern="[0-9]*"
          // Only the first box: lets iOS/Android offer the code from SMS.
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={(e) => handlePaste(i, e)}
          onFocus={(e) => e.target.select()}
          style={{ width: 40, height: 48, textAlign: 'center', fontSize: 22 }}
        />
      ))}
    </div>
  );
}
