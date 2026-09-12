import { useT } from '../i18n/useLocale'
import { GitHubIcon } from './icons'

export const GITHUB_REPO_URL = 'https://github.com/redPeak5421/ictree'

export function GitHubLink() {
  const t = useT()
  return (
    <a
      className="icon-btn"
      href={GITHUB_REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t.githubRepo}
    >
      <GitHubIcon />
    </a>
  )
}
