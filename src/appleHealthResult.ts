import { AppleHealthShortcut_acceptCallback } from "./utils/appleHealthShortcut";

const url = new URL(window.location.href);
window.history.replaceState(null, "", window.location.pathname);
let status: ReturnType<typeof AppleHealthShortcut_acceptCallback>;
try {
  status = AppleHealthShortcut_acceptCallback(url, window.localStorage);
} catch {
  // Safari and a Home Screen app may not share storage. Logging can still succeed.
}
const messages = {
  saved: "Saved to Apple Health. You can return to VelociReps.",
  cancelled: "Sending was cancelled. Your workout remains saved in VelociReps.",
  failed: "The Shortcut couldn't finish. Check Apple Health before trying again.",
};
document.getElementById("result")!.textContent = status
  ? messages[status as keyof typeof messages]
  : "Return to VelociReps from your Home Screen. If the Shortcut showed a success message, your workout was logged. Otherwise, check Apple Health before retrying.";
