import { siteConfig } from "@/config/site"
import { RootRedirect } from "./root-redirect"

/** There is no landing page: the root opens the morning brief. */
export default function Home() {
  return <RootRedirect href={siteConfig.home} />
}
