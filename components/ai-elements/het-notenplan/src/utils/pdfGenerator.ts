import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { NutRecommendation } from '../types';

export async function generateRecommendationPdf(
  elementId: string,
  recommendation: NutRecommendation,
  userEmail?: string
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error('PDF element niet gevonden');
  }

  // Use html2canvas to capture the branded proposal card
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#F6F3EE',
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const imgWidth = 210; // A4 width in mm
  const pageHeight = 297; // A4 height in mm
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft >= 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  const filename = `HetNotenplan_Advies_${recommendation.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  pdf.save(filename);
}
