import type { ReactNode } from "react";

type ModalProps = {
  title: string;
  children: ReactNode;
};

export function Modal({ title, children }: ModalProps) {
  return (
    <section className="modal-panel" role="dialog" aria-modal="true" aria-label={title}>
      <h2>{title}</h2>
      <div>{children}</div>
    </section>
  );
}
