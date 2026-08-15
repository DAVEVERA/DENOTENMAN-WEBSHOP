import type { CSSProperties } from "react";
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from "react-email";
import type { Locale } from "@/lib/i18n";

export function BackInStockEmail({
  locale,
  preview,
  heading,
  intro,
  productName,
  buttonLabel,
  productUrl,
  footer,
}: {
  locale: Locale;
  preview: string;
  heading: string;
  intro: string;
  productName: string;
  buttonLabel: string;
  productUrl: string;
  footer: string;
}) {
  return (
    <Html lang={locale} dir="ltr">
      <Head />
      <Body style={styles.body}>
        <Preview>{preview}</Preview>
        <Section style={styles.outer}>
          <Container style={styles.container}>
            <Section style={styles.brandBar} />
            <Section style={styles.content}>
              <Text style={styles.brand}>DE NOTENMAN</Text>
              <Heading as="h1" style={styles.heading}>{heading}</Heading>
              <Text style={styles.text}>{intro}</Text>
              <Text style={styles.product}>{productName}</Text>
              <Button href={productUrl} style={styles.button}>{buttonLabel}</Button>
              <Text style={styles.footer}>{footer}</Text>
            </Section>
          </Container>
        </Section>
      </Body>
    </Html>
  );
}

const styles: Record<string, CSSProperties> = {
  body: { margin: 0, backgroundColor: "#f6f3ee", fontFamily: "Arial, Helvetica, sans-serif" },
  outer: { padding: "24px 12px" },
  container: { maxWidth: "600px", overflow: "hidden", border: "1px solid #ded7ca", borderRadius: "12px", backgroundColor: "#ffffff" },
  brandBar: { height: "5px", backgroundColor: "#e0b200" },
  content: { padding: "28px" },
  brand: { margin: 0, color: "#806600", fontSize: "13px", fontWeight: 700, letterSpacing: "0.08em" },
  heading: { margin: "12px 0", color: "#141414", fontSize: "26px", lineHeight: "1.25" },
  text: { color: "#625c53", fontSize: "16px", lineHeight: "1.55" },
  product: { margin: "22px 0", color: "#141414", fontSize: "19px", fontWeight: 700 },
  button: { display: "block", padding: "14px 20px", borderRadius: "8px", backgroundColor: "#e0b200", color: "#141414", fontSize: "16px", fontWeight: 700, textAlign: "center", textDecoration: "none" },
  footer: { margin: "24px 0 0", color: "#625c53", fontSize: "13px", lineHeight: "1.5" },
};

export default BackInStockEmail;
