import { redirect } from 'next/navigation';

export default function AdminWarehouseFreightPage() {
  redirect('/admin/packages?tab=freight');
}
