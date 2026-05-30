import api from '../lib/api'

export interface BusinessKycUpgradeInput {
  companyId: string
  businessType: 'individual' | 'company'
}

export interface UploadDocInput {
  submissionId: string
  documentType: 'license' | 'insurance'
  fileUrl: string
}

export interface CompanyStatus {
  companyId: string
  companyName: string
  kycStatus: string
  submission: {
    id: string
    status: string
    submittedAt: string | null
    reviewedAt: string | null
    reviewNote: string | null
  } | null
  businessVerification: {
    requiresLicense: boolean
    licenseVerified: boolean
    insuranceVerified: boolean
  } | null
}

export interface TrustScoreData {
  workspaceId: string
  kycVerified: boolean
  licenseVerified: boolean
  insuranceVerified: boolean
  avgRating: number
  totalScore: number
  details: {
    kycWeight: number
    licenseWeight: number
    insuranceWeight: number
    ratingWeight: number
    breakdown: {
      kycScore: number
      licenseScore: number
      insuranceScore: number
      ratingScore: number
    }
  }
  businessVerification: {
    requiresLicense: boolean
    licenseVerifiedAt: string | null
    insuranceVerifiedAt: string | null
  } | null
}

export async function startUpgrade(input: BusinessKycUpgradeInput) {
  const { data } = await api.post('/kyc/business/upgrade', input)
  return data
}

export async function uploadDocument(input: UploadDocInput) {
  const endpoint = input.documentType === 'license'
    ? '/kyc/business/upload-license'
    : '/kyc/business/upload-insurance'
  const { data } = await api.post(endpoint, input)
  return data
}

export async function getBusinessKycStatus() {
  const { data } = await api.get<{ companies: CompanyStatus[] }>('/kyc/business/status')
  return data
}

export async function getTrustScore(companyId: string) {
  const { data } = await api.get<TrustScoreData>('/kyc/business/trust-score', {
    params: { companyId },
  })
  return data
}
