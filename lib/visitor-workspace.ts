import { headers } from "next/headers";

export async function getWorkspaceId(): Promise<string> {
  const requestHeaders = await headers();
  const id = requestHeaders.get("x-testflow-workspace");
  if (!id || !/^guest:[a-f0-9]{64}$/.test(id)) {
    throw new Error("Visitor workspace context is missing.");
  }
  return id;
}
