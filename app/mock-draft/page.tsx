import { getMockDraftPool } from "@/lib/mockDraftPool";
import { MockDraftApp } from "./MockDraftApp";

export const metadata = {
  title: "Mock Draft",
  description: "Practice a live snake draft against computer managers before you start a league.",
};

export const revalidate = 1800;

export default async function MockDraftPage() {
  const pool = await getMockDraftPool();
  return <MockDraftApp pool={pool} />;
}
