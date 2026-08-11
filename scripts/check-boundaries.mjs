import {readdirSync,readFileSync,statSync} from 'node:fs';
import {join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../apps/api/src/render/',import.meta.url));
const files=[];
function walk(dir){for(const name of readdirSync(dir)){const path=join(dir,name);statSync(path).isDirectory()?walk(path):path.endsWith('.ts')&&files.push(path)}}
walk(root);
const rules=[['domain',['application','interfaces','infrastructure']],['application',['interfaces']],['infrastructure',['interfaces']]];
const errors=[];
for(const file of files){const rel=relative(root,file).replaceAll('\\','/');const layer=rel.split('/')[0];const source=readFileSync(file,'utf8');for(const[owner,forbidden]of rules)if(layer===owner)for(const target of forbidden)if(source.includes(`../${target}`)||source.includes(`/${target}/`))errors.push(`${rel} imports ${target}`)}
if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log(`Boundary gate: ${files.length} files checked`);
