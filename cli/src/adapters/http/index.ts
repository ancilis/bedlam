import type { CLIAdapterModule } from "@bedlam/adapter-utils";
import { printHttpStdoutEvent } from "./format-event.js";

export const httpCLIAdapter: CLIAdapterModule = {
  type: "http",
  formatStdoutEvent: printHttpStdoutEvent,
};
