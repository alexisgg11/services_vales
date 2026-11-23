import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'../main/java/com/servicesvales/modulos');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
for(const module of ['emision','autorizacion','atencion','anulacion','documentos','facturacion','gastos']){
 for(const layer of ['api','aplicacion','infraestructura'])assert.ok(fs.existsSync(path.join(root,module,layer)),`${module} requiere ${layer}`);
}
for(const file of walk(root).filter(f=>f.endsWith('.java'))){const module=path.relative(root,file).split(path.sep)[0],src=fs.readFileSync(file,'utf8');
 for(const m of src.matchAll(/import com\.servicesvales\.modulos\.([^.]+)\.infraestructura\./g))assert.equal(m[1],module,'Una capa no debe acceder al repositorio de otro módulo: '+file);
 if(file.includes(`${path.sep}aplicacion${path.sep}`))assert.ok(!/import com\.servicesvales\.modulos\.[^.]+\.api\./.test(src),'El caso de uso no debe depender de DTO HTTP: '+file);
}
console.log('PASS: siete módulos con capas y sin accesos a repositorios ajenos ni DTO HTTP en casos de uso.');
