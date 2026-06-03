import { buildJSON } from "../formats/json";
import { buildLOG } from "../formats/log";
import { makeFilename, downloadContent } from "../downloadUtils";

export function shapeRuntimeTrace(trace = []) {
  return (trace || []).map((entry, index) => ({
    step: index,
    pc: entry.pc,
    sp: entry.sp ?? entry.stack?.length ?? 0,
    registers: entry.registers || {},
    stack: entry.stack || [],
    call_stack: entry.call_stack || [],
    output: entry.output || [],
    halted: !!entry.halted,
  }));
}

export function downloadRuntime_JSON(trace, filename = makeFilename("runtime-trace", "json")) {
  downloadContent(buildJSON(shapeRuntimeTrace(trace)), filename, "json");
}

export function downloadRuntime_LOG(history = [], filename = makeFilename("runtime-execution", "log")) {
  downloadContent(buildLOG(history), filename, "log");
}
