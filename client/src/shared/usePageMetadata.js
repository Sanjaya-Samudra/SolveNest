import { useEffect } from 'react'

const titles = { '/': 'Academic support with clarity', '/method': 'The SolveNest Method', '/domains': 'Study Domains', '/plans': 'Plans & Estimates', '/why-solvenest': 'Why SolveNest', '/help': 'Help Centre', '/connect': 'Contact SolveNest', '/analyze': 'Analyze Your Task', '/login': 'Sign In', '/register': 'Create Account', '/reset-password': 'Reset Password' }
export function usePageMetadata(path) {
  useEffect(() => {
    const role = /^\/(student|expert|admin|superadmin)(?:\/|$)/.exec(path)?.[1]
    const title = role ? ({ student: 'Student Workspace', expert: 'Expert Workspace', admin: 'Admin Operations', superadmin: 'Super Admin Governance' })[role] : titles[path] || (path.startsWith('/policy/') ? 'SolveNest Policies' : 'SolveNest')
    document.title = `${title} | SolveNest`
    let robots = document.querySelector('meta[name="robots"]')
    if (!robots) { robots = document.createElement('meta'); robots.name = 'robots'; document.head.appendChild(robots) }
    const indexable = ['/','/method','/domains','/plans','/why-solvenest','/help','/connect'].includes(path)
    robots.content = indexable ? 'index, follow' : 'noindex, nofollow'
    document.querySelector('link[rel="canonical"]')?.remove()
    if (indexable) { const canonical = document.createElement('link'); canonical.rel = 'canonical'; canonical.href = `${window.location.origin}${path}`; document.head.appendChild(canonical) }
  }, [path])
}
