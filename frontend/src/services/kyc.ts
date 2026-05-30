import api from '../lib/api'

export const getKycStatus = () => api.get('/kyc/status').then((r) => r.data)
export const submitKyc = (formData: FormData) =>
  api.post('/kyc/submit', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data)
