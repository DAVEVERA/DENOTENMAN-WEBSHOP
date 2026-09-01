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

export type NewOrderNotificationEmailItem = {
  name: string;
  quantity: number;
  lineTotal: string;
};

export type NewOrderNotificationEmailProps = {
  preview: string;
  orderNumber: string;
  orderDate: string;
  customerName: string;
  customerEmail: string;
  delivery: string;
  items: NewOrderNotificationEmailItem[];
  total: string;
  adminUrl: string;
};

export function NewOrderNotificationEmail({
  preview,
  orderNumber,
  orderDate,
  customerName,
  customerEmail,
  delivery,
  items,
  total,
  adminUrl,
}: NewOrderNotificationEmailProps) {
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
              <Heading as="h1" style={styles.heading}>Nieuwe bestelling geplaatst</Heading>
              <Text style={styles.intro}>
                De betaling is bevestigd. Dit is de enige interne e-mail voor deze bestelling.
              </Text>

              <Section style={styles.summary}>
                <Text style={styles.summaryLine}><strong>Bestelnummer:</strong> {orderNumber}</Text>
                <Text style={styles.summaryLine}><strong>Besteld op:</strong> {orderDate}</Text>
                <Text style={styles.summaryLine}><strong>Klant:</strong> {customerName}</Text>
                <Text style={styles.summaryLine}><strong>E-mail:</strong> {customerEmail}</Text>
                <Text style={styles.summaryLine}><strong>Levering:</strong> {delivery}</Text>
              </Section>

              <Heading as="h2" style={styles.subheading}>Bestelde producten</Heading>
              {items.map((item, index) => (
                <Text key={`${item.name}-${index}`} style={styles.item}>
                  {item.quantity}× {item.name} — {item.lineTotal}
                </Text>
              ))}
              <Text style={styles.total}><strong>Totaal:</strong> {total}</Text>

              <Button href={adminUrl} style={styles.button}>Open bestelling in admin</Button>
              <Text style={styles.footer}>
                Latere betaal-, verzend- of statuswijzigingen sturen geen extra interne e-mail.
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
  subheading: { margin: "24px 0 10px", color: "#141414", fontSize: "19px" },
  item: { margin: "7px 0", color: "#333333", fontSize: "15px", lineHeight: "1.45" },
  total: {
    margin: "18px 0 22px",
    paddingTop: "14px",
    borderTop: "1px solid #ded7ca",
    color: "#141414",
    fontSize: "18px",
  },
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

export default NewOrderNotificationEmail;
