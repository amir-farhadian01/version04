import { useEffect, useState, type FormEvent } from 'react'
import api from '../../lib/api'

type Level1 = { emailVerified: boolean; phoneVerified: boolean; complete: boolean }
type Field = { id: string; label: string; type: string; required: boolean; options?: Array<{ value: string; label: string }>; showIf?: { fieldId: string; equals?: unknown; in?: unknown[] }; accept?: string[] }
type BusinessSchema = { title: string; description?: string; fields: Field[] }
type UploadRow = { fieldId: string; url: string; fileName: string; mimeType: string; sizeBytes: number }

function apiMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'response' in error) {
    return (error as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Request failed'
  }
  return error instanceof Error ? error.message : 'Request failed'
}

async function uploadPrivateDocument(file: File): Promise<string> {
  const body = new FormData(); body.append('file', file)
  const response = await api.post<{ reference: string }>('/kyc/v2/documents', body, { headers: { 'Content-Type': 'multipart/form-data' } })
  return response.data.reference
}

export default function KycVerification() {
  const [level1, setLevel1] = useState<Level1 | null>(null)
  const [emailToken, setEmailToken] = useState('')
  const [phoneCode, setPhoneCode] = useState('')
  const [schema, setSchema] = useState<BusinessSchema | null>(null)
  const [schemaVersion, setSchemaVersion] = useState<number | null>(null)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [businessUploads, setBusinessUploads] = useState<UploadRow[]>([])
  const [companyId, setCompanyId] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    const [l1, form] = await Promise.all([
      api.get<Level1>('/kyc/v2/level1/me'),
      api.get<{ version: number; schema: BusinessSchema }>('/kyc/v2/business/schema/active').catch(() => null),
    ])
    setLevel1(l1.data)
    if (form) { setSchema(form.data.schema); setSchemaVersion(form.data.version) }
  }

  useEffect(() => { refresh().catch((err) => setError(apiMessage(err))) }, [])

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true); setError(null); setMessage(null)
    try { await action(); setMessage(success); await refresh() }
    catch (err) { setError(apiMessage(err)) }
    finally { setBusy(false) }
  }

  const submitLevel2 = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget)
    await run(async () => {
      const front = form.get('idFront') as File; const back = form.get('idBack') as File; const selfie = form.get('selfie') as File
      const [idFrontUrl, selfieUrl, idBackUrl] = await Promise.all([
        uploadPrivateDocument(front), uploadPrivateDocument(selfie), back?.size ? uploadPrivateDocument(back) : Promise.resolve(null),
      ])
      await api.post('/kyc/v2/level2/submit', {
        declaredLegalName: form.get('legalName'), idDocumentType: form.get('documentType'), idDocumentNumber: form.get('documentNumber'),
        idFrontUrl, idBackUrl, selfieUrl,
        address: { line1: form.get('line1'), line2: form.get('line2'), city: form.get('city'), province: form.get('province'), postalCode: form.get('postalCode'), country: 'CA' },
      })
    }, 'Level 2 submitted for administrator review.')
  }

  const uploadBusinessFile = async (field: Field, file: File) => {
    setBusy(true); setError(null)
    try {
      const reference = await uploadPrivateDocument(file)
      setBusinessUploads((current) => [...current.filter((item) => item.fieldId !== field.id), { fieldId: field.id, url: reference, fileName: file.name, mimeType: file.type, sizeBytes: file.size }])
    } catch (err) { setError(apiMessage(err)) }
    finally { setBusy(false) }
  }

  const submitBusiness = async (event: FormEvent) => {
    event.preventDefault()
    await run(() => api.post('/kyc/v2/business/submit', { companyId, answers, uploads: businessUploads }), `Level 3 schema ${schemaVersion ?? ''} submitted for review.`)
  }

  const visible = (field: Field) => {
    if (!field.showIf) return true
    const value = answers[field.showIf.fieldId]
    return 'equals' in field.showIf ? value === field.showIf.equals : field.showIf.in?.includes(value) === true
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 text-white sm:p-6">
      <header><h1 className="text-2xl font-bold">Identity & business verification</h1><p className="text-sm text-gray-400">Complete each level in order. Documents are private and previews expire after five minutes.</p></header>
      {error && <div role="alert" className="rounded-lg border border-red-700 bg-red-950 p-3">{error}<button onClick={() => refresh()} className="ml-3 underline">Retry</button></div>}
      {message && <div role="status" className="rounded-lg border border-emerald-700 bg-emerald-950 p-3">{message}</div>}

      <section className="rounded-xl border border-gray-800 bg-gray-950 p-4">
        <h2 className="text-lg font-semibold">Level 1 · Email and phone</h2>
        <p className="mb-3 text-sm text-gray-400">Email: {level1?.emailVerified ? 'Verified' : 'Not verified'} · Phone: {level1?.phoneVerified ? 'Verified' : 'Not verified'}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2"><button disabled={busy || level1?.emailVerified} onClick={() => run(() => api.post('/kyc/v2/level1/verify-email/start'), 'Verification email sent.')} className="rounded bg-blue-600 px-3 py-2 disabled:opacity-50">Send email link</button><label className="block text-sm">Email token<input value={emailToken} onChange={(e) => setEmailToken(e.target.value)} className="mt-1 w-full rounded bg-gray-900 p-2" /></label><button disabled={busy || !emailToken} onClick={() => run(() => api.post('/kyc/v2/level1/verify-email/confirm', { token: emailToken }), 'Email verified.')} className="rounded border px-3 py-2 disabled:opacity-50">Confirm email</button></div>
          <div className="space-y-2"><button disabled={busy || level1?.phoneVerified} onClick={() => run(() => api.post('/kyc/v2/level1/verify-phone/start'), 'SMS code sent.')} className="rounded bg-blue-600 px-3 py-2 disabled:opacity-50">Send SMS code</button><label className="block text-sm">Six-digit code<input inputMode="numeric" maxLength={6} value={phoneCode} onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, ''))} className="mt-1 w-full rounded bg-gray-900 p-2" /></label><button disabled={busy || phoneCode.length !== 6} onClick={() => run(() => api.post('/kyc/v2/level1/verify-phone/confirm', { code: phoneCode }), 'Phone verified.')} className="rounded border px-3 py-2 disabled:opacity-50">Confirm phone</button></div>
        </div>
      </section>

      <form onSubmit={submitLevel2} className="space-y-3 rounded-xl border border-gray-800 bg-gray-950 p-4" aria-disabled={!level1?.complete}>
        <h2 className="text-lg font-semibold">Level 2 · Identity and Canadian address</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>Legal name<input required name="legalName" className="mt-1 w-full rounded bg-gray-900 p-2" /></label>
          <label>Document type<select required name="documentType" className="mt-1 w-full rounded bg-gray-900 p-2"><option value="national_id">Identity card</option><option value="passport">Passport</option><option value="drivers_license">Driver’s licence</option></select></label>
          <label>Document number<input name="documentNumber" className="mt-1 w-full rounded bg-gray-900 p-2" /></label>
          <label>Address line 1<input required name="line1" className="mt-1 w-full rounded bg-gray-900 p-2" /></label><label>Address line 2<input name="line2" className="mt-1 w-full rounded bg-gray-900 p-2" /></label>
          <label>City<input required name="city" className="mt-1 w-full rounded bg-gray-900 p-2" /></label><label>Province<input required name="province" maxLength={2} className="mt-1 w-full rounded bg-gray-900 p-2 uppercase" /></label><label>Postal code<input required name="postalCode" placeholder="A1A 1A1" className="mt-1 w-full rounded bg-gray-900 p-2 uppercase" /></label>
          <label>ID front<input required name="idFront" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="mt-1 block w-full" /></label><label>ID back (required for ID card)<input name="idBack" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="mt-1 block w-full" /></label><label>Current selfie<input required name="selfie" type="file" accept="image/jpeg,image/png,image/webp" className="mt-1 block w-full" /></label>
        </div><button disabled={busy || !level1?.complete} className="rounded bg-emerald-600 px-4 py-2 disabled:opacity-50">Submit Level 2</button>
      </form>

      <form onSubmit={submitBusiness} className="space-y-3 rounded-xl border border-gray-800 bg-gray-950 p-4">
        <h2 className="text-lg font-semibold">Level 3 · Dynamic business verification</h2>
        <label>Business workspace ID<input required value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="mt-1 w-full rounded bg-gray-900 p-2" /></label>
        <div className="grid gap-3 sm:grid-cols-2">{schema?.fields.filter(visible).map((field) => (
          <label key={field.id}>{field.label}{field.type === 'file' ? <input required={field.required} type="file" accept={field.accept?.join(',')} onChange={(e) => e.target.files?.[0] && uploadBusinessFile(field, e.target.files[0])} className="mt-1 block w-full" /> : field.type === 'select' ? <select required={field.required} value={String(answers[field.id] ?? '')} onChange={(e) => setAnswers({ ...answers, [field.id]: e.target.value })} className="mt-1 w-full rounded bg-gray-900 p-2"><option value="">Select…</option>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : field.type === 'boolean' ? <input type="checkbox" checked={answers[field.id] === true} onChange={(e) => setAnswers({ ...answers, [field.id]: e.target.checked })} className="ml-2" /> : <input required={field.required} type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'} value={String(answers[field.id] ?? '')} onChange={(e) => setAnswers({ ...answers, [field.id]: e.target.value })} className="mt-1 w-full rounded bg-gray-900 p-2" />}</label>
        ))}</div>
        <button disabled={busy || !companyId || !schema} className="rounded bg-purple-600 px-4 py-2 disabled:opacity-50">Submit Level 3</button>
      </form>
    </main>
  )
}
