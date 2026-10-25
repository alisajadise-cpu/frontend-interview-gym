import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OtpInput } from './index';

function setup(length = 6) {
  const onComplete = vi.fn();
  render(<OtpInput length={length} onComplete={onComplete} />);
  const box = (n: number) => screen.getByRole('textbox', { name: `Digit ${n} of ${length}` }) as HTMLInputElement;
  const values = () => Array.from({ length }, (_, i) => box(i + 1).value).join(',');
  const type = (n: number, value: string) => {
    box(n).focus();
    fireEvent.change(box(n), { target: { value } });
  };
  const key = (n: number, k: string) => fireEvent.keyDown(box(n), { key: k });
  const paste = (n: number, text: string) => {
    box(n).focus();
    fireEvent.paste(box(n), { clipboardData: { getData: () => text } });
  };
  return { onComplete, box, values, type, key, paste };
}

describe('OtpInput: markup', () => {
  it('renders one labelled numeric input per digit', () => {
    const { box } = setup();
    expect(screen.getAllByRole('textbox')).toHaveLength(6);
    expect(screen.getByRole('group', { name: 'Verification code' })).toBeInTheDocument();
    expect(box(1)).toHaveAttribute('inputmode', 'numeric');
    expect(box(1)).toHaveAttribute('autocomplete', 'one-time-code');
    expect(box(2)).not.toHaveAttribute('autocomplete', 'one-time-code');
  });
});

describe('OtpInput: typing', () => {
  it('fills the box and moves focus to the next one', () => {
    const { type, box, values } = setup();
    type(1, '4');
    expect(values()).toBe('4,,,,,');
    expect(box(2)).toHaveFocus();
  });

  it('ignores non-digits', () => {
    const { type, box, values } = setup();
    type(1, 'a');
    expect(values()).toBe(',,,,,');
    expect(box(1)).toHaveFocus();
  });

  it('typing into a filled box replaces its digit', () => {
    const { type, values } = setup();
    type(1, '1');
    type(1, '15'); // caret after the old digit
    expect(values()).toBe('5,,,,,');
    type(1, '7'); // whole digit selected and replaced
    expect(values()).toBe('7,,,,,');
  });

  it('many digits at once (SMS autofill) fill from that box', () => {
    const { type, values, onComplete } = setup();
    type(1, '123456');
    expect(values()).toBe('1,2,3,4,5,6');
    expect(onComplete).toHaveBeenCalledWith('123456');
  });
});

describe('OtpInput: keyboard', () => {
  it('Backspace on a filled box clears it and keeps focus', () => {
    const { type, key, box, values } = setup();
    type(1, '1');
    type(2, '2');
    box(2).focus();
    key(2, 'Backspace');
    expect(values()).toBe('1,,,,,');
    expect(box(2)).toHaveFocus();
  });

  it('Backspace on an empty box clears the previous one and moves back', () => {
    const { type, key, box, values } = setup();
    type(1, '1');
    type(2, '2');
    box(3).focus();
    key(3, 'Backspace');
    expect(values()).toBe('1,,,,,');
    expect(box(2)).toHaveFocus();
  });

  it('ArrowLeft / ArrowRight move focus', () => {
    const { key, box } = setup();
    box(3).focus();
    key(3, 'ArrowLeft');
    expect(box(2)).toHaveFocus();
    key(2, 'ArrowRight');
    key(3, 'ArrowRight');
    expect(box(4)).toHaveFocus();
  });
});

describe('OtpInput: paste and completion', () => {
  it('pasting a full code fills everything, focuses the last box and completes once', () => {
    const { paste, values, box, onComplete } = setup();
    paste(1, '123456');
    expect(values()).toBe('1,2,3,4,5,6');
    expect(box(6)).toHaveFocus();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('pasting into a middle box fills from there and strips separators', () => {
    const { paste, values, onComplete, box } = setup();
    paste(3, '12 34-56');
    expect(values()).toBe(',,1,2,3,4');
    expect(onComplete).not.toHaveBeenCalled();
    expect(box(6)).toHaveFocus();
  });

  it('calls onComplete only when the code becomes complete or changes', () => {
    const { type, key, box, onComplete } = setup(4);
    type(1, '1');
    type(2, '2');
    type(3, '3');
    expect(onComplete).not.toHaveBeenCalled();
    type(4, '4');
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenLastCalledWith('1234');

    box(4).focus();
    key(4, 'Backspace'); // incomplete again
    type(4, '9'); // complete again
    expect(onComplete).toHaveBeenCalledTimes(2);
    expect(onComplete).toHaveBeenLastCalledWith('1239');

    type(2, '2'); // same digit typed again: nothing changed
    expect(onComplete).toHaveBeenCalledTimes(2);
    type(2, '7'); // complete code changed
    expect(onComplete).toHaveBeenCalledTimes(3);
    expect(onComplete).toHaveBeenLastCalledWith('1739');
  });
});
