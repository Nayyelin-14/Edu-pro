import { redirect } from "next/navigation";

export default async function UserIndexPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  redirect(`/${userId}/profile`);
}