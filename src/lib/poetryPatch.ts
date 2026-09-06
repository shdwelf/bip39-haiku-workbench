import { SYLLABLE_EXCEPTIONS } from "./syllables";

const BROKEN_COUNTER =
  'function hr(n){const e=n.toLowerCase().replace(/[^a-z]/g,"");if(!e)return 0;if(e.length<=3)return 1;const t="aeiouy";let a=0,r=!1;for(const l of e){const c=t.includes(l);c&&!r&&a++,r=c}return e.endsWith("e")&&a>1&&a--,e.endsWith("le")&&a>1&&a--,Math.max(1,a)}';

const BROKEN_LINE_BUILDER =
  'function ig(n,e,t={}){const a=[],r=[];let l=0;const c=t.kigo||(t.season?rS(n,t.season):void 0),d=c?J(n,sS):-1,f=t.kireji&&n()>.5?J(n,oR):void 0;for(;l<e;){let p,g;if(c&&a.length===d)p=c,g=hr(p);else if(f&&a.length===lR())p=f,g=hr(p);else{const m=J(n,Object.keys(we));p=J(n,we[m]),g=hr(p)}if(l+g<=e||l===0)a.push(p),r.push(g),l+=g;else if(e-l<=2){const m=Object.values(we).flat().filter(v=>hr(v)<=e-l);if(m.length)p=J(n,m),g=hr(p),a.push(p),r.push(g),l+=g;else break}else break}return{text:a.join(" "),syllables:r,total:l}}';

const STRICT_VALIDATOR =
  'function fR(n,e){const t=Nx[n]?.pattern||[],a=e.map(l=>l.split(" ").map(hr).reduce((c,d)=>c+d,0)),r=[];t.length!==a.length&&r.push(`Expected ${t.length} lines, got ${a.length}`);for(let l=0;l<Math.min(t.length,a.length);l++)t[l]!==a[l]&&r.push(`Line ${l+1}: expected ${t[l]} syllables, got ${a[l]}`);return{valid:r.length===0,expected:t,actual:a,errors:r}}';

// This is the browser-bundle equivalent of src/lib/syllables.ts. The uploaded
// Gen2 file is compiled and has no module seam, so its closed-over `hr` function
// must be replaced before the document executes in srcdoc.
const FIXED_COUNTER = `const $haikuSyllableExceptions=${JSON.stringify(SYLLABLE_EXCEPTIONS)};function hr(n){let e=n.toLowerCase().trim().replace(/[^a-z0-9-]/g,"");if(!e)return 0;const t=$haikuSyllableExceptions[e];if(t!==void 0)return t;if(e.includes("-"))return e.split("-").reduce((u,o)=>u+hr(o),0);if(e.length<=3)return 1;const a=e;e=e.replace(/(?:[^laeiouy]es|ed|[^aeiouy]e)$/,"").replace(/^y/,"");const r=e.match(/[aeiouy]{1,2}/g);let l=r?r.length:1;return /[^aeiouy]le$/.test(a)&&l++,Math.max(1,l)}`;

// The old builder abandoned a line whenever a randomly selected word was too
// large and more than two syllables remained. It also accepted an oversized
// first word unconditionally. Select only words that fit the remainder and use
// a known one-syllable fallback, so every emitted line reaches its target.
const FIXED_LINE_BUILDER =
  'function ig(n,e,t={}){const a=[],r=[];let l=0;const c=t.kigo||(t.season?rS(n,t.season):void 0),d=c?J(n,sS):-1,f=t.kireji&&n()>.5?J(n,oR):void 0;for(;l<e;){let p,g;if(c&&a.length===d)p=c,g=hr(p);else if(f&&a.length===lR())p=f,g=hr(p);else{const m=Object.values(we).flat().filter(v=>{const A=hr(v);return A>0&&A<=e-l});p=m.length?J(n,m):"wind",g=hr(p)}if(!(g>0&&l+g<=e)){const m=Object.values(we).flat().filter(v=>{const A=hr(v);return A>0&&A<=e-l});p=m.length?J(n,m):"wind",g=hr(p)}a.push(p),r.push(g),l+=g}return{text:a.join(" "),syllables:r,total:l}}';

function findExactlyOnce(html: string, signature: string, label: string): number {
  const first = html.indexOf(signature);
  if (first < 0) throw new Error(`Cannot apply Gen2 Poetry patch: ${label} signature is missing`);
  if (html.indexOf(signature, first + signature.length) >= 0) {
    throw new Error(`Cannot apply Gen2 Poetry patch: ${label} signature is ambiguous`);
  }
  return first;
}

function replaceExactlyOnce(html: string, broken: string, fixed: string, label: string): string {
  const first = findExactlyOnce(html, broken, label);
  return `${html.slice(0, first)}${fixed}${html.slice(first + broken.length)}`;
}

/**
 * Repair the Poetry engine without replacing the rest of the uploaded app.
 * Validation remains strict: every line must equal its form's target; 4 or 6
 * syllables never pass as a five-syllable third line.
 */
export function patchGen2Poetry(html: string): string {
  // Do not silently preserve or introduce a ±1 tolerance while repairing the
  // generator. This signature uses direct integer equality for every line.
  findExactlyOnce(html, STRICT_VALIDATOR, "strict validator");
  const withCounter = replaceExactlyOnce(html, BROKEN_COUNTER, FIXED_COUNTER, "syllable counter");
  return replaceExactlyOnce(withCounter, BROKEN_LINE_BUILDER, FIXED_LINE_BUILDER, "line builder");
}

export const GEN2_POETRY_PATCH_SIGNATURES = {
  brokenCounter: BROKEN_COUNTER,
  brokenLineBuilder: BROKEN_LINE_BUILDER,
  fixedCounter: FIXED_COUNTER,
  fixedLineBuilder: FIXED_LINE_BUILDER,
  strictValidator: STRICT_VALIDATOR,
} as const;
