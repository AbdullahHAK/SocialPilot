import { redirect } from "next/navigation";
import { CreateContentForm } from "@/components/create-content-form";
import { getSession } from "@/lib/session";
import { generateConceptsAction } from "./actions";

export default async function CreateContentPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return <CreateContentForm action={generateConceptsAction} />;
}
