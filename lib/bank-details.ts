/** Official Snappy payment accounts for electronic invoices */

export type BankAccount = {
  holder: string;
  bank: string;
  accountNumber: string;
  branch?: string;
  /** Name registered on the wallet / account (MoMo, etc.) */
  registeredName?: string;
  channel?: 'bank' | 'momo';
};

export const SNAPPY_BANK_ACCOUNTS: BankAccount[] = [
  {
    holder: 'Snappy Sampson Enterprise',
    bank: 'Prudential Bank',
    accountNumber: '0304003190019',
    channel: 'bank',
  },
  {
    holder: 'Snappy Sampson Enterprise',
    bank: 'Stanbic Bank',
    accountNumber: '9040014178591',
    branch: 'Graphic Road',
    channel: 'bank',
  },
  {
    holder: 'Snappy Sampson Enterprise',
    bank: 'MTN Mobile Money',
    accountNumber: '0550016939',
    registeredName: 'Sampson Dziwornu Amadah',
    channel: 'momo',
  },
];

export const SNAPPY_INVOICE_ISSUER = {
  brand: 'SNAPPY IMPORTS GLOBAL',
  legalName: 'Snappy Sampson Enterprise',
  contactName: 'Sampson Dziwornu Amadah',
  addressLines: [
    'Nii Teiko Din Street',
    'Awudome Estates (close to TV Africa)',
    'P.O.Box KS 48 ACCRA',
    'Ghana',
  ],
  phones: ['+233 54 751 2646', '+86 16672882842'],
  email: 'snappyimportsgh@gmail.com',
};
