const preact = require('preact');
const render = require('preact-render-to-string');

console.log(render.render(preact.h('div', { onclick: "alert(1)", onClick: "alert(2)" })));
