import { sendEvent } from "@splitline/client";

type TrackerState = {
  endpoint: string;
  apiKey: string;
  visitorId: string;
  experimentKey: string;
  variantKey: string | null;
  track: boolean;
};

const node = document.getElementById("splitline-state");
const state: TrackerState | null = node?.textContent ? (JSON.parse(node.textContent) as TrackerState) : null;

function track(eventName: string) {
  if (!state?.track || !state.variantKey || !state.visitorId) return;
  void sendEvent({
    endpoint: state.endpoint,
    apiKey: state.apiKey,
    event: {
      experimentKey: state.experimentKey,
      variantKey: state.variantKey,
      visitorId: state.visitorId,
      eventType: "conversion",
      eventName,
    },
  });
}

document.querySelectorAll("[data-splitline-goal]").forEach((element) => {
  element.addEventListener("click", () => track("cta_click"));
});

document.querySelector("[data-splitline-form]")?.addEventListener("submit", (event) => {
  event.preventDefault();
  track("form_submit");
  document.querySelector("[data-form-panel]")?.setAttribute("hidden", "");
  document.querySelector("[data-form-thanks]")?.removeAttribute("hidden");
});
