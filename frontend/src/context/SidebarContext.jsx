import { createContext, useState } from 'react'

export const SidebarContext = createContext({ mobileOpen: false, toggle: () => {}, close: () => {} })

export function SidebarProvider({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const toggle = () => { setMobileOpen(o => !o); }
  const close  = () => setMobileOpen(false)
  return (
    <SidebarContext.Provider value={{ mobileOpen, toggle, close }}>
      {children}
    </SidebarContext.Provider>
  )
}