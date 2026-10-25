import type { ReactNode, RefObject } from 'react';

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  initialFocusRef?: RefObject<HTMLElement | null>;
};

export function Modal(props: ModalProps) {
  // TODO: implement. See README.md for the full spec.
  return props.open ? <div>TODO: implement Modal</div> : null;
}
