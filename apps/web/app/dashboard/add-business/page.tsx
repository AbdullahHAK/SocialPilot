import { getTranslations } from "next-intl/server";
import { AddBusinessForm } from "@/components/add-business-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { addBusinessAction } from "@/app/dashboard/org-actions";

export default async function AddBusinessPage() {
  const t = await getTranslations("dashboard.addBusiness");

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <AddBusinessForm action={addBusinessAction} />
      </CardContent>
    </Card>
  );
}
