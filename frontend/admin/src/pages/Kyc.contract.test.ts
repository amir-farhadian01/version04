import { describe, expect, it } from 'vitest'
import {
  buildBusinessReviewRequest,
  KYC_STATUS_BADGE_COLORS,
} from './Kyc'

describe('business KYC review contract', () => {
  it('uses the backend review endpoint and payload shape', () => {
    expect(
      buildBusinessReviewRequest('submission-1', 'request_resubmit', 'Please upload a current certificate.'),
    ).toEqual({
      endpoint: '/admin/kyc/business/submission-1/review',
      body: {
        action: 'request_resubmit',
        note: 'Please upload a current certificate.',
      },
    })
  })

  it('styles the persisted resubmission status as a warning', () => {
    expect(KYC_STATUS_BADGE_COLORS.resubmit_requested).toContain('warning')
  })
})
