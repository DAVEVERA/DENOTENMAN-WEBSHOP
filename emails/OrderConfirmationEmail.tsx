import type { CSSProperties } from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "react-email";
import type { Locale } from "@/lib/i18n";

export type OrderConfirmationEmailItem = {
  productName: string;
  variantLabel: string;
  quantity: number;
  lineTotal: string;
};

export type OrderConfirmationEmailProps = {
  locale: Locale;
  preview: string;
  greeting: string;
  intro: string;
  orderNumberLabel: string;
  orderNumber: string;
  orderDateLabel: string;
  orderDate: string;
  itemsTitle: string;
  productLabel: string;
  amountLabel: string;
  items: OrderConfirmationEmailItem[];
  subtotalLabel: string;
  subtotal: string;
  discountLabel?: string;
  discount?: string;
  shippingLabel: string;
  shipping: string;
  totalLabel: string;
  total: string;
  shippingHeading: string;
  shippingAddress: string[];
  viewOrderCta: string;
  orderUrl: string;
  footer: string;
};

const colors = {
  background: "#f6f3ee",
  surface: "#ffffff",
  text: "#333333",
  strong: "#141414",
  muted: "#625c53",
  border: "#ded7ca",
  accent: "#e0b200",
};

export function OrderConfirmationEmail({
  locale,
  preview,
  greeting,
  intro,
  orderNumberLabel,
  orderNumber,
  orderDateLabel,
  orderDate,
  itemsTitle,
  productLabel,
  amountLabel,
  items,
  subtotalLabel,
  subtotal,
  discountLabel,
  discount,
  shippingLabel,
  shipping,
  totalLabel,
  total,
  shippingHeading,
  shippingAddress,
  viewOrderCta,
  orderUrl,
  footer,
}: OrderConfirmationEmailProps) {
  return (
    <Html lang={locale} dir="ltr">
      <Head />
      <Body lang={locale} dir="ltr" style={bodyStyle}>
        <Preview lang={locale} dir="ltr">
          {preview}
        </Preview>
        <Section lang={locale} dir="ltr" style={outerSectionStyle}>
          <Container lang={locale} dir="ltr" style={containerStyle}>
            <Section style={brandBarStyle} />
            <Section style={headerStyle}>
              <Text style={brandStyle}>DE NOTENMAN</Text>
              <Heading as="h1" style={headingStyle}>
                {greeting}
              </Heading>
              <Text style={introStyle}>{intro}</Text>
            </Section>

            <Section style={metaSectionStyle}>
              <Text style={metaTextStyle}>
                <strong>{orderNumberLabel}:</strong> {orderNumber}
              </Text>
              <Text style={metaTextStyle}>
                <strong>{orderDateLabel}:</strong> {orderDate}
              </Text>
            </Section>

            <Section style={contentSectionStyle}>
              <Heading as="h2" style={subheadingStyle}>
                {itemsTitle}
              </Heading>
              <table width="100%" cellPadding="0" cellSpacing="0" style={receiptTableStyle}>
                <thead>
                  <tr>
                    <th scope="col" style={productHeaderStyle}>
                      {productLabel}
                    </th>
                    <th scope="col" style={amountHeaderStyle}>
                      {amountLabel}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={`${item.productName}-${item.variantLabel}-${index}`}>
                      <td style={productCellStyle}>
                        <strong>{item.quantity}× {item.productName}</strong>
                        <br />
                        <span style={variantStyle}>{item.variantLabel}</span>
                      </td>
                      <td style={amountCellStyle}>{item.lineTotal}</td>
                    </tr>
                  ))}
                  <tr>
                    <td style={summaryLabelStyle}>{subtotalLabel}</td>
                    <td style={summaryAmountStyle}>{subtotal}</td>
                  </tr>
                  {discountLabel && discount ? (
                    <tr>
                      <td style={discountLabelStyle}>{discountLabel}</td>
                      <td style={discountAmountStyle}>{discount}</td>
                    </tr>
                  ) : null}
                  <tr>
                    <td style={summaryLabelStyle}>{shippingLabel}</td>
                    <td style={summaryAmountStyle}>{shipping}</td>
                  </tr>
                  <tr>
                    <td style={totalLabelStyle}>{totalLabel}</td>
                    <td style={totalAmountStyle}>{total}</td>
                  </tr>
                </tbody>
              </table>
            </Section>

            <Section style={contentSectionStyle}>
              <Heading as="h2" style={subheadingStyle}>
                {shippingHeading}
              </Heading>
              <Text style={addressStyle}>
                {shippingAddress.map((line, index) => (
                  <span key={`${line}-${index}`}>
                    {line}
                    {index < shippingAddress.length - 1 ? <br /> : null}
                  </span>
                ))}
              </Text>
            </Section>

            <Section style={buttonSectionStyle}>
              <Button href={orderUrl} style={buttonStyle}>
                {viewOrderCta}
              </Button>
            </Section>

            <Hr style={dividerStyle} />
            <Section style={footerSectionStyle}>
              <Text style={footerStyle}>{footer}</Text>
            </Section>
          </Container>
        </Section>
      </Body>
    </Html>
  );
}

const bodyStyle: CSSProperties = {
  margin: 0,
  backgroundColor: colors.background,
  fontFamily: "Arial, Helvetica, sans-serif",
};

const outerSectionStyle: CSSProperties = { padding: "24px 12px" };

const containerStyle: CSSProperties = {
  width: "100%",
  maxWidth: "600px",
  margin: "0 auto",
  overflow: "hidden",
  border: `1px solid ${colors.border}`,
  borderRadius: "12px",
  backgroundColor: colors.surface,
};

const brandBarStyle: CSSProperties = { height: "5px", backgroundColor: colors.accent };
const headerStyle: CSSProperties = { padding: "28px 28px 18px" };
const brandStyle: CSSProperties = {
  margin: 0,
  color: "#806600",
  fontSize: "13px",
  fontWeight: 700,
  letterSpacing: "0.08em",
};
const headingStyle: CSSProperties = {
  margin: "12px 0 0",
  color: colors.strong,
  fontSize: "24px",
  lineHeight: "1.25",
};
const introStyle: CSSProperties = {
  margin: "10px 0 0",
  color: colors.muted,
  fontSize: "16px",
  lineHeight: "1.55",
};
const metaSectionStyle: CSSProperties = {
  margin: "0 28px",
  padding: "14px 16px",
  border: `1px solid ${colors.border}`,
  borderRadius: "8px",
  backgroundColor: colors.background,
};
const metaTextStyle: CSSProperties = {
  margin: "2px 0",
  color: colors.text,
  fontSize: "14px",
  lineHeight: "1.5",
  overflowWrap: "anywhere",
};
const contentSectionStyle: CSSProperties = { padding: "24px 28px 0" };
const subheadingStyle: CSSProperties = {
  margin: "0 0 12px",
  color: colors.strong,
  fontSize: "18px",
  lineHeight: "1.35",
};
const receiptTableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  color: colors.text,
  fontSize: "14px",
};
const productHeaderStyle: CSSProperties = {
  padding: "8px 0",
  borderBottom: `2px solid ${colors.strong}`,
  textAlign: "left",
};
const amountHeaderStyle: CSSProperties = {
  ...productHeaderStyle,
  width: "110px",
  textAlign: "right",
};
const productCellStyle: CSSProperties = {
  padding: "12px 8px 12px 0",
  borderBottom: `1px solid ${colors.border}`,
  lineHeight: "1.45",
};
const amountCellStyle: CSSProperties = {
  padding: "12px 0",
  borderBottom: `1px solid ${colors.border}`,
  textAlign: "right",
  whiteSpace: "nowrap",
};
const variantStyle: CSSProperties = { color: colors.muted, fontSize: "13px" };
const summaryLabelStyle: CSSProperties = { paddingTop: "10px", color: colors.muted };
const summaryAmountStyle: CSSProperties = {
  paddingTop: "10px",
  textAlign: "right",
  whiteSpace: "nowrap",
};
const discountLabelStyle: CSSProperties = {
  paddingTop: "10px",
  color: "#237a3b",
  fontWeight: 700,
};
const discountAmountStyle: CSSProperties = {
  ...discountLabelStyle,
  textAlign: "right",
  whiteSpace: "nowrap",
};
const totalLabelStyle: CSSProperties = {
  paddingTop: "12px",
  color: colors.strong,
  fontSize: "16px",
  fontWeight: 700,
};
const totalAmountStyle: CSSProperties = {
  ...totalLabelStyle,
  textAlign: "right",
  whiteSpace: "nowrap",
};
const addressStyle: CSSProperties = {
  margin: 0,
  color: colors.text,
  fontSize: "15px",
  lineHeight: "1.55",
};
const buttonSectionStyle: CSSProperties = { padding: "28px" };
const buttonStyle: CSSProperties = {
  display: "block",
  boxSizing: "border-box",
  width: "100%",
  padding: "14px 20px",
  borderRadius: "8px",
  backgroundColor: colors.accent,
  color: colors.strong,
  fontSize: "16px",
  fontWeight: 700,
  lineHeight: "20px",
  textAlign: "center",
  textDecoration: "none",
};
const dividerStyle: CSSProperties = {
  margin: "0 28px",
  border: 0,
  borderTop: `1px solid ${colors.border}`,
};
const footerSectionStyle: CSSProperties = { padding: "18px 28px 24px" };
const footerStyle: CSSProperties = {
  margin: 0,
  color: colors.muted,
  fontSize: "13px",
  lineHeight: "1.5",
};

OrderConfirmationEmail.PreviewProps = {
  locale: "nl",
  preview: "Betaling ontvangen · bestelbon voor bestelling test-order-123",
  greeting: "Bedankt voor je bestelling, Robin!",
  intro: "We hebben je betaling ontvangen. Hieronder vind je de bestelbon.",
  orderNumberLabel: "Bestelnummer",
  orderNumber: "test-order-123",
  orderDateLabel: "Besteldatum",
  orderDate: "14 augustus 2026",
  itemsTitle: "Bestelde producten",
  productLabel: "Product",
  amountLabel: "Bedrag",
  items: [
    {
      productName: "Cashewnoten gebrand ongezouten",
      variantLabel: "450 gram",
      quantity: 2,
      lineTotal: "€ 13,90",
    },
  ],
  subtotalLabel: "Subtotaal",
  subtotal: "€ 13,90",
  shippingLabel: "Verzendkosten",
  shipping: "Gratis",
  totalLabel: "Totaal",
  total: "€ 13,90",
  shippingHeading: "Verzendadres",
  shippingAddress: ["Robin de Vries", "Notenstraat 12", "1234 AB Utrecht", "Nederland"],
  viewOrderCta: "Bekijk je bestelling",
  orderUrl: "https://example.com/nl/order/test-order-123",
  footer: "Vragen over je bestelling? Beantwoord deze e-mail; we helpen je graag.",
} satisfies OrderConfirmationEmailProps;

export default OrderConfirmationEmail;
