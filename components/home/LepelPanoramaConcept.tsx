import styles from "./LepelPanoramaConcept.module.css";

const PREVIEW_SOURCE =
  "/preview-assets/lepelpanorama/interactieve-lepelpanorama.html";

export function LepelPanoramaConcept() {
  return (
    <section
      className={styles.hero}
      aria-label="Conceptpreview van het interactieve lepelpanorama"
      data-lepelpanorama-concept
    >
      <iframe
        className={styles.frame}
        src={PREVIEW_SOURCE}
        title="Interactief lepelpanorama van De Notenman"
        sandbox="allow-scripts"
      />
    </section>
  );
}
