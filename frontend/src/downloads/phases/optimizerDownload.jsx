import { buildCSV } from "../formats/csv";
import { buildJSON } from "../formats/json";
import { makeFilename, downloadContent } from "../downloadUtils";
import { shapeTAC } from "./irDownload";

export function shapeOptimizedIR(optimizedTac = []) {
  return shapeTAC(optimizedTac);
}

export function downloadOptimizedIR_JSON(optimizedTac, filename = makeFilename("optimizer-ir", "json")) {
  downloadContent(buildJSON(shapeOptimizedIR(optimizedTac)), filename, "json");
}

export function downloadOptimizedIR_CSV(optimizedTac, filename = makeFilename("optimizer-ir", "csv")) {
  downloadContent(buildCSV(shapeOptimizedIR(optimizedTac)), filename, "csv");
}
