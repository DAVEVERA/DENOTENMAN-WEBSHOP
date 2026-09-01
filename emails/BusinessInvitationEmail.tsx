import type { CSSProperties } from "react";
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from "react-email";

export type BusinessInvitationEmailProps = {
  preview: string;
  contactName: string;
  companyName: string;
  invitationUrl: string;
};

export function BusinessInvitationEmail({ preview, contactName, companyName, invitationUrl }: BusinessInvitationEmailProps) {
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
              <Heading as="h1" style={styles.heading}>Welkom bij De Notenman zakelijk, {contactName}</Heading>
              <Text style={styles.intro}>
                Fedor heeft een zakelijke omgeving voor {companyName} klaargezet. Hier vind je straks je
                bestellijsten, facturen en betaalstatus.
              </Text>
              <Button href={invitationUrl} style={styles.button}>Activeer mijn zakelijke omgeving</Button>
              <Text style={styles.small}>
                Werkt de knop niet? Kopieer deze link: {invitationUrl}
              </Text>
              <Text style={styles.footer}>
                Deze persoonlijke link is 72 uur geldig en kan eenmaal worden gebruikt. Vragen? Beantwoord
                deze e-mail of neem contact op met Fedor.
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
  brand: { margin: 0, color: "#806600", fontSize: "13px", fontWeight: 700, letterSpacing: "0.08em" },
  heading: { margin: "12px 0", color: "#141414", fontSize: "26px", lineHeight: "1.25" },
  intro: { margin: "0 0 20px", color: "#625c53", fontSize: "16px", lineHeight: "1.55" },
  button: { display: "block", padding: "14px 20px", borderRadius: "8px", backgroundColor: "#e0b200", color: "#141414", fontSize: "16px", fontWeight: 700, textAlign: "center", textDecoration: "none" },
  small: { margin: "16px 0 0", color: "#625c53", fontSize: "13px", lineHeight: "1.5", wordBreak: "break-all" },
  footer: { margin: "20px 0 0", paddingTop: "16px", borderTop: "1px solid #ded7ca", color: "#625c53", fontSize: "13px", lineHeight: "1.5" },
};

export default BusinessInvitationEmail;
