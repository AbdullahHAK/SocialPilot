import { listSocialAccounts } from "@socialpilot/db";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { disconnectAccountAction } from "./actions";

export default async function AccountsPage({
  searchParams,
}: PageProps<"/dashboard/accounts">) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const { error, connected } = await searchParams;
  const accounts = await listSocialAccounts(session.organizationId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Connected Accounts</h1>
        <a
          href="/api/meta/connect"
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
        >
          Connect Instagram / Facebook
        </a>
      </div>

      {typeof error === "string" && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {typeof connected === "string" && (
        <p className="text-sm text-green-700">
          Connected {connected} account{connected === "1" ? "" : "s"}.
        </p>
      )}

      {accounts.length === 0 ? (
        <p className="text-sm text-gray-600">
          No accounts connected yet. Connect your Facebook Page and its
          linked Instagram Business account to start publishing.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {accounts.map((account) => (
            <li
              key={account.id}
              className="flex items-center justify-between rounded-md border border-gray-200 p-4"
            >
              <div>
                <p className="text-sm font-medium">
                  {account.displayName ?? account.externalId}
                </p>
                <p className="text-xs text-gray-500">
                  {account.provider === "INSTAGRAM" ? "Instagram" : "Facebook"}{" "}
                  · {account.status}
                </p>
              </div>
              <form action={disconnectAccountAction}>
                <input type="hidden" name="accountId" value={account.id} />
                <button type="submit" className="text-xs text-red-600 underline">
                  Disconnect
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
