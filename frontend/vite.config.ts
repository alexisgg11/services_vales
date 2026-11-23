import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import fs from 'node:fs';
import {createHash} from 'node:crypto';
export default defineConfig({
  base: "/app/",
  plugins: [react(), tailwindcss(),{
    name:'vales-pwa',
    closeBundle(){
      const dir=path.resolve(import.meta.dirname,'dist'),index=fs.readFileSync(path.join(dir,'index.html'));
      const version=createHash('sha256').update(index).digest('hex').slice(0,16);
      const assets=fs.readdirSync(path.join(dir,'assets')).filter(n=>/\.(m?js|css)$/.test(n)).map(n=>'/app/assets/'+n);
      const file=path.join(dir,'sw.js'),sw=fs.readFileSync(file,'utf8').replace('vales-shell-v2','vales-shell-'+version)
        .replace("['/app/index.html','/app/icon.svg']",JSON.stringify(['/app/index.html','/app/icon.svg',...assets]));
      fs.writeFileSync(file,sw);
    }
  }],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8080",
      "/login": "http://127.0.0.1:8080",
      "/logout": "http://127.0.0.1:8080",
    },
  },
});
