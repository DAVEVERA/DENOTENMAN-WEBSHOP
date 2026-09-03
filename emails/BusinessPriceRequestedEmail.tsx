import type { CSSProperties } from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "react-email";

export type BusinessPriceRequestedEmailProps = {
  preview: string;
  companyName: string;
  contactName: string;
  orderListTitle: string;
  productName: string;
  variantLabel: string | null;
  quantity: number;
  requestedAt: string;
  adminUrl: string;
};

export function BusinessPriceRequestedEmail({
  preview,
  companyName,
  contactName,
  orderListTitle,
  productName,
  variantLabel,
  quantity,
  requestedAt,
  adminUrl,
}: BusinessPriceRequestedEmailProps) {
  return (
    <Html lang="nl" dir="ltr">
      <Head />
      <Body style={styles.body}>
        <Preview>{preview}</Preview>
        <Section style={styles.outer}>
          <Container style={styles.container}>
            <Section style={styles.brandBar} />
            <Section style={styles.content}>
              <Text style={styles.brand}>DE NOTENMAN</Text>
              <Heading as="h1" style={styles.heading}>Prijs opgevraagd</Heading>
              <Text style={styles.intro}>
                {contactName} van {companyName} heeft een prijs opgevraagd voor een regel op &quot;{orderListTitle}&quot;.
              </Text>

              <Section style={styles.summary}>
                <Text style={styles.summaryLine}><strong>Product:</strong> {productName}{variantLabel ? ` (${variantLabel})` : ""}</Text>
                <Text style={styles.summaryLine}><strong>Aantal:</strong> {quantity}</Text>
                <Text style={styles.summaryLine}><strong>Opgevraagd op:</strong> {requestedAt}</Text>
              </Section>

              <Button href={adminUrl} style={styles.button}>Prijs invullen in admin</Button>
              <Text style={styles.footer}>
                Zodra je een prijs invult, kan de klant deze regel zien en meebestellen.
              </Text>
            </Section>
          </Container>
        </Section>
      </Body>
    </Html>
  );
}

const styles: Record<string, CSSProperties> = {
  body: {
    margin: 0,
    backgroundColor: "#f6f3ee",
    fontFamily: "Arial, Helvetica, sans-serif",
  },
  outer: { padding: "24px 12px" },
  container: {
    maxWidth: "600px",
    overflow: "hidden",
    border: "1px solid #ded7ca",
    borderRadius: "12px",
    backgroundColor: "#ffffff",
  },
  brandBar: { height: "5px", backgroundColor: "#e0b200" },
  content: { padding: "28px" },
  brand: {
    margin: 0,
    color: "#806600",
    fontSize: "13px",
    fontWeight: 700,
    letterSpacing: "0.08em",
  },
  heading: { margin: "12px 0", color: "#141414", fontSize: "26px", lineHeight: "1.25" },
  intro: { margin: "0 0 20px", color: "#625c53", fontSize: "16px", lineHeight: "1.55" },
  summary: { padding: "14px 16px", borderRadius: "8px", backgroundColor: "#f6f3ee" },
  summaryLine: { margin: "4px 0", color: "#333333", fontSize: "15px", lineHeight: "1.45" },
  button: {
    display: "block",
    padding: "14px 20px",
    borderRadius: "8px",
    backgroundColor: "#e0b200",
    color: "#141414",
    fontSize: "16px",
    fontWeight: 700,
    textAlign: "center",
    textDecoration: "none",
  },
  footer: { margin: "24px 0 0", color: "#625c53", fontSize: "13px", lineHeight: "1.5" },
};

export default BusinessPriceRequestedEmail;
