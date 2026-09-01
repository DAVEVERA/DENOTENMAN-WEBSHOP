import type { CSSProperties } from "react";
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from "react-email";

export type BusinessOrderListChangedEmailItem = { name: string; quantity: number; lineTotal: string };

export type BusinessOrderListChangedEmailProps = {
  preview: string;
  contactName: string;
  companyName: string;
  title: string;
  changedDate: string;
  items: BusinessOrderListChangedEmailItem[];
  total: string;
  portalUrl: string;
};

export function BusinessOrderListChangedEmail({
  preview,
  contactName,
  companyName,
  title,
  changedDate,
  items,
  total,
  portalUrl,
}: BusinessOrderListChangedEmailProps) {
  return (
    <Html lang="nl" dir="ltr">
      <Head />
      <Body style={styles.body}>
        <Preview>{preview}</Preview>
        <Section style={styles.outer}>
          <Container style={styles.container}>
            <Section style={styles.brandBar} />
            <Section style={styles.content}>
              <Section>
                <Text style={styles.brand}>DE NOTENMAN</Text>
                <Text style={styles.pill}>Gewijzigd op {changedDate}</Text>
              </Section>
              <Heading as="h1" style={styles.heading}>Je bestellijst is aangepast, {contactName}</Heading>
              <Text style={styles.intro}>
                Fedor heeft wijzigingen doorgevoerd in &ldquo;{title}&rdquo; voor {companyName}. Bekijk de
                nieuwe inhoud voordat je afrekent.
              </Text>

              <Heading as="h2" style={styles.subheading}>Huidige inhoud</Heading>
              {items.map((item, index) => (
                <Text key={`${item.name}-${index}`} style={styles.item}>
                  {item.quantity}× {item.name} — {item.lineTotal}
                </Text>
              ))}
              <Text style={styles.total}><strong>Nieuw totaal (excl. BTW):</strong> {total}</Text>

              <Button href={portalUrl} style={styles.button}>Bekijk gewijzigde lijst en reken af</Button>
              <Text style={styles.footer}>
                Nog niet afgerekend? De aangepaste lijst staat klaar zodra je inlogt.
              </Text>
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
  brand: { display: "inline-block", margin: "0 8px 0 0", color: "#806600", fontSize: "13px", fontWeight: 700, letterSpacing: "0.08em" },
  pill: { display: "inline-block", margin: 0, padding: "2px 10px", borderRadius: "999px", backgroundColor: "#fef3c7", color: "#92400e", fontSize: "12px", fontWeight: 700 },
  heading: { margin: "12px 0", color: "#141414", fontSize: "26px", lineHeight: "1.25" },
  intro: { margin: "0 0 20px", color: "#625c53", fontSize: "16px", lineHeight: "1.55" },
  subheading: { margin: "24px 0 10px", color: "#141414", fontSize: "19px" },
  item: { margin: "7px 0", color: "#333333", fontSize: "15px", lineHeight: "1.45" },
  total: { margin: "18px 0 22px", paddingTop: "14px", borderTop: "1px solid #ded7ca", color: "#141414", fontSize: "18px" },
  button: { display: "block", padding: "14px 20px", borderRadius: "8px", backgroundColor: "#e0b200", color: "#141414", fontSize: "16px", fontWeight: 700, textAlign: "center", textDecoration: "none" },
  footer: { margin: "24px 0 0", color: "#625c53", fontSize: "13px", lineHeight: "1.5" },
};

export default BusinessOrderListChangedEmail;
