import api from '../lib/api'

export type PaymentSession = {
  id: string
  status: string
  amount: number
  currency: string
  paymentUrl: string
  createdAt: string
}

export async function createPaymentSession(orderId: string): Promise<PaymentSession> {
  const res = await api.post<{ session: PaymentSession }>(`/orders/${orderId}/payments/session`)
  return res.data.session
}

export async function submitDispute(orderId: string, reason: string): Promise<void> {
  await api.post(`/orders/${orderId}/dispute`, { reason })
}
