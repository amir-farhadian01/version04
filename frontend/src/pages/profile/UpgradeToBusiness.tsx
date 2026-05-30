import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { StatusBar } from '../../components/ui/phone/StatusBar'
import { BottomNav, NavIcons } from '../../components/ui/phone/BottomNav'
import api from '../../lib/api'
import {
  startUpgrade,
  uploadDocument,
  getBusinessKycStatus,
  getTrustScore,
  type TrustScoreData,
} from '../../services/businessKyc'

type StepKey = 'select-type' | 'license-check' | 'insurance-check' | 'document-upload' | 'confirmation'

interface CompanyOption {
  id: string
  name: string
  kycStatus: string
}

export default function UpgradeToBusiness() {
  const navigate = useNavigate()

  const [currentStep, setCurrentStep] = useState<StepKey>('select-type')
  const [stepIndex, setStepIndex] = useState(1)

  const [businessType, setBusinessType] = useState<'individual' | 'company'>('individual')
  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState('')
  const [loadingCompanies, setLoadingCompanies] = useState(true)

  const [requiresLicense, setRequiresLicense] = useState(false)

  const [hasInsurance, setHasInsurance] = useState(false)

  const [submissionId, setSubmissionId] = useState('')
  const [licenseFileUrl, setLicenseFileUrl] = useState('')
  const [insuranceFileUrl, setInsuranceFileUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [docUploadMode, setDocUploadMode] = useState<'license' | 'insurance' | null>(null)

  const [trustScore, setTrustScore] = useState<TrustScoreData | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const steps: { key: StepKey; label: string }[] = [
    { key: 'select-type', label: 'Business Type' },
    { key: 'license-check', label: 'License Requirement' },
    { key: 'insurance-check', label: 'Insurance' },
    { key: 'document-upload', label: 'Upload Documents' },
    { key: 'confirmation', label: 'Confirmation' },
  ]

  useEffect(() => {
    const loadCompanies = async () => {
      setLoadingCompanies(true)
      try {
        const { companies: list } = await getBusinessKycStatus()
        const opts = list
          .filter((c) => c.submission?.status !== 'approved')
          .map((c) => ({
            id: c.companyId,
            name: c.companyName,
            kycStatus: c.kycStatus,
          }))
        const { data: userCompanies } = await api.get('/companies')
        const all: CompanyOption[] = [...opts]
        const seen = new Set(all.map((c) => c.id))
        for (const uc of userCompanies ?? []) {
          if (!seen.has(uc.id)) {
            all.push({ id: uc.id, name: uc.name, kycStatus: uc.kycStatus ?? '' })
            seen.add(uc.id)
          }
        }
        setCompanies(all)
        if (all.length > 0) setSelectedCompanyId(all[0].id)
      } catch {
        try {
          const { data: userCompanies } = await api.get('/companies')
          setCompanies((userCompanies ?? []).map((c: { id: string; name: string; kycStatus?: string }) => ({
            id: c.id, name: c.name, kycStatus: c.kycStatus ?? '',
          })))
          if (userCompanies?.length > 0) setSelectedCompanyId(userCompanies[0].id)
        } catch {
          setError('Could not load your companies. Please ensure you have a company set up.')
        }
      }
      setLoadingCompanies(false)
    }
    loadCompanies()
  }, [])

  const goToStep = (key: StepKey, idx: number) => {
    setCurrentStep(key)
    setStepIndex(idx)
    setError(null)
  }

  const nextStep = () => {
    const idx = stepIndex
    if (idx < 5) {
      const next = steps[idx]
      goToStep(next.key, idx + 1)
    }
  }

  const prevStep = () => {
    const idx = stepIndex - 2
    if (idx >= 0) {
      const prev = steps[idx]
      goToStep(prev.key, idx + 1)
    }
  }

  const handleTypeSelected = async () => {
    if (!selectedCompanyId) { setError('Please select a company'); return }
    setLoading(true)
    setError(null)
    try {
      const result = await startUpgrade({ companyId: selectedCompanyId, businessType })
      setSubmissionId(result.id)
      nextStep()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to start upgrade'
      setError(msg)
    }
    setLoading(false)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !submissionId || !docUploadMode) return
    setUploading(true)
    setUploadError(null)
    try {
      const placeholderUrl = `https://media.neighborly.local/uploads/business-kyc/${Date.now()}-${file.name}`
      await uploadDocument({ submissionId, documentType: docUploadMode, fileUrl: placeholderUrl })
      if (docUploadMode === 'license') setLicenseFileUrl(placeholderUrl)
      else setInsuranceFileUrl(placeholderUrl)
      setDocUploadMode(null)
    } catch (err: unknown) {
      setUploadError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Upload failed')
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDocumentsComplete = () => nextStep()

  useEffect(() => {
    if (currentStep === 'confirmation' && selectedCompanyId) {
      const loadData = async () => {
        try {
          const [statusData, scoreData] = await Promise.all([getBusinessKycStatus(), getTrustScore(selectedCompanyId)])
          const myCompany = statusData.companies.find((c) => c.companyId === selectedCompanyId)
          // company status loaded but not displayed in this version
          void myCompany
          setTrustScore(scoreData)
        } catch { /* non-critical */ }
      }
      loadData()
    }
  }, [currentStep, selectedCompanyId])

  const handleSubmitFinal = async () => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      await api.put(`/kyc/business/submit/${submissionId}`, {})
      setSubmitSuccess(true)
    } catch (err: unknown) {
      setSubmitError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to submit')
    }
    setSubmitting(false)
  }

  const renderStepIndicator = () => (
    <div className="flex gap-1.5 justify-center py-3">
      {steps.map((s, i) => {
        const isActive = i === stepIndex - 1
        const isPast = i < stepIndex - 1
        return (
          <div
            key={s.key}
            className={`w-2 h-2 rounded-full transition-all duration-200 ${
              isPast ? 'bg-nh-primary opacity-70' : isActive ? 'bg-nh-primary' : 'bg-nh-border opacity-40'
            }`}
          />
        )
      })}
    </div>
  )

  const stepTitle = (num: number, title: string) => (
    <div className="font-heading text-lg font-bold text-nh-text mb-1">Step {num}: {title}</div>
  )

  const renderStep1 = () => (
    <div className="px-[18px] py-2">
      {stepTitle(1, 'Business Type')}
      <p className="text-[13px] text-nh-text-muted mb-5 leading-relaxed">Select the type of business account you want to create, and choose which company to upgrade.</p>
      <div className="mb-5">
        <label className="text-xs font-semibold text-nh-text-secondary mb-1.5 block">Select Company</label>
        {loadingCompanies ? (
          <div className="p-3 text-[13px] text-nh-text-muted">Loading companies...</div>
        ) : companies.length === 0 ? (
          <div className="p-3 text-[13px] text-nh-warning bg-nh-warning/10 rounded-lg">No companies found. You need a company to upgrade to a business account.</div>
        ) : (
          <select value={selectedCompanyId} onChange={(e) => setSelectedCompanyId(e.target.value)} className="w-full px-[14px] py-3 bg-nh-bg border border-nh-border rounded-[10px] text-nh-text text-sm outline-none">
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name} {c.kycStatus ? `(${c.kycStatus})` : ''}</option>
            ))}
          </select>
        )}
      </div>
      <div className="mb-5">
        <label className="text-xs font-semibold text-nh-text-secondary mb-1.5 block">Business Type</label>
        <div className="flex gap-2.5">
          <button
            onClick={() => setBusinessType('individual')}
            className={`flex-1 px-3 py-[14px] rounded-xl text-sm font-semibold cursor-pointer transition-all duration-200 border-[1.5px] ${businessType === 'individual' ? 'bg-nh-primary border-nh-primary text-white' : 'bg-nh-surface border-nh-border text-nh-text'}`}
          >
            <div className="text-2xl mb-1">👤</div>Individual<div className="text-[11px] font-normal mt-1 opacity-70">Sole proprietor</div>
          </button>
          <button
            onClick={() => setBusinessType('company')}
            className={`flex-1 px-3 py-[14px] rounded-xl text-sm font-semibold cursor-pointer transition-all duration-200 border-[1.5px] ${businessType === 'company' ? 'bg-nh-primary border-nh-primary text-white' : 'bg-nh-surface border-nh-border text-nh-text'}`}
          >
            <div className="text-2xl mb-1">🏢</div>Company<div className="text-[11px] font-normal mt-1 opacity-70">Registered business</div>
          </button>
        </div>
      </div>
      <button
        onClick={handleTypeSelected}
        disabled={loading || !selectedCompanyId}
        className={`w-full py-[14px] border-0 rounded-[10px] font-semibold text-sm flex items-center justify-center gap-2 ${loading || !selectedCompanyId ? 'bg-nh-border text-nh-text-muted cursor-not-allowed' : 'bg-nh-primary text-white cursor-pointer'}`}
      >
        {loading ? 'Starting upgrade...' : 'Continue →'}
      </button>
    </div>
  )

  const renderStep2 = () => (
    <div className="px-[18px] py-2">
      {stepTitle(2, 'License Requirement')}
      <p className="text-[13px] text-nh-text-muted mb-5 leading-relaxed">Depending on your business category, you may need a professional license or certification.</p>
      <div className="p-4 bg-nh-surface rounded-xl border border-nh-border mb-4">
        <div className="text-[13px] font-semibold text-nh-text mb-2">Does your business require a professional license?</div>
        <div className="flex gap-2.5">
          <button onClick={() => { setRequiresLicense(false); nextStep() }} className="flex-1 py-2.5 bg-nh-bg border-[1.5px] border-nh-border rounded-lg text-nh-text text-[13px] font-medium cursor-pointer">No</button>
          <button onClick={() => { setRequiresLicense(true); nextStep() }} className="flex-1 py-2.5 bg-nh-bg border-[1.5px] border-nh-border rounded-lg text-nh-text text-[13px] font-medium cursor-pointer">Yes</button>
        </div>
      </div>
      <p className="text-[11px] text-nh-text-muted leading-relaxed">Examples: electrician, plumber, HVAC, automotive repair, healthcare.</p>
    </div>
  )

  const renderStep3 = () => {
    if (businessType !== 'company') {
      return (
        <div className="px-[18px] py-2">
          {stepTitle(3, 'Insurance')}
          <p className="text-[13px] text-nh-text-muted mb-5 leading-relaxed">As an individual provider, you can skip this step.</p>
          <div className="p-4 bg-nh-success/10 rounded-xl border border-nh-success/30 mb-4 flex items-center gap-2.5">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-nh-success" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <span className="text-[13px] text-nh-success">Skipped — not required for individual providers</span>
          </div>
          <button onClick={() => { nextStep() }} className="w-full py-[14px] bg-nh-primary text-white border-0 rounded-[10px] font-semibold text-sm cursor-pointer">Continue →</button>
        </div>
      )
    }
    return (
      <div className="px-[18px] py-2">
        {stepTitle(3, 'Insurance')}
        <p className="text-[13px] text-nh-text-muted mb-5 leading-relaxed">Registered companies typically require liability insurance. Do you have a valid insurance certificate?</p>
        <div className="p-4 bg-nh-surface rounded-xl border border-nh-border mb-4">
          <div className="text-[13px] font-semibold text-nh-text mb-2">Do you have liability insurance?</div>
          <div className="flex gap-2.5">
            <button onClick={() => { setHasInsurance(false); nextStep() }} className="flex-1 py-2.5 bg-nh-bg border-[1.5px] border-nh-border rounded-lg text-nh-text text-[13px] font-medium cursor-pointer">Not yet</button>
            <button onClick={() => { setHasInsurance(true); nextStep() }} className="flex-1 py-2.5 bg-nh-bg border-[1.5px] border-nh-border rounded-lg text-nh-text text-[13px] font-medium cursor-pointer">Yes, I have it</button>
          </div>
        </div>
      </div>
    )
  }

  const renderStep4 = () => (
    <div className="px-[18px] py-2">
      {stepTitle(4, 'Upload Documents')}
      <p className="text-[13px] text-nh-text-muted mb-5 leading-relaxed">Upload the required documents for verification.</p>
      <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileSelect} className="hidden" />
      {requiresLicense && (
        <div className={`p-4 bg-nh-surface rounded-xl mb-3 border ${licenseFileUrl ? 'border-nh-success/30' : 'border-nh-border'}`}>
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-[13px] font-semibold text-nh-text">Professional License</div>
              <div className="text-[11px] text-nh-text-muted">PDF, JPG, or PNG</div>
            </div>
            {licenseFileUrl ? (
              <span className="text-nh-success text-xs font-semibold">✓ Uploaded</span>
            ) : (
              <button onClick={() => { setDocUploadMode('license'); fileInputRef.current?.click() }} disabled={uploading} className="px-4 py-2 bg-nh-primary text-white border-0 rounded-lg text-xs font-semibold cursor-pointer">
                {uploading && docUploadMode === 'license' ? 'Uploading...' : 'Upload'}
              </button>
            )}
          </div>
          {licenseFileUrl && <div className="text-[11px] text-nh-text-muted break-all">{licenseFileUrl.split('/').pop()}</div>}
        </div>
      )}
      {businessType === 'company' && hasInsurance && (
        <div className={`p-4 bg-nh-surface rounded-xl mb-3 border ${insuranceFileUrl ? 'border-nh-success/30' : 'border-nh-border'}`}>
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-[13px] font-semibold text-nh-text">Insurance Certificate</div>
              <div className="text-[11px] text-nh-text-muted">PDF, JPG, or PNG</div>
            </div>
            {insuranceFileUrl ? (
              <span className="text-nh-success text-xs font-semibold">✓ Uploaded</span>
            ) : (
              <button onClick={() => { setDocUploadMode('insurance'); fileInputRef.current?.click() }} disabled={uploading} className="px-4 py-2 bg-nh-primary text-white border-0 rounded-lg text-xs font-semibold cursor-pointer">
                {uploading && docUploadMode === 'insurance' ? 'Uploading...' : 'Upload'}
              </button>
            )}
          </div>
          {insuranceFileUrl && <div className="text-[11px] text-nh-text-muted break-all">{insuranceFileUrl.split('/').pop()}</div>}
        </div>
      )}
      {!requiresLicense && businessType !== 'company' && (
        <div className="p-5 bg-nh-primary/5 rounded-xl border border-dashed border-nh-border text-center text-[13px] text-nh-text-muted mb-4">No documents required for individual providers without license requirements.</div>
      )}
      {uploadError && <div className="p-2.5 bg-nh-danger/10 rounded-lg border border-nh-danger text-xs text-nh-danger mb-3">{uploadError}</div>}
      <button onClick={handleDocumentsComplete} className="w-full py-[14px] bg-nh-primary text-white border-0 rounded-[10px] font-semibold text-sm cursor-pointer">Continue to Review →</button>
    </div>
  )

  const renderStep5 = () => (
    <div className="px-[18px] py-2">
      {stepTitle(5, 'Review & Submit')}
      {submitSuccess ? (
        <div className="text-center py-5">
          <div className="text-5xl mb-3">✅</div>
          <div className="text-base font-bold text-nh-success mb-2">Submission Complete!</div>
          <p className="text-[13px] text-nh-text-muted leading-relaxed mb-4">Your business upgrade request has been submitted for review.</p>
          <button onClick={() => navigate('/app/profile')} className="px-6 py-3 bg-nh-primary text-white border-0 rounded-[10px] font-semibold text-sm cursor-pointer">Back to Profile</button>
        </div>
      ) : (
        <>
          <div className="p-4 bg-nh-surface rounded-xl border border-nh-border mb-4">
            <div className="text-sm font-semibold text-nh-text mb-3">Upgrade Summary</div>
            <div className="text-xs text-nh-text-secondary leading-loose">
              <div><strong>Business Type:</strong> {businessType === 'individual' ? 'Individual / Sole Proprietor' : 'Registered Company'}</div>
              {requiresLicense && <div><strong>License:</strong> Required {licenseFileUrl ? '✓' : '✗'}</div>}
              {businessType === 'company' && <div><strong>Insurance:</strong> {hasInsurance ? 'Yes' : 'Not yet'} {insuranceFileUrl ? '✓' : ''}</div>}
            </div>
          </div>
          {trustScore && (
            <div className="p-4 bg-nh-surface rounded-xl border border-nh-border mb-4">
              <div className="flex justify-between items-center mb-2">
                <div className="text-sm font-semibold text-nh-text">Trust Score Preview</div>
                <div className={`text-2xl font-bold ${trustScore.totalScore >= 70 ? 'text-nh-success' : trustScore.totalScore >= 40 ? 'text-nh-warning' : 'text-nh-danger'}`}>{trustScore.totalScore}</div>
              </div>
              <div className="h-1.5 bg-nh-border rounded-sm overflow-hidden mb-2.5">
                <div className={`h-full rounded-sm transition-[width] duration-500 ${trustScore.totalScore >= 70 ? 'bg-nh-success' : trustScore.totalScore >= 40 ? 'bg-nh-warning' : 'bg-nh-danger'}`} style={{ width: `${trustScore.totalScore}%` }} />
              </div>
              {trustScore.details && (
                <div className="text-[11px] text-nh-text-muted leading-relaxed">
                  <div>KYC: {trustScore.details.breakdown.kycScore}/{trustScore.details.kycWeight}</div>
                  <div>License: {trustScore.details.breakdown.licenseScore}/{trustScore.details.licenseWeight}</div>
                  <div>Insurance: {trustScore.details.breakdown.insuranceScore}/{trustScore.details.insuranceWeight}</div>
                  <div>Rating: {trustScore.details.breakdown.ratingScore}/{trustScore.details.ratingWeight}</div>
                </div>
              )}
            </div>
          )}
          {submitError && <div className="p-2.5 bg-nh-danger/10 rounded-lg border border-nh-danger text-xs text-nh-danger mb-3">{submitError}</div>}
          <button
            onClick={handleSubmitFinal}
            disabled={submitting}
            className={`w-full py-[14px] border-0 rounded-[10px] font-semibold text-sm flex items-center justify-center gap-2 ${submitting ? 'bg-nh-border text-nh-text-muted cursor-not-allowed' : 'bg-nh-primary text-white cursor-pointer'}`}
          >
            {submitting ? 'Submitting...' : 'Submit for Review'}
          </button>
        </>
      )}
    </div>
  )

  const renderStep = () => {
    switch (currentStep) {
      case 'select-type': return renderStep1()
      case 'license-check': return renderStep2()
      case 'insurance-check': return renderStep3()
      case 'document-upload': return renderStep4()
      case 'confirmation': return renderStep5()
      default: return renderStep1()
    }
  }

  return (
    <div className="relative h-full flex flex-col bg-nh-bg">
      <StatusBar title="9:41" showNotifDot />
      <div className="flex items-center px-4 py-2.5 border-b border-nh-border gap-3 bg-nh-bg">
        <svg width="20" height="20" viewBox="0 0 24 24" className="fill-nh-text-secondary cursor-pointer" onClick={() => submitSuccess ? navigate('/app/profile') : prevStep()}>
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
        </svg>
        <span className="flex-1 text-sm font-semibold text-nh-text">Upgrade to Business</span>
      </div>
      {!submitSuccess && renderStepIndicator()}
      {!submitSuccess && (
        <div className="text-center py-1 pb-2">
          <span className="text-[11px] text-nh-text-muted font-medium">{steps[stepIndex - 1]?.label ?? ''}</span>
        </div>
      )}
      {error && <div className="mx-[18px] mb-2 p-2.5 bg-nh-danger/10 rounded-lg border border-nh-danger text-xs text-nh-danger">{error}</div>}
      <div className="flex-1 overflow-auto">{renderStep()}</div>
      <div className="h-20" />
      <BottomNav
        items={[
          { id: 'home', label: 'Home', icon: NavIcons.home },
          { id: 'social', label: 'Explorer', icon: NavIcons.social },
          { id: 'activity', label: 'Activity', icon: NavIcons.activity },
          { id: 'biz', label: 'Business', isBiz: true, icon: NavIcons.business },
        ]}
      />
    </div>
  )
}