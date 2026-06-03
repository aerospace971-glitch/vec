import lexer     from "./lexer.phase";
import parser    from "./parser.phase";
import semantic  from "./semantic.phase";
import ir        from "./ir.phase";
import optimizer from "./optimizer.phase";
import codegen   from "./codegen.phase";

export const BUILD_PHASES = [lexer, parser, semantic, ir, optimizer, codegen];
