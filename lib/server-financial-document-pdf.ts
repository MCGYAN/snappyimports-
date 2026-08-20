import { jsPDF } from 'jspdf';
import sharp from 'sharp';
import { SNAPPY_BANK_ACCOUNTS, SNAPPY_INVOICE_ISSUER } from './bank-details';

type FinancialDocument = {
  document_number: string;
  document_type: 'invoice' | 'receipt';
  flow: 'shop' | 'rmb' | 'shipping';
  currency: string;
  amount: number;
  status: string;
  issued_at: string;
  due_at?: string | null;
  paid_at?: string | null;
  customer_email?: string | null;
  data?: Record<string, any> | null;
};

type PdfLine = {
  description: string;
  detail: string;
  quantity: number;
  unitPrice: number;
  amount: number;
};

const SERVICE_LABELS: Record<FinancialDocument['flow'], string> = {
  shop: 'Product order',
  rmb: 'Buy RMB',
  shipping: 'Shipping to Ghana',
};

const PDF_LOGO_ALIAS = 'snappy-logo';

function date(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('en-GB') : '';
}

function amount(value: number) {
  return Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Shrink logo so mobile share sheets do not choke on multi-MB invoice PDFs. */
async function preparePdfLogo(
  logo?: ArrayBuffer | null,
): Promise<{ dataUrl: string; format: 'JPEG' } | null> {
  if (!logo || logo.byteLength === 0) return null;
  try {
    const jpeg = await sharp(Buffer.from(logo))
      .rotate()
      .resize({ width: 360, withoutEnlargement: true })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: 70, mozjpeg: true })
      .toBuffer();
    return {
      dataUrl: `data:image/jpeg;base64,${jpeg.toString('base64')}`,
      format: 'JPEG',
    };
  } catch {
    return null;
  }
}

function linesFor(document: FinancialDocument): PdfLine[] {
  const data = document.data || {};
  if (document.flow === 'shop' && Array.isArray(data.items) && data.items.length) {
    return data.items.map((item: any) => {
      const quantity = Number(item.quantity) || 1;
      const total = Number(item.total_price) || 0;
      const variant = item.metadata?.color || item.metadata?.size || item.variant_name || '';
      return {
        description: item.product_name || 'Item',
        detail: variant,
        quantity,
        unitPrice: Number(item.unit_price) || total / quantity,
        amount: total,
      };
    });
  }

  if (document.flow === 'rmb') {
    const detail = [
      data.amount_to ? `Customer receives ${amount(Number(data.amount_to))} RMB` : '',
      data.rate ? `Rate ${Number(data.rate).toFixed(4)}` : '',
    ]
      .filter(Boolean)
      .join('. ');
    return [
      {
        description: 'Buy RMB',
        detail,
        quantity: 1,
        unitPrice: Number(document.amount),
        amount: Number(document.amount),
      },
    ];
  }

  const contents = Array.isArray(data.contents)
    ? data.contents
        .map(
          (entry: any) =>
            `${entry.product_name || 'Item'} x ${entry.quantity || 1}${
              entry.order_number ? ` (${entry.order_number})` : ''
            }`,
        )
        .join(', ')
    : '';
  return [
    {
      description: 'Sea freight, China to Ghana',
      detail: [
        data.tracking_id ? `Tracking ${data.tracking_id}` : '',
        data.package_name ? `Package ${data.package_name}` : '',
        contents ? `Inside: ${contents}` : '',
      ]
        .filter(Boolean)
        .join('. '),
      quantity: 1,
      unitPrice: Number(document.amount),
      amount: Number(document.amount),
    },
  ];
}

function text(
  pdf: jsPDF,
  value: unknown,
  x: number,
  y: number,
  options?: Parameters<jsPDF['text']>[3],
) {
  pdf.text(String(value ?? ''), x, y, options);
}

export async function generateFinancialDocumentPdf(
  document: FinancialDocument,
  logo?: ArrayBuffer | null,
): Promise<ArrayBuffer> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });
  const data = document.data || {};
  const receipt = document.document_type === 'receipt';
  const currency = document.currency || 'GHS';
  const pageWidth = pdf.internal.pageSize.getWidth();
  const left = 15;
  const right = pageWidth - 15;
  const preparedLogo = await preparePdfLogo(logo);

  if (preparedLogo) {
    try {
      pdf.addImage(
        preparedLogo.dataUrl,
        preparedLogo.format,
        left,
        10,
        28,
        19,
        PDF_LOGO_ALIAS,
        'FAST',
      );
    } catch {
      // The branded text header below remains if the image cannot be decoded.
    }
  }

  pdf.setTextColor(11, 31, 58);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  text(pdf, SNAPPY_INVOICE_ISSUER.brand, 49, 16);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  text(pdf, SNAPPY_INVOICE_ISSUER.addressLines.slice(0, 2).join(', '), 49, 20.5);
  text(pdf, SNAPPY_INVOICE_ISSUER.addressLines.slice(2).join(', '), 49, 24);
  text(
    pdf,
    `${SNAPPY_INVOICE_ISSUER.contactName}, ${SNAPPY_INVOICE_ISSUER.phones.join(' / ')}`,
    49,
    27.5,
  );
  text(pdf, SNAPPY_INVOICE_ISSUER.email, 49, 31);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  text(pdf, receipt ? 'RECEIPT' : 'INVOICE', right, 18, { align: 'right' });
  pdf.setFontSize(8);
  text(
    pdf,
    receipt ? 'PAID IN FULL' : 'PAYMENT REQUESTED',
    right,
    23.5,
    { align: 'right' },
  );
  pdf.setDrawColor(11, 31, 58);
  pdf.setLineWidth(0.5);
  pdf.line(left, 36, right, 36);

  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  text(pdf, 'BILL TO', left, 44);
  text(pdf, data.customer_name || 'Customer', left, 49);
  pdf.setFont('helvetica', 'normal');
  text(pdf, document.customer_email || '', left, 53.5);

  const metaX = 125;
  const valueX = right;
  const meta: Array<[string, string]> = [
    [receipt ? 'Receipt No.:' : 'Invoice No.:', document.document_number],
    ...(data.reference ? [['Reference:', String(data.reference)] as [string, string]] : []),
    ['Issue date:', date(document.issued_at)],
    ...(receipt && document.paid_at
      ? [['Payment date:', date(document.paid_at)] as [string, string]]
      : []),
    ...(!receipt && document.due_at
      ? [['Due date:', date(document.due_at)] as [string, string]]
      : []),
    ['Service:', SERVICE_LABELS[document.flow]],
  ];
  meta.forEach(([label, value], index) => {
    const rowY = 44 + index * 4.6;
    pdf.setFont('helvetica', 'bold');
    text(pdf, label, metaX, rowY);
    pdf.setFont('helvetica', 'normal');
    text(pdf, value, valueX, rowY, { align: 'right' });
  });

  let y = Math.max(72, 48 + meta.length * 4.6);
  const descriptionX = left;
  const quantityX = 118;
  const unitX = 151;
  const totalX = right;

  const tableHeader = () => {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    text(pdf, 'DESCRIPTION', descriptionX, y);
    text(pdf, 'QTY', quantityX, y, { align: 'center' });
    text(pdf, `UNIT PRICE (${currency})`, unitX, y, { align: 'right' });
    text(pdf, `AMOUNT (${currency})`, totalX, y, { align: 'right' });
    pdf.line(left, y + 2, right, y + 2);
    y += 7.5;
  };
  tableHeader();

  pdf.setFontSize(9);
  for (const line of linesFor(document)) {
    const detailLines = line.detail ? pdf.splitTextToSize(line.detail, 88) : [];
    const rowHeight = Math.max(9, 7 + detailLines.length * 3.8);
    if (y + rowHeight > 245) {
      pdf.addPage();
      y = 20;
      tableHeader();
    }
    pdf.setFont('helvetica', 'bold');
    text(pdf, line.description, descriptionX, y);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    if (detailLines.length) pdf.text(detailLines, descriptionX, y + 4.2);
    pdf.setFontSize(9);
    text(pdf, line.quantity, quantityX, y, { align: 'center' });
    text(pdf, amount(line.unitPrice), unitX, y, { align: 'right' });
    pdf.setFont('helvetica', 'bold');
    text(pdf, amount(line.amount), totalX, y, { align: 'right' });
    y += rowHeight;
  }

  y += 7;
  const summaryLabel = receipt ? `TOTAL PAID (${currency})` : `TOTAL DUE (${currency})`;
  pdf.setDrawColor(0);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  text(pdf, summaryLabel, 125, y);
  text(pdf, amount(document.amount), right, y, { align: 'right' });

  const pageHeight = pdf.internal.pageSize.getHeight();
  const paymentStartY = pageHeight - 52;

  if (receipt) {
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    text(pdf, 'PAYMENT RECEIVED', left, paymentStartY);
    pdf.setFont('helvetica', 'normal');
    const confirmation = `Snappy Imports Global confirms full payment of ${currency} ${amount(
      document.amount,
    )} for ${SERVICE_LABELS[document.flow].toLowerCase()}${
      data.reference ? ` ${data.reference}` : ''
    }. Thank you for your business.`;
    pdf.text(pdf.splitTextToSize(confirmation, right - left), left, paymentStartY + 5.5);
    pdf.setFontSize(8);
    text(
      pdf,
      'Keep this receipt. It is your proof of payment and no further amount is owed on this item.',
      left,
      paymentStartY + 16,
    );
  } else {
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    text(pdf, 'PAYMENT DETAILS:', left, paymentStartY);
    pdf.setFont('helvetica', 'normal');
    text(
      pdf,
      `Account holder: ${SNAPPY_BANK_ACCOUNTS[0]?.holder || SNAPPY_INVOICE_ISSUER.legalName}`,
      left,
      paymentStartY + 5,
    );
    if (document.flow === 'shipping') {
      pdf.setFontSize(7.5);
      pdf.setTextColor(80, 80, 80);
      const note =
        'This cedi amount is held until the due date because the dollar rate changes. After the due date, request a fresh bill from your account page.';
      pdf.text(pdf.splitTextToSize(note, right - left), left, paymentStartY + 9.5);
      pdf.setTextColor(0, 0, 0);
    }

    const boxTop = paymentStartY + (document.flow === 'shipping' ? 16 : 10);
    const boxHeight = 22;
    const boxWidth = right - left;
    const columns = SNAPPY_BANK_ACCOUNTS.length + 1;
    const colWidth = boxWidth / columns;

    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.35);
    pdf.rect(left, boxTop, boxWidth, boxHeight);

    for (let i = 1; i < columns; i++) {
      const x = left + colWidth * i;
      pdf.line(x, boxTop, x, boxTop + boxHeight);
    }

    pdf.setFontSize(7.5);
    SNAPPY_BANK_ACCOUNTS.forEach((account, index) => {
      const x = left + colWidth * index + 2;
      const title =
        account.channel === 'momo'
          ? account.bank
            ? `Mobile Money (${account.bank})`
            : 'Mobile Money'
          : account.branch
            ? `${account.bank} (${account.branch})`
            : account.bank;
      pdf.setFont('helvetica', 'bold');
      const titleLines = pdf.splitTextToSize(title, colWidth - 4);
      pdf.text(titleLines, x, boxTop + 5);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      text(pdf, account.accountNumber, x, boxTop + 5 + titleLines.length * 3.4);
      pdf.setFontSize(7.5);
    });

    if (preparedLogo) {
      try {
        const logoColLeft = left + colWidth * SNAPPY_BANK_ACCOUNTS.length;
        const logoW = Math.min(20, colWidth - 3);
        const logoH = logoW * (19 / 28);
        // Use the prepared JPEG again (tiny). Alias reuse fails in some jsPDF builds
        // and left this footer cell blank on mobile downloads.
        pdf.addImage(
          preparedLogo.dataUrl,
          preparedLogo.format,
          logoColLeft + (colWidth - logoW) / 2,
          boxTop + (boxHeight - logoH) / 2,
          logoW,
          logoH,
          `${PDF_LOGO_ALIAS}-footer`,
          'FAST',
        );
      } catch {
        // Text header already covers branding if logo fails.
      }
    }
  }

  pdf.setProperties({
    title: document.document_number,
    subject: `${receipt ? 'Receipt' : 'Invoice'} from ${SNAPPY_INVOICE_ISSUER.brand}`,
    author: SNAPPY_INVOICE_ISSUER.brand,
  });
  return pdf.output('arraybuffer');
}
