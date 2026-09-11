import { getPublishingSchedule } from "@socialpilot/db";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import {
  addScheduleSlotAction,
  removeScheduleSlotAction,
  toggleScheduleSlotAction,
} from "./actions";

const DAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;

const DAY_LABELS: Record<(typeof DAYS)[number], string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
};

export default async function SchedulePage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const schedule = await getPublishingSchedule(session.organizationId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Publishing Schedule</h1>
        <p className="mt-1 text-sm text-gray-600">
          Choose which days and times SocialPilot should publish, and to
          which platform. Add as many slots per day as you need.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {DAYS.map((day) => {
          const slots = schedule.slots.filter((slot) => slot.dayOfWeek === day);

          return (
            <div key={day} className="rounded-md border border-gray-200 p-4">
              <h2 className="mb-2 text-sm font-semibold">{DAY_LABELS[day]}</h2>

              {slots.length === 0 ? (
                <p className="mb-3 text-xs text-gray-500">
                  No slots — nothing will publish on this day.
                </p>
              ) : (
                <ul className="mb-3 flex flex-col gap-2">
                  {slots.map((slot) => (
                    <li
                      key={slot.id}
                      className="flex items-center gap-3 text-sm"
                    >
                      <span className="w-16 font-mono">{slot.time}</span>
                      <span className="w-20">
                        {slot.platform === "INSTAGRAM"
                          ? "Instagram"
                          : "Facebook"}
                      </span>
                      <form action={toggleScheduleSlotAction}>
                        <input type="hidden" name="slotId" value={slot.id} />
                        <input
                          type="hidden"
                          name="enabled"
                          value={String(slot.enabled)}
                        />
                        <button
                          type="submit"
                          className={
                            "text-xs underline " +
                            (slot.enabled ? "text-green-700" : "text-gray-400")
                          }
                        >
                          {slot.enabled ? "Enabled" : "Disabled"}
                        </button>
                      </form>
                      <form action={removeScheduleSlotAction}>
                        <input type="hidden" name="slotId" value={slot.id} />
                        <button
                          type="submit"
                          className="text-xs text-red-600 underline"
                        >
                          Remove
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}

              <form action={addScheduleSlotAction} className="flex items-center gap-2">
                <input type="hidden" name="dayOfWeek" value={day} />
                <input
                  type="time"
                  name="time"
                  required
                  className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                />
                <select
                  name="platform"
                  className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                >
                  <option value="INSTAGRAM">Instagram</option>
                  <option value="FACEBOOK">Facebook</option>
                </select>
                <button
                  type="submit"
                  className="rounded-md bg-black px-3 py-1 text-xs font-medium text-white"
                >
                  Add slot
                </button>
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
