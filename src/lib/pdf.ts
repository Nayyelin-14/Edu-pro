import PDFDocument from "pdfkit";

export interface CertificateData {
  number: string;
  userName: string;
  courseTitle: string;
  issuedAt: Date;
}

/** Renders an A4-landscape certificate to a PDF buffer using standard fonts. */
export function renderCertificatePdf(data: CertificateData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 40,
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Frame
    doc
      .rect(18, 18, 779, 539)
      .lineWidth(4)
      .strokeColor("#166534")
      .stroke();
    doc.rect(28, 28, 759, 519).lineWidth(1).strokeColor("#16a34a").stroke();

    const width = 720;
    const center = 60;

    doc
      .font("Helvetica-Bold")
      .fontSize(30)
      .fillColor("#111827")
      .text("Certificate of Completion", center, 90, {
        align: "center",
        width,
      });

    doc
      .font("Helvetica")
      .fontSize(14)
      .fillColor("#6b7280")
      .text("This certifies that", center, 180, { align: "center", width });

    doc
      .font("Helvetica-Bold")
      .fontSize(32)
      .fillColor("#166534")
      .text(data.userName, center, 215, { align: "center", width });

    doc
      .font("Helvetica")
      .fontSize(14)
      .fillColor("#6b7280")
      .text("has successfully completed the course", center, 265, {
        align: "center",
        width,
      });

    doc
      .font("Helvetica-Bold")
      .fontSize(22)
      .fillColor("#111827")
      .text(data.courseTitle, center, 295, { align: "center", width });

    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor("#374151")
      .text(`Certificate No. ${data.number}`, center, 355, {
        align: "center",
        width,
      });

    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor("#374151")
      .text(`Issued on ${data.issuedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, center, 375, {
        align: "center",
        width,
      });

    doc.end();
  });
}
