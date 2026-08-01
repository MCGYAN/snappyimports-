import { redirect } from 'next/navigation';

/** Old fake confirmation route. Send people to the real returns help page. */
export default function ReturnConfirmationPage() {
  redirect('/returns');
}
