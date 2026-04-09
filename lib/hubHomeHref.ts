/**
 * Href for “Site home” / results hub. All public hosts (including draftasticprowrestling.com) use `/`.
 */
export async function getHubHomeHref(): Promise<string> {
  return "/";
}
