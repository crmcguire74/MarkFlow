const TurndownService = require('turndown');
const turndownPluginGfm = require('turndown-plugin-gfm');
const tables = turndownPluginGfm.tables;

const turndownService = new TurndownService();
turndownService.use(tables);

const html = "<table><thead><tr><th>Header 1</th><th>Header 2</th></tr></thead><tbody><tr><td>Data 1</td><td>Data 2</td></tr></tbody></table>";
console.log(turndownService.turndown(html));
