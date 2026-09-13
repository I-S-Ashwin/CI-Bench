const esbuild=require('esbuild');
require('./bridge.cjs');
esbuild.buildSync({entryPoints:['frontend/main.jsx'],bundle:true,minify:true,sourcemap:true,outfile:'static/react/app.js',define:{'process.env.NODE_ENV':'"production"'},loader:{'.jsx':'jsx'},target:['es2020']});
console.log('React production assets built in static/react');
require('node:fs').copyFileSync('frontend/index.html','static/index.html');
