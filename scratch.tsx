import { render } from 'preact-render-to-string';
import { h } from 'preact';

const a = render(<div onclick="alert(1)" onClick="alert(2)" {...{onclick: "alert(3)"}} />);
console.log("Rendered:", a);
