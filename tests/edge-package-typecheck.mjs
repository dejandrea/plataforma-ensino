import ts from 'typescript';
// Offline type check using installed SDK declarations. Does not claim a Deno deploy.
const options={target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,allowImportingTsExtensions:true,resolveJsonModule:true,esModuleInterop:true,skipLibCheck:true,strict:true,noEmit:true,allowJs:true,checkJs:false,types:[],lib:['lib.es2022.d.ts','lib.dom.d.ts','lib.dom.iterable.d.ts']};
const host=ts.createCompilerHost(options);
host.resolveModuleNames=(names,file)=>names.map(name=>ts.resolveModuleName(name==='npm:@supabase/supabase-js@2'?'@supabase/supabase-js':name,file,options,ts.sys).resolvedModule);
const program=ts.createProgram(['tests/fixtures/deno-edge-globals.d.ts','supabase/functions/import-lesson-package/index.ts','supabase/functions/import-web-presentation/index.ts'],options,host);
const diagnostics=ts.getPreEmitDiagnostics(program);
if(diagnostics.length){console.log(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCurrentDirectory:ts.sys.getCurrentDirectory,getCanonicalFileName:x=>x,getNewLine:()=> '\n'}));process.exitCode=1;}
else console.log('Edge package TypeScript: passed (offline; installed SDK; not Deno runtime/deployment validation).');
