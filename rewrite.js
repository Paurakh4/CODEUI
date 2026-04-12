const fs = require('fs');
const path = 'components/dashboard/dashboard-main.tsx';
let content = fs.readFileSync(path, 'utf8');

// Colors
content = content.replace(/bg-zinc-900\/50|bg-zinc-900\/10/g, 'bg-[#141414]');
content = content.replace(/bg-zinc-900|bg-zinc-800/g, 'bg-[#141414]');
content = content.replace(/bg-zinc-950/g, 'bg-black');
content = content.replace(/border-white\/10|border-white\/5|border-zinc-700|border-zinc-800/g, 'border-[#414141]/80');
content = content.replace(/text-zinc-400|text-zinc-500|text-zinc-600/g, 'text-[#a0a0a0]');
content = content.replace(/text-zinc-200|text-zinc-300|text-zinc-100/g, 'text-white');
content = content.replace(/hover:bg-zinc-900|hover:bg-zinc-800/g, 'hover:bg-[#3a3a3a]');
content = content.replace(/hover:text-white|hover:text-zinc-200|hover:text-zinc-300/g, 'hover:text-[#faff69]');
content = content.replace(/ring-zinc-500/g, 'ring-[#faff69]');

// Buttons & Accents
content = content.replace(/bg-blue-600|hover:bg-blue-600/g, 'bg-[#1d1d1d]');
content = content.replace(/bg-blue-500/g, 'bg-[#faff69] text-[#151515]');
content = content.replace(/text-blue-500/g, 'text-[#faff69]');

content = content.replace(/bg-amber-500/g, 'bg-[#faff69]');
content = content.replace(/text-amber-500/g, 'text-[#faff69]');
content = content.replace(/hover:text-amber-400/g, 'hover:text-[#faff69]');

// Cards
content = content.replace(/bg-white\/5/g, 'bg-[#141414]');
content = content.replace(/hover:bg-white\/10/g, 'hover:bg-[#3a3a3a]');

// Border Radius
content = content.replace(/rounded-xl|rounded-2xl|rounded-3xl/g, 'rounded-[8px]');
content = content.replace(/rounded-md|rounded-lg/g, 'rounded-[4px]');

// Shadows
content = content.replace(/shadow-xl|shadow-lg/g, 'shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1)]');
content = content.replace(/shadow-sm|shadow/g, 'shadow-[0_1px_3px_rgba(0,0,0,0.1)]');

// Typography adjustments
content = content.replace(/font-medium/g, 'font-bold');

fs.writeFileSync(path, content);
console.log('Done!');
