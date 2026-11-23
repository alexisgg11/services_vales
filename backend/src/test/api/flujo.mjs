import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const base=process.env.VALES_TEST_URL||'http://127.0.0.1:18085';
const claveDemo=process.env.VALES_DEMO_PASSWORD;
if(!claveDemo)throw new Error('Define VALES_DEMO_PASSWORD con la clave de la base de demostración aislada.');
if(new URL(base).hostname!=='127.0.0.1'||new URL(base).port!=='18085')throw new Error('Esta prueba con registros nuevos requiere la instancia aislada en 127.0.0.1:18085.');
class Session {
 cookies=new Map(); csrf=null;
 async request(url,body,{status=200,csrf=true}={}){
  const headers={Accept:'application/json',Cookie:[...this.cookies].map(([k,v])=>k+'='+v).join('; ')};
  if(body!==undefined){if(csrf){if(!this.csrf)this.csrf=await this.request('/api/csrf');headers[this.csrf.header]=this.csrf.token;}headers['Content-Type']='application/json';}
  const r=await fetch(base+url,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'});
  for(const c of r.headers.getSetCookie()){const [k,v]=c.split(';')[0].split('=');this.cookies.set(k,v);}
  const text=await r.text();assert.equal(r.status,status,url+' '+text);return text?JSON.parse(text):null;
 }
 async login(name){this.csrf=await this.request('/api/csrf');const r=await fetch(base+'/login',{method:'POST',headers:{Cookie:[...this.cookies].map(([k,v])=>k+'='+v).join('; '),[this.csrf.header]:this.csrf.token,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:name,password:claveDemo}),redirect:'manual'});assert.equal(r.status,302);assert.ok(!r.headers.get('location')?.includes('error'),'login '+name);for(const c of r.headers.getSetCookie()){const[k,v]=c.split(';')[0].split('=');this.cookies.set(k,v);}this.csrf=null;return this;}
}
const anonymous=new Session();await anonymous.request('/api/aplicacion',undefined,{status:401});
await anonymous.request('/api/v1/autorizacion/vales',{vales:[1]},{status:401,csrf:false});
const op=await new Session().login('demo.operativo.piura'),jefe=await new Session().login('demo.jefe.piura'),grifo=await new Session().login('demo.grifo.algarrobos'),conta=await new Session().login('demo.contabilidad'),admin=await new Session().login('demo.admin');
const ctx=await op.request('/api/aplicacion');
await op.request('/api/v1/autorizacion/vales',{vales:[1]},{status:403,csrf:false});
const hoy=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Lima'}).format(new Date());
const contrato=ctx.cuenta.contratos.find(c=>c.proveedor==='20000000001'&&c.activo&&c.inicio<=hoy&&c.fin>=hoy);
assert.ok(contrato,'contrato de demostración vigente');
const suministro=Object.keys(contrato.precios)[0];
const persona=await op.request('/api/v1/identidad/dni',{dni:'99000001'});assert.equal(persona.origen,'Demostración ficticia');
await conta.request('/api/v1/identidad/dni',{dni:'99000001'},{status:403});
await op.request('/api/v1/identidad/dni',{dni:'x'},{status:422});
const recommendations=await op.request('/api/v1/emision/recomendaciones',{fecha:hoy,modalidad:'CONTRATO',suministro,galones:2,costoKm:.5,latitud:-5.19,longitud:-80.63});assert.ok(recommendations.some(r=>r.proveedor===contrato.proveedor));
const payload={dni:ctx.cuenta.trabajador.dni,proveedor:contrato.proveedor,suministro,cantidad:2,observacion:'QA módulos '+randomUUID(),fecha:hoy,centro:ctx.cuenta.trabajador.centro,localidad:ctx.cuenta.trabajador.localidad,unidadMovil:ctx.cuenta.maquinaria.find(u=>u.cod_zonal===ctx.cuenta.trabajador.zonal)?.codigo||null,sinContrato:false,tercero:null,destino:null};
const created=await op.request('/api/v1/emision/vales',payload),vale=created.vales.find(v=>v.id_vale===created.id);assert.ok(vale);assert.equal(vale.estado_vale,0);
await op.request('/api/v1/autorizacion/vales',{vales:[vale.id_vale]},{status:403});
await jefe.request('/api/v1/autorizacion/vales',{vales:[vale.id_vale]});
const atencion='/api/v1/atencion/vales/'+vale.id_qr;
await op.request(atencion+'/validar-dni',{dni:payload.dni},{status:403});
await grifo.request(atencion+'/validar-dni',{dni:'99000001'},{status:422});
assert.deepEqual(await grifo.request(atencion+'/validar-dni',{dni:payload.dni}),{nombre:ctx.cuenta.nombre,tipo:'TRABAJADOR'});
const price=await grifo.request(atencion+'/precio?fecha='+hoy);
const att = {
  fecha: hoy, cantidad: 1.25, precio: price.precio, precioConfirmado: null,
  dniPresentado: payload.dni, identidadVerificada: true,
};
await grifo.request(atencion+'/atencion',{...att,cantidad:2.01},{status:422});
await grifo.request(atencion+'/atencion',{...att,identidadVerificada:false},{status:422});
await grifo.request(atencion+'/atencion',{...att,dniPresentado:'99000001'},{status:422});
const used=await grifo.request(atencion+'/atencion',att);assert.equal(used.vale.estado_vale,3);assert.match(used.vale.ticket,/^T\d{14}$/);
await grifo.request(atencion+'/atencion',att,{status:422});
const emitidoTercero = await op.request('/api/v1/emision/vales', {
  ...payload, suministro: 'REGULAR', sinContrato: true, tercero: '99000001', destino: 'Servicio de prueba',
});
await jefe.request('/api/v1/autorizacion/vales', { vales: [emitidoTercero.id] });
const valeTercero = emitidoTercero.vales.find(v => v.id_vale === emitidoTercero.id);
const atencionTercero = '/api/v1/atencion/vales/' + valeTercero.id_qr;
const validarTercero = atencionTercero + '/validar-dni';
await grifo.request(validarTercero, { dni: payload.dni }, { status: 422 });
assert.deepEqual(await grifo.request(validarTercero, { dni: '99000001' }), { nombre: persona.nombre, tipo: 'TERCERO' });
const precioTercero = await grifo.request(atencionTercero + '/precio?fecha=' + hoy);
const despachoTercero = { ...att, precio: precioTercero.precio, dniPresentado: '99000001' };
await grifo.request(atencionTercero + '/atencion', { ...despachoTercero, dniPresentado: payload.dni }, { status: 422 });
const terceroAtendido = await grifo.request(atencionTercero + '/atencion', despachoTercero);
assert.equal(terceroAtendido.vale.estado_vale, 3);
assert.equal(terceroAtendido.vale.tercero, persona.nombre);
const emission={vales:[vale.id_vale],solicitud:randomUUID(),fecha:hoy};
const [invoice,simultaneous]=await Promise.all([grifo.request('/api/v1/facturacion/grifo',emission),grifo.request('/api/v1/facturacion/grifo',emission)]);assert.equal(invoice.codigo_factura,simultaneous.codigo_factura);assert.match(invoice.numero,/^\d{8,15}$/);assert.equal(Number(invoice.total),Number(used.vale.importe));
const repeat=await grifo.request('/api/v1/facturacion/grifo',emission);assert.equal(invoice.codigo_factura,repeat.codigo_factura);
await grifo.request('/api/v1/facturacion/grifo',{...emission,solicitud:randomUUID()},{status:422});
await op.request('/api/v1/facturacion/grifo',emission,{status:403});
const accounting=await conta.request('/api/aplicacion'),registered=accounting.cuenta.facturas.find(f=>String(f.codigo_factura)===String(invoice.codigo_factura));assert.deepEqual(registered.tickets,[used.vale.ticket]);
await conta.request('/api/v1/facturacion/facturas/'+invoice.codigo_factura+'/vales',{vales:[vale.id_vale]});
const expense=await conta.request('/api/v1/gastos?mes='+hoy.slice(0,7)+'-01');assert.ok(expense.vales.some(v=>String(v.id_vale)===vale.id_vale));
const another = await op.request('/api/v1/emision/vales', payload);
const cancelPath = '/api/v1/anulacion/vales/' + another.id;
const cancelQr = another.vales.find(v => v.id_vale === another.id).id_qr;
await jefe.request('/api/v1/autorizacion/vales', { vales: [another.id] });
await op.request(cancelPath, { motivo: '\n \t' }, { status: 422 });
const cancelContext = await op.request(cancelPath, { motivo: '  Prueba aislada de anulación  ' });
assert.equal(cancelContext.vales.find(v => v.id_vale === another.id).estado_vale, 4);
const cancelled = await op.request('/api/v1/documentos/' + cancelQr);
assert.equal(cancelled.vale.estado_vale, 4);
assert.equal(cancelled.vale.observacion_anulacion, 'Prueba aislada de anulación');
await op.request(cancelPath, { motivo: 'Segundo intento' }, { status: 422 });
await grifo.request('/api/v1/atencion/vales/' + cancelQr + '/atencion', att, { status: 422 });
await jefe.request('/api/v1/autorizacion/unidades');await admin.request('/api/administracion');
const pub=await anonymous.request('/api/publico/vales/'+vale.id_qr);assert.equal(pub.estado,3);assert.ok(!('trabajador'in pub));
console.log('PASS: siete APIs, permisos, DNI, recomendación, atención única, factura automática e idempotente, conciliación, gastos y QR público.');
