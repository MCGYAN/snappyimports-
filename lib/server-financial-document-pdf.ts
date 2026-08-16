import { jsPDF } from 'jspdf';
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

function date(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('en-GB') : '';
}

function amount(value: number) {
  return Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const data = document.data || {};
  const receipt = document.document_type === 'receipt';
  const currency = document.currency || 'GHS';
  const pageWidth = pdf.internal.pageSize.getWidth();
  const left = 15;
  const right = pageWidth - 15;

  if (logo) {
    try {
      const base64 = Buffer.from(logo).toString('base64');
      pdf.addImage(`data:image/png;base64,${base64}`, 'PNG', left, 12, 30, 18);
    } catch {
      // The branded text header below remains if the image cannot be decoded.
    }
  }

  pdf.setTextColor(11, 31, 58);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  text(pdf, SNAPPY_INVOICE_ISSUER.brand, 49, 16);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  text(pdf, SNAPPY_INVOICE_ISSUER.addressLines.slice(0, 2).join(', '), 49, 20);
  text(pdf, SNAPPY_INVOICE_ISSUER.addressLines.slice(2).join(', '), 49, 23.5);
  text(
    pdf,
    `${SNAPPY_INVOICE_ISSUER.contactName}, ${SNAPPY_INVOICE_ISSUER.phones.join(' / ')}`,
    49,
    27,
  );
  text(pdf, SNAPPY_INVOICE_ISSUER.email, 49, 30.5);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(19);
  text(pdf, receipt ? 'RECEIPT' : 'INVOICE', right, 18, { align: 'right' });
  pdf.setFontSize(7);
  text(
    pdf,
    receipt ? 'PAID IN FULL' : 'PAYMENT REQUESTED',
    right,
    23,
    { align: 'right' },
  );
  pdf.setDrawColor(11, 31, 58);
  pdf.setLineWidth(0.5);
  pdf.line(left, 35, right, 35);

  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  text(pdf, 'BILL TO', left, 43);
  text(pdf, data.customer_name || 'Customer', left, 48);
  pdf.setFont('helvetica', 'normal');
  text(pdf, document.customer_email || '', left, 52);

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
    const y = 43 + index * 4.2;
    pdf.setFont('helvetica', 'bold');
    text(pdf, label, metaX, y);
    pdf.setFont('helvetica', 'normal');
    text(pdf, value, valueX, y, { align: 'right' });
  });

  let y = Math.max(70, 47 + meta.length * 4.2);
  const descriptionX = left;
  const quantityX = 118;
  const unitX = 151;
  const totalX = right;

  const tableHeader = () => {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    text(pdf, 'DESCRIPTION', descriptionX, y);
    text(pdf, 'QTY', quantityX, y, { align: 'center' });
    text(pdf, `UNIT PRICE (${currency})`, unitX, y, { align: 'right' });
    text(pdf, `AMOUNT (${currency})`, totalX, y, { align: 'right' });
    pdf.line(left, y + 2, right, y + 2);
    y += 7;
  };
  tableHeader();

  pdf.setFontSize(8);
  for (const line of linesFor(document)) {
    const detailLines = line.detail ? pdf.splitTextToSize(line.detail, 88) : [];
    const rowHeight = Math.max(8, 6 + detailLines.length * 3.5);
    if (y + rowHeight > 260) {
      pdf.addPage();
      y = 20;
      tableHeader();
    }
    pdf.setFont('helvetica', 'bold');
    text(pdf, line.description, descriptionX, y);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    if (detailLines.length) pdf.text(detailLines, descriptionX, y + 4);
    pdf.setFontSize(8);
    text(pdf, line.quantity, quantityX, y, { align: 'center' });
    text(pdf, amount(line.unitPrice), unitX, y, { align: 'right' });
    pdf.setFont('helvetica', 'bold');
    text(pdf, amount(line.amount), totalX, y, { align: 'right' });
    y += rowHeight;
    pdf.setDrawColor(180);
    pdf.line(left, y - 3, right, y - 3);
  }

  y += 4;
  const summaryLabel = receipt ? `TOTAL PAID (${currency})` : `TOTAL DUE (${currency})`;
  pdf.setDrawColor(0);
  pdf.line(125, y - 3, right, y - 3);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  text(pdf, summaryLabel, 125, y);
  text(pdf, amount(document.amount), right, y, { align: 'right' });
  y += 11;

  pdf.line(left, y - 4, right, y - 4);
  pdf.setFontSize(8);
  if (receipt) {
    text(pdf, 'PAYMENT RECEIVED', left, y);
    pdf.setFont('helvetica', 'normal');
    const confirmation = `Snappy Imports Global confirms full payment of ${currency} ${amount(
      document.amount,
    )} for ${SERVICE_LABELS[document.flow].toLowerCase()}${
      data.reference ? ` ${data.reference}` : ''
    }. Thank you for your business.`;
    pdf.text(pdf.splitTextToSize(confirmation, right - left), left, y + 5);
    pdf.setFontSize(7);
    text(
      pdf,
      'Keep this receipt. It is your proof of payment and no further amount is owed on this item.',
      left,
      y + 14,
    );
  } else {
    text(pdf, 'PAYMENT DETAILS', left, y);
    pdf.setFont('helvetica', 'normal');
    let paymentY = y + 5;
    for (const account of SNAPPY_BANK_ACCOUNTS) {
      const label = account.channel === 'momo' ? 'Mobile Money' : 'Bank';
      const details = `${label}: ${account.bank}${
        account.branch ? ` (${account.branch})` : ''
      }, Account No. ${account.accountNumber}`;
      text(pdf, details, left, paymentY);
      paymentY += 4.5;
    }
  }

  pdf.setProperties({
    title: document.document_number,
    subject: `${receipt ? 'Receipt' : 'Invoice'} from ${SNAPPY_INVOICE_ISSUER.brand}`,
    author: SNAPPY_INVOICE_ISSUER.brand,
  });
  return pdf.output('arraybuffer');
}
