import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../lib/api'
import { uploadDocument, uploadPrivateKycDocument } from '../businessKyc'

vi.mock('../../lib/api', () => ({
  default: { post: vi.fn() },
}))

describe('business KYC document upload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uploads the file to private storage and returns its opaque reference', async () => {
    const file = new File(['document'], 'license.pdf', { type: 'application/pdf' })
    vi.mocked(api.post).mockResolvedValue({ data: { reference: 'kyc-document://document-1' } })

    const reference = await uploadPrivateKycDocument(file)

    expect(reference).toBe('kyc-document://document-1')
    expect(api.post).toHaveBeenCalledOnce()
    const [path, body, config] = vi.mocked(api.post).mock.calls[0]
    expect(path).toBe('/kyc/v2/documents')
    expect(body).toBeInstanceOf(FormData)
    expect((body as FormData).get('file')).toBe(file)
    expect(config).toEqual({ headers: { 'Content-Type': 'multipart/form-data' } })
  })

  it('rejects a non-private upload reference', async () => {
    const file = new File(['document'], 'license.pdf', { type: 'application/pdf' })
    vi.mocked(api.post).mockResolvedValue({ data: { reference: 'https://media.example/license.pdf' } })

    await expect(uploadPrivateKycDocument(file)).rejects.toThrow('invalid private reference')
  })

  it('attaches only the private reference to the business submission', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 'submission-1' } })

    await uploadDocument({
      submissionId: 'submission-1',
      documentType: 'license',
      fileUrl: 'kyc-document://document-1',
    })

    expect(api.post).toHaveBeenCalledWith('/kyc/business/upload-license', {
      submissionId: 'submission-1',
      documentType: 'license',
      fileUrl: 'kyc-document://document-1',
    })
  })
})
