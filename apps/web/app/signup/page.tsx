import { redirect } from "next/navigation";

/** Direct account creation is no longer part of the funnel - visitors pick a
 * plan and pay first, then connect their accounts, and only then create
 * their login at /create-account. This route stays as a redirect for any
 * old links. */
export default function SignupPage() {
  redirect("/pricing");
}
