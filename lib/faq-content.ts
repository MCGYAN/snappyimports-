/** Shared FAQ content for UI + FAQPage JSON-LD (AI / Google). */

export type FaqItem = {
  category: string;
  question: string;
  answer: string;
};

export const FAQ_CATEGORIES = [
  { id: 'all', name: 'All Questions', icon: 'ri-question-line' },
  { id: 'orders', name: 'Orders', icon: 'ri-shopping-bag-line' },
  { id: 'shipping', name: 'Shipping', icon: 'ri-truck-line' },
  { id: 'returns', name: 'Returns', icon: 'ri-arrow-go-back-line' },
  { id: 'payment', name: 'Payment', icon: 'ri-bank-card-line' },
  { id: 'account', name: 'Account', icon: 'ri-user-line' },
] as const;

export const FAQ_ITEMS: FaqItem[] = [
  {
    category: 'orders',
    question: 'How do I place an order?',
    answer:
      'Browse products, add them to your cart, and check out. Enter your name, email, and phone. Choose store pickup or doorstep delivery, then complete payment.',
  },
  {
    category: 'orders',
    question: 'I ordered as a guest. How do I see my invoice again?',
    answer:
      'Create an account or sign in with the same email you used at checkout. Your guest invoices and orders show in Order history. You can also use Find my order in the footer with your order number and email.',
  },
  {
    category: 'orders',
    question: 'Where is my order?',
    answer:
      'Sign in and open the order from your account. You will see the import journey from payment through sourcing, shipping to Ghana, and ready or delivered. If you have no account yet, use Find my order in the footer.',
  },
  {
    category: 'orders',
    question: 'Can I change or cancel my order?',
    answer:
      'Message us on WhatsApp or the contact page as soon as you can, with your order number. If payment is confirmed and sourcing has started, changes may not be possible.',
  },
  {
    category: 'shipping',
    question: 'How long does an import take?',
    answer:
      'It depends on the product and shipping method. We update your order status as goods move from China to Ghana. Ask us before you pay if you need a clearer estimate.',
  },
  {
    category: 'shipping',
    question: 'Do you deliver to my door?',
    answer:
      'Yes. At checkout choose doorstep delivery, or choose store pickup. When goods are ready in Ghana, we confirm delivery details and any delivery cost with you.',
  },
  {
    category: 'shipping',
    question: 'Where do goods arrive in Ghana?',
    answer:
      'Imports come into Ghana for clearing, then become ready for pickup or delivery. Your order page shows when that stage is reached.',
  },
  {
    category: 'shipping',
    question: 'What if I miss the delivery call?',
    answer:
      'We will try again or arrange pickup. Keep your phone number correct so we can reach you.',
  },
  {
    category: 'payment',
    question: 'How can I pay?',
    answer:
      'Smaller carts usually pay with Mobile Money at checkout. Larger carts (about GH¢2,000 and above) get an invoice with bank or MoMo transfer details. Pay the invoice, then tap I’ve paid on your order page.',
  },
  {
    category: 'payment',
    question: 'I paid the invoice. What next?',
    answer:
      'Open your order and tap I’ve paid. That tells us to confirm the transfer. After we confirm, your import journey moves forward.',
  },
  {
    category: 'payment',
    question: 'Do you accept cash on delivery?',
    answer:
      'No. Pay online by Mobile Money or by the invoice transfer details before we source and ship.',
  },
  {
    category: 'payment',
    question: 'Can I pay in parts?',
    answer:
      'For some larger imports we may agree a plan. Message us on WhatsApp before you checkout so we can confirm what is possible.',
  },
  {
    category: 'returns',
    question: 'Can I return an item?',
    answer:
      'Import orders are handled case by case. Contact us with your order number and photos if something is wrong, damaged, or not what you ordered. We will tell you the next step clearly.',
  },
  {
    category: 'returns',
    question: 'What if the item is damaged?',
    answer:
      'Tell us quickly with clear photos and your order number. We review it and work out a fix with you.',
  },
  {
    category: 'account',
    question: 'Do I need an account to buy?',
    answer:
      'No. You can checkout as a guest. Creating an account with the same email later lets you reopen invoices, tap I’ve paid, and track orders in one place.',
  },
  {
    category: 'account',
    question: 'How do I create an account?',
    answer:
      'Go to Account, then Create account. Enter your name, phone, email, and a strong password. Agree to the terms. You can sign in right away. No email confirmation step.',
  },
  {
    category: 'account',
    question: 'I forgot my password. What do I do?',
    answer:
      'On the sign-in page, use Forgot password. We email a reset link. You can also contact us on WhatsApp with the email on the order.',
  },
  {
    category: 'payment',
    question: 'What is Buy RMB on Snappy Imports Global?',
    answer:
      'Buy RMB lets you pay Ghana Cedis and receive RMB for paying Chinese suppliers. Open Buy RMB, lock the rate, get an invoice, and pay. It is for China payment needs, not a bank account product.',
  },
];
