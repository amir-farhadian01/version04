import api from '../lib/api'

export type ContractVersionStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'superseded'

export type ContractVersion = {
  id: string
  versionNumber: number
  status: ContractVersionStatus
  title: string
  termsMarkdown: string
  policiesMarkdown: string | null
  scopeSummary: string | null
  amount: number | null
  currency: string | null
  sentAt: string | null
  reviewedAt: string | null
  reviewNote: string | null
  createdAt: string
}

export type ContractBundle = {
  contract: {
    id: string
    orderId: string
    currentVersionId: string | null
    currentVersion: ContractVersion | null
  } | null
  versions: ContractVersion[]
  events: { id: string; actionType: string; actorRole: string; createdAt: string; note: string | null }[]
}

export async function fetchContractBundle(orderId: string): Promise<ContractBundle> {
  const res = await api.get<ContractBundle>(`/orders/${orderId}/contracts`)
  return res.data
}

export async function approveContract(orderId: string, versionId: string): Promise<ContractVersion> {
  const res = await api.post<{ version: ContractVersion }>(`/orders/${orderId}/contracts/${versionId}/approve`)
  return res.data.version
}

export async function rejectContract(
  orderId: string,
  versionId: string,
  note: string,
  requestEdit: boolean,
): Promise<ContractVersion> {
  const res = await api.post<{ version: ContractVersion }>(
    `/orders/${orderId}/contracts/${versionId}/reject`,
    { note, requestEdit },
  )
  return res.data.version
}
