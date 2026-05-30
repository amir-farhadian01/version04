import { Outlet } from 'react-router-dom'
import { PhoneContainer } from '../ui/phone/PhoneContainer'

export function PublicLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-nh-bg px-4 py-5 pb-10 font-sans">
      <PhoneContainer>
        <Outlet />
      </PhoneContainer>
    </div>
  )
}