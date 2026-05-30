import api from '../lib/api'

export const getThreads = () => api.get('/chat').then((r) => r.data)
export const getMessages = (orderId: string) => api.get(`/chat/${orderId}`).then((r) => r.data)
export const sendMessage = (orderId: string, content: string) =>
  api.post(`/chat/${orderId}`, { content }).then((r) => r.data)
