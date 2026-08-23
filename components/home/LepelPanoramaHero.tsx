import styles from "./LepelPanoramaHero.module.css";

const PANORAMA_SOURCE = "/lepelpanorama/interactieve-lepelpanorama.html";

export function LepelPanoramaHero() {
  return (
    <section
      className={styles.hero}
      aria-label="Interactief lepelpanorama van De Notenman"
      data-lepelpanorama-hero
    >
      <iframe
        className={styles.frame}
        src={PANORAMA_SOURCE}
        title="Interactief lepelpanorama van De Notenman"
        sandbox="allow-scripts"
      />
    </section>
  );
}
